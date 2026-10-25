import type { Dataset } from '../dataset/types.ts';
import { issueMessages, makeIssue, type Issue } from '../issues.ts';
import {
  CONTAS,
  checkpointsOf,
  movementsBetween,
  type DayCheckpoint,
} from './balance.ts';

const SALDO_COLUMN = 'Saldo (€)';

function where(checkpoint: DayCheckpoint) {
  return { ...checkpoint.src, column: SALDO_COLUMN };
}

export function verifyCheckpoints(dataset: Dataset): Issue[] {
  const issues: Issue[] = [];

  for (const conta of CONTAS) {
    const checkpoints = checkpointsOf(dataset, conta);

    for (const checkpoint of checkpoints) {
      if (!checkpoint.conflicting) continue;
      const values = dataset.saldos
        .filter((c) => c.conta === conta && c.data === checkpoint.data)
        .map((c) => c.saldoCents);
      issues.push(
        makeIssue(
          'checkpoint-conflict',
          issueMessages['checkpoint-conflict'](
            conta,
            checkpoint.data,
            values[0] ?? 0,
            values.find((value) => value !== values[0]) ?? 0,
          ),
          where(checkpoint),
        ),
      );
    }

    checkpoints.slice(1).forEach((next, at) => {
      const previous = checkpoints[at];
      if (previous === undefined || previous.conflicting || next.conflicting) {
        return;
      }
      const computed =
        previous.saldoCents +
        movementsBetween(dataset, conta, previous.data, next.data);
      if (computed !== next.saldoCents) {
        issues.push(
          makeIssue(
            'checkpoint-mismatch',
            issueMessages['checkpoint-mismatch'](
              conta,
              next.data,
              next.saldoCents,
              computed,
            ),
            where(next),
          ),
        );
      }
    });
  }
  return issues;
}
