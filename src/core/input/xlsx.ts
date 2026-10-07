import * as XLSX from 'xlsx';
import {
  isIgnoredSheetName,
  suggestTabForSheetName,
  tabForSheetName,
} from './columns.ts';
import { issueMessages, makeIssue, type Issue } from '../issues.ts';
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

export interface XlsxRead {
  readonly tables: RawTable[];
  readonly issues: Issue[];
}

export function readXlsx(name: string, bytes: Uint8Array): XlsxRead {
  const workbook = XLSX.read(bytes, { type: 'array', cellDates: false });
  const date1904 = workbook.Workbook?.WBProps?.date1904 === true;
  const tables: RawTable[] = [];
  const issues: Issue[] = [];
  const keptSheet = new Map<string, string>();

  for (const sheetName of workbook.SheetNames) {
    const tab = tabForSheetName(sheetName);
    const sheet = workbook.Sheets[sheetName];
    if (sheet === undefined) continue;

    if (tab === null) {
      if (!isIgnoredSheetName(sheetName)) {
        const near = suggestTabForSheetName(sheetName);
        issues.push(
          makeIssue(
            'ignored-sheet',
            issueMessages['ignored-sheet'](sheetName, near),
            { file: name },
            near ?? undefined,
          ),
        );
      }
      continue;
    }

    const kept = keptSheet.get(tab);
    if (kept !== undefined) {
      issues.push(
        makeIssue(
          'duplicate-sheet',
          issueMessages['duplicate-sheet'](kept, sheetName, tab),
          { file: name, tab },
        ),
      );
      continue;
    }
    keptSheet.set(tab, sheetName);

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
  return { tables, issues };
}
