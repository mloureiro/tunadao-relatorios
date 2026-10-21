import { DENOMINATIONS_CENTS } from '../calc/index.ts';
import type { Config } from '../config/schema.ts';
import { didYouMean, issueMessages, type Issue } from '../issues.ts';
import { parseMoney } from '../money.ts';
import type { ReportTipo } from '../reports/index.ts';
import { closest } from '../text.ts';
import {
  CASH_COUNT_HEADER,
  INDICATORS_HEADER,
  MARKER_LABELS,
  MARKER_SCAN_ROWS,
  MAX_TEXT_CHARS,
  PAIRS_HEADER,
  REPORT_SPECS,
  REPORT_TIPOS,
  SIGNATURES_HEADER,
  SUPPORTED_LAYOUT_VERSION,
  VERSION_FIELD,
  labelKey,
  reportTypeFor,
  type BlockSpec,
  type FieldSpec,
  type ReportSpec,
} from './catalogue.ts';
import {
  contentOf,
  issueAt,
  parseDate,
  parseIndicatorValue,
  parseMoneyCell,
  parseQuantity,
  parseTextCell,
  parseVersion,
  parseYear,
  parseYesNo,
  plainText,
  type Parsed,
  type Where,
} from './cells.ts';
import { cellAddress, type SheetGrid } from './grid.ts';
import type {
  DraftBlock,
  DraftCount,
  DraftField,
  DraftRow,
  DraftSignature,
  DraftValue,
  RawValue,
  SheetDraft,
} from './types.ts';

export interface ReadContext {
  readonly config: Config;
}

const LABEL_COLUMN = 0;
const VALUE_COLUMN = 1;
const LAST_TEXT_COLUMN = 2;

const markerKeys = new Set(MARKER_LABELS.map(labelKey));
const versionKeys = new Set(
  [VERSION_FIELD.label, ...VERSION_FIELD.aliases].map(labelKey),
);

const TYPE_LABELS = REPORT_TIPOS.map((tipo) => REPORT_SPECS[tipo].label);

const DENOMINATIONS: readonly number[] = DENOMINATIONS_CENTS;

function titleKeys(block: BlockSpec): string[] {
  return [block.title, ...block.aliases].map(labelKey);
}

function fieldKeys(field: FieldSpec): string[] {
  return [field.label, ...field.aliases].map(labelKey);
}

class SheetReader {
  readonly issues: Issue[] = [];
  readonly fields: DraftField[] = [];
  readonly blocks: DraftBlock[] = [];
  private readonly fieldByKey = new Map<string, FieldSpec>();
  private readonly blockByKey = new Map<string, BlockSpec>();
  private readonly roles: readonly string[];
  private readonly roleKeys: ReadonlySet<string>;
  version = 1;
  touched = false;
  versionCell: string | null = null;

  constructor(
    private readonly grid: SheetGrid,
    private readonly spec: ReportSpec,
    config: Config,
  ) {
    for (const field of spec.fields) {
      for (const key of fieldKeys(field)) this.fieldByKey.set(key, field);
    }
    for (const block of spec.blocks) {
      for (const key of titleKeys(block)) this.blockByKey.set(key, block);
    }
    this.roles = config.signatures[spec.tipo];
    this.roleKeys = new Set(this.roles.map(labelKey));
  }

  private where(row: number, column: number, field: string): Where {
    return {
      sheet: this.grid.name,
      cell: cellAddress(row, column),
      field,
    };
  }

  private labelAt(row: number): string | null {
    const cell = this.grid.cell(row, LABEL_COLUMN);
    if (cell?.t !== 's' || typeof cell.v !== 'string') return null;
    const text = cell.v.trim();
    return text === '' ? null : text;
  }

  private isKnown(key: string): boolean {
    return (
      this.fieldByKey.has(key) ||
      this.blockByKey.has(key) ||
      markerKeys.has(key) ||
      versionKeys.has(key)
    );
  }

  private isBoundary(row: number, insideSignatures: boolean): boolean {
    const label = this.labelAt(row);
    if (label === null) return false;
    const key = labelKey(label);
    if (insideSignatures && this.roleKeys.has(key)) return false;
    return this.isKnown(key);
  }

  private value(
    row: number,
    column: number,
    field: string,
    parse: (content: RawValue, where: Where) => Parsed,
  ): DraftValue {
    const where = this.where(row, column, field);
    const { content, issues } = contentOf(this.grid.cell(row, column), where);
    const parsed = parse(content, where);
    this.issues.push(...issues, ...parsed.issues);
    return { cell: where.cell, raw: content, value: parsed.value };
  }

