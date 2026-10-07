import { parseIso } from './dates.ts';
import type { Cents } from './money.ts';
import { roundHalfAway } from './money.ts';

const MINUS = '−';
const EURO = ' €';
const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/;

function requireInteger(value: number, what: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(
      `${what} must be a safe integer, got ${String(value)}`,
    );
  }
}

function group(digits: string): string {
  const first = digits.length % 3 || 3;
  const parts = [digits.slice(0, first)];
  for (let at = first; at < digits.length; at += 3)
    parts.push(digits.slice(at, at + 3));
  return parts.join('.');
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function magnitude(cents: Cents): string {
  const abs = Math.abs(cents);
  const fraction = abs % 100;
  return `${group(String((abs - fraction) / 100))},${pad2(fraction)}${EURO}`;
}

export function formatMoney(cents: Cents): string {
  requireInteger(cents, 'cents');
  return `${cents < 0 ? MINUS : ''}${magnitude(cents)}`;
}

export function formatMoneySigned(cents: Cents): string {
  requireInteger(cents, 'cents');
  if (cents === 0) return magnitude(0);
  return `${cents < 0 ? MINUS : '+'}${magnitude(cents)}`;
}

export function formatEuros(cents: Cents): string {
  requireInteger(cents, 'cents');
  const euros = roundHalfAway(cents, 100);
  return `${euros < 0 ? MINUS : ''}${group(String(Math.abs(euros)))}${EURO}`;
}

export function formatPermille(value: number): string {
  requireInteger(value, 'permille');
  const abs = Math.abs(value);
  const tenth = abs % 10;
  return `${value < 0 ? MINUS : ''}${group(String((abs - tenth) / 10))},${String(tenth)}%`;
}

export function formatShare(value: number): string {
  requireInteger(value, 'permille');
  const percent = roundHalfAway(value, 10);
  return `${percent < 0 ? MINUS : ''}${String(Math.abs(percent))}%`;
}

export function formatDate(iso: string): string {
  const { year, month, day } = parseIso(iso);
  return `${pad2(day)}/${pad2(month)}/${String(year).padStart(4, '0')}`;
}

export function formatDateTime(localIso: string): string {
  const match = LOCAL_DATE_TIME.exec(localIso);
  if (match === null)
    throw new RangeError(`Not a local date-time: ${localIso}`);
  return `${formatDate(match[1] ?? '')} ${match[2] ?? ''}:${match[3] ?? ''}`;
}
