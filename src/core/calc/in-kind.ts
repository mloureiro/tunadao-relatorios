import { inRange, type IsoDate } from '../dates.ts';
import type { Cents, Dataset, Genero } from '../dataset/types.ts';
import { issueMessages, makeIssue, type Issue } from '../issues.ts';
import { sum } from '../money.ts';

export type InKindScope =
  | { readonly atividade: string }
  | { readonly start: IsoDate; readonly end: IsoDate };

export interface InKindResult {
  readonly rows: Genero[];
  readonly totalCents: Cents;
  readonly issues: Issue[];
}

export function inKind(dataset: Dataset, scope: InKindScope): InKindResult {
  const issues: Issue[] = [];
  let rows: Genero[];

  if ('atividade' in scope) {
    rows = dataset.generos.filter((g) => g.atividade === scope.atividade);
  } else {
    rows = dataset.generos.filter(
      (g) => g.data !== null && inRange(g.data, scope.start, scope.end),
    );
    const undated = dataset.generos.filter((g) => g.data === null).length;
    if (undated > 0) {
      issues.push(
        makeIssue('undated-generos', issueMessages['undated-generos'](undated)),
      );
    }
  }

  return {
    rows,
    totalCents: sum(rows.map((g) => g.valorEstimadoCents ?? 0)),
    issues,
  };
}
