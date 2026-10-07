import { describe, expect, it } from 'vitest';
import { formatMoney } from './format.ts';
import { parseMoney, roundHalfAway, sum } from './money.ts';

const NBSP = ' ';
const NNBSP = ' ';
const THIN = ' ';

describe('parseMoney()', () => {
  const accepted: [string, string | number, number][] = [
    ['plain euros', '1234', 123400],
    ['dot thousands with euro sign', '1.234,56 €', 123456],
    ['space thousands', '1 234,56 €', 123456],
    ['no-break space thousands', `1${NBSP}234,56${NBSP}€`, 123456],
    ['narrow no-break space thousands', `1${NNBSP}234,56`, 123456],
    ['thin space thousands', `1${THIN}234,56`, 123456],
    ['parentheses are negative', '(1 234,56)', -123456],
    ['hyphen minus', '-1.234,56', -123456],
    ['unicode minus', '−1.610,00 €', -161000],
    ['explicit plus', '+12,5', 1250],
    ['dot decimal', '1234.56', 123456],
    ['comma decimal', '12,3', 1230],
    ['grouped dot with no decimals is thousands', '1.234', 123400],
    ['single dot with two digits is decimal', '0.50', 50],
    ['comma thousands with dot decimal', '1,234.56', 123456],
    ['millions', '1.234.567,89', 123456789],
    ['one cent', '0,01', 1],
    ['zero', '0,00', 0],
    ['negative zero stays zero', '-0,00', 0],
    ['number', 13844.05, 1384405],
    ['negative number', -1610, -161000],
    ['float noise is rounded', 0.1 + 0.2, 30],
    ['number zero', 0, 0],
  ];

  it.each(accepted)('reads %s', (_name, input, cents) => {
    expect(parseMoney(input)).toEqual({ cents, subCent: false });
  });

  const subCent: [string, string | number, number][] = [
    ['three decimals rounds half away up', '12,345', 1235],
    ['three decimals rounds down', '12,344', 1234],
    ['negative half-cent rounds away from zero', '-12,345', -1235],
    ['long fraction', '0,0049', 0],
    ['number with sub-cent', 0.125, 13],
    ['number half-cent that is below in binary', 1.005, 101],
    ['negative number half-cent', -1.005, -101],
    ['0.145', 0.145, 15],
    ['2.675', 2.675, 268],
    ['0.285', 0.285, 29],
    ['5e-7 rounds to zero', 5e-7, 0],
  ];

  it.each(subCent)('flags sub-cent: %s', (_name, input, cents) => {
    expect(parseMoney(input)).toEqual({ cents, subCent: true });
  });

  it('reads every two-decimal number from 0.00 to 19999.99 exactly', () => {
    for (let cents = 0; cents < 2_000_000; cents++) {
      const result = parseMoney(cents / 100);
      if (!('cents' in result) || result.cents !== cents || result.subCent) {
        expect.fail(`${String(cents / 100)} read as ${JSON.stringify(result)}`);
      }
    }
  });

  it('agrees with the comma text form for every three-decimal number', () => {
    for (let thousandths = 0; thousandths < 1_000_000; thousandths++) {
      const text = `${String(Math.floor(thousandths / 1000))},${String(thousandths % 1000).padStart(3, '0')}`;
      if (
        JSON.stringify(parseMoney(thousandths / 1000)) !==
        JSON.stringify(parseMoney(text))
      ) {
        expect.fail(`${text} disagrees`);
      }
    }
  });

  it('does not flag trailing zeros past the cents', () => {
    expect(parseMoney('12,500')).toEqual({ cents: 1250, subCent: false });
  });

  it.each(['', '  ', '€', NBSP])('reports %j as empty', (input) => {
    expect(parseMoney(input)).toEqual({ issue: 'required-empty' });
  });

  it.each([
    'abc',
    '12,3,4',
    '1.2.3',
    '1.2345.678,90',
    '1,23.4,5',
    '--5',
    '1e5',
    ',50',
    '12,5x',
    '(12,00',
    '12345678901234',
    Number.NaN,
    Number.POSITIVE_INFINITY,
    1e15,
  ])('rejects %j', (input) => {
    expect(parseMoney(input)).toEqual({ issue: 'invalid-number' });
  });

  it('round-trips every formatMoney output', () => {
    const samples = [
      0, 1, -1, 99, 100, 161000, -161000, 1384405, -1384405, 123456789012,
    ];
    for (const cents of samples) {
      expect(parseMoney(formatMoney(cents))).toEqual({ cents, subCent: false });
    }
  });
});

describe('roundHalfAway()', () => {
  const table: [number, number, number][] = [
    [1, 2, 1],
    [-1, 2, -1],
    [1, -2, -1],
    [-1, -2, 1],
    [3, 2, 2],
    [-3, 2, -2],
    [1, 3, 0],
    [-1, 3, 0],
    [2, 3, 1],
    [0, 7, 0],
    [1106, 1, 1106],
    [1384405, 100, 13844],
    [1385000, 100, 13850],
  ];

  it.each(table)('%i / %i = %i', (numerator, denominator, expected) => {
    expect(roundHalfAway(numerator, denominator)).toBe(expected);
  });

  it('never returns negative zero', () => {
    expect(Object.is(roundHalfAway(-1, 3), 0)).toBe(true);
  });

  it.each([
    [1, 0],
    [1.5, 2],
    [1, 0.5],
  ])('throws on %j / %j', (numerator, denominator) => {
    expect(() => roundHalfAway(numerator, denominator)).toThrow(RangeError);
  });
});

describe('sum()', () => {
  it('adds integers and is zero when empty', () => {
    expect(sum([])).toBe(0);
    expect(sum([1, -3, 100])).toBe(98);
  });
});
