import type ExcelJS from 'exceljs';
import type { ReportTipo } from '../../src/core/reports/index.ts';
import {
  REPORT_SPECS,
  REPORT_TIPOS,
  type BlockSpec,
  type FieldSpec,
} from '../../src/core/sheets/catalogue.ts';
import {
  buildLayout,
  type LayoutCell,
  type LayoutConfig,
  type LayoutRow,
} from '../../src/core/sheets/layout.ts';
import {
  DATE_FORMAT,
  INTEGER_FORMAT,
  MONEY_FORMAT,
  STYLE,
  TEXT_FORMAT,
  applyStyle,
} from './sheet-style.ts';
import { addListValidation, literalList } from './validation.ts';

export interface ReportSheetSpec {
  readonly tipo: ReportTipo;
  readonly name: string;
  readonly values?: Readonly<Record<string, unknown>>;
  readonly cells?: Readonly<Record<string, ExcelJS.CellValue>>;
}

export interface ListRanges {
  readonly atividade: string;
  readonly orcamento: string;
}

export interface ReportSheetOptions {
  readonly config: LayoutConfig;
  readonly lists?: ListRanges;
}

const NUMBER_FORMATS = {
  text: TEXT_FORMAT,
  date: DATE_FORMAT,
  money: MONEY_FORMAT,
  integer: INTEGER_FORMAT,
} as const;

const ROLE_STYLES = {
  label: STYLE.label,
  input: STYLE.input,
  title: STYLE.title,
  hint: STYLE.hint,
  header: STYLE.header,
  preprinted: STYLE.preprinted,
  display: STYLE.display,
} as const;

const EMPTY_ROW_HEIGHT = 18;

const COLUMN_INDEX = { A: 1, B: 2, C: 3 } as const;

type Filled = Map<string, ExcelJS.CellValue>;

