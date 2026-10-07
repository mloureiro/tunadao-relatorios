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

const CP1252_EXTRAS = new Map([['€', 0x80]]);

export function encodeCsv(
  text: string,
  encoding: 'utf-8' | 'utf-8-bom' | 'windows-1252',
): Uint8Array {
  if (encoding === 'windows-1252') {
    return Uint8Array.from(Array.from(text), (char) => {
      const code = char.codePointAt(0) ?? 0;
      return CP1252_EXTRAS.get(char) ?? (code <= 0xff ? code : 0x3f);
    });
  }
  const body = new TextEncoder().encode(text);
  return encoding === 'utf-8-bom'
    ? Uint8Array.from([0xef, 0xbb, 0xbf, ...body])
    : body;
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
