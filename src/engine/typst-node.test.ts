import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { defaultManifest } from './assets';
import helloSample from './hello-sample.json' with { type: 'json' };
import type { Renderer } from './renderer';
import { createNodeRenderer } from './typst-node';

const hasPoppler = spawnSync('pdffonts', ['-v']).error === undefined;

function poppler(tool: 'pdffonts' | 'pdfdetach', pdf: Uint8Array): string {
  const dir = mkdtempSync(join(tmpdir(), 'engine-'));
  try {
    const file = join(dir, 'out.pdf');
    writeFileSync(file, pdf);
    const args = tool === 'pdfdetach' ? ['-list', file] : [file];
    return spawnSync(tool, args, { encoding: 'utf8' }).stdout;
  } finally {
    rmSync(dir, { recursive: true });
  }
}

function latin1(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('latin1');
}

describe('createNodeRenderer', () => {
  let renderer: Renderer;

  beforeAll(async () => {
    renderer = await createNodeRenderer();
  });

  it('renders a PDF with no warnings', async () => {
    const { pdf, warnings } = await renderer.render('hello', helloSample);

    expect(latin1(pdf.subarray(0, 5))).toBe('%PDF-');
    expect(warnings).toEqual([]);
  });

  it.skipIf(!hasPoppler)('embeds only Lato and Carter One faces', async () => {
    const { pdf } = await renderer.render('hello', helloSample);

    const names = poppler('pdffonts', pdf)
      .split('\n')
      .slice(2)
      .filter(Boolean)
      .map((line) => /^\S+\+(\S+)/.exec(line)?.[1]);

    expect(names.sort()).toEqual([
      'CarterOne',
      'Lato-Bold',
      'Lato-BoldItalic',
      'Lato-Italic',
      'Lato-Regular',
    ]);
  });

  it('warns about a font family missing from the manifest', async () => {
    const withoutCarterOne = await createNodeRenderer({
      manifest: {
        ...defaultManifest,
        fonts: defaultManifest.fonts.filter(
          (f) => !f.endsWith('CarterOne.ttf'),
        ),
      },
    });

    const { warnings } = await withoutCarterOne.render('hello', helloSample);

    expect(warnings.join('\n')).toContain(
      'warning: /templates/hello.typ:17:13: unknown font family: carter one',
    );
  });

  it('rejects when the template cannot be compiled', async () => {
    await expect(renderer.render('pegada', helloSample)).rejects.toThrow(
      /error: \/templates\/pegada\.typ: failed to load file/,
    );
  });

  describe('report attachment', () => {
    it('embeds the report JSON when attachReport is true', async () => {
      const { pdf } = await renderer.render('hello', helloSample);

      expect(latin1(pdf)).toContain('/EmbeddedFile');
      if (hasPoppler)
        expect(poppler('pdfdetach', pdf)).toContain('report.json');
    });

    it('embeds nothing when attachReport is false', async () => {
      const report = {
        ...helloSample,
        trace: { ...helloSample.trace, attachReport: false },
      };

      const { pdf } = await renderer.render('hello', report);

      expect(latin1(pdf)).not.toContain('/EmbeddedFile');
    });
  });
});
