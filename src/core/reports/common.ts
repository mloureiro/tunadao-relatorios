import {
  aggregate,
  annexFooter,
  classify,
  composition,
  type ActivityResult,
  type ActivityRow as ActivityCalcRow,
  type AggregationLevel,
  type AnnexFooter,
  type BudgetTables,
  type PendingResult,
  type PeriodFigures,
} from '../calc/index.ts';
import type { Config } from '../config/schema.ts';
import type {
  Cents,
  DatasetSource,
  Genero,
  Lists,
  Movimento,
} from '../dataset/types.ts';
import type { IsoDate } from '../dates.ts';
import {
  formatDate,
  formatDateTime,
  formatEuros,
  formatMoney,
  formatMoneySigned,
  formatPermille,
  formatShare,
} from '../format.ts';
import type { Issue } from '../issues.ts';
import { sum } from '../money.ts';
import { permille } from '../percent.ts';
import type {
  BridgeRow,
  BridgeSection,
  BudgetRow,
  BudgetSection,
  ByActivitySection,
  CompositionSection,
  FooterLine,
  InKindSection,
  KpiCard,
  KpisSection,
  Money,
  MovementRow,
  MovementsSection,
  PendingRow,
  PendingSection,
  ReportJson,
  Signature,
  TextSection,
} from './types.ts';

export interface BuildContext {
  readonly now: string;
  readonly sources: readonly DatasetSource[];
  readonly generatorVersion: string;
}

export interface BuildOutput {
  readonly report: ReportJson;
  readonly issues: Issue[];
}

const SHORT_SHA_LENGTH = 12;

export function money(cents: Cents): Money {
  return { cents, text: formatMoney(cents) };
}

export function signedMoney(cents: Cents): Money {
  return { cents, text: formatMoneySigned(cents) };
}

