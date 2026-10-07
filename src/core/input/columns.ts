import type { TabName } from '../dataset/types.ts';
import { issueMessages, makeIssue, type Issue } from '../issues.ts';
import { normalise, normaliseHeader } from '../text.ts';
import type { RawTable } from './raw-table.ts';

export interface ColumnSpec {
  readonly header: string;
  readonly required: boolean;
}

export type ColumnSpecs = Readonly<Record<string, ColumnSpec>>;
export type ColumnIndex<S extends ColumnSpecs> = {
  readonly [K in keyof S]: number | null;
};

function column(header: string, required: boolean): ColumnSpec {
  return { header, required };
}

export const MOVIMENTOS_COLUMNS = {
  data: column('Data', true),
  doc: column('N.º doc', false),
  descricao: column('Descrição', true),
  atividade: column('Atividade', true),
  rubrica: column('Rubrica', true),
  subRubrica: column('Sub-rubrica', false),
  tipo: column('Tipo', true),
  meio: column('Meio', true),
  valor: column('Valor (€)', true),
  conta: column('Conta', false),
  valorComSinal: column('Valor com sinal (€)', false),
  contaResultado: column('Conta para o resultado', false),
} as const satisfies ColumnSpecs;

export const PENDENTES_COLUMNS = {
  tipo: column('Tipo', true),
  entidade: column('Entidade', true),
  descricao: column('Descrição', true),
  atividade: column('Atividade', false),
  valor: column('Valor (€)', true),
  dataRegisto: column('Data de registo', true),
  dataLiquidacao: column('Data de liquidação', false),
  notas: column('Notas', false),
} as const satisfies ColumnSpecs;

export const ORCAMENTO_COLUMNS = {
  ambito: column('Âmbito', true),
  tipo: column('Tipo', true),
  rubrica: column('Rubrica', true),
  subRubrica: column('Sub-rubrica', false),
  orcado: column('Orçado (€)', true),
} as const satisfies ColumnSpecs;

export const GENEROS_COLUMNS = {
  data: column('Data', false),
  atividade: column('Atividade', true),
  tipo: column('Tipo', true),
  quantidade: column('Quantidade', false),
  emFalta: column('Em falta', false),
  valorEstimado: column('Valor estimado (€)', false),
} as const satisfies ColumnSpecs;

export const SALDOS_COLUMNS = {
  data: column('Data', true),
  conta: column('Conta', true),
  saldo: column('Saldo (€)', true),
  fonte: column('Fonte', true),
} as const satisfies ColumnSpecs;

export const LISTAS_SIGNATURE = [
  'Rubrica',
  'Tipo',
  'Conta para o resultado',
  'Sub-rubrica',
  'Atividade',
  'Meio',
  'Conta',
] as const;

export const TAB_NAMES = [
  'Movimentos',
  'Pendentes',
  'Orçamento',
  'Géneros',
  'Listas',
  'Saldos',
] as const satisfies readonly TabName[];

export function tabForSheetName(sheetName: string): TabName | null {
  const wanted = normalise(sheetName);
  return TAB_NAMES.find((tab) => normalise(tab) === wanted) ?? null;
}

function requiredHeaders(specs: ColumnSpecs): string[] {
  return Object.values(specs)
    .filter((spec) => spec.required)
    .map((spec) => spec.header);
}

interface Signature {
  readonly tab: TabName;
  readonly headers: readonly string[];
  readonly adjacent?: readonly string[];
}

const SIGNATURES: readonly Signature[] = [
  { tab: 'Movimentos', headers: requiredHeaders(MOVIMENTOS_COLUMNS) },
  { tab: 'Pendentes', headers: requiredHeaders(PENDENTES_COLUMNS) },
  { tab: 'Orçamento', headers: requiredHeaders(ORCAMENTO_COLUMNS) },
  { tab: 'Géneros', headers: requiredHeaders(GENEROS_COLUMNS) },
  { tab: 'Saldos', headers: requiredHeaders(SALDOS_COLUMNS) },
  {
    tab: 'Listas',
    headers: LISTAS_SIGNATURE,
    adjacent: ['Rubrica', 'Tipo', 'Conta para o resultado'],
  },
];

function hasRun(
  header: readonly string[],
  run: readonly string[] | undefined,
): boolean {
  if (run === undefined) return true;
  const wanted = run.map(normaliseHeader);
  return header.some((_, start) =>
    wanted.every((cell, offset) => header[start + offset] === cell),
  );
}

export function tabForHeader(header: readonly string[]): TabName | null {
  const normalised = header.map(normaliseHeader);
  const present = new Set(normalised);
  const matches = SIGNATURES.filter(
    ({ headers, adjacent }) =>
      headers.every((wanted) => present.has(normaliseHeader(wanted))) &&
      hasRun(normalised, adjacent),
  );
  const widest = Math.max(0, ...matches.map(({ headers }) => headers.length));
  const best = matches.filter(({ headers }) => headers.length === widest);
  return best.length === 1 ? (best[0]?.tab ?? null) : null;
}

export function headerRow(table: RawTable): number {
  return table.firstDataRow - 1;
}

export function resolveColumns<S extends ColumnSpecs>(
  table: RawTable,
  tab: TabName,
  specs: S,
  issues: Issue[],
): ColumnIndex<S> {
  const normalised = table.header.map(normaliseHeader);
  const index: Record<string, number | null> = {};
  for (const [key, spec] of Object.entries(specs)) {
    const found = normalised.indexOf(normaliseHeader(spec.header));
    index[key] = found >= 0 ? found : null;
    if (found < 0 && spec.required) {
      issues.push(
        makeIssue(
          'missing-column',
          issueMessages['missing-column'](spec.header, tab),
          {
            file: table.source,
            tab,
            row: headerRow(table),
            column: spec.header,
          },
        ),
      );
    }
  }
  return index as ColumnIndex<S>;
}
