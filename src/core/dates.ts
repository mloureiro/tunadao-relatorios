export type IsoDate = string;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_FIRST = /^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/;
const YEAR_FIRST = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

const MIN_YEAR = 1900;
const MAX_YEAR = 9999;
const EXCEL_1900_EPOCH = -25569;
// Excel treats 1900 as a leap year, so serial 60 is a non-existent 29/02/1900
const EXCEL_1900_BUG_SERIAL = 60;
const EXCEL_1904_EPOCH = -24107;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear =
    Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

function civilFromDays(days: number): {
  year: number;
  month: number;
  day: number;
} {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) /
      365,
  );
  const dayOfYear =
    dayOfEra -
    (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthIndex = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1;
  const month = monthIndex < 10 ? monthIndex + 3 : monthIndex - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

function toIso(year: number, month: number, day: number): IsoDate {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

function build(year: number, month: number, day: number): IsoDate | null {
  const valid =
    year >= MIN_YEAR &&
    year <= MAX_YEAR &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month);
  return valid ? toIso(year, month, day) : null;
}

function fromDays(days: number): IsoDate | null {
  const { year, month, day } = civilFromDays(days);
  return build(year, month, day);
}

export function parseIso(iso: IsoDate): {
  year: number;
  month: number;
  day: number;
} {
  const match = ISO.exec(iso);
  if (match === null) throw new RangeError(`Not an ISO date: ${iso}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (build(year, month, day) === null)
    throw new RangeError(`Not a calendar date: ${iso}`);
  return { year, month, day };
}

export function fromExcelSerial(
  serial: number,
  date1904: boolean,
): IsoDate | null {
  if (!Number.isFinite(serial)) return null;
  const whole = Math.floor(serial);
  if (date1904) return whole < 0 ? null : fromDays(whole + EXCEL_1904_EPOCH);
  if (whole < 1 || whole === EXCEL_1900_BUG_SERIAL) return null;
  const beforeLeapBug = whole < EXCEL_1900_BUG_SERIAL ? 1 : 0;
  return fromDays(whole + beforeLeapBug + EXCEL_1900_EPOCH);
}

export function parseDateText(text: string): IsoDate | null {
  const trimmed = text.trim();
  const dayFirst = DAY_FIRST.exec(trimmed);
  if (dayFirst !== null) {
    return build(Number(dayFirst[4]), Number(dayFirst[3]), Number(dayFirst[1]));
  }
  const yearFirst = YEAR_FIRST.exec(trimmed);
  if (yearFirst !== null) {
    return build(
      Number(yearFirst[1]),
      Number(yearFirst[2]),
      Number(yearFirst[3]),
    );
  }
  return null;
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const { year, month, day } = parseIso(iso);
  const result = fromDays(daysFromCivil(year, month, day) + days);
  if (result === null)
    throw new RangeError(`Date out of range: ${iso} + ${String(days)} days`);
  return result;
}

export function addMonths(iso: IsoDate, months: number): IsoDate {
  const { year, month, day } = parseIso(iso);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = index - targetYear * 12 + 1;
  const result = build(
    targetYear,
    targetMonth,
    Math.min(day, daysInMonth(targetYear, targetMonth)),
  );
  if (result === null)
    throw new RangeError(
      `Date out of range: ${iso} + ${String(months)} months`,
    );
  return result;
}

export function compare(a: IsoDate, b: IsoDate): -1 | 0 | 1 {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

export function inRange(date: IsoDate, from: IsoDate, to: IsoDate): boolean {
  return compare(date, from) >= 0 && compare(date, to) <= 0;
}
