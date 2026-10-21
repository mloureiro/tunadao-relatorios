import { describe, expect, it } from 'vitest';
import { serial } from '../../../tests/support/report-sheet.ts';
import {
  contentOf,
  parseDate,
  parseIndicatorValue,
  parseQuantity,
  parseTextCell,
  parseYear,
  parseYesNo,
  type Where,
} from './cells.ts';

const where: Where = { sheet: 'Folha', cell: 'B4', field: 'Campo' };
const codes = (issues: readonly { code: string }[]) =>
  issues.map(({ code }) => code);

describe('parseDate()', () => {
  it.each([
    [serial('2026-06-15'), false, '2026-06-15'],
    [serial('2026-06-15') + 0.75, false, '2026-06-15'],
    [serial('2026-06-15') - 1462, true, '2026-06-15'],
  ])('reads the serial %s (1904: %s) as %s', (cell, date1904, expected) => {
    expect(parseDate(cell, date1904, where)).toEqual({
      value: expected,
      issues: [],
    });
  });

  it.each([
    ['15/06/2026', '2026-06-15'],
    ['15-06-2026', '2026-06-15'],
    ['2026-06-15', '2026-06-15'],
  ])('accepts the text %s but warns that it was read as text', (text, iso) => {
    const result = parseDate(text, false, where);

    expect(result.value).toBe(iso);
    expect(codes(result.issues)).toEqual(['date-as-text']);
    expect(result.issues[0]).toMatchObject({
      severity: 'warning',
      sheet: 'Folha',
      cell: 'B4',
      field: 'Campo',
    });
  });

  it.each([
    ['31/02/2026'],
    ['amanhã'],
    ['15/06/1999'],
    [serial('1999-12-31')],
    [serial('2101-01-01')],
    [-3],
    [true],
  ])('rejects %s as an invalid date', (cell) => {
    const result = parseDate(cell, false, where);

    expect(result.value).toBeNull();
    expect(codes(result.issues)).toEqual(['field-invalid']);
  });

  it('leaves a blank cell blank without complaint', () => {
    expect(parseDate(null, false, where)).toEqual({ value: null, issues: [] });
  });
});

describe('parseYesNo()', () => {
  it.each([
    ['sim', true],
    ['S', true],
    ['Verdadeiro', true],
    ['TRUE', true],
    [1, true],
    [true, true],
    ['Não', false],
    ['nao', false],
    ['N', false],
    ['FALSO', false],
    [0, false],
    [false, false],
    [null, null],
  ])('reads %j as %j', (cell, expected) => {
    expect(parseYesNo(cell, where)).toEqual({ value: expected, issues: [] });
  });

  it.each([['talvez'], [2], ['']])('rejects %j', (cell) => {
    expect(codes(parseYesNo(cell, where).issues)).toEqual(['field-invalid']);
  });
});

describe('parseYear()', () => {
  it.each([
    [2026, 2026],
    ['2026', 2026],
  ])('reads %j', (cell, expected) => {
    expect(parseYear(cell, where).value).toBe(expected);
  });

  it.each([['26'], [2026.5], [true], ['2026a']])('rejects %j', (cell) => {
    expect(codes(parseYear(cell, where).issues)).toEqual(['field-invalid']);
  });
});

describe('parseTextCell()', () => {
  it('turns a number into its digits and refuses a boolean', () => {
    expect(parseTextCell(2025, where).value).toBe('2025');
    expect(codes(parseTextCell(true, where).issues)).toEqual(['field-invalid']);
  });
});

describe('indicator values', () => {
  it.each([
    [645, '645'],
    [1234, '1.234'],
    [3334.6, '3.334,60'],
    [0.5, '0,50'],
    [-1500, '−1.500'],
    [1234567.891, '1.234.567,89'],
  ])('writes the number %s as %s', (number, expected) => {
    expect(parseIndicatorValue(number, where).value).toBe(expected);
  });

  it('keeps text exactly as typed', () => {
    expect(parseIndicatorValue('22,2%', where).value).toBe('22,2%');
  });
});

describe('parseQuantity()', () => {
  it.each([
    [3, 3],
    ['5', 5],
    [0, 0],
    [null, null],
  ])('reads %j as %j', (cell, expected) => {
    expect(parseQuantity(cell, where)).toEqual({ value: expected, issues: [] });
  });

  it.each([[-1], [1.5], ['x'], [true]])('rejects %j', (cell) => {
    expect(codes(parseQuantity(cell, where).issues)).toEqual(['field-invalid']);
  });
});

describe('contentOf()', () => {
  it('trims text and treats whitespace-only text as blank', () => {
    expect(contentOf({ t: 's', v: '  olá ' }, where).content).toBe('olá');
    expect(contentOf({ t: 's', v: '   ' }, where).content).toBeNull();
    expect(contentOf(undefined, where).content).toBeNull();
  });

  it('uses the cached value of a formula and warns', () => {
    const result = contentOf({ t: 'n', f: 'A1+1', v: 2025 }, where);

    expect(result.content).toBe(2025);
    expect(codes(result.issues)).toEqual(['formula-input']);
  });

  it('refuses a formula that has no cached value', () => {
    const result = contentOf({ t: 'n', f: 'A1+1' }, where);

    expect(result.content).toBeNull();
    expect(result.issues).toMatchObject([
      { code: 'formula-no-value', severity: 'error', cell: 'B4' },
    ]);
  });

  it('reports a cell holding a spreadsheet error', () => {
    const result = contentOf({ t: 'e', v: 42, w: '#N/D' }, where);

    expect(result.content).toBeNull();
    expect(codes(result.issues)).toEqual(['field-invalid']);
    expect(result.issues[0]?.message).toContain('#N/D');
  });
});