  private parserFor(field: FieldSpec): (c: RawValue, w: Where) => Parsed {
    switch (field.kind) {
      case 'date':
        return (content, where) =>
          parseDate(content, this.grid.date1904, where);
      case 'money':
        return parseMoneyCell;
      case 'year':
        return parseYear;
      case 'yesno':
        return parseYesNo;
      case 'text':
      case 'activity':
      case 'budget':
        return parseTextCell;
    }
  }

  read(): void {
    const seen = new Map<string, string>();
    let versionSeen: string | null = null;
    let row = 0;
    while (row < this.grid.rowCount) {
      const label = this.labelAt(row);
      if (label === null) {
        row += 1;
        continue;
      }
      const key = labelKey(label);
      const block = this.blockByKey.get(key);
      const field = this.fieldByKey.get(key);

      if (block !== undefined) {
        row = this.readBlock(block, row);
        continue;
      }
      if (field !== undefined) {
        this.readField(field, row, seen);
      } else if (versionKeys.has(key)) {
        versionSeen = this.readVersion(row, versionSeen);
      } else if (!markerKeys.has(key)) {
        this.reportUnknown(label, row);
      }
      row += 1;
    }

    for (const field of this.spec.fields) {
      if (field.required && !field.derivable && !seen.has(field.key)) {
        this.issues.push(
          issueAt(
            'field-missing',
            issueMessages['field-missing'](field.label),
            { sheet: this.grid.name, field: field.label },
          ),
        );
      }
    }
  }

  private reportUnknown(label: string, row: number): void {
    const known = [
      ...this.spec.fields.map((field) => field.label),
      ...this.spec.blocks.map((block) => block.title),
    ];
    this.issues.push(
      issueAt(
        'field-unknown',
        issueMessages['field-unknown'](label),
        this.where(row, LABEL_COLUMN, label),
        didYouMean(closest(label, known)),
      ),
    );
  }

  private readField(
    field: FieldSpec,
    row: number,
    seen: Map<string, string>,
  ): void {
    const first = seen.get(field.key);
    if (first !== undefined) {
      this.issues.push(
        issueAt(
          'field-duplicate',
          issueMessages['field-duplicate'](field.label, first),
          this.where(row, LABEL_COLUMN, field.label),
        ),
      );
      return;
    }
    seen.set(field.key, cellAddress(row, VALUE_COLUMN));
    const value = this.value(
      row,
      VALUE_COLUMN,
      field.label,
      this.parserFor(field),
    );
    if (value.raw !== null) this.touched = true;
    this.fields.push({ key: field.key, label: field.label, ...value });
  }

  private readVersion(row: number, seen: string | null): string | null {
    if (seen !== null) {
      this.issues.push(
        issueAt(
          'field-duplicate',
          issueMessages['field-duplicate'](VERSION_FIELD.label, seen),
          this.where(row, LABEL_COLUMN, VERSION_FIELD.label),
        ),
      );
      return seen;
    }
    const value = this.value(
      row,
      VALUE_COLUMN,
      VERSION_FIELD.label,
      parseVersion,
    );
    if (typeof value.value === 'number') this.version = value.value;
    this.versionCell = value.cell;
    return value.cell;
  }

  private readBlock(spec: BlockSpec, titleRow: number): number {
    const insideSignatures = spec.kind === 'signatures';
    const header = this.headerFirstColumn(spec);
    let row = titleRow + 1;
    const first = this.labelAt(row);
    if (
      header !== null &&
      first !== null &&
      labelKey(first) === labelKey(header)
    ) {
      row += 1;
    }

    const body: number[] = [];
    while (
      row < this.grid.rowCount &&
      !this.isBoundary(row, insideSignatures)
    ) {
      body.push(row);
      row += 1;
    }

    const title = this.where(titleRow, LABEL_COLUMN, spec.title);
    switch (spec.kind) {
      case 'pairs':
      case 'indicators':
        this.blocks.push({
          kind: spec.kind,
          key: spec.key,
          title: spec.title,
          titleCell: title.cell,
          rows: this.readRows(spec, body),
        });
        break;
      case 'cashCount':
        this.blocks.push({
          kind: 'cashCount',
          key: spec.key,
          title: spec.title,
          titleCell: title.cell,
          counts: this.readCounts(spec, body),
        });
        break;
      case 'text':
        this.blocks.push({
          kind: 'text',
          key: spec.key,
          title: spec.title,
          titleCell: title.cell,
          paragraphs: this.readParagraphs(spec, body, title),
        });
        break;
      case 'signatures':
        this.blocks.push({
          kind: 'signatures',
          key: spec.key,
          title: spec.title,
          titleCell: title.cell,
          lines: this.readSignatures(spec, body),
        });
        break;
    }
    return row;
  }

