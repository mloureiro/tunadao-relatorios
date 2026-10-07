export type Cents = number;

export type MoneyParse =
  | { readonly cents: Cents; readonly subCent: boolean }
  | { readonly issue: 'required-empty' | 'invalid-number' };

const MAX_EURO_DIGITS = 13;
const THOUSANDS_DOT = /^\d{1,3}(\.\d{3})+$/;
const THOUSANDS_COMMA = /^\d{1,3}(,\d{3})+$/;
const DIGITS = /^\d+$/;
const SPACES = /\s+/g;

export function sum(values: readonly Cents[]): Cents {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

export function roundHalfAway(numerator: number, denominator: number): number {
  if (
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator) ||
    denominator === 0
  ) {
    throw new RangeError(
      `roundHalfAway needs safe integers and a non-zero denominator, got ${String(numerator)}/${String(denominator)}`,
    );
  }
  const negative = numerator < 0 !== denominator < 0;
  const n = Math.abs(numerator);
  const d = Math.abs(denominator);
  const remainder = n % d;
  const quotient = (n - remainder) / d + (remainder * 2 >= d ? 1 : 0);
  return negative && quotient !== 0 ? -quotient : quotient;
}

const NUMBER_DIGITS = /^(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/;

function centsFromDigits(
  whole: string,
  fraction: string,
): { magnitude: number; subCent: boolean } {
  const kept = fraction.slice(0, 2).padEnd(2, '0');
  const dropped = fraction.slice(2);
  const roundUp = dropped !== '' && dropped.charAt(0) >= '5';
  return {
    magnitude: Number(whole) * 100 + Number(kept) + (roundUp ? 1 : 0),
    subCent: /[1-9]/.test(dropped),
  };
}

function signed(magnitude: number, negative: boolean): number {
  return negative && magnitude !== 0 ? -magnitude : magnitude;
}

// Excel keeps 15 significant digits, so a cell shown as 1,005 must not read as the nearest double below it
function fromNumber(value: number): MoneyParse {
  if (!Number.isFinite(value) || Math.abs(value) > 10 ** MAX_EURO_DIGITS) {
    return { issue: 'invalid-number' };
  }
  const match = NUMBER_DIGITS.exec(Math.abs(value).toPrecision(15));
  if (match === null) return { issue: 'invalid-number' };
  const digits = (match[1] ?? '') + (match[2] ?? '');
  const pointAt = (match[1] ?? '').length + Number(match[3] ?? '0');
  const whole =
    pointAt <= 0 ? '0' : digits.padEnd(pointAt, '0').slice(0, pointAt);
  const fraction =
    pointAt <= 0 ? '0'.repeat(-pointAt) + digits : digits.slice(pointAt);
  const { magnitude, subCent } = centsFromDigits(whole, fraction);
  return { cents: signed(magnitude, value < 0), subCent };
}

function splitDecimal(
  body: string,
): { whole: string; fraction: string } | null {
  const lastDot = body.lastIndexOf('.');
  const lastComma = body.lastIndexOf(',');

  if (lastDot >= 0 && lastComma >= 0) {
    const decimalAt = Math.max(lastDot, lastComma);
    const thousands = decimalAt === lastComma ? THOUSANDS_DOT : THOUSANDS_COMMA;
    const whole = body.slice(0, decimalAt);
    if (!thousands.test(whole)) return null;
    return {
      whole: whole.replace(/[.,]/g, ''),
      fraction: body.slice(decimalAt + 1),
    };
  }
  if (lastComma >= 0) {
    if (body.indexOf(',') !== lastComma) return null;
    return {
      whole: body.slice(0, lastComma),
      fraction: body.slice(lastComma + 1),
    };
  }
  if (lastDot >= 0) {
    if (THOUSANDS_DOT.test(body)) {
      return { whole: body.replace(/\./g, ''), fraction: '' };
    }
    if (body.indexOf('.') !== lastDot) return null;
    return { whole: body.slice(0, lastDot), fraction: body.slice(lastDot + 1) };
  }
  return { whole: body, fraction: '' };
}

function fromText(text: string): MoneyParse {
  let body = text.replace(/€/g, '').replace(SPACES, '');
  if (body === '') return { issue: 'required-empty' };

  let negative = false;
  if (body.startsWith('(') && body.endsWith(')')) {
    negative = true;
    body = body.slice(1, -1);
  }
  const sign = body.charAt(0);
  if (sign === '-' || sign === '−' || sign === '+') {
    negative = negative || sign !== '+';
    body = body.slice(1);
  }

  const parts = splitDecimal(body);
  if (parts === null) return { issue: 'invalid-number' };
  const { whole, fraction } = parts;
  const wholeOk = DIGITS.test(whole) && whole.length <= MAX_EURO_DIGITS;
  const fractionOk = fraction === '' || DIGITS.test(fraction);
  if (!wholeOk || !fractionOk) return { issue: 'invalid-number' };

  const { magnitude, subCent } = centsFromDigits(whole, fraction);
  return { cents: signed(magnitude, negative), subCent };
}

export function parseMoney(cell: string | number): MoneyParse {
  return typeof cell === 'number' ? fromNumber(cell) : fromText(cell);
}
