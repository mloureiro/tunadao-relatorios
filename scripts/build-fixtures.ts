import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFixtureFiles } from './lib/fixture-files.ts';

export const GENERATED_DIR = fileURLToPath(
  new URL('../fixtures/generated/', import.meta.url),
);

for (const [path, bytes] of await buildFixtureFiles()) {
  const target = `${GENERATED_DIR}${path}`;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
}
