import { MOVIMENTOS_COLUMNS } from '@/core/input/columns';
import type { ColumnMapping } from '@/core/input/csv';
import { normaliseHeader } from '@/core/text';

export const PROFILES_KEY = 'tunadao-relatorios.perfis-csv';

const FIELD_KEYS = new Set<string>(Object.keys(MOVIMENTOS_COLUMNS));

function isMapping(value: unknown): value is ColumnMapping {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.entries(value).every(
      ([field, index]) =>
        FIELD_KEYS.has(field) &&
        typeof index === 'number' &&
        Number.isInteger(index) &&
        index >= 0,
    )
  );
}

function isProfiles(value: unknown): value is Record<string, ColumnMapping> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(isMapping)
  );
}

export type ProfileStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function headerSignature(header: readonly string[]): string {
  return header.map(normaliseHeader).join('|');
}

function readAll(
  storage: ProfileStorage | null,
): Record<string, ColumnMapping> {
  if (storage === null) return {};
  try {
    const raw = storage.getItem(PROFILES_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    return isProfiles(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(
  storage: ProfileStorage | null,
  profiles: Record<string, ColumnMapping>,
): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    return true;
  } catch {
    return false;
  }
}

export function browserStorage(): ProfileStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function findProfile(
  storage: ProfileStorage | null,
  header: readonly string[],
): ColumnMapping | null {
  return readAll(storage)[headerSignature(header)] ?? null;
}

export function saveProfile(
  storage: ProfileStorage | null,
  header: readonly string[],
  mapping: ColumnMapping,
): boolean {
  return writeAll(storage, {
    ...readAll(storage),
    [headerSignature(header)]: mapping,
  });
}

export function clearProfile(
  storage: ProfileStorage | null,
  header: readonly string[],
): void {
  const signature = headerSignature(header);
  const kept = Object.entries(readAll(storage)).filter(
    ([key]) => key !== signature,
  );
  writeAll(storage, Object.fromEntries(kept));
}
