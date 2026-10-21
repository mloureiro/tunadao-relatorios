import * as XLSX from 'xlsx';

export type GridCellType = 'n' | 's' | 'b' | 'e';

export interface GridCell {
  readonly t: GridCellType;
  readonly v?: string | number | boolean;
  readonly f?: string;
  readonly w?: string;
}

export interface SheetGrid {
  readonly name: string;
  readonly date1904: boolean;
  readonly rowCount: number;
  cell(row: number, column: number): GridCell | undefined;
}

export function cellAddress(row: number, column: number): string {
  return XLSX.utils.encode_cell({ r: row, c: column });
}

function toGridCell(cell: XLSX.CellObject | undefined): GridCell | undefined {
  if (cell === undefined) return undefined;
  const type: GridCellType =
    cell.t === 'n' || cell.t === 'b' || cell.t === 'e' ? cell.t : 's';
  const value = cell.t === 'd' || cell.t === 'z' ? undefined : cell.v;
  return {
    t: type,
    ...(typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
      ? { v: value }
      : {}),
    ...(cell.f === undefined ? {} : { f: cell.f }),
    ...(cell.w === undefined ? {} : { w: cell.w }),
  };
}

export function gridFromWorksheet(
  name: string,
  sheet: XLSX.WorkSheet,
  date1904: boolean,
): SheetGrid {
  const ref = sheet['!ref'];
  const rowCount = ref === undefined ? 0 : XLSX.utils.decode_range(ref).e.r + 1;
  return {
    name,
    date1904,
    rowCount,
    cell: (row, column) =>
      toGridCell(
        sheet[cellAddress(row, column)] as XLSX.CellObject | undefined,
      ),
  };
}
