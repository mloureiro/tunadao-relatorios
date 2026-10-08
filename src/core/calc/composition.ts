import type { Cents } from '../dataset/types.ts';
import { roundHalfAway, sum } from '../money.ts';

export interface CompositionInput {
  readonly label: string;
  readonly cents: Cents;
}

export interface CompositionSegment extends CompositionInput {
  readonly permille: number;
}

export interface CompositionResult {
  readonly totalCents: Cents;
  readonly segments: CompositionSegment[];
}

export function composition(
  rows: readonly CompositionInput[],
): CompositionResult {
  const totalCents = sum(rows.map((row) => row.cents));
  const segments = rows
    .filter((row) => row.cents !== 0)
    .toSorted((a, b) => b.cents - a.cents)
    .map((row) => ({
      ...row,
      permille:
        totalCents === 0 ? 0 : roundHalfAway(row.cents * 1000, totalCents),
    }));
  return { totalCents, segments };
}
