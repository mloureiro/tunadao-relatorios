import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defaultManifest, type AssetManifest } from './assets';
import type { Renderer } from './renderer';
import { createTypstSession } from './typst-session';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);

export interface NodeRendererOptions {
  manifest?: AssetManifest;
}

async function readFiles(
  paths: readonly string[],
): Promise<Map<string, Uint8Array>> {
  const entries = await Promise.all(
    paths.map(
      async (path) =>
        [path, new Uint8Array(await readFile(repoRoot + path))] as const,
    ),
  );
  return new Map(entries);
}

export async function createNodeRenderer(
  options: NodeRendererOptions = {},
): Promise<Renderer> {
  const manifest = options.manifest ?? defaultManifest;
  const wasm = await readFile(
    require.resolve('@myriaddreamin/typst-ts-web-compiler/wasm'),
  );
  const fonts = await readFiles(manifest.fonts);
  const files = await readFiles([...manifest.templates, manifest.logo]);
  return createTypstSession({
    wasm: new Uint8Array(wasm),
    fonts: [...fonts.values()],
    files,
  });
}
