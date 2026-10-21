import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildStarterFiles } from './lib/starter-files.ts';

export const STARTERS_DIR = fileURLToPath(
  new URL('../public/folhas/', import.meta.url),
);

await mkdir(STARTERS_DIR, { recursive: true });
for (const [name, bytes] of await buildStarterFiles()) {
  await writeFile(`${STARTERS_DIR}${name}`, bytes);
}
