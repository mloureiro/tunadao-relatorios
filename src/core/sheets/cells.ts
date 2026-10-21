import { fromExcelSerial, parseDateText, type IsoDate } from '../dates.ts';
import { groupThousands } from '../format.ts';
import {
  issueMessages,
  makeIssue,
  type Issue,
  type IssueCode,
  type IssueLocation,
} from '../issues.ts';
import { normalise } from '../text.ts';
import type { GridCell } from './grid.ts';
import type { RawValue } from './types.ts';

export interface Where {
  readonly sheet: string;
  readonly cell: string;
  readonly field: string;
}

export interface Content {
  readonly content: RawValue;
  readonly issues: Issue[];
}

export interface Parsed {
  readonly value: RawValue;
  readonly issues: Issue[];
}

const MIN_DATE_YEAR = 2000;
const MAX_DATE_YEAR = 2100;
const FOUR_DIGITS = /^\d{4}$/;
const DIGITS = /^\d+$/;
const MINUS = '−';

const TRUE_WORDS = new Set(['sim', 's', 'verdadeiro', 'true', '1']);
const FALSE_WORDS = new Set(['nao', 'n', 'falso', 'false', '0']);

export function issueAt(
  code: IssueCode,
  message: string,
  where: IssueLocation,
  suggestion?: string,
): Issue {
  return makeIssue(code, message, where, suggestion);
}

function invalid(where: Where, detail: string): Issue {
  return issueAt(
    'field-invalid',
    issueMessages['field-invalid'](detail),
    where,
  );
}

export function contentOf(cell: GridCell | undefined, where: Where): Content {
  if (cell === undefined) return { content: null, issues: [] };

  if (cell.f !== undefined && (cell.v === undefined || cell.v === '')) {
    return {
      content: null,
      issues: [
        issueAt('formula-no-value', issueMessages['formula-no-value'](), where),
      ],
    };
  }

  if (cell.t === 'e') {
    return {
      content: null,
      issues: [
        invalid(
          where,
          `A célula contém um erro de cálculo (${cell.w ?? 'erro'}).`,
        ),
      ],
    };
  }

  const formulaIssues: Issue[] = [];
  if (cell.f !== undefined) {
    formulaIssues.push(
      issueAt('formula-input', issueMessages['formula-input'](), where),
    );
  }

  const value = cell.v ?? null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return { content: trimmed === '' ? null : trimmed, issues: formulaIssues };
  }
  return { content: value, issues: formulaIssues };
}

function ok(value: RawValue): Parsed {
  return { value, issues: [] };
}

function fail(where: Where, detail: string): Parsed {
  return { value: null, issues: [invalid(where, detail)] };
}

function withinDateYears(iso: IsoDate): boolean {
  const year = Number(iso.slice(0, 4));
  return year >= MIN_DATE_YEAR && year <= MAX_DATE_YEAR;
}

export function parseDate(
  content: RawValue,
  date1904: boolean,
  where: Where,
): Parsed {
  if (content === null) return ok(null);
  const outOfRange = `Data fora do intervalo ${String(MIN_DATE_YEAR)}–${String(MAX_DATE_YEAR)}.`;

  if (typeof content === 'number') {
    const iso = fromExcelSerial(content, date1904);
    if (iso === null) return fail(where, 'Data inválida.');
    return withinDateYears(iso) ? ok(iso) : fail(where, outOfRange);
  }

  if (typeof content === 'string') {
    const iso = parseDateText(content);
    if (iso === null) {
      return fail(
        where,
        `Data inválida: "${content}". Use uma data (dd/mm/aaaa).`,
      );
    }
    if (!withinDateYears(iso)) return fail(where, outOfRange);
    return {
      value: iso,
      issues: [
        issueAt('date-as-text', issueMessages['date-as-text'](content), where),
      ],
    };
  }

  return fail(where, 'Data inválida.');
}

export function parseMoneyCell(content: RawValue, where: Where): Parsed {
  if (content === null || typeof content === 'number') return ok(content);
  return typeof content === 'string'
    ? ok(content)
    : fail(where, 'Valor monetário inválido.');
}

export function parseTextCell(content: RawValue, where: Where): Parsed {
  if (content === null || typeof content === 'string') return ok(content);
  return typeof content === 'number'
    ? ok(String(content))
    : fail(where, 'Escreva texto, não verdadeiro/falso.');
}

export function parseYear(content: RawValue, where: Where): Parsed {
  if (content === null) return ok(null);
  if (typeof content === 'number' && Number.isInteger(content)) {
    return ok(content);
  }
  if (typeof content === 'string' && FOUR_DIGITS.test(content)) {
    return ok(Number(content));
  }
  return fail(where, 'O ano tem de ter 4 algarismos (por exemplo 2026).');
}

export function parseYesNo(content: RawValue, where: Where): Parsed {
  if (content === null || typeof content === 'boolean') return ok(content);
  const word =
    typeof content === 'number' ? String(content) : normalise(content);
  if (TRUE_WORDS.has(word)) return ok(true);
  if (FALSE_WORDS.has(word)) return ok(false);
  return fail(where, 'Escreva Sim ou Não.');
}

export function parseVersion(content: RawValue, where: Where): Parsed {
  const bad =
    'A versão do modelo tem de ser um número inteiro (por exemplo 1).';
  if (content === null) return ok(null);
  if (typeof content === 'number') {
    return Number.isInteger(content) && content >= 1
      ? ok(content)
      : fail(where, bad);
  }
  if (typeof content === 'string' && DIGITS.test(content)) {
    const version = Number(content);
    return version >= 1 ? ok(version) : fail(where, bad);
  }
  return fail(where, bad);
}

export function indicatorNumber(value: number): string {
  const negative = value < 0;
  const magnitude = Math.abs(value);
  const sign = negative ? MINUS : '';
  if (Number.isInteger(magnitude)) {
    return `${sign}${groupThousands(String(magnitude))}`;
  }
  const hundredths = Math.round(magnitude * 100);
  const fraction = hundredths % 100;
  const whole = (hundredths - fraction) / 100;
  return `${sign}${groupThousands(String(whole))},${String(fraction).padStart(2, '0')}`;
}

export function parseIndicatorValue(content: RawValue, where: Where): Parsed {
  if (content === null || typeof content === 'string') return ok(content);
  return typeof content === 'number'
    ? ok(indicatorNumber(content))
    : fail(where, 'Escreva o valor do indicador como texto ou número.');
}

export function parseQuantity(content: RawValue, where: Where): Parsed {
  if (content === null) return ok(null);
  const amount =
    typeof content === 'string' && DIGITS.test(content)
      ? Number(content)
      : content;
  if (typeof amount !== 'number') {
    return fail(where, 'A quantidade tem de ser um número inteiro.');
  }
  if (!Number.isInteger(amount)) {
    return fail(where, 'A quantidade tem de ser um número inteiro.');
  }
  return amount < 0
    ? fail(where, 'A quantidade não pode ser negativa.')
    : ok(amount);
}

export function plainText(content: RawValue): string | null {
  if (content === null) return null;
  return typeof content === 'string' ? content : String(content);
}
