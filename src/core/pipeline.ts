import type { Dataset } from './dataset/types.ts';
import { readCsv } from './input/csv.ts';
import type { RawTable } from './input/raw-table.ts';
import { readXlsx } from './input/xlsx.ts';
import type { Issue } from './issues.ts';
import { normaliseTables } from './normalise/normalise-tables.ts';
import type { UnresolvedMovimento } from './normalise/movimentos.ts';

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

function readTables(file: InputFile): RawTable[] {
  return startsWith(file.bytes, ZIP_MAGIC) || startsWith(file.bytes, OLE_MAGIC)
    ? readXlsx(file.name, file.bytes)
    : [readCsv(file.name, file.bytes)];
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
  const { dataset, issues, unresolved } = normaliseTables(
    files.flatMap(readTables),
  );
  return { dataset: { sources, ...dataset }, issues, unresolved };
}
