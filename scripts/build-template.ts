import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { TEMPLATE_SPEC } from './template-spec.ts';
import { writeWorkbook } from './lib/workbook-writer.ts';

export const TEMPLATE_PATH = fileURLToPath(
  new URL('../public/modelo-tesouraria.xlsx', import.meta.url),
);

await writeFile(TEMPLATE_PATH, await writeWorkbook(TEMPLATE_SPEC));
