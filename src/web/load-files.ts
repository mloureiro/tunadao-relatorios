import type { ColumnMapping } from '@/core/input/csv';
import type { RawTable } from '@/core/input/raw-table';
import type { InputFile } from '@/core/pipeline';
import { mappedFile, unrecognisedCsv } from './mapping';
import { findProfile, type ProfileStorage } from './profiles';

export interface PendingMapping {
  readonly name: string;
  readonly table: RawTable;
}

export interface PreparedInputs {
  readonly ready: InputFile[];
  readonly pending: PendingMapping[];
  readonly autoMapped: PendingMapping[];
}

const isCsv = (name: string): boolean => name.toLowerCase().endsWith('.csv');

export function selectionProblem(names: readonly string[]): string | null {
  if (names.length <= 1 || names.every(isCsv)) return null;
  return 'Escolha um único ficheiro .xlsx ou vários ficheiros .csv de uma vez.';
}

export function prepareInputs(
  files: readonly InputFile[],
  chosen: Readonly<Record<string, ColumnMapping>>,
  storage: ProfileStorage | null,
): PreparedInputs {
  const ready: InputFile[] = [];
  const pending: PendingMapping[] = [];
  const autoMapped: PendingMapping[] = [];

  for (const file of files) {
    const table = unrecognisedCsv(file);
    const sessionMapping = chosen[file.name];
    const profile =
      table !== null && sessionMapping === undefined
        ? findProfile(storage, table.header)
        : null;

    if (table === null) ready.push(file);
    else if (sessionMapping !== undefined)
      ready.push(mappedFile(file.name, table, sessionMapping));
    else if (profile !== null) {
      ready.push(mappedFile(file.name, table, profile));
      autoMapped.push({ name: file.name, table });
    } else pending.push({ name: file.name, table });
  }
  return { ready, pending, autoMapped };
}

export async function readInputFiles(
  files: readonly File[],
): Promise<InputFile[]> {
  return Promise.all(
    files.map(async (file) => ({
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    })),
  );
}
