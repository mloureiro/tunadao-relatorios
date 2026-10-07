import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatEuros,
  formatMoney,
  formatMoneySigned,
  formatPermille,
  formatShare,
} from './format.ts';

const NBSP = ' ';
const MINUS = '−';

describe('formatMoney()', () => {
  const table: [number, string][] = [
    [1384405, `13.844,05${NBSP}€`],
    [-161000, `${MINUS}1.610,00${NBSP}€`],
    [0, `0,00${NBSP}€`],
    [1, `0,01${NBSP}€`],
    [-1, `${MINUS}0,01${NBSP}€`],
    [99, `0,99${NBSP}€`],
    [100000, `1.000,00${NBSP}€`],
    [99999, `999,99${NBSP}€`],
    [123456789, `1.234.567,89${NBSP}€`],
  ];

  it.each(table)('%i', (cents, expected) => {
    expect(formatMoney(cents)).toBe(expected);
  });

  it.each([1.5, Number.NaN, Infinity])('rejects %j', (cents) => {
    expect(() => formatMoney(cents)).toThrow(RangeError);
  });
});

describe('formatMoneySigned()', () => {
  const table: [number, string][] = [
    [37000, `+370,00${NBSP}€`],
    [-16000, `${MINUS}160,00${NBSP}€`],
    [0, `0,00${NBSP}€`],
    [1, `+0,01${NBSP}€`],
  ];

  it.each(table)('%i', (cents, expected) => {
    expect(formatMoneySigned(cents)).toBe(expected);
  });
});

describe('formatEuros()', () => {
  const table: [number, string][] = [
    [2022520, `20.225${NBSP}€`],
    [2022449, `20.224${NBSP}€`],
    [2022550, `20.226${NBSP}€`],
    [-2022550, `${MINUS}20.226${NBSP}€`],
    [49, `0${NBSP}€`],
    [50, `1${NBSP}€`],
    [-49, `0${NBSP}€`],
    [-50, `${MINUS}1${NBSP}€`],
    [0, `0${NBSP}€`],
    [123456700, `1.234.567${NBSP}€`],
  ];

  it.each(table)('%i', (cents, expected) => {
    expect(formatEuros(cents)).toBe(expected);
  });
});

describe('formatPermille()', () => {
  const table: [number, string][] = [
    [1106, '110,6%'],
    [1000, '100,0%'],
    [0, '0,0%'],
    [5, '0,5%'],
    [-50, `${MINUS}5,0%`],
    [12345, '1.234,5%'],
  ];

  it.each(table)('%i', (value, expected) => {
    expect(formatPermille(value)).toBe(expected);
  });
});

describe('formatShare()', () => {
  const table: [number, string][] = [
    [420, '42%'],
    [425, '43%'],
    [424, '42%'],
    [4, '0%'],
    [5, '1%'],
    [-5, `${MINUS}1%`],
    [1000, '100%'],
  ];

  it.each(table)('%i', (value, expected) => {
    expect(formatShare(value)).toBe(expected);
  });
});

describe('formatDate() and formatDateTime()', () => {
  it('writes dd/mm/aaaa', () => {
    expect(formatDate('2026-09-30')).toBe('30/09/2026');
    expect(formatDate('2026-01-05')).toBe('05/01/2026');
  });

  it('rejects text that is not a calendar date', () => {
    expect(() => formatDate('2026-02-30')).toThrow(RangeError);
  });

  it('writes the trace timestamp as dd/mm/aaaa hh:mm', () => {
    expect(formatDateTime('2026-09-30T14:05:59')).toBe('30/09/2026 14:05');
    expect(formatDateTime('2026-01-05T00:00')).toBe('05/01/2026 00:00');
  });

  it('rejects a date without a time', () => {
    expect(() => formatDateTime('2026-09-30')).toThrow(RangeError);
  });
});