function toDate(iso: string): Date {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function fieldValue(field: FieldSpec, value: unknown): ExcelJS.CellValue {
  switch (field.kind) {
    case 'date':
      return toDate(String(value));
    case 'money':
    case 'year':
      return Number(value);
    case 'yesno':
      return value === true || value === 'Sim' ? 'Sim' : 'Não';
    default:
      return String(value);
  }
}

function slotsOf(rows: readonly LayoutRow[], from: number): LayoutRow[] {
  const slots: LayoutRow[] = [];
  for (const row of rows.slice(from)) {
    if (row.cells.length === 0) break;
    slots.push(row);
  }
  return slots;
}

function take<T>(items: readonly T[], slots: readonly LayoutRow[], at: string) {
  if (items.length > slots.length) {
    throw new Error(
      `${at}: ${String(items.length)} rows do not fit the ${String(slots.length)} the layout leaves`,
    );
  }
  return items.map((item, index) => ({ item, row: slots[index] }));
}

function fillBlock(
  filled: Filled,
  block: BlockSpec,
  slots: readonly LayoutRow[],
  value: unknown,
): void {
  const inputs = slots.filter((slot) => slot.cells[0]?.role !== 'header');
  switch (block.kind) {
    case 'pairs':
    case 'indicators': {
      const rows = value as readonly Record<string, string | number>[];
      for (const { item, row } of take(rows, inputs, block.key)) {
        const [first, second] = Object.values(item);
        filled.set(`A${String(row?.row)}`, String(first));
        filled.set(
          `B${String(row?.row)}`,
          block.kind === 'pairs' ? Number(second) : String(second),
        );
      }
      break;
    }
    case 'text':
      for (const { item, row } of take(
        String(value).split('\n'),
        inputs,
        block.key,
      )) {
        filled.set(`A${String(row?.row)}`, item);
      }
      break;
    case 'cashCount': {
      for (const [key, quantity] of Object.entries(
        value as Record<string, number>,
      )) {
        const euros = Number(key.replace(',', '.'));
        const row = inputs.find((slot) => slot.cells[0]?.number === euros);
        if (row === undefined) throw new Error(`No denomination ${key}`);
        filled.set(`B${String(row.row)}`, quantity);
        filled.set(`C${String(row.row)}`, euros * quantity);
      }
      break;
    }
    case 'signatures':
      for (const [cargo, name] of Object.entries(
        value as Readonly<Record<string, string>>,
      )) {
        const row = inputs.find((slot) => slot.cells[0]?.text === cargo);
        if (row === undefined) throw new Error(`No cargo ${cargo}`);
        filled.set(`B${String(row.row)}`, name);
      }
      break;
  }
}

function fillValues(
  tipo: ReportTipo,
  rows: readonly LayoutRow[],
  valueCells: Readonly<Record<string, string>>,
  values: Readonly<Record<string, unknown>>,
): Filled {
  const spec = REPORT_SPECS[tipo];
  const filled: Filled = new Map();
  const unused = new Set(
    Object.keys(values).filter((key) => values[key] !== undefined),
  );

  for (const field of spec.fields) {
    const value = values[field.key];
    const address = valueCells[field.key];
    if (value === undefined || address === undefined) continue;
    filled.set(address, fieldValue(field, value));
    unused.delete(field.key);
  }
  rows.forEach((row, index) => {
    const block = spec.blocks.find(({ key }) => key === row.key);
    const value = block === undefined ? undefined : values[block.key];
    if (block === undefined || value === undefined) return;
    fillBlock(filled, block, slotsOf(rows, index + 1), value);
    unused.delete(block.key);
  });

  if (unused.size > 0) {
    throw new Error(`Unknown ${tipo} values: ${[...unused].join(', ')}`);
  }
  return filled;
}

function writeCell(
  sheet: ExcelJS.Worksheet,
  row: number,
  cell: LayoutCell,
  filled: Filled,
): void {
  const target = sheet.getCell(row, COLUMN_INDEX[cell.column]);
  const address = `${cell.column}${String(row)}`;
  target.numFmt = NUMBER_FORMATS[cell.format];
  applyStyle(target, ROLE_STYLES[cell.role]);

  if (cell.formula !== undefined) {
    const result = filled.get(address);
    target.value = {
      formula: cell.formula,
      result: typeof result === 'number' ? result : 0,
    };
    return;
  }
  const typed = filled.get(address);
  if (typed !== undefined) target.value = typed;
  else if (cell.text !== undefined) target.value = cell.text;
  else if (cell.number !== undefined) target.value = cell.number;
}

function validationFor(
  sheet: ExcelJS.Worksheet,
  address: string,
  cell: LayoutCell,
  lists: ListRanges | undefined,
): void {
  const prompt = (title: string, text: string) => ({ title, text });
  if (cell.input === 'type') {
    addListValidation(sheet, {
      range: address,
      source: literalList(...REPORT_TIPOS.map((t) => REPORT_SPECS[t].label)),
      prompt: prompt('Tipo de relatório', 'Escolha o tipo na lista.'),
      error: 'Escolha um dos tipos de relatório da lista.',
    });
  } else if (cell.input === 'yesno') {
    addListValidation(sheet, {
      range: address,
      source: literalList('Sim', 'Não'),
      prompt: prompt('Sim ou Não', 'Escolha na lista.'),
      error: 'Escolha Sim ou Não.',
    });
  } else if (cell.input === 'activity' && lists !== undefined) {
    addListValidation(sheet, {
      range: address,
      source: lists.atividade,
      prompt: prompt('Atividade', 'Escolha uma atividade da lista.'),
      error: 'Escolha uma atividade da lista (separador Listas).',
    });
  } else if (cell.input === 'budget' && lists !== undefined) {
    addListValidation(sheet, {
      range: address,
      source: lists.orcamento,
      prompt: prompt(
        'Orçamento a usar',
        'Escolha um orçamento da lista, ou deixe em branco.',
      ),
      error: 'Escolha um orçamento da lista (separador Listas).',
    });
  }
}

export function writeReportSheet(
  workbook: ExcelJS.Workbook,
  { tipo, name, values = {}, cells = {} }: ReportSheetSpec,
  { config, lists }: ReportSheetOptions,
): ExcelJS.Worksheet {
  const layout = buildLayout(tipo, config);
  const filled = fillValues(tipo, layout.rows, layout.valueCells, values);
  const sheet = workbook.addWorksheet(name);

  (['A', 'B', 'C'] as const).forEach((column) => {
    sheet.getColumn(COLUMN_INDEX[column]).width = layout.widths[column];
  });
  for (const { row, cells } of layout.rows) {
    const empty = cells.every(
      (cell) =>
        cell.role === 'input' &&
        cell.formula === undefined &&
        !filled.has(`${cell.column}${String(row)}`),
    );
    if (cells.length > 0 && empty) sheet.getRow(row).height = EMPTY_ROW_HEIGHT;
    for (const cell of cells) {
      writeCell(sheet, row, cell, filled);
      if (cell.input !== undefined) {
        validationFor(sheet, `${cell.column}${String(row)}`, cell, lists);
      }
    }
  }
  for (const [address, value] of Object.entries(cells)) {
    sheet.getCell(address).value = value;
  }
  return sheet;
}
