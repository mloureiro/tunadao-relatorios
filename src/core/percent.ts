import { roundHalfAway } from './money.ts';

export function permille(part: number, whole: number): number | null {
  if (whole === 0) return null;
  return roundHalfAway(part * 1000, whole);
}
