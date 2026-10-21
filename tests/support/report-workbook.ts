import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import type { ReportContext } from '../../src/core/pipeline.ts';
import type { ReportTipo } from '../../src/core/reports/index.ts';
import { GENERATOR_VERSION } from '../../src/core/version.ts';
import {
  config,
  filledRows,
  layoutRows,
  worksheet,
  type TestRows,
} from './report-sheet.ts';

export const V1_FIXTURE = 'fixtures/v1/tesouraria.xlsx';
export const V1_TEMPLATE = 'fixtures/v1/modelo-tesouraria.xlsx';

export const CTX: ReportContext = {
  config,
  now: '2026-10-07T12:00:00',
  generatorVersion: GENERATOR_VERSION,
};

export async function withReportSheets(
  path: string,
  sheets: Readonly<Record<string, TestRows>>,
): Promise<Uint8Array> {
  const workbook = XLSX.read(await readFile(path), { type: 'buffer' });
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, worksheet(rows), name);
  }
  return new Uint8Array(
    XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer,
  );
}

export function withOnlySheets(
  sheets: Readonly<Record<string, TestRows>>,
): Uint8Array {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, worksheet(rows), name);
  }
  return new Uint8Array(
    XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer,
  );
}

export async function readParams(
  name: string,
): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(`fixtures/v1/params/${name}.json`, 'utf8'),
  ) as Record<string, unknown>;
}

export function sheetRows(
  tipo: ReportTipo,
  params: Readonly<Record<string, unknown>>,
  without: readonly string[] = [],
): TestRows {
  const kept = Object.fromEntries(
    Object.entries(params).filter(([key]) => !without.includes(key)),
  );
  return filledRows(tipo, kept);
}

export async function sheetFrom(
  fixture: string,
  tipo: ReportTipo,
  overrides: Readonly<Record<string, unknown>> = {},
  without: readonly string[] = [],
): Promise<TestRows> {
  return sheetRows(
    tipo,
    { ...(await readParams(fixture)), ...overrides },
    without,
  );
}

export function withoutLabel(rows: TestRows, label: string): TestRows {
  return rows.filter((row) => row[0] !== label);
}

export const emptySheetRows = layoutRows;
