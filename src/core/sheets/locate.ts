import type { Issue } from '../issues.ts';
import type { CellRef } from './raw-params.ts';

const LOCATED_AT: Readonly<Record<string, string>> = {
  'reconciliation-difference': 'saldoExtrato',
  'cash-count-difference': 'contagem',
  'no-budget': 'ambitoOrcamento',
  'unknown-atividade': 'atividade',
};

export function locateBuilderIssue(
  issue: Issue,
  sheet: string,
  cellOf: ReadonlyMap<string, CellRef>,
): Issue {
  const key = LOCATED_AT[issue.code];
  const target = key === undefined ? undefined : cellOf.get(key);
  return target === undefined
    ? issue
    : { ...issue, sheet, cell: target.cell, field: target.field };
}