  private headerFirstColumn(spec: BlockSpec): string | null {
    switch (spec.kind) {
      case 'pairs':
        return PAIRS_HEADER[0];
      case 'indicators':
        return INDICATORS_HEADER[0];
      case 'cashCount':
        return CASH_COUNT_HEADER[0];
      case 'signatures':
        return SIGNATURES_HEADER[0];
      case 'text':
        return null;
    }
  }

  private readRows(spec: BlockSpec, body: readonly number[]): DraftRow[] {
    const rows: DraftRow[] = [];
    for (const row of body) {
      const first = this.value(row, 0, spec.title, parseTextCell);
      const second = this.value(
        row,
        1,
        spec.title,
        spec.kind === 'indicators' ? parseIndicatorValue : parseMoneyCell,
      );
      if (first.raw === null && second.raw === null) continue;
      const missing =
        first.raw === null ? first : second.raw === null ? second : null;
      if (missing !== null) {
        this.issues.push(
          issueAt('field-empty', issueMessages['field-empty'](), {
            sheet: this.grid.name,
            cell: missing.cell,
            field: spec.title,
          }),
        );
      }
      this.touched = true;
      rows.push({ first, second });
    }
    return rows;
  }

  private readCounts(spec: BlockSpec, body: readonly number[]): DraftCount[] {
    const counts: DraftCount[] = [];
    const seen = new Set<number>();
    for (const row of body) {
      const denominationWhere = this.where(row, 0, spec.title);
      const quantityWhere = this.where(row, 1, spec.title);
      const denomination = contentOf(this.grid.cell(row, 0), denominationWhere);
      const quantity = contentOf(this.grid.cell(row, 1), quantityWhere);
      this.issues.push(...denomination.issues, ...quantity.issues);
      if (denomination.content === null && quantity.content === null) continue;
      if (quantity.content !== null) this.touched = true;

      if (denomination.content === null) {
        this.issues.push(
          issueAt(
            'field-empty',
            issueMessages['field-empty'](),
            denominationWhere,
          ),
        );
        continue;
      }

      const cents = this.denominationCents(denomination.content);
      if (cents === null) {
        this.touched = true;
        this.issues.push(
          issueAt(
            'field-invalid',
            issueMessages['field-invalid'](
              `Denominação desconhecida: "${String(denomination.content)}".`,
            ),
            denominationWhere,
          ),
        );
        continue;
      }
      if (seen.has(cents)) {
        this.touched = true;
        this.issues.push(
          issueAt(
            'field-invalid',
            issueMessages['field-invalid'](
              `Denominação repetida: "${String(denomination.content)}".`,
            ),
            denominationWhere,
          ),
        );
        continue;
      }
      seen.add(cents);

      const parsed = parseQuantity(quantity.content, quantityWhere);
      this.issues.push(...parsed.issues);
      counts.push({
        denominationCents: cents,
        denominationCell: denominationWhere.cell,
        quantity: {
          cell: quantityWhere.cell,
          raw: quantity.content,
          value: parsed.value,
        },
      });
    }
    return counts;
  }

  private denominationCents(content: RawValue): number | null {
    if (typeof content === 'boolean' || content === null) return null;
    const parsed = parseMoney(content);
    if ('issue' in parsed || parsed.subCent) return null;
    return DENOMINATIONS.includes(parsed.cents) ? parsed.cents : null;
  }

  private readParagraphs(
    spec: BlockSpec,
    body: readonly number[],
    title: Where,
  ): string[] {
    const paragraphs: string[] = [];
    for (const row of body) {
      for (let column = 0; column <= LAST_TEXT_COLUMN; column++) {
        const where = this.where(row, column, spec.title);
        const { content, issues } = contentOf(
          this.grid.cell(row, column),
          where,
        );
        this.issues.push(...issues);
        const text = plainText(content);
        if (text === null) continue;
        paragraphs.push(
          ...text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line !== ''),
        );
        break;
      }
    }
    if (paragraphs.length > 0) this.touched = true;
    const length = paragraphs.join('\n').length;
    if (length > MAX_TEXT_CHARS) {
      this.issues.push(
        issueAt(
          'text-too-long',
          issueMessages['text-too-long'](length, MAX_TEXT_CHARS),
          title,
        ),
      );
    }
    return paragraphs;
  }

  private readSignatures(
    spec: BlockSpec,
    body: readonly number[],
  ): DraftSignature[] {
    const lines: DraftSignature[] = [];
    for (const row of body) {
      const cargoWhere = this.where(row, 0, spec.title);
      const nameWhere = this.where(row, 1, spec.title);
      const cargo = contentOf(this.grid.cell(row, 0), cargoWhere);
      const name = contentOf(this.grid.cell(row, 1), nameWhere);
      this.issues.push(...cargo.issues, ...name.issues);
      const nameText = plainText(name.content);
      if (nameText === null) continue;
      this.touched = true;

      const cargoText = plainText(cargo.content);
      if (cargoText === null) {
        this.issues.push(
          issueAt('field-empty', issueMessages['field-empty'](), cargoWhere),
        );
        continue;
      }
      const role =
        this.roles.find(
          (candidate) => labelKey(candidate) === labelKey(cargoText),
        ) ?? null;
      if (role === null) {
        this.issues.push(
          issueAt(
            'signature-role-unknown',
            issueMessages['signature-role-unknown'](cargoText),
            cargoWhere,
            didYouMean(closest(cargoText, this.roles)),
          ),
        );
      }
      lines.push({
        cargo: cargoText,
        role,
        name: nameText,
        cell: nameWhere.cell,
      });
    }
    return lines;
  }
}