export function countLabel(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

export function periodLabel(start: IsoDate, end: IsoDate): string {
  return start === end
    ? formatDate(start)
    : `${formatDate(start)} a ${formatDate(end)}`;
}

export function card(
  label: string,
  cents: Cents,
  caption?: string,
  emphasis = false,
): KpiCard {
  return {
    label,
    value: formatEuros(cents),
    ...(caption === undefined ? {} : { caption }),
    ...(emphasis ? { emphasis } : {}),
  };
}

export function themeOf(config: Config): ReportJson['theme'] {
  return { ...config.theme };
}

export function traceOf(
  ctx: BuildContext,
  attachReport: boolean,
): ReportJson['trace'] {
  return {
    generatedAt: ctx.now,
    generatedAtLabel: formatDateTime(ctx.now),
    sources: ctx.sources.map(({ name, sha256 }) => ({
      name,
      sha256Short: sha256.slice(0, SHORT_SHA_LENGTH),
    })),
    generatorVersion: ctx.generatorVersion,
    attachReport,
  };
}

export function signaturesOf(
  titles: readonly string[],
  names: readonly (string | undefined)[] = [],
): Signature[] {
  return titles.map((title, index) => {
    const name = names[index];
    return name === undefined ? { title } : { title, name };
  });
}

export function dedupeIssues(issues: readonly Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = JSON.stringify(issue);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function negativeNetIssues(
  movements: readonly Movimento[],
  lists: Lists,
  levels: readonly AggregationLevel[],
): Issue[] {
  return dedupeIssues(
    [...new Set(levels)].flatMap(
      (level) => aggregate(movements, lists, level).issues,
    ),
  );
}

export function hasManualOpening(issues: readonly Issue[]): boolean {
  return issues.some((issue) => issue.code === 'manual-opening-balance');
}

export function textSection(
  title: string,
  text: string | undefined,
): TextSection | null {
  const paragraphs = (text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  return paragraphs.length === 0 ? null : { kind: 'text', title, paragraphs };
}

export function labelOf(row: {
  readonly rubrica: string;
  readonly subRubrica?: string | undefined;
}): string {
  return row.subRubrica ?? row.rubrica;
}

const MAX_COMPOSITION_SEGMENTS = 8;
const FOLDED_SEGMENT_LABEL = 'Restantes rubricas';

interface ComposedSegment {
  readonly label: string;
  readonly cents: Cents;
  readonly permille: number;
  readonly folded?: true;
}

export function compositionSection(
  title: string,
  level: AggregationLevel,
  movements: readonly Movimento[],
  lists: Lists,
  side: 'receita' | 'despesa',
): CompositionSection | null {
  const rows = aggregate(movements, lists, level).rows.filter(
    (row) => row.side === side,
  );
  const positive = composition(
    rows
      .filter((row) => row.netCents > 0)
      .map((row) => ({ label: labelOf(row), cents: row.netCents })),
  );
  if (positive.segments.length === 0) return null;
  const kept =
    positive.segments.length > MAX_COMPOSITION_SEGMENTS
      ? positive.segments.slice(0, MAX_COMPOSITION_SEGMENTS - 1)
      : positive.segments;
  const folded = positive.segments.slice(kept.length);
  const foldedCents = sum(folded.map((segment) => segment.cents));
  const segments: ComposedSegment[] =
    folded.length === 0
      ? kept
      : [
          ...kept,
          {
            label: FOLDED_SEGMENT_LABEL,
            cents: foldedCents,
            permille: permille(foldedCents, positive.totalCents) ?? 0,
            folded: true,
          },
        ];
  return {
    kind: 'composition',
    title,
    total: money(sum(rows.map((row) => row.netCents))),
    segments: segments.map((segment) => ({
      label: segment.label,
      value: money(segment.cents),
      permille: segment.permille,
      shareText: formatShare(segment.permille),
      ...(segment.folded ? { folded: true as const } : {}),
    })),
  };
}

function budgetRow(
  label: string,
  figures: {
    readonly orcadoCents: Cents;
    readonly realizadoCents: Cents;
    readonly desvioCents: Cents;
    readonly execucaoPermille: number | null;
  },
): BudgetRow {
  return {
    label,
    orcado: money(figures.orcadoCents),
    realizado: money(figures.realizadoCents),
    desvio: signedMoney(figures.desvioCents),
    execucao:
      figures.execucaoPermille === null
        ? ''
        : formatPermille(figures.execucaoPermille),
  };
}

const DESPESA_DESVIO_NOTE =
  'Nas despesas, desvio positivo significa que se gastou mais do que o orçado.';

export function budgetSections(tables: BudgetTables | null): BudgetSection[] {
  if (tables === null) return [];
  const sides = [
    ['Receitas: orçado e realizado', 'receita', tables.receitas],
    ['Despesas: orçado e realizado', 'despesa', tables.despesas],
  ] as const;
  return sides
    .filter(([, , table]) => table.rows.length > 0)
    .map(([title, side, table]) => ({
      kind: 'budget',
      title,
      side,
      rows: table.rows.map((row) => budgetRow(row.label, row)),
      total: budgetRow('Total', table.total),
      ...(side === 'despesa' ? { note: DESPESA_DESVIO_NOTE } : {}),
    }));
}

function pendingRows(items: PendingResult['receber']): PendingRow[] {
  return items.map((pendente) => ({
    entidade: pendente.entidade,
    descricao: pendente.descricao,
    ...(pendente.atividade === null ? {} : { atividade: pendente.atividade }),
    registo: formatDate(pendente.dataRegisto),
    valor: money(pendente.valorCents),
    ...(pendente.notas === null ? {} : { notas: pendente.notas }),
  }));
}

export function pendingSection(
  title: string,
  ref: IsoDate,
  pending: PendingResult,
): PendingSection {
  return {
    kind: 'pending',
    title,
    refLabel: `Situação a ${formatDate(ref)}`,
    receber: pendingRows(pending.receber),
    pagar: pendingRows(pending.pagar),
    ...(pending.receber.length === 0 ? { emptyReceber: 'Nada a receber' } : {}),
    ...(pending.pagar.length === 0 ? { emptyPagar: 'Nada a pagar' } : {}),
    totals: {
      receber: money(pending.porReceberCents),
      pagar: money(pending.porPagarCents),
    },
  };
}

export function inKindSection(
  rows: readonly Genero[],
  totalCents: Cents,
): InKindSection | null {
  if (rows.length === 0) return null;
  return {
    kind: 'inKind',
    title: 'Apoios em espécie',
    rows: rows.map((genero) => ({
      ...(genero.data === null ? {} : { data: formatDate(genero.data) }),
      atividade: genero.atividade,
      tipo: genero.tipo,
      ...(genero.quantidade === null ? {} : { quantidade: genero.quantidade }),
      ...(genero.emFalta === null ? {} : { emFalta: String(genero.emFalta) }),
      ...(genero.valorEstimadoCents === null
        ? {}
        : { valor: money(genero.valorEstimadoCents) }),
    })),
    ...(totalCents > 0 ? { total: money(totalCents) } : {}),
  };
}

export function movementRow(
  movimento: Movimento,
  lists: Lists,
  level: AggregationLevel,
  accumulatedCents?: Cents,
): MovementRow {
  const entrada = movimento.tipo === 'Entrada';
  return {
    data: formatDate(movimento.data),
    doc: movimento.doc ?? '',
    descricao: movimento.descricao,
    atividade: movimento.atividade,
    meio: movimento.meio,
    rubrica: level === 'subRubrica' ? movimento.subRubrica : movimento.rubrica,
    valor: money(movimento.signedCents),
    ...(entrada ? { entrada: money(movimento.valorCents) } : {}),
    ...(entrada ? {} : { saida: money(movimento.valorCents) }),
    ...(accumulatedCents === undefined
      ? {}
      : { acumulado: money(accumulatedCents) }),
    refund: classify(movimento, lists).refund,
    outsideResult: !movimento.contaResultado,
  };
}

export function annexFooterLines(footer: AnnexFooter): FooterLine[] {
  const optional = (label: string, cents: Cents): FooterLine[] =>
    cents === 0 ? [] : [{ label, value: money(cents) }];
  const hasRefunds =
    footer.reembolsoEmDespesasCents !== 0 ||
    footer.reembolsoEmReceitasCents !== 0;
  return [
    { label: 'Entradas brutas', value: money(footer.entradasBrutasCents) },
    { label: 'Saídas brutas', value: money(footer.saidasBrutasCents) },
    ...optional(
      'Reembolsos abatidos às despesas (entradas)',
      footer.reembolsoEmDespesasCents,
    ),
    ...optional(
      'Reembolsos abatidos às receitas (saídas)',
      footer.reembolsoEmReceitasCents,
    ),
    ...(hasRefunds
      ? [
          {
            label: 'Recebido (entradas brutas − reembolsos)',
            value: money(footer.recebidoCents),
          },
          {
            label: 'Pago (saídas brutas − reembolsos)',
            value: money(footer.pagoCents),
          },
        ]
      : []),
  ];
}

export function signedMovementsSection(
  title: string,
  movements: readonly Movimento[],
  lists: Lists,
  level: AggregationLevel,
  variationCents: Cents,
): MovementsSection | null {
  if (movements.length === 0) return null;
  const inside = movements.filter((m) => m.contaResultado);
  const outside = movements.filter((m) => !m.contaResultado);
  const outsideCents = sum(outside.map((m) => m.signedCents));
  const footer = annexFooter(inside, lists);
  return {
    kind: 'movements',
    title,
    columns: 'signed',
    rows: inside.map((m) => movementRow(m, lists, level)),
    ...(outside.length === 0
      ? {}
      : {
          outside: {
            title: 'Movimentos fora do resultado',
            rows: outside.map((m) => movementRow(m, lists, level)),
            subtotal: money(outsideCents),
          },
        }),
    footer: [
      ...annexFooterLines(footer),
      ...(outside.length === 0
        ? []
        : [
            {
              label: 'Movimentos fora do resultado',
              value: money(outsideCents),
            },
          ]),
      { label: 'Variação no período', value: money(variationCents) },
    ],
  };
}

export function headerOf(
  config: Config,
  title: string,
  period: string,
  lead?: string,
): ReportJson['header'] {
  return {
    org: config.org.name,
    subtitle: config.org.subtitle,
    title,
    periodLabel: period,
    ...(lead === undefined ? {} : { lead }),
  };
}

export function bridgeSection(
  figures: PeriodFigures,
  manualOpening: boolean,
  extraRows: readonly BridgeRow[] = [],
): BridgeSection {
  return {
    kind: 'bridge',
    title: 'Ponte entre o saldo inicial e o saldo final',
    rows: [
      {
        label: manualOpening
          ? 'Saldo inicial (declarado manualmente)'
          : 'Saldo inicial',
        value: money(figures.opening.totalCents),
      },
      { label: '(+) Recebimentos', value: money(figures.recebidoCents) },
      { label: '(−) Pagamentos', value: money(figures.pagoCents) },
      ...(figures.outrosCents === 0
        ? []
        : [
            {
              label: 'Outros movimentos fora do resultado',
              value: money(figures.outrosCents),
            },
          ]),
      {
        label: 'Saldo final',
        value: money(figures.closing.totalCents),
        emphasis: true,
      },
      { label: 'Em caixa', value: money(figures.closing.caixaCents) },
      { label: 'Em banco', value: money(figures.closing.bancoCents) },
      ...extraRows,
    ],
  };
}

export function periodKpis(figures: PeriodFigures): KpisSection {
  return {
    kind: 'kpis',
    cards: [
      card('Saldo inicial', figures.opening.totalCents),
      card(
        'Recebimentos',
        figures.recebidoCents,
        countLabel(figures.counts.recebimentos, 'movimento', 'movimentos'),
      ),
      card(
        'Pagamentos',
        figures.pagoCents,
        countLabel(figures.counts.pagamentos, 'movimento', 'movimentos'),
      ),
      card(
        'Saldo final',
        figures.closing.totalCents,
        `Caixa\u00A0${formatEuros(figures.closing.caixaCents)} · Banco\u00A0${formatEuros(figures.closing.bancoCents)}`,
      ),
    ],
  };
}

export function activitySection(
  result: ActivityResult,
): ByActivitySection | null {
  if (result.rows.length === 0) return null;
  const moneyRow = (row: Omit<ActivityCalcRow, 'atividade'>) => ({
    recebido: money(row.recebidoCents),
    pago: money(row.pagoCents),
    resultado: money(row.resultadoCents),
  });
  return {
    kind: 'byActivity',
    title: 'Resultado por atividade',
    rows: result.rows.map((row) => ({
      atividade: row.atividade,
      ...moneyRow(row),
    })),
    total: moneyRow(result.total),
  };
}

export function present<T>(section: T | null): T[] {
  return section === null ? [] : [section];
}
