import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertPinnedVersion,
  patchGlueFile,
  patchWebCompilerGlue,
} from './typst-glue-patch.ts';

const require = createRequire(import.meta.url);
const webCompilerDir = dirname(
  require.resolve('@myriaddreamin/typst-ts-web-compiler/package.json'),
);
const typstTsDir = dirname(
  require.resolve('@myriaddreamin/typst.ts/package.json'),
);

describe('typst glue patch', () => {
  it.each([
    join(webCompilerDir, 'pkg/typst_ts_web_compiler.mjs'),
    join(webCompilerDir, 'pkg/wasm-pack-shim.mjs'),
    join(typstTsDir, 'dist/esm/init.mjs'),
  ])('leaves no eval path in the installed %s', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(
      /new Function\((getStringFromWasm0|'m')/,
    );
  });

  it('is idempotent on an already patched file', () => {
    const once = patchGlueFile(
      'web-compiler-glue',
      patchWebCompilerGlue(
        'a = new Function(getStringFromWasm0(arg0, arg1)); b = new Function(getStringFromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3));',
      ),
    );

    expect(patchGlueFile('web-compiler-glue', once)).toBe(once);
  });

  it('fails loudly when an upgrade changes the glue', () => {
    expect(() => patchGlueFile('web-compiler-glue', 'const x = 1;')).toThrow(
      /Typst glue changed/,
    );
  });

  it('rejects any typst.ts release other than the pinned one', () => {
    expect(() => {
      assertPinnedVersion('@myriaddreamin/typst.ts', '0.7.0');
    }).not.toThrow();
    expect(() => {
      assertPinnedVersion('@myriaddreamin/typst.ts', '0.7.1');
    }).toThrow(/exactly 0\.7\.0/);
  });

  it('pins the installed packages to the supported release', () => {
    for (const dir of [webCompilerDir, typstTsDir]) {
      const { version } = JSON.parse(
        readFileSync(join(dir, 'package.json'), 'utf8'),
      ) as { version: string };
      expect(() => {
        assertPinnedVersion(dir, version);
      }).not.toThrow();
    }
  });
});
