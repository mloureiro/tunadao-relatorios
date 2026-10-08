import { addDays, type IsoDate } from '../dates.ts';
import type { Cents, Dataset, Movimento } from '../dataset/types.ts';
import { issueMessages, makeIssue, type Issue } from '../issues.ts';
import { roundHalfAway, sum } from '../money.ts';
import { annexFooter, type AnnexFooter } from './annex.ts';
import { pendingAt, type PendingResult } from './pending.ts';
import {
  inPeriod,
  periodFigures,
  sortChronologically,
  type ManualOpening,
  type PeriodFigures,
} from './period.ts';

export const DENOMINATIONS_CENTS = [
  50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1,
] as const;

export type DenominationCents = (typeof DENOMINATIONS_CENTS)[number];

export interface UnclearedItem {
  readonly descricao: string;
  readonly valorCents: Cents;
}

export interface PegadaParams {
  readonly dataUltimoRelatorio: IsoDate;
  readonly dataPassagem: IsoDate;
  readonly saldoExtratoCents: Cents;
  readonly naoDebitados: readonly UnclearedItem[];
  readonly naoCreditados: readonly UnclearedItem[];
  readonly contagem: Readonly<Partial<Record<DenominationCents, number>>>;
  readonly moedasPequenasCents?: Cents;
  readonly aberturaManual?: ManualOpening;
}

export interface CashCountRow {
  readonly denominationCents: DenominationCents;
  readonly quantity: number;
  readonly valueCents: Cents;
}

export interface PositionSegment {
  readonly label: string;
  readonly cents: Cents;
  readonly permille: number;
  readonly negative: boolean;
}

export interface PegadaFigures {
  readonly period: PeriodFigures;
  readonly movements: Movimento[];
  readonly variacaoCents: Cents;
  readonly footer: AnnexFooter;
  readonly reconciliation: {
    readonly saldoExtratoCents: Cents;
    readonly naoDebitadosCents: Cents;
    readonly naoCreditadosCents: Cents;
    readonly adjustedCents: Cents;
    readonly bookBancoCents: Cents;
    readonly differenceCents: Cents;
  };
  readonly cashCount: {
    readonly rows: CashCountRow[];
    readonly smallCoinsCents: Cents;
    readonly countedCents: Cents;
    readonly bookCaixaCents: Cents;
    readonly differenceCents: Cents;
  };
  readonly pending: PendingResult;
  readonly position: {
    readonly segments: PositionSegment[];
    readonly netCents: Cents;
  };
  readonly issues: Issue[];
}

function positionSegments(
  parts: readonly Omit<PositionSegment, 'permille'>[],
): PositionSegment[] {
  const visible = parts.filter((part) => part.cents !== 0);
  const totalAbs = sum(visible.map((part) => Math.abs(part.cents)));
  return visible.map((part) => ({
    ...part,
    permille: roundHalfAway(Math.abs(part.cents) * 1000, totalAbs),
  }));
}

export function pegadaFigures(
  dataset: Dataset,
  params: PegadaParams,
): PegadaFigures {
  const { dataUltimoRelatorio, dataPassagem } = params;
  const start = addDays(dataUltimoRelatorio, 1);
  const period = periodFigures(
    dataset,
    start,
    dataPassagem,
    params.aberturaManual,
  );
  const { issues: periodIssues, ...periodOnly } = period;
  const movements = sortChronologically(
    inPeriod(dataset.movimentos, start, dataPassagem),
  );

  const naoDebitadosCents = sum(params.naoDebitados.map((i) => i.valorCents));
  const naoCreditadosCents = sum(params.naoCreditados.map((i) => i.valorCents));
  const adjustedCents =
    params.saldoExtratoCents - naoDebitadosCents + naoCreditadosCents;
  const reconciliationDifference = adjustedCents - period.closing.bancoCents;

  const rows = DENOMINATIONS_CENTS.map((denominationCents): CashCountRow => {
    const quantity = params.contagem[denominationCents] ?? 0;
    return {
      denominationCents,
      quantity,
      valueCents: denominationCents * quantity,
    };
  });
  const smallCoinsCents = params.moedasPequenasCents ?? 0;
  const countedCents = sum(rows.map((r) => r.valueCents)) + smallCoinsCents;
  const cashDifference = countedCents - period.closing.caixaCents;

  const pending = pendingAt(dataset, dataPassagem);
  const netCents =
    period.closing.totalCents + pending.porReceberCents - pending.porPagarCents;

  const issues = [...periodIssues];
  if (reconciliationDifference !== 0) {
    issues.push(
      makeIssue(
        'reconciliation-difference',
        issueMessages['reconciliation-difference'](reconciliationDifference),
      ),
    );
  }
  if (cashDifference !== 0) {
    issues.push(
      makeIssue(
        'cash-count-difference',
        issueMessages['cash-count-difference'](cashDifference),
      ),
    );
  }

  return {
    period: periodOnly,
    movements,
    variacaoCents: period.closing.totalCents - period.opening.totalCents,
    footer: annexFooter(movements, dataset.lists),
    reconciliation: {
      saldoExtratoCents: params.saldoExtratoCents,
      naoDebitadosCents,
      naoCreditadosCents,
      adjustedCents,
      bookBancoCents: period.closing.bancoCents,
      differenceCents: reconciliationDifference,
    },
    cashCount: {
      rows,
      smallCoinsCents,
      countedCents,
      bookCaixaCents: period.closing.caixaCents,
      differenceCents: cashDifference,
    },
    pending,
    position: {
      segments: positionSegments([
        { label: 'Caixa', cents: period.closing.caixaCents, negative: false },
        { label: 'Banco', cents: period.closing.bancoCents, negative: false },
        { label: 'A receber', cents: pending.porReceberCents, negative: false },
        { label: 'Dívidas', cents: pending.porPagarCents, negative: true },
      ]),
      netCents,
    },
    issues,
  };
}
