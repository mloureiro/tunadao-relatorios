import { addDays, compare, inRange, type IsoDate } from '../dates.ts';
import type { Cents, Conta, Dataset, Movimento } from '../dataset/types.ts';
import { issueMessages, makeIssue, type Issue } from '../issues.ts';
import { sum } from '../money.ts';
import { CONTAS, balanceAtEndOf, movementsBetween } from '../ledger/balance.ts';
import { verifyFromManual } from '../ledger/verify.ts';
import { classify } from './classify.ts';

export type ManualOpening = Readonly<Partial<Record<Conta, Cents>>>;

export interface AccountSplit {
  readonly caixaCents: Cents;
  readonly bancoCents: Cents;
  readonly totalCents: Cents;
}

export interface MovementCounts {
  readonly recebimentos: number;
  readonly pagamentos: number;
}

export interface PeriodFigures {
  readonly start: IsoDate;
  readonly end: IsoDate;
  readonly opening: AccountSplit;
  readonly recebidoCents: Cents;
  readonly pagoCents: Cents;
  readonly outrosCents: Cents;
  readonly closing: AccountSplit;
  readonly counts: MovementCounts;
}

export interface PeriodResult extends PeriodFigures {
  readonly issues: Issue[];
}

export function splitOf(caixaCents: Cents, bancoCents: Cents): AccountSplit {
  return { caixaCents, bancoCents, totalCents: caixaCents + bancoCents };
}

export function inPeriod(
  movements: readonly Movimento[],
  start: IsoDate,
  end: IsoDate,
): Movimento[] {
  return movements.filter((m) => inRange(m.data, start, end));
}

export function resultMovements(movements: readonly Movimento[]): Movimento[] {
  return movements.filter((m) => m.contaResultado);
}

export function sortChronologically(
  movements: readonly Movimento[],
): Movimento[] {
  return movements.toSorted(
    (a, b) => compare(a.data, b.data) || a.src.row - b.src.row,
  );
}

export function countsOf(
  movements: readonly Movimento[],
  dataset: Dataset,
): MovementCounts {
  const sides = movements.map((m) => classify(m, dataset.lists).side);
  return {
    recebimentos: sides.filter((side) => side === 'receita').length,
    pagamentos: sides.filter((side) => side === 'despesa').length,
  };
}

export function resultCents(
  movements: readonly Movimento[],
  dataset: Dataset,
): { recebidoCents: Cents; pagoCents: Cents } {
  const classified = movements.map((m) => classify(m, dataset.lists));
  const total = (side: 'receita' | 'despesa') =>
    sum(
      classified.filter((c) => c.side === side).map((c) => c.contributionCents),
    );
  return { recebidoCents: total('receita'), pagoCents: total('despesa') };
}

export function periodFigures(
  dataset: Dataset,
  start: IsoDate,
  end: IsoDate,
  manualOpening: ManualOpening = {},
): PeriodResult {
  const dayBefore = addDays(start, -1);
  const issues: Issue[] = [];
  const manualUsed: Partial<Record<Conta, Cents>> = {};
  const opening = {} as Record<Conta, Cents>;

  for (const conta of CONTAS) {
    const fromLedger = balanceAtEndOf(dataset, conta, dayBefore);
    const manual = manualOpening[conta];
    if (fromLedger !== undefined) {
      opening[conta] = fromLedger;
    } else if (manual !== undefined) {
      opening[conta] = manual;
      manualUsed[conta] = manual;
      issues.push(
        makeIssue(
          'manual-opening-balance',
          issueMessages['manual-opening-balance'](conta, manual),
        ),
      );
    } else {
      opening[conta] = 0;
      issues.push(
        makeIssue(
          'missing-opening-balance',
          issueMessages['missing-opening-balance'](conta, start),
        ),
      );
    }
  }
  issues.push(...verifyFromManual(dataset, start, manualUsed));

  const closing = {} as Record<Conta, Cents>;
  for (const conta of CONTAS) {
    closing[conta] =
      balanceAtEndOf(dataset, conta, end) ??
      opening[conta] + movementsBetween(dataset, conta, dayBefore, end);
  }

  const inside = inPeriod(dataset.movimentos, start, end);
  const result = resultMovements(inside);
  const { recebidoCents, pagoCents } = resultCents(result, dataset);
  const outrosCents = sum(
    inside.filter((m) => !m.contaResultado).map((m) => m.signedCents),
  );
  const figures: PeriodFigures = {
    start,
    end,
    opening: splitOf(opening.Caixa, opening.Banco),
    recebidoCents,
    pagoCents,
    outrosCents,
    closing: splitOf(closing.Caixa, closing.Banco),
    counts: countsOf(result, dataset),
  };

  const bridge =
    figures.opening.totalCents + recebidoCents - pagoCents + outrosCents;
  if (
    !issues.some((issue) => issue.severity === 'error') &&
    bridge !== figures.closing.totalCents
  ) {
    throw new Error(
      `Balance bridge does not close for ${start}..${end}: ${String(bridge)} != ${String(figures.closing.totalCents)}`,
    );
  }
  return { ...figures, issues };
}
