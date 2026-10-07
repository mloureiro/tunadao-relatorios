import type { Dataset } from '../dataset/types.ts';
import type { Issue } from '../issues.ts';
import { negativeBalanceIssues } from '../ledger/daily.ts';
import { verifyCheckpoints } from '../ledger/verify.ts';
import type { UnresolvedMovimento } from '../normalise/movimentos.ts';
import { membershipIssues } from './membership.ts';
import {
  duplicateIssues,
  nonResultRowIssues,
  settledBeforeRegisteredIssues,
  transferIssues,
} from './rows.ts';

export function validateDataset(
  dataset: Dataset,
  unresolved: readonly UnresolvedMovimento[],
  options: { readonly listasMissing?: boolean } = {},
): Issue[] {
  return [
    ...membershipIssues(dataset, unresolved, options.listasMissing === true),
    ...duplicateIssues(dataset),
    ...transferIssues(dataset),
    ...nonResultRowIssues(dataset),
    ...settledBeforeRegisteredIssues(dataset),
    ...verifyCheckpoints(dataset),
    ...negativeBalanceIssues(dataset),
  ];
}