export interface TypeMarker {
  readonly row: number;
}

export function findTypeMarker(grid: SheetGrid): TypeMarker | null {
  const last = Math.min(grid.rowCount, MARKER_SCAN_ROWS);
  for (let row = 0; row < last; row++) {
    const cell = grid.cell(row, LABEL_COLUMN);
    if (cell?.t === 's' && typeof cell.v === 'string') {
      if (markerKeys.has(labelKey(cell.v))) return { row };
    }
  }
  return null;
}

const FORMULA_CODES: ReadonlySet<string> = new Set([
  'formula-input',
  'formula-no-value',
]);

function emptyDraft(
  sheet: string,
  tipo: ReportTipo | null,
  typeCell: string | null,
  issues: readonly Issue[],
): SheetDraft {
  return {
    sheet,
    tipo,
    typeCell,
    version: 1,
    fields: [],
    blocks: [],
    porPreencher: false,
    issues,
  };
}

function readType(
  grid: SheetGrid,
  marker: TypeMarker | null,
): { tipo: ReportTipo | null; cell: string | null; issues: Issue[] } {
  if (marker === null) {
    return {
      tipo: null,
      cell: null,
      issues: [
        issueAt(
          'report-type-unknown',
          issueMessages['report-type-unknown'](null, TYPE_LABELS),
          { sheet: grid.name, field: MARKER_LABELS[0] },
        ),
      ],
    };
  }
  const where: Where = {
    sheet: grid.name,
    cell: cellAddress(marker.row, VALUE_COLUMN),
    field: MARKER_LABELS[0],
  };
  const { content, issues } = contentOf(
    grid.cell(marker.row, VALUE_COLUMN),
    where,
  );
  const text = plainText(content);
  const tipo = text === null ? null : reportTypeFor(text);
  if (tipo !== null) return { tipo, cell: where.cell, issues };
  return {
    tipo: null,
    cell: where.cell,
    issues: [
      ...issues,
      issueAt(
        'report-type-unknown',
        issueMessages['report-type-unknown'](text, TYPE_LABELS),
        where,
        text === null ? undefined : didYouMean(closest(text, TYPE_LABELS)),
      ),
    ],
  };
}

export function readReportSheet(grid: SheetGrid, ctx: ReadContext): SheetDraft {
  const marker = findTypeMarker(grid);
  const type = readType(grid, marker);
  if (type.tipo === null) {
    return emptyDraft(grid.name, null, type.cell, type.issues);
  }

  const spec: ReportSpec = REPORT_SPECS[type.tipo];
  const reader = new SheetReader(grid, spec, ctx.config);
  reader.read();
  const issues = [...type.issues, ...reader.issues];

  const newer = reader.version > SUPPORTED_LAYOUT_VERSION;
  if (newer) {
    return {
      ...emptyDraft(grid.name, type.tipo, type.cell, [
        issueAt(
          'report-version-newer',
          issueMessages['report-version-newer'](
            reader.version,
            SUPPORTED_LAYOUT_VERSION,
          ),
          {
            sheet: grid.name,
            ...(reader.versionCell === null
              ? {}
              : { cell: reader.versionCell }),
            field: VERSION_FIELD.label,
          },
        ),
      ]),
      version: reader.version,
    };
  }

  const porPreencher =
    !reader.touched &&
    !reader.issues.some(({ code }) => FORMULA_CODES.has(code));
  return {
    sheet: grid.name,
    tipo: type.tipo,
    typeCell: type.cell,
    version: reader.version,
    fields: reader.fields,
    blocks: reader.blocks,
    porPreencher,
    issues: porPreencher ? [] : issues,
  };
}
