import { addDays, addMonths, type IsoDate } from '../dates.ts';
import type { Cents, Conta, Dataset } from '../dataset/types.ts';
import { balanceAtEndOf } from '../ledger/balance.ts';
import { issueMessages, makeIssue, type Issue } from '../issues.ts';
import {
  aggregate,
  type AggregateRow,
  type AggregationLevel,
} from './aggregate.ts';
import { inPeriod, resultCents, resultMovements } from './period.ts';

export interface NullableSplit {
  readonly caixaCents: Cents | null;
  readonly bancoCents: Cents | null;
  readonly totalCents: Cents | null;
}

export type PreviousPeriod =
  | {
      readonly status: 'sem-dados';
      readonly start: IsoDate;
      readonly end: IsoDate;
      readonly issues: Issue[];
    }
  | {
      readonly status: 'ok';
      readonly start: IsoDate;
      readonly end: IsoDate;
      readonly opening: NullableSplit;
      readonly closing: NullableSplit;
      readonly recebidoCents: Cents;
      readonly pagoCents: Cents;
      readonly rows: AggregateRow[];
      readonly issues: Issue[];
    };

function splitAt(dataset: Dataset, date: IsoDate): NullableSplit {
  const balance = (conta: Conta) =>
    balanceAtEndOf(dataset, conta, date) ?? null;
  const caixaCents = balance('Caixa');
  const bancoCents = balance('Banco');
  return {
    caixaCents,
    bancoCents,
    totalCents:
      caixaCents === null || bancoCents === null
        ? null
        : caixaCents + bancoCents,
  };
}

export function previousPeriod(
  dataset: Dataset,
  start: IsoDate,
  end: IsoDate,
  level: AggregationLevel = 'rubrica',
): PreviousPeriod {
  const previousStart = addMonths(start, -12);
  const previousEnd = addMonths(end, -12);
  const movements = resultMovements(
    inPeriod(dataset.movimentos, previousStart, previousEnd),
  );

  if (movements.length === 0) {
    return {
      status: 'sem-dados',
      start: previousStart,
      end: previousEnd,
      issues: [
        makeIssue('no-previous-data', issueMessages['no-previous-data']()),
      ],
    };
  }

  return {
    status: 'ok',
    start: previousStart,
    end: previousEnd,
    opening: splitAt(dataset, addDays(previousStart, -1)),
    closing: splitAt(dataset, previousEnd),
    ...resultCents(movements, dataset),
    rows: aggregate(movements, dataset.lists, level).rows,
    issues: [],
  };
}
