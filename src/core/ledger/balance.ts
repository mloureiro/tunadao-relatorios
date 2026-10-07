import { addDays, compare, type IsoDate } from '../dates.ts';
import type { Checkpoint, Conta, Dataset } from '../dataset/types.ts';
import type { Cents } from '../money.ts';

export const CONTAS = ['Caixa', 'Banco'] as const satisfies readonly Conta[];

export interface DayCheckpoint {
  readonly data: IsoDate;
  readonly saldoCents: Cents;
  readonly conflicting: boolean;
  readonly src: Checkpoint['src'];
}

export function checkpointsOf(dataset: Dataset, conta: Conta): DayCheckpoint[] {
  const byDate = new Map<IsoDate, DayCheckpoint>();
  const ordered = dataset.saldos
    .filter((checkpoint) => checkpoint.conta === conta)
    .toSorted((a, b) => compare(a.data, b.data) || a.src.row - b.src.row);

  for (const checkpoint of ordered) {
    const previous = byDate.get(checkpoint.data);
    byDate.set(checkpoint.data, {
      data: checkpoint.data,
      saldoCents: checkpoint.saldoCents,
      conflicting:
        previous !== undefined &&
        (previous.conflicting || previous.saldoCents !== checkpoint.saldoCents),
      src: checkpoint.src,
    });
  }
  return [...byDate.values()];
}

export function movementsBetween(
  dataset: Dataset,
  conta: Conta,
  after: IsoDate,
  upTo: IsoDate,
): Cents {
  return dataset.movimentos.reduce(
    (total, m) =>
      m.conta === conta && m.data > after && m.data <= upTo
        ? total + m.signedCents
        : total,
    0,
  );
}

export function balanceAtEndOf(
  dataset: Dataset,
  conta: Conta,
  date: IsoDate,
): Cents | undefined {
  const latest = checkpointsOf(dataset, conta).findLast(
    (checkpoint) => checkpoint.data <= date,
  );
  return latest === undefined
    ? undefined
    : latest.saldoCents + movementsBetween(dataset, conta, latest.data, date);
}

export function openingBalance(
  dataset: Dataset,
  conta: Conta,
  periodStart: IsoDate,
  manual?: Cents,
): Cents | undefined {
  return balanceAtEndOf(dataset, conta, addDays(periodStart, -1)) ?? manual;
}
