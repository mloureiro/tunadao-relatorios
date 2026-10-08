import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { createNodeRenderer } from '../../src/engine/typst-node.ts';
import type { TemplateId } from '../../src/engine/renderer.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const EXAMPLES_DIR = `${ROOT}examples/`;
const BASELINES_DIR = `${ROOT}tests/visual/baselines/`;
const ACTUAL_DIR = `${ROOT}tests/visual/actual/`;
const DIFF_DIR = `${ROOT}tests/visual/diff/`;

const RESOLUTION = '72';
const PIXEL_THRESHOLD = 0.1;
const MAX_DIFFERING_SHARE = 0.0002;

const update = process.argv.includes('--update');

function rasterise(pdf: Uint8Array, directory: string): string[] {
  const file = join(directory, 'report.pdf');
  writeFileSync(file, pdf);
  const result = spawnSync(
    'pdftoppm',
    ['-r', RESOLUTION, '-png', file, join(directory, 'page')],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(
      `pdftoppm failed: ${result.stderr || String(result.error)}`,
    );
  }
  return readdirSync(directory)
    .filter((name) => name.startsWith('page-') && name.endsWith('.png'))
    .sort()
    .map((name) => join(directory, name));
}

function readPng(path: string): PNG {
  return PNG.sync.read(readFileSync(path));
}

function exampleNames(): string[] {
  return readdirSync(EXAMPLES_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.replace(/\.json$/, ''))
    .sort();
}

function baselineNames(example: string): string[] {
  return readdirSync(BASELINES_DIR).filter(
    (name) => name.startsWith(`${example}-`) && name.endsWith('.png'),
  );
}

function pageName(example: string, index: number): string {
  return `${example}-${String(index + 1).padStart(2, '0')}.png`;
}

function compare(actualPath: string, baselinePath: string, diffPath: string) {
  const actual = readPng(actualPath);
  const baseline = readPng(baselinePath);
  if (actual.width !== baseline.width || actual.height !== baseline.height) {
    return { share: 1, reason: 'page size changed' };
  }
  const diff = new PNG({ width: actual.width, height: actual.height });
  const differing = pixelmatch(
    actual.data,
    baseline.data,
    diff.data,
    actual.width,
    actual.height,
    { threshold: PIXEL_THRESHOLD },
  );
  const share = differing / (actual.width * actual.height);
  if (share > MAX_DIFFERING_SHARE)
    writeFileSync(diffPath, PNG.sync.write(diff));
  return { share, reason: '' };
}

mkdirSync(BASELINES_DIR, { recursive: true });
rmSync(ACTUAL_DIR, { recursive: true, force: true });
rmSync(DIFF_DIR, { recursive: true, force: true });
mkdirSync(ACTUAL_DIR, { recursive: true });
mkdirSync(DIFF_DIR, { recursive: true });

const renderer = await createNodeRenderer();
const failures: string[] = [];
const scratch = mkdtempSync(join(tmpdir(), 'visual-'));

try {
  for (const example of exampleNames()) {
    const report = JSON.parse(
      readFileSync(`${EXAMPLES_DIR}${example}.json`, 'utf8'),
    ) as { tipo: TemplateId };
    const { pdf, warnings } = await renderer.render(report.tipo, report);
    if (warnings.length > 0) {
      failures.push(`${example}: ${warnings.join('; ')}`);
      continue;
    }

    const directory = join(scratch, example);
    mkdirSync(directory);
    const pages = rasterise(pdf, directory);
    const names = pages.map((_, index) => pageName(example, index));
    pages.forEach((page, index) => {
      writeFileSync(
        `${ACTUAL_DIR}${pageName(example, index)}`,
        readFileSync(page),
      );
    });

    if (update) {
      for (const stale of baselineNames(example)) {
        rmSync(`${BASELINES_DIR}${stale}`);
      }
      names.forEach((name) => {
        writeFileSync(
          `${BASELINES_DIR}${name}`,
          readFileSync(`${ACTUAL_DIR}${name}`),
        );
      });
      console.log(
        `${example}: ${String(pages.length)} baseline page(s) written`,
      );
      continue;
    }

    const expected = baselineNames(example).sort();
    if (expected.length !== names.length) {
      failures.push(
        `${example}: ${String(names.length)} page(s) rendered, ${String(expected.length)} in the baseline`,
      );
      continue;
    }
    names.forEach((name) => {
      const baselinePath = `${BASELINES_DIR}${name}`;
      if (!existsSync(baselinePath)) {
        failures.push(`${name}: no baseline`);
        return;
      }
      const { share, reason } = compare(
        `${ACTUAL_DIR}${name}`,
        baselinePath,
        `${DIFF_DIR}${name}`,
      );
      const percent = (share * 100).toFixed(3);
      if (share > MAX_DIFFERING_SHARE) {
        failures.push(`${name}: ${reason || `${percent}% of pixels differ`}`);
      } else {
        console.log(`${name}: ${percent}%`);
      }
    });
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`Visual regression failed:\n${failures.join('\n')}`);
  process.exit(1);
}
