import type { TabName } from '../dataset/types.ts';

export type Cell = string | number | boolean | null;

export interface RawTable {
  readonly source: string;
  readonly tab: TabName | null;
  readonly header: readonly string[];
  readonly rows: readonly (readonly Cell[])[];
  readonly firstDataRow: number;
  readonly date1904: boolean;
}

export function toCell(value: unknown): Cell {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return null;
}

export function headerText(value: unknown): string {
  const cell = toCell(value);
  return cell === null ? '' : String(cell);
}

export function isBlankRow(cells: readonly Cell[]): boolean {
  return cells.every((cell) => cell === null);
}
