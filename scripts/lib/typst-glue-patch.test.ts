import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  patchDynamicImportHelper,
  patchTypstGlue,
  patchWebCompilerGlue,
} from './typst-glue-patch';

const require = createRequire(import.meta.url);
const gluePath =
  require.resolve('@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler.mjs');
const typstTsInit = join(
  dirname(require.resolve('@myriaddreamin/typst.ts/package.json')),
  'dist/esm/init.mjs',
);

describe('typst glue patch', () => {
  it('removes every eval path from the installed web-compiler glue', () => {
    const patched = patchTypstGlue(gluePath, readFileSync(gluePath, 'utf8'));

    expect(patched).toBeDefined();
    expect(patched).not.toMatch(/new Function\(getStringFromWasm0/);
  });

  it('leaves unrelated modules alone', () => {
    expect(patchTypstGlue('/repo/src/main.ts', 'new Function("x")')).toBe(
      undefined,
    );
  });

  it('replaces the dynamic-import helper in the typst.ts init module', () => {
    const init = readFileSync(typstTsInit, 'utf8');

    expect(patchTypstGlue(typstTsInit, init)).not.toContain(
      "new Function('m', 'return import(m)')",
    );
  });

  it('fails loudly when an upgrade changes the glue', () => {
    expect(() => patchWebCompilerGlue('const changed = 1;')).toThrow(
      /Typst glue changed/,
    );
    expect(() => patchDynamicImportHelper('const changed = 1;')).toThrow(
      /Typst glue changed/,
    );
  });
});
