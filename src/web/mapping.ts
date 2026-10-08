import Papa from 'papaparse';
import { MOVIMENTOS_COLUMNS } from '@/core/input/columns';
import { applyMapping, readCsv, type ColumnMapping } from '@/core/input/csv';
import type { Cell, RawTable } from '@/core/input/raw-table';
import type { InputFile } from '@/core/pipeline';
import { normaliseHeader } from '@/core/text';

export type MappingField = keyof typeof MOVIMENTOS_COLUMNS;

export const MAPPING_FIELDS = (
  Object.keys(MOVIMENTOS_COLUMNS) as MappingField[]
).map((key) => ({
  key,
  label: MOVIMENTOS_COLUMNS[key].header,
  required: MOVIMENTOS_COLUMNS[key].required,
}));

export const PREVIEW_ROWS = 5;

export function suggestMapping(header: readonly string[]): ColumnMapping {
  const normalised = header.map(normaliseHeader);
  const entries = MAPPING_FIELDS.flatMap(({ key, label }) => {
    const index = normalised.indexOf(normaliseHeader(label));
    return index < 0 ? [] : [[key, index] as const];
  });
  return Object.fromEntries(entries);
}

export function missingRequiredFields(mapping: ColumnMapping): string[] {
  return MAPPING_FIELDS.filter(
    ({ key, required }) => required && mapping[key] === undefined,
  ).map(({ label }) => label);
}

export function mappedPreview(
  table: RawTable,
  mapping: ColumnMapping,
): { header: readonly string[]; rows: readonly (readonly Cell[])[] } {
  const mapped = applyMapping(table, mapping);
  return { header: mapped.header, rows: mapped.rows.slice(0, PREVIEW_ROWS) };
}

export function mappedFile(
  name: string,
  table: RawTable,
  mapping: ColumnMapping,
): InputFile {
  const mapped = applyMapping(table, mapping);
  const text = Papa.unparse(
    {
      fields: [...mapped.header],
      data: mapped.rows.map((row) => row.map((cell) => cell ?? '')),
    },
    { delimiter: ';', newline: '\n' },
  );
  const leadingBlankLines = '\n'.repeat(Math.max(table.firstDataRow - 2, 0));
  return {
    name,
    bytes: new TextEncoder().encode(leadingBlankLines + text),
  };
}

export function unrecognisedCsv(file: InputFile): RawTable | null {
  if (!file.name.toLowerCase().endsWith('.csv')) return null;
  const table = readCsv(file.name, file.bytes);
  return table.tab === null && table.header.length > 0 ? table : null;
}
