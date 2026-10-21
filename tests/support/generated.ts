import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { InputFile } from '../../src/core/pipeline.ts';
import { loadDataset } from '../../src/core/pipeline.ts';

export const GENERATED = fileURLToPath(
  new URL('../../fixtures/generated/', import.meta.url),
);

export async function readGenerated(path: string): Promise<InputFile> {
  return {
    name: path.split('/').pop() ?? path,
    bytes: new Uint8Array(await readFile(`${GENERATED}${path}`)),
  };
}

export async function loadGenerated(path: string) {
  return loadDataset([await readGenerated(path)]);
}
