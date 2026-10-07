import { addDays, type IsoDate } from '../dates.ts';
import type { Conta, Dataset } from '../dataset/types.ts';
import { issueMessages, makeIssue, type Issue } from '../issues.ts';
import type { Cents } from '../money.ts';
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

export function verifyFromManual(
  dataset: Dataset,
  periodStart: IsoDate,
  manual: Readonly<Partial<Record<Conta, Cents>>>,
): Issue[] {
  const openingDay = addDays(periodStart, -1);
  const issues: Issue[] = [];

  for (const conta of CONTAS) {
    const opening = manual[conta];
    const first = checkpointsOf(dataset, conta).find(
      (checkpoint) => checkpoint.data > openingDay && !checkpoint.conflicting,
    );
    if (opening === undefined || first === undefined) continue;

    const computed =
      opening + movementsBetween(dataset, conta, openingDay, first.data);
    if (computed !== first.saldoCents) {
      issues.push(
        makeIssue(
          'manual-opening-mismatch',
          issueMessages['manual-opening-mismatch'](
            conta,
            first.data,
            first.saldoCents,
            computed,
          ),
          where(first),
        ),
      );
    }
  }
  return issues;
}
