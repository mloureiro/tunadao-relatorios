import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import {
  assertPinnedVersion,
  patchGlueFile,
  type GlueFile,
} from './lib/typst-glue-patch.ts';

const require = createRequire(import.meta.url);

function packageDir(name: string): string {
  const manifest = require.resolve(`${name}/package.json`);
  const { version } = JSON.parse(readFileSync(manifest, 'utf8')) as {
    version: string;
  };
  assertPinnedVersion(name, version);
  return dirname(manifest);
}

const webCompiler = packageDir('@myriaddreamin/typst-ts-web-compiler');
const typstTs = packageDir('@myriaddreamin/typst.ts');

const targets: [string, GlueFile][] = [
  [join(webCompiler, 'pkg/typst_ts_web_compiler.mjs'), 'web-compiler-glue'],
  [join(webCompiler, 'pkg/wasm-pack-shim.mjs'), 'dynamic-import-helper'],
  [join(typstTs, 'dist/esm/init.mjs'), 'dynamic-import-helper'],
];

for (const [file, kind] of targets) {
  const code = readFileSync(file, 'utf8');
  const patched = patchGlueFile(kind, code);
  if (patched !== code) writeFileSync(file, patched);
}

rmSync(join(process.cwd(), 'node_modules/.vite'), {
  recursive: true,
  force: true,
});
