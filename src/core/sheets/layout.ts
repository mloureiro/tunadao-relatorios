import { DENOMINATIONS_CENTS } from '../calc/index.ts';
import type { Config } from '../config/schema.ts';
import type { ReportTipo } from '../reports/index.ts';
import {
  CASH_COUNT_HEADER,
  INDICATORS_HEADER,
  MARKER_LABELS,
  PAIRS_HEADER,
  REPORT_SPECS,
  SIGNATURES_HEADER,
  SUPPORTED_LAYOUT_VERSION,
  VERSION_FIELD,
  type BlockSpec,
  type FieldKind,
  type ReportSpec,
} from './catalogue.ts';

export type LayoutConfig = Pick<Config, 'signatures'>;

export type CellRole =
  'label' | 'input' | 'title' | 'hint' | 'header' | 'preprinted' | 'display';

export type CellFormat = 'text' | 'date' | 'money' | 'integer';

export interface LayoutCell {
  readonly column: 'A' | 'B' | 'C';
  readonly role: CellRole;
  readonly format: CellFormat;
  readonly text?: string;
  readonly number?: number;
  readonly formula?: string;
  readonly input?: FieldKind | 'type';
}

export interface LayoutRow {
  readonly row: number;
  readonly key?: string;
  readonly cells: readonly LayoutCell[];
}

export interface SheetLayout {
  readonly tipo: ReportTipo;
  readonly rows: readonly LayoutRow[];
  readonly widths: Readonly<Record<'A' | 'B' | 'C', number>>;
  readonly typeCell: string;
  readonly valueCells: Readonly<Record<string, string>>;
}

export const LAYOUT_WIDTHS = { A: 46, B: 34, C: 56 } as const;

const EMPTY_ROWS = { pairs: 5, indicators: 8, text: 5 } as const;

const FORMAT_BY_KIND: Readonly<Record<FieldKind, CellFormat>> = {
  date: 'date',
  money: 'money',
  text: 'text',
  year: 'integer',
  yesno: 'text',
  activity: 'text',
  budget: 'text',
};

function cell(
  column: LayoutCell['column'],
  role: CellRole,
  extra: Partial<Omit<LayoutCell, 'column' | 'role'>> = {},
): LayoutCell {
  return { column, role, format: 'text', ...extra };
}

function toEuros(denominationCents: number): number {
  return denominationCents / 100;
}

class Builder {
  readonly rows: LayoutRow[] = [];
  readonly valueCells: Record<string, string> = {};

  get next(): number {
    return this.rows.length + 1;
  }

  add(cells: readonly LayoutCell[], key?: string): number {
    const row = this.next;
    this.rows.push({ row, ...(key === undefined ? {} : { key }), cells });
    return row;
  }

  blank(): void {
    this.add([]);
  }

  emptyRows(count: number, columns: 1 | 2): void {
    for (let i = 0; i < count; i++) {
      this.add(
        columns === 1
          ? [cell('A', 'input')]
          : [cell('A', 'input'), cell('B', 'input')],
      );
    }
  }
}

function addBlock(
  builder: Builder,
  spec: BlockSpec,
  tipo: ReportTipo,
  config: LayoutConfig,
): void {
  const title = [cell('A', 'title', { text: spec.title })];
  if (spec.hint !== undefined) {
    title.push(cell('C', 'hint', { text: spec.hint }));
  }
  builder.add(title, spec.key);

  switch (spec.kind) {
    case 'pairs':
      builder.add([
        cell('A', 'header', { text: PAIRS_HEADER[0] }),
        cell('B', 'header', { text: PAIRS_HEADER[1] }),
      ]);
      builder.emptyRows(EMPTY_ROWS.pairs, 2);
      break;
    case 'indicators':
      builder.add([
        cell('A', 'header', { text: INDICATORS_HEADER[0] }),
        cell('B', 'header', { text: INDICATORS_HEADER[1] }),
      ]);
      builder.emptyRows(EMPTY_ROWS.indicators, 2);
      break;
    case 'cashCount':
      builder.add([
        cell('A', 'header', { text: CASH_COUNT_HEADER[0] }),
        cell('B', 'header', { text: CASH_COUNT_HEADER[1] }),
        cell('C', 'header', { text: CASH_COUNT_HEADER[2] }),
      ]);
      for (const cents of DENOMINATIONS_CENTS) {
        const row = builder.next;
        builder.add([
          cell('A', 'preprinted', {
            number: toEuros(cents),
            format: 'money',
          }),
          cell('B', 'input', { format: 'integer' }),
          cell('C', 'display', {
            format: 'money',
            formula: `A${String(row)}*B${String(row)}`,
          }),
        ]);
      }
      break;
    case 'text':
      builder.emptyRows(EMPTY_ROWS.text, 1);
      break;
    case 'signatures':
      builder.add([
        cell('A', 'header', { text: SIGNATURES_HEADER[0] }),
        cell('B', 'header', { text: SIGNATURES_HEADER[1] }),
      ]);
      for (const cargo of config.signatures[tipo]) {
        builder.add([
          cell('A', 'preprinted', { text: cargo }),
          cell('B', 'input'),
        ]);
      }
      break;
  }
}

export function buildLayout(
  tipo: ReportTipo,
  config: LayoutConfig,
): SheetLayout {
  const spec: ReportSpec = REPORT_SPECS[tipo];
  const builder = new Builder();

  const typeRow = builder.add([
    cell('A', 'label', { text: MARKER_LABELS[0] }),
    cell('B', 'input', { text: spec.label, input: 'type' }),
  ]);
  const versionRow = builder.add([
    cell('A', 'label', { text: VERSION_FIELD.label }),
    cell('B', 'input', {
      number: SUPPORTED_LAYOUT_VERSION,
      format: 'integer',
    }),
  ]);
  builder.blank();

  for (const field of spec.fields) {
    const cells = [
      cell('A', 'label', { text: field.label }),
      cell('B', 'input', {
        format: FORMAT_BY_KIND[field.kind],
        input: field.kind,
      }),
    ];
    if (field.hint !== undefined) {
      cells.push(cell('C', 'hint', { text: field.hint }));
    }
    const row = builder.add(cells, field.key);
    builder.valueCells[field.key] = `B${String(row)}`;
  }

  for (const block of spec.blocks) {
    builder.blank();
    addBlock(builder, block, tipo, config);
  }

  return {
    tipo,
    rows: builder.rows,
    widths: LAYOUT_WIDTHS,
    typeCell: `B${String(typeRow)}`,
    valueCells: {
      ...builder.valueCells,
      versao: `B${String(versionRow)}`,
    },
  };
}
