import * as XLSX from 'xlsx';
import type { Cell, RawTable } from '../../src/core/input/raw-table.ts';
import { headerText, toCell } from '../../src/core/input/raw-table.ts';
import type { TabName } from '../../src/core/dataset/types.ts';

export type Sheet = readonly (readonly Cell[])[];

export function buildWorkbook(
  sheets: Readonly<Record<string, Sheet>>,
  options: { date1904?: boolean } = {},
): Uint8Array {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(rows.map((row) => [...row])),
      name,
    );
  }
  if (options.date1904 === true) {
    workbook.Workbook = { WBProps: { date1904: true } };
  }
  return new Uint8Array(
    XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer,
  );
}

export function table(
  tab: TabName,
  rows: Sheet,
  source = 'teste.xlsx',
): RawTable {
  const [header = [], ...body] = rows;
  return {
    source,
    tab,
    header: header.map(headerText),
    rows: body.map((row) => row.map(toCell)),
    firstDataRow: 2,
    date1904: false,
  };
}
