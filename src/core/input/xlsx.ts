import * as XLSX from 'xlsx';
import { tabForSheetName } from './columns.ts';
import { headerText, toCell, type Cell, type RawTable } from './raw-table.ts';

function sheetRows(sheet: XLSX.WorkSheet): unknown[][] {
  const ref = sheet['!ref'];
  if (ref === undefined) return [];
  const range = XLSX.utils.decode_range(ref);
  range.s = { r: 0, c: 0 };
  sheet['!ref'] = XLSX.utils.encode_range(range);
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  });
}

export function readXlsx(name: string, bytes: Uint8Array): RawTable[] {
  const workbook = XLSX.read(bytes, { type: 'array', cellDates: false });
  const date1904 = workbook.Workbook?.WBProps?.date1904 === true;
  const tables: RawTable[] = [];
  const seen = new Set<string>();

  for (const sheetName of workbook.SheetNames) {
    const tab = tabForSheetName(sheetName);
    const sheet = workbook.Sheets[sheetName];
    if (tab === null || sheet === undefined || seen.has(tab)) continue;
    seen.add(tab);

    const [header = [], ...rows] = sheetRows(sheet);
    tables.push({
      source: name,
      tab,
      header: header.map(headerText),
      rows: rows.map((row): Cell[] => row.map(toCell)),
      firstDataRow: 2,
      date1904,
    });
  }
  return tables;
}
