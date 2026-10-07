import Papa from 'papaparse';
import { MOVIMENTOS_COLUMNS, tabForHeader } from './columns.ts';
import {
  headerText,
  isBlankRow,
  toCell,
  type Cell,
  type RawTable,
} from './raw-table.ts';

const DELIMITERS = [';', '\t', ','] as const;

// Node decodes windows-1252 as ISO-8859-1, which turns bytes 0x80-0x9F (the euro sign among them) into control characters
const CP1252_HIGH = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ';

function decodeWindows1252(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) =>
    byte >= 0x80 && byte <= 0x9f
      ? (CP1252_HIGH[byte - 0x80] ?? '')
      : String.fromCharCode(byte),
  ).join('');
}

export function decodeCsv(bytes: Uint8Array): string {
  const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  if (hasBom) return new TextDecoder('utf-8').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return decodeWindows1252(bytes);
  }
}

export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r\n|\n|\r/).find((line) => line.trim() !== '');
  if (firstLine === undefined) return ',';

  const counts = new Map<string, number>(DELIMITERS.map((d) => [d, 0]));
  let quoted = false;
  for (const char of firstLine) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && counts.has(char)) {
      counts.set(char, (counts.get(char) ?? 0) + 1);
    }
  }
  let best = ',';
  let bestCount = 0;
  for (const delimiter of DELIMITERS) {
    const count = counts.get(delimiter) ?? 0;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

export function readCsv(name: string, bytes: Uint8Array): RawTable {
  const text = decodeCsv(bytes);
  const parsed = Papa.parse<string[]>(text, {
    delimiter: detectDelimiter(text),
    skipEmptyLines: false,
  });
  const records = parsed.data.map((record): Cell[] => record.map(toCell));
  const headerAt = records.findIndex((record) => !isBlankRow(record));
  if (headerAt < 0) {
    return {
      source: name,
      tab: null,
      header: [],
      rows: [],
      firstDataRow: 2,
      date1904: false,
    };
  }

  const header = (records[headerAt] ?? []).map(headerText);
  return {
    source: name,
    tab: tabForHeader(header),
    header,
    rows: records.slice(headerAt + 1),
    firstDataRow: headerAt + 2,
    date1904: false,
  };
}

export type ColumnMapping = Readonly<
  Partial<Record<keyof typeof MOVIMENTOS_COLUMNS, number>>
>;

export function applyMapping(
  table: RawTable,
  mapping: ColumnMapping,
): RawTable {
  const mapped = (
    Object.keys(MOVIMENTOS_COLUMNS) as (keyof typeof MOVIMENTOS_COLUMNS)[]
  ).flatMap((key) => {
    const sourceIndex = mapping[key];
    return sourceIndex === undefined ? [] : [{ key, sourceIndex }];
  });

  return {
    ...table,
    tab: 'Movimentos',
    header: mapped.map(({ key }) => MOVIMENTOS_COLUMNS[key].header),
    rows: table.rows.map((row) =>
      mapped.map(({ sourceIndex }) => row[sourceIndex] ?? null),
    ),
  };
}
