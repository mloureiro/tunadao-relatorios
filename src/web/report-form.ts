import { DENOMINATIONS_CENTS } from '@/core/calc';
import type { Cents, Dataset } from '@/core/dataset/types';
import { parseDateText } from '@/core/dates';
import { parseMoney } from '@/core/money';
import type { ReportTipo } from '@/core/reports';

export interface IndicatorRow {
  readonly key: number;
  readonly label: string;
  readonly value: string;
}

export interface UnclearedRow {
  readonly key: number;
  readonly descricao: string;
  readonly valor: string;
}

export interface ReportFormValues {
  readonly fields: Readonly<Record<string, string>>;
  readonly flags: Readonly<Record<string, boolean>>;
  readonly touched: Readonly<Record<string, true>>;
  readonly indicadores: readonly IndicatorRow[];
  readonly naoDebitados: readonly UnclearedRow[];
  readonly naoCreditados: readonly UnclearedRow[];
  readonly contagem: Readonly<Record<string, string>>;
}

export const DENOMINATION_GRID = [...DENOMINATIONS_CENTS];

export function denominationKey(cents: Cents): string {
  return String(cents / 100);
}

const DEFAULT_FLAGS: Record<ReportTipo, Record<string, boolean>> = {
  evento: { anexarJson: true },
  pegada: { anexarJson: true },
  letivo: { anexar: true, anexarJson: true },
  fiscal: { anexoMovimentos: false, anexarJson: true },
};

export function emptyForm(tipo: ReportTipo): ReportFormValues {
  return {
    fields: {},
    flags: DEFAULT_FLAGS[tipo],
    touched: {},
    indicadores: [],
    naoDebitados: [],
    naoCreditados: [],
    contagem: {},
  };
}

export function setField(
  form: ReportFormValues,
  key: string,
  value: string,
): ReportFormValues {
  return {
    ...form,
    fields: { ...form.fields, [key]: value },
    touched: { ...form.touched, [key]: true },
  };
}

export function touch(form: ReportFormValues, key: string): ReportFormValues {
  return form.touched[key] === true
    ? form
    : { ...form, touched: { ...form.touched, [key]: true } };
}

export function setFlag(
  form: ReportFormValues,
  key: string,
  value: boolean,
): ReportFormValues {
  return { ...form, flags: { ...form.flags, [key]: value } };
}

export function setCount(
  form: ReportFormValues,
  cents: Cents,
  value: string,
): ReportFormValues {
  const key = denominationKey(cents);
  return {
    ...form,
    contagem: { ...form.contagem, [key]: value },
    touched: { ...form.touched, [`contagem/${key}`]: true },
  };
}

export function nextRowKey(rows: readonly { readonly key: number }[]): number {
  return rows.reduce((highest, { key }) => Math.max(highest, key), 0) + 1;
}

export function plainEuros(cents: Cents): string {
  const abs = Math.abs(cents);
  const euros = String(Math.floor(abs / 100));
  const fraction = String(abs % 100).padStart(2, '0');
  return `${cents < 0 ? '-' : ''}${euros},${fraction}`;
}

export function extratoOn(dataset: Dataset, dateText: string): Cents | null {
  const date = parseDateText(dateText);
  if (date === null) return null;
  const found = dataset.saldos.find(
    (saldo) =>
      saldo.conta === 'Banco' &&
      saldo.fonte === 'Extrato' &&
      saldo.data === date,
  );
  return found?.saldoCents ?? null;
}

function derived(
  tipo: ReportTipo,
  fields: Readonly<Record<string, string>>,
  dataset: Dataset,
): Record<string, string> {
  switch (tipo) {
    case 'evento':
      return { ambitoOrcamento: fields.atividade ?? '' };
    case 'fiscal':
      return { ambitoOrcamento: (fields.ano ?? '').trim() };
    case 'pegada': {
      const extrato = extratoOn(dataset, fields.dataPassagem ?? '');
      return { saldoExtrato: extrato === null ? '' : plainEuros(extrato) };
    }
    case 'letivo':
      return {};
  }
}

