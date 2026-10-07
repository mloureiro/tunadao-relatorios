import type { Dataset } from '../dataset/types.ts';
import type { Issue } from '../issues.ts';
import { negativeBalanceIssues } from '../ledger/daily.ts';
import { verifyCheckpoints } from '../ledger/verify.ts';
import type { UnresolvedMovimento } from '../normalise/movimentos.ts';
import { membershipIssues } from './membership.ts';
import {
  duplicateIssues,
  settledBeforeRegisteredIssues,
  transferIssues,
} from './rows.ts';

export function validateDataset(
  dataset: Dataset,
  unresolved: readonly UnresolvedMovimento[],
): Issue[] {
  return [
    ...membershipIssues(dataset, unresolved),
    ...duplicateIssues(dataset),
    ...transferIssues(dataset),
    ...settledBeforeRegisteredIssues(dataset),
    ...verifyCheckpoints(dataset),
    ...negativeBalanceIssues(dataset),
  ];
}
