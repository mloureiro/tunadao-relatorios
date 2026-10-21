import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import { loadConfig } from '../../src/core/config/schema.ts';
import type { ReportTipo } from '../../src/core/reports/index.ts';
import {
  REPORT_SPECS,
  type BlockKind,
  type ReportSpec,
} from '../../src/core/sheets/catalogue.ts';
import {
  gridFromWorksheet,
  type SheetGrid,
} from '../../src/core/sheets/grid.ts';
import { buildLayout } from '../../src/core/sheets/layout.ts';

export const config = loadConfig(
  JSON.parse(await readFile('config/config.json', 'utf8')),
);

export type TestCell =
  | string
  | number
  | boolean
  | null
  | { readonly f: string; readonly v?: string | number | boolean };

export type TestRows = TestCell[][];

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

export function serial(iso: string): number {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  return (Date.UTC(year, month - 1, day) - EXCEL_EPOCH_UTC) / DAY_MS;
}

export function worksheet(
  rows: readonly (readonly TestCell[])[],
): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet(
    rows.map((row) =>
      row.map((cell) =>
        typeof cell === 'object' && cell !== null ? null : cell,
      ),
    ),
  );
  rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (typeof cell !== 'object' || cell === null) return;
      const type =
        typeof cell.v === 'string'
          ? 's'
          : typeof cell.v === 'boolean'
            ? 'b'
            : 'n';
      sheet[XLSX.utils.encode_cell({ r, c })] = {
        t: type,
        f: cell.f,
        ...(cell.v === undefined ? {} : { v: cell.v }),
      };
    });
  });
  sheet['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(rows.length, 1) - 1, c: 2 },
  });
  return sheet;
}

export function gridOf(
  rows: readonly (readonly TestCell[])[],
  options: { name?: string; date1904?: boolean } = {},
): SheetGrid {
  return gridFromWorksheet(
    options.name ?? 'Folha',
    worksheet(rows),
    options.date1904 ?? false,
  );
}

export function layoutRows(tipo: ReportTipo): TestRows {
  const { rows } = buildLayout(tipo, config);
  return rows.map(({ cells }) => {
    const row: TestCell[] = [null, null, null];
    for (const cell of cells) {
      const index = 'ABC'.indexOf(cell.column);
      if (cell.formula !== undefined) row[index] = { f: cell.formula };
      else row[index] = cell.text ?? cell.number ?? null;
    }
    return row;
  });
}

function put(rows: TestRows, address: string, value: TestCell): void {
  const { r, c } = XLSX.utils.decode_cell(address);
  const row = rows[r];
  if (row === undefined) throw new Error(`No row for ${address}`);
  row[c] = value;
}

function blockRows(tipo: ReportTipo, key: string): number[] {
  const { rows } = buildLayout(tipo, config);
  const title = rows.findIndex((row) => row.key === key);
  const found: number[] = [];
  for (let index = title + 1; index < rows.length; index++) {
    const row = rows[index];
    if (row === undefined || row.cells.length === 0) break;
    if (row.cells[0]?.role !== 'header') found.push(index);
  }
  return found;
}

const euros = (key: string): number => Number(key.replace(',', '.'));

type ParamValue = string | number | boolean;
type ParamRow = Readonly<Record<string, ParamValue>>;

function rowAt(rows: TestRows, index: number | undefined): TestCell[] {
  const row = index === undefined ? undefined : rows[index];
  if (row === undefined) throw new Error(`No row at ${String(index)}`);
  return row;
}

function fillBlock(
  rows: TestRows,
  slots: readonly number[],
  kind: BlockKind,
  value: unknown,
): void {
  if (kind === 'text') {
    String(value)
      .split('\n')
      .forEach((line, position) => {
        rowAt(rows, slots[position])[0] = line;
      });
  } else if (kind === 'cashCount') {
    for (const [key, quantity] of Object.entries(
      value as Record<string, number>,
    )) {
      const slot = slots.find((index) => rows[index]?.[0] === euros(key));
      rowAt(rows, slot)[1] = quantity;
    }
  } else {
    (value as readonly ParamRow[]).forEach((entry, position) => {
      const row = rowAt(rows, slots[position]);
      Object.values(entry).forEach((cell, column) => {
        row[column] = cell;
      });
    });
  }
}

export function filledRows(
  tipo: ReportTipo,
  params: Readonly<Record<string, unknown>>,
): TestRows {
  const rows = layoutRows(tipo);
  const layout = buildLayout(tipo, config);
  const spec: ReportSpec = REPORT_SPECS[tipo];

  for (const field of spec.fields) {
    const value = params[field.key] as ParamValue | undefined;
    const address = layout.valueCells[field.key];
    if (value === undefined || address === undefined) continue;
    put(rows, address, field.kind === 'date' ? serial(String(value)) : value);
  }

  for (const block of spec.blocks) {
    const value = params[block.key];
    if (value === undefined) continue;
    fillBlock(rows, blockRows(tipo, block.key), block.kind, value);
  }
  return rows;
}
