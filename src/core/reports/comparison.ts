import {
  aggregate,
  aggregationKey,
  compareListasOrder,
  previousPeriod,
  type AggregateRow,
  type AggregationLevel,
  type PeriodFigures,
} from '../calc/index.ts';
import type { Cents, Dataset, Movimento } from '../dataset/types.ts';
import { formatMoney, formatMoneySigned } from '../format.ts';
import type { Issue } from '../issues.ts';
import { roundHalfAway } from '../money.ts';
import { periodLabel } from './common.ts';
import type {
  ComparisonBar,
  ComparisonRow,
  YearComparisonSection,
} from './types.ts';

const NOT_AVAILABLE = 'n.d.';

interface Labelled {
  readonly rubrica: string;
  readonly subRubrica?: string | undefined;
  readonly side: 'receita' | 'despesa';
  readonly previousCents: Cents;
  readonly currentCents: Cents;
}

function cellOf(cents: Cents | null): string {
  return cents === null ? NOT_AVAILABLE : formatMoney(cents);
}

function variationOf(current: Cents, previous: Cents | null): string {
  return previous === null
    ? NOT_AVAILABLE
    : formatMoneySigned(current - previous);
}

function row(
  label: string,
  kind: ComparisonRow['kind'],
  previous: Cents | null,
  current: Cents,
): ComparisonRow {
  return {
    label,
    kind,
    previous: cellOf(previous),
    current: formatMoney(current),
    variation: variationOf(current, previous),
  };
}

function mergeRubricas(
  dataset: Dataset,
  level: AggregationLevel,
  previous: readonly AggregateRow[],
  current: readonly AggregateRow[],
): Labelled[] {
  const byRubrica = new Map<string, Labelled>();
  const put = (
    source: AggregateRow,
    field: 'previousCents' | 'currentCents',
  ) => {
    const key = aggregationKey(
      level,
      source.rubrica,
      source.subRubrica ?? source.rubrica,
    );
    const existing = byRubrica.get(key) ?? {
      rubrica: source.rubrica,
      subRubrica: source.subRubrica,
      side: source.side,
      previousCents: 0,
      currentCents: 0,
    };
    byRubrica.set(key, {
      ...existing,
      [field]: source.netCents,
    });
  };
  previous.forEach((source) => {
    put(source, 'previousCents');
  });
  current.forEach((source) => {
    put(source, 'currentCents');
  });
  return [...byRubrica.values()].toSorted((a, b) =>
    compareListasOrder(dataset.lists, a, b),
  );
}

function barsOf(rubricas: readonly Labelled[]): ComparisonBar[] {
  const largest = Math.max(
    0,
    ...rubricas.flatMap((r) => [r.previousCents, r.currentCents]),
  );
  const scaled = (cents: Cents) =>
    largest === 0 || cents <= 0 ? 0 : roundHalfAway(cents * 1000, largest);
  return rubricas.map((r) => ({
    label: r.subRubrica ?? r.rubrica,
    side: r.side,
    previousText: formatMoney(r.previousCents),
    currentText: formatMoney(r.currentCents),
    previousPermille: scaled(r.previousCents),
    currentPermille: scaled(r.currentCents),
  }));
}

export function comparisonSection(
  dataset: Dataset,
  figures: PeriodFigures,
  periodMovements: readonly Movimento[],
  pair: readonly [string, string],
  withBars: boolean,
  level: AggregationLevel,
): { section: YearComparisonSection; issues: Issue[] } {
  const previous = previousPeriod(dataset, figures.start, figures.end, level);
  const title = 'Comparação com o período homólogo';

  if (previous.status === 'sem-dados') {
    return {
      section: {
        kind: 'yearComparison',
        title,
        status: 'sem-dados',
        labels: pair,
        message: `Sem dados no período de comparação (${periodLabel(previous.start, previous.end)}).`,
        rows: [],
      },
      issues: previous.issues,
    };
  }

  const current = aggregate(periodMovements, dataset.lists, level).rows;
  const rubricas = mergeRubricas(dataset, level, previous.rows, current);
  const ofSide = (side: 'receita' | 'despesa'): ComparisonRow[] =>
    rubricas
      .filter((r) => r.side === side)
      .map((r) =>
        row(r.subRubrica ?? r.rubrica, side, r.previousCents, r.currentCents),
      );

  const { recebidoCents, pagoCents } = figures;
  const previousResultado = previous.recebidoCents - previous.pagoCents;

  return {
    section: {
      kind: 'yearComparison',
      title,
      status: 'ok',
      labels: pair,
      rows: [
        row(
          'Saldo inicial',
          'saldo',
          previous.opening.totalCents,
          figures.opening.totalCents,
        ),
        ...ofSide('receita'),
        row('Total recebido', 'total', previous.recebidoCents, recebidoCents),
        ...ofSide('despesa'),
        row('Total pago', 'total', previous.pagoCents, pagoCents),
        row('Resultado', 'total', previousResultado, recebidoCents - pagoCents),
        row(
          'Saldo final',
          'saldo',
          previous.closing.totalCents,
          figures.closing.totalCents,
        ),
      ],
      ...(withBars ? { bars: barsOf(rubricas) } : {}),
    },
    issues: previous.issues,
  };
}
