import { compare, type IsoDate } from '../dates.ts';
import type { Conta, Dataset } from '../dataset/types.ts';
import { issueMessages, makeIssue, type Issue } from '../issues.ts';
import type { Cents } from '../money.ts';
import { CONTAS, balanceAtEndOf, checkpointsOf } from './balance.ts';

export interface DailyBalance {
  readonly data: IsoDate;
  readonly saldoCents: Cents;
}

export function dailyBalances(dataset: Dataset, conta: Conta): DailyBalance[] {
  const first = checkpointsOf(dataset, conta)[0];
  if (first === undefined) return [];

  const dates = new Set<IsoDate>([first.data]);
  for (const checkpoint of dataset.saldos) {
    if (checkpoint.conta === conta && checkpoint.data >= first.data) {
      dates.add(checkpoint.data);
    }
  }
  for (const m of dataset.movimentos) {
    if (m.conta === conta && m.data > first.data) dates.add(m.data);
  }

  return [...dates].toSorted(compare).map((data) => ({
    data,
    saldoCents: balanceAtEndOf(dataset, conta, data) ?? 0,
  }));
}

export function negativeBalanceIssues(dataset: Dataset): Issue[] {
  const issues: Issue[] = [];
  for (const conta of CONTAS) {
    let negativeRun = false;
    for (const { data, saldoCents } of dailyBalances(dataset, conta)) {
      const negative = saldoCents < 0;
      if (negative && !negativeRun) {
        issues.push(
          makeIssue(
            'negative-balance',
            issueMessages['negative-balance'](conta, data, saldoCents),
          ),
        );
      }
      negativeRun = negative;
    }
  }
  return issues;
}
