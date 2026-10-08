import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildExampleJson } from './lib/example-json.ts';

const EXAMPLES_DIR = fileURLToPath(new URL('../examples/', import.meta.url));

await mkdir(EXAMPLES_DIR, { recursive: true });
for (const [name, json] of await buildExampleJson()) {
  await writeFile(`${EXAMPLES_DIR}${name}`, json);
}
