import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  compare,
  fromExcelSerial,
  inRange,
  parseDateText,
  parseIso,
} from './dates.ts';

describe('fromExcelSerial()', () => {
  const table: [string, number, boolean, string | null][] = [
    ['1900 first day', 1, false, '1900-01-01'],
    ['day before the leap bug', 59, false, '1900-02-28'],
    ['the non-existent 29 Feb 1900', 60, false, null],
    ['day after the leap bug', 61, false, '1900-03-01'],
    ['epoch year', 25569, false, '1970-01-01'],
    ['recent date', 46295, false, '2026-09-30'],
    ['time of day is dropped', 46295.99, false, '2026-09-30'],
    ['year 9999', 2958465, false, '9999-12-31'],
    ['past year 9999', 2958466, false, null],
    ['zero in 1900 system', 0, false, null],
    ['negative', -1, false, null],
    ['1904 epoch', 0, true, '1904-01-01'],
    ['1904 same day differs by 1462', 46295 - 1462, true, '2026-09-30'],
    ['1904 leap day', 59, true, '1904-02-29'],
    ['1904 negative', -1, true, null],
    ['not finite', Number.NaN, false, null],
  ];

  it.each(table)('%s', (_name, serial, date1904, expected) => {
    expect(fromExcelSerial(serial, date1904)).toBe(expected);
  });
});

describe('parseDateText()', () => {
  const table: [string, string | null][] = [
    ['30/09/2026', '2026-09-30'],
    ['30-09-2026', '2026-09-30'],
    ['2026-09-30', '2026-09-30'],
    ['1/2/2026', '2026-02-01'],
    ['  05/10/2026 ', '2026-10-05'],
    ['29/02/2024', '2024-02-29'],
    ['29/02/2025', null],
    ['31/04/2026', null],
    ['00/01/2026', null],
    ['01/13/2026', null],
    ['30/09-2026', null],
    ['2026-9-3', '2026-09-03'],
    ['30/09/26', null],
    ['01/01/1899', null],
    ['', null],
    ['hoje', null],
  ];

  it.each(table)('%j -> %j', (input, expected) => {
    expect(parseDateText(input)).toBe(expected);
  });
});

describe('addMonths()', () => {
  const table: [string, number, string][] = [
    ['2024-02-29', 12, '2025-02-28'],
    ['2026-08-31', -12, '2025-08-31'],
    ['2026-01-31', 1, '2026-02-28'],
    ['2024-01-31', 1, '2024-02-29'],
    ['2026-03-31', -1, '2026-02-28'],
    ['2026-12-15', 1, '2027-01-15'],
    ['2026-01-15', -1, '2025-12-15'],
    ['2026-05-10', 0, '2026-05-10'],
    ['2026-05-10', 24, '2028-05-10'],
  ];

  it.each(table)('%s %i months -> %s', (iso, months, expected) => {
    expect(addMonths(iso, months)).toBe(expected);
  });

  it('throws when leaving the supported years', () => {
    expect(() => addMonths('1900-01-01', -1)).toThrow(RangeError);
  });
});

describe('addDays()', () => {
  const table: [string, number, string][] = [
    ['2026-09-30', 1, '2026-10-01'],
    ['2026-01-01', -1, '2025-12-31'],
    ['2024-02-28', 1, '2024-02-29'],
    ['2025-02-28', 1, '2025-03-01'],
    ['2026-01-01', 365, '2027-01-01'],
    ['2026-01-01', 0, '2026-01-01'],
  ];

  it.each(table)('%s %i days -> %s', (iso, days, expected) => {
    expect(addDays(iso, days)).toBe(expected);
  });
});

describe('compare() and inRange()', () => {
  it('orders dates', () => {
    expect(compare('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compare('2026-01-02', '2026-01-01')).toBe(1);
    expect(compare('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('includes both ends of the range', () => {
    expect(inRange('2026-01-01', '2026-01-01', '2026-12-31')).toBe(true);
    expect(inRange('2026-12-31', '2026-01-01', '2026-12-31')).toBe(true);
    expect(inRange('2025-12-31', '2026-01-01', '2026-12-31')).toBe(false);
    expect(inRange('2027-01-01', '2026-01-01', '2026-12-31')).toBe(false);
  });
});

describe('parseIso()', () => {
  it.each(['2026-13-01', '2026-02-30', '26-01-01', 'x'])(
    'rejects %j',
    (iso) => {
      expect(() => parseIso(iso)).toThrow(RangeError);
    },
  );
});
