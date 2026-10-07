import type { TabName } from '../dataset/types.ts';
import { issueMessages, makeIssue, type Issue } from '../issues.ts';
import { closest, normalise, normaliseHeader } from '../text.ts';
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

const IGNORED_SHEET_NAMES = ['Instruções'] as const;

export function isIgnoredSheetName(sheetName: string): boolean {
  const wanted = normalise(sheetName);
  return IGNORED_SHEET_NAMES.some((name) => normalise(name) === wanted);
}

export function suggestTabForSheetName(sheetName: string): TabName | null {
  const near = closest(sheetName, TAB_NAMES);
  const words = normalise(sheetName).split(' ');
  return (
    TAB_NAMES.find((tab) => tab === near) ??
    TAB_NAMES.find((tab) => words.includes(normalise(tab))) ??
    null
  );
}

export function tabForSheetName(sheetName: string): TabName | null {
  const wanted = normalise(sheetName);
  return TAB_NAMES.find((tab) => normalise(tab) === wanted) ?? null;
}

function requiredHeaders(specs: ColumnSpecs): string[] {
  return Object.values(specs)
    .filter((spec) => spec.required)
    .map((spec) => spec.header);
}

function allHeaders(specs: ColumnSpecs): string[] {
  return Object.values(specs).map((spec) => spec.header);
}

interface Signature {
  readonly tab: TabName;
  readonly required: readonly string[];
  readonly defined: readonly string[];
}

const SIGNATURES: readonly Signature[] = [
  {
    tab: 'Movimentos',
    required: requiredHeaders(MOVIMENTOS_COLUMNS),
    defined: allHeaders(MOVIMENTOS_COLUMNS),
  },
  {
    tab: 'Pendentes',
    required: requiredHeaders(PENDENTES_COLUMNS),
    defined: allHeaders(PENDENTES_COLUMNS),
  },
  {
    tab: 'Orçamento',
    required: requiredHeaders(ORCAMENTO_COLUMNS),
    defined: allHeaders(ORCAMENTO_COLUMNS),
  },
  {
    tab: 'Géneros',
    required: requiredHeaders(GENEROS_COLUMNS),
    defined: allHeaders(GENEROS_COLUMNS),
  },
  {
    tab: 'Saldos',
    required: requiredHeaders(SALDOS_COLUMNS),
    defined: allHeaders(SALDOS_COLUMNS),
  },
  { tab: 'Listas', required: LISTAS_SIGNATURE, defined: LISTAS_SIGNATURE },
];

function carriesNoForeignColumn(
  { tab, defined }: Signature,
  present: ReadonlySet<string>,
): boolean {
  const known = new Set(defined.map(normaliseHeader));
  return !SIGNATURES.filter((other) => other.tab !== tab)
    .flatMap((other) => other.required.map(normaliseHeader))
    .some((wanted) => present.has(wanted) && !known.has(wanted));
}

export function tabForHeader(header: readonly string[]): TabName | null {
  const present = new Set(header.map(normaliseHeader));
  const matches = SIGNATURES.filter(
    (signature) =>
      signature.required.every((wanted) =>
        present.has(normaliseHeader(wanted)),
      ) && carriesNoForeignColumn(signature, present),
  );
  const widest = Math.max(0, ...matches.map(({ required }) => required.length));
  const best = matches.filter(({ required }) => required.length === widest);
  return best.length === 1 ? (best[0]?.tab ?? null) : null;
}

export interface ClosestTab {
  readonly tab: TabName;
  readonly missing: readonly string[];
}

export function closestTab(header: readonly string[]): ClosestTab | null {
  const present = new Set(header.map(normaliseHeader));
  let best: ClosestTab | null = null;
  let bestShare = 0;
  for (const signature of SIGNATURES) {
    if (!carriesNoForeignColumn(signature, present)) continue;
    const { tab, required } = signature;
    const missing = required.filter(
      (wanted) => !present.has(normaliseHeader(wanted)),
    );
    const share = (required.length - missing.length) / required.length;
    if (share > bestShare) {
      best = { tab, missing };
      bestShare = share;
    }
  }
  return best;
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