export function withDefaults(
  tipo: ReportTipo,
  form: ReportFormValues,
  dataset: Dataset,
): ReportFormValues {
  const defaults = derived(tipo, form.fields, dataset);
  const fields = { ...form.fields };
  for (const [key, value] of Object.entries(defaults)) {
    if (form.touched[key] !== true) fields[key] = value;
  }
  return { ...form, fields };
}

const trimmed = (value: string | undefined): string | undefined => {
  const text = value?.trim() ?? '';
  return text === '' ? undefined : text;
};

function manualOpening(
  fields: Readonly<Record<string, string>>,
): { caixa: string | undefined; banco: string | undefined } | undefined {
  const caixa = trimmed(fields['aberturaManual/caixa']);
  const banco = trimmed(fields['aberturaManual/banco']);
  return caixa === undefined && banco === undefined
    ? undefined
    : { caixa, banco };
}

function counted(
  contagem: Readonly<Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(
    DENOMINATION_GRID.flatMap((cents) => {
      const quantity = trimmed(contagem[denominationKey(cents)]);
      return quantity === undefined ? [] : [[denominationKey(cents), quantity]];
    }),
  );
}

export function toRawParams(
  tipo: ReportTipo,
  form: ReportFormValues,
): Record<string, unknown> {
  const text = (key: string) => trimmed(form.fields[key]);
  const flag = (key: string) => form.flags[key] ?? false;
  const uncleared = (rows: readonly UnclearedRow[]) =>
    rows.map(({ descricao, valor }) => ({
      descricao: trimmed(descricao),
      valor: trimmed(valor),
    }));

  switch (tipo) {
    case 'evento':
      return {
        atividade: text('atividade'),
        eventoInicio: text('eventoInicio'),
        eventoFim: text('eventoFim'),
        contarAte: text('contarAte'),
        refPendentes: text('refPendentes'),
        ambitoOrcamento: text('ambitoOrcamento'),
        indicadores: form.indicadores.map(({ label, value }) => ({
          label,
          value,
        })),
        notas: text('notas'),
        anexarJson: flag('anexarJson'),
      };
    case 'pegada':
      return {
        dataUltimoRelatorio: text('dataUltimoRelatorio'),
        dataPassagem: text('dataPassagem'),
        direcaoCessante: text('direcaoCessante'),
        direcaoEntrante: text('direcaoEntrante'),
        saldoExtrato: text('saldoExtrato'),
        naoDebitados: uncleared(form.naoDebitados),
        naoCreditados: uncleared(form.naoCreditados),
        contagem: counted(form.contagem),
        moedasPequenas: text('moedasPequenas'),
        aberturaManual: manualOpening(form.fields),
        notas: text('notas'),
        anexarJson: flag('anexarJson'),
      };
    case 'letivo':
      return {
        inicio: text('inicio'),
        fim: text('fim'),
        ambitoOrcamento: text('ambitoOrcamento'),
        aberturaManual: manualOpening(form.fields),
        notas: text('notas'),
        anexar: flag('anexar'),
        anexarJson: flag('anexarJson'),
      };
    case 'fiscal':
      return {
        ano: text('ano'),
        ambitoOrcamento: text('ambitoOrcamento'),
        parecerCF: text('parecerCF'),
        notas: text('notas'),
        anexoMovimentos: flag('anexoMovimentos'),
        aberturaManual: manualOpening(form.fields),
        anexarJson: flag('anexarJson'),
      };
  }
}

export function cashCountTotals(
  contagem: Readonly<Record<string, string>>,
  smallCoins: string,
): { rows: readonly (Cents | null)[]; totalCents: Cents } {
  const rows = DENOMINATION_GRID.map((cents) => {
    const text = (contagem[denominationKey(cents)] ?? '').trim();
    if (text === '') return 0;
    return /^\d+$/.test(text) ? cents * Number(text) : null;
  });
  const coins = smallCoinsCents(smallCoins);
  const totalCents =
    rows.reduce<Cents>((sum, value) => sum + (value ?? 0), 0) + (coins ?? 0);
  return { rows, totalCents };
}

function smallCoinsCents(text: string): Cents | null {
  const parsed = parseMoney(text);
  return 'cents' in parsed && parsed.cents >= 0 ? parsed.cents : null;
}
