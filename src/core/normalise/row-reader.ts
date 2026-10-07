import { fromExcelSerial, parseDateText, type IsoDate } from '../dates.ts';
import type { TabName } from '../dataset/types.ts';
import type { ColumnIndex, ColumnSpecs } from '../input/columns.ts';
import type { Cell, RawTable } from '../input/raw-table.ts';
import {
  issueMessages,
  makeIssue,
  type Issue,
  type IssueCode,
  type IssueLocation,
} from '../issues.ts';
import { parseMoney, type Cents } from '../money.ts';
import { normalise } from '../text.ts';

export const DIRECOES = ['Entrada', 'Saída'] as const;
export const CONTAS = ['Caixa', 'Banco'] as const;
const SIM_NAO = ['Sim', 'Não'] as const;

const DAY_FIRST_TEXT = /^(\d{1,2})([/-])(\d{1,2})\2\d{4}$/;
const COUNT_TEXT = /^\d+(?:[.,]\d+)?$/;

export interface MoneyCell {
  readonly cents: Cents;
}

export class RowReader<S extends ColumnSpecs> {
  failed = false;

  constructor(
    private readonly table: RawTable,
    private readonly tab: TabName,
    private readonly specs: S,
    private readonly index: ColumnIndex<S>,
    private readonly cells: readonly Cell[],
    readonly row: number,
    private readonly issues: Issue[],
  ) {}

  get src(): { file: string; tab: TabName; row: number } {
    return { file: this.table.source, tab: this.tab, row: this.row };
  }

  private raw(key: keyof S & string): Cell {
    const at = this.index[key];
    return at === null ? null : (this.cells[at] ?? null);
  }

  private where(key: keyof S & string): IssueLocation {
    return {
      file: this.table.source,
      tab: this.tab,
      row: this.row,
      column: this.specs[key]?.header ?? key,
    };
  }

  report(
    code: IssueCode,
    message: string,
    key: keyof S & string,
    suggestion?: string,
  ): void {
    const issue = makeIssue(code, message, this.where(key), suggestion);
    this.issues.push(issue);
    if (issue.severity === 'error') this.failed = true;
  }

  text(key: keyof S & string): string | null {
    const cell = this.raw(key);
    return cell === null ? null : String(cell);
  }

  requiredText(key: keyof S & string): string | null {
    const value = this.text(key);
    if (value === null) {
      this.report(
        'required-empty',
        issueMessages['required-empty'](this.specs[key]?.header ?? key),
        key,
      );
    }
    return value;
  }

  date(key: keyof S & string, required: boolean): IsoDate | null {
    const cell = this.raw(key);
    if (cell === null) {
      if (required) this.requiredText(key);
      return null;
    }
    let parsed: IsoDate | null = null;
    if (typeof cell === 'number') {
      parsed = fromExcelSerial(cell, this.table.date1904);
    } else if (typeof cell === 'string') {
      parsed = parseDateText(cell);
    }
    if (parsed === null) {
      this.report(
        'invalid-date',
        issueMessages['invalid-date'](String(cell)),
        key,
      );
    }
    return parsed;
  }

  money(key: keyof S & string, required: boolean): MoneyCell | null {
    const cell = this.raw(key);
    if (cell === null) {
      if (required) this.requiredText(key);
      return null;
    }
    const parsed =
      typeof cell === 'boolean'
        ? ({ issue: 'invalid-number' } as const)
        : parseMoney(cell);
    if ('issue' in parsed) {
      if (parsed.issue === 'required-empty') {
        this.requiredText(key);
      } else {
        this.report(
          'invalid-number',
          issueMessages['invalid-number'](String(cell)),
          key,
        );
      }
      return null;
    }
    if (parsed.subCent) {
      this.report('sub-cent', issueMessages['sub-cent'](String(cell)), key);
    }
    return { cents: parsed.cents };
  }

  count(key: keyof S & string): number | null {
    const cell = this.raw(key);
    if (cell === null) return null;
    let value = Number.NaN;
    if (typeof cell === 'number') value = cell;
    else if (typeof cell === 'string' && COUNT_TEXT.test(cell)) {
      value = Number(cell.replace(',', '.'));
    }
    if (!Number.isFinite(value) || value < 0) {
      this.report(
        'invalid-number',
        issueMessages['invalid-number'](String(cell)),
        key,
      );
      return null;
    }
    return value;
  }

  enumValue<T extends string>(
    key: keyof S & string,
    accepted: readonly T[],
    required: boolean,
  ): T | null {
    const cell = this.raw(key);
    if (cell === null) {
      if (required) this.requiredText(key);
      return null;
    }
    const wanted = normalise(String(cell));
    const match = accepted.find((label) => normalise(label) === wanted);
    if (match === undefined) {
      this.report(
        'invalid-enum',
        issueMessages['invalid-enum'](String(cell), accepted),
        key,
      );
      return null;
    }
    return match;
  }

  yesNo(key: keyof S & string, required: boolean): boolean | null {
    if (typeof this.raw(key) === 'boolean') return this.raw(key) === true;
    const answer = this.enumValue(key, SIM_NAO, required);
    return answer === null ? null : answer === 'Sim';
  }
}

export function warnAmbiguousDateOrder<S extends ColumnSpecs>(
  table: RawTable,
  tab: TabName,
  specs: S,
  index: ColumnIndex<S>,
  key: keyof S & string,
  issues: Issue[],
): void {
  const at = index[key];
  if (at === null) return;

  let firstSuspect = -1;
  let dayOverTwelve = false;
  for (const [offset, cells] of table.rows.entries()) {
    const cell = cells[at];
    const match = typeof cell === 'string' ? DAY_FIRST_TEXT.exec(cell) : null;
    if (match === null) continue;
    if (Number(match[1]) > 12) dayOverTwelve = true;
    if (Number(match[3]) > 12 && firstSuspect < 0) firstSuspect = offset;
  }

  if (firstSuspect >= 0 && !dayOverTwelve) {
    issues.push(
      makeIssue(
        'ambiguous-date-order',
        issueMessages['ambiguous-date-order'](),
        {
          file: table.source,
          tab,
          row: table.firstDataRow + firstSuspect,
          column: specs[key]?.header ?? key,
        },
      ),
    );
  }
}
