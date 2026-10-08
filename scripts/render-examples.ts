import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createNodeRenderer } from '../src/engine/typst-node.ts';
import type { TemplateId } from '../src/engine/renderer.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const EXAMPLES_DIR = `${ROOT}examples/`;

const renderer = await createNodeRenderer();
const failures: string[] = [];

for (const file of (await readdir(EXAMPLES_DIR)).sort()) {
  if (!file.endsWith('.json')) continue;
  const report = JSON.parse(
    await readFile(`${EXAMPLES_DIR}${file}`, 'utf8'),
  ) as { tipo: TemplateId };
  if (!existsSync(`${ROOT}templates/${report.tipo}.typ`)) continue;

  const name = file.replace(/\.json$/, '');
  const { pdf, warnings } = await renderer.render(report.tipo, report);
  if (warnings.length > 0) {
    failures.push(`${name}:\n${warnings.join('\n')}`);
    continue;
  }
  await writeFile(`${EXAMPLES_DIR}${name}.pdf`, pdf);
  console.log(`examples/${name}.pdf`);
}

if (failures.length > 0) {
  console.error(failures.join('\n\n'));
  process.exit(1);
}
