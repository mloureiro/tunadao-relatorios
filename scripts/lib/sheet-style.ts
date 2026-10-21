import type ExcelJS from 'exceljs';

export const DATE_FORMAT = 'dd/mm/yyyy';
export const MONEY_FORMAT = '#,##0.00 "€"';
export const INTEGER_FORMAT = '0';
export const TEXT_FORMAT = '@';

export const NAVY = 'FF1D2F6F';
const RULE = 'FFBFC5D2';
const LABEL_FILL = 'FFF2F3F7';
const HEADER_FILL = 'FFE3E8F4';
const AUTOMATIC_FILL = 'FFE7E7E7';
const MUTED = 'FF6B7280';

function solid(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

const thin: Partial<ExcelJS.Border> = {
  style: 'thin',
  color: { argb: RULE },
};
const BOX: Partial<ExcelJS.Borders> = {
  top: thin,
  left: thin,
  bottom: thin,
  right: thin,
};

export const STYLE = {
  input: { border: BOX, alignment: { vertical: 'top', wrapText: true } },
  label: {
    fill: solid(LABEL_FILL),
    border: BOX,
    font: { bold: true, color: { argb: 'FF1F2937' } },
    alignment: { vertical: 'top', wrapText: true },
  },
  preprinted: {
    fill: solid(LABEL_FILL),
    border: BOX,
    alignment: { vertical: 'top', horizontal: 'left' },
  },
  display: {
    fill: solid(AUTOMATIC_FILL),
    border: BOX,
    font: { italic: true, color: { argb: MUTED } },
    alignment: { vertical: 'top' },
  },
  title: {
    font: { bold: true, size: 12, color: { argb: NAVY } },
    border: { bottom: { style: 'medium', color: { argb: NAVY } } },
    alignment: { vertical: 'bottom', wrapText: true },
  },
  hint: {
    font: { italic: true, color: { argb: MUTED } },
    alignment: { vertical: 'top', wrapText: true },
  },
  header: {
    fill: solid(HEADER_FILL),
    border: BOX,
    font: { bold: true, color: { argb: NAVY } },
    alignment: { vertical: 'top', wrapText: true },
  },
  inputHeader: {
    fill: solid(HEADER_FILL),
    font: { bold: true, color: { argb: NAVY } },
    border: BOX,
  },
  automaticHeader: {
    fill: solid(AUTOMATIC_FILL),
    font: { bold: true, italic: true, color: { argb: MUTED } },
    border: BOX,
  },
  automatic: { fill: solid(AUTOMATIC_FILL), font: { color: { argb: MUTED } } },
} as const satisfies Record<string, Partial<ExcelJS.Style>>;

export function applyStyle(
  cell: ExcelJS.Cell,
  style: Partial<ExcelJS.Style>,
): void {
  if (style.fill !== undefined) cell.fill = style.fill;
  if (style.border !== undefined) cell.border = style.border;
  if (style.font !== undefined) cell.font = style.font;
  if (style.alignment !== undefined) cell.alignment = style.alignment;
}
