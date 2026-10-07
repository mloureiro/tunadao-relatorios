import type { Dataset } from './dataset/types.ts';
import { closestTab } from './input/columns.ts';
import { readCsv } from './input/csv.ts';
import type { RawTable } from './input/raw-table.ts';
import { readXlsx } from './input/xlsx.ts';
import { issueMessages, makeIssue, type Issue } from './issues.ts';
import { normaliseTables } from './normalise/normalise-tables.ts';
import type { UnresolvedMovimento } from './normalise/movimentos.ts';
import { validateDataset } from './validate/validate-dataset.ts';

export interface InputFile {
  readonly name: string;
  readonly bytes: Uint8Array;
}

export interface LoadResult {
  readonly dataset: Dataset;
  readonly issues: Issue[];
  readonly unresolved: UnresolvedMovimento[];
}

const ZIP_MAGIC = [0x50, 0x4b];
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  return magic.every((byte, position) => bytes[position] === byte);
}

function readTables(file: InputFile): {
  tables: RawTable[];
  issues: Issue[];
} {
  return startsWith(file.bytes, ZIP_MAGIC) || startsWith(file.bytes, OLE_MAGIC)
    ? readXlsx(file.name, file.bytes)
    : { tables: [readCsv(file.name, file.bytes)], issues: [] };
}

function readFile(file: InputFile): { tables: RawTable[]; issues: Issue[] } {
  let tables: RawTable[];
  let sheetIssues: Issue[];
  try {
    ({ tables, issues: sheetIssues } = readTables(file));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      tables: [],
      issues: [
        makeIssue(
          'unreadable-file',
          issueMessages['unreadable-file'](file.name, reason),
          { file: file.name },
        ),
      ],
    };
  }

  const recognised = tables.some((table) => table.tab !== null);
  if (recognised) return { tables, issues: sheetIssues };

  const closest =
    tables.length === 0 ? null : closestTab(tables[0]?.header ?? []);
  return {
    tables: [],
    issues: [
      makeIssue(
        'unrecognised-file',
        issueMessages['unrecognised-file'](file.name, closest),
        { file: file.name },
      ),
      ...sheetIssues,
    ],
  };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export async function loadDataset(
  files: readonly InputFile[],
): Promise<LoadResult> {
  const sources = await Promise.all(
    files.map(async ({ name, bytes }) => ({
      name,
      sha256: await sha256Hex(bytes),
    })),
  );
  const read = files.map(readFile);
  const { dataset, issues, unresolved } = normaliseTables(
    read.flatMap(({ tables }) => tables),
  );
  const listasMissing = !read.some(({ tables }) =>
    tables.some((table) => table.tab === 'Listas'),
  );
  const full: Dataset = { sources, ...dataset };
  return {
    dataset: full,
    issues: [
      ...read.flatMap((result) => result.issues),
      ...issues,
      ...validateDataset(full, unresolved, { listasMissing }),
    ],
    unresolved,
  };
}
