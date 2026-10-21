import type { z } from 'zod';
import { issueMessages, type Issue } from '../issues.ts';
import { paramsSchemas, type ParamsByTipo } from '../reports/index.ts';
import type { ReportTipo } from '../reports/index.ts';
import { issueAt } from './cells.ts';
import {
  REPORT_SPECS,
  SUPPORTED_LAYOUT_VERSION,
  type ReportSpec,
} from './catalogue.ts';
import type { DraftBlock, SheetDraft } from './types.ts';

export interface CellRef {
  readonly cell: string;
  readonly field: string;
}

export interface RawParams {
  readonly raw: Readonly<Record<string, unknown>>;
  readonly cellOf: ReadonlyMap<string, CellRef>;
}

export type SheetParams = {
  [T in ReportTipo]: { readonly tipo: T; readonly params: ParamsByTipo[T] };
}[ReportTipo];

export interface DraftValidation {
  readonly params: SheetParams | null;
  readonly issues: Issue[];
}

function euroKey(cents: number): string {
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  return fraction === 0
    ? String(whole)
    : `${String(whole)},${String(fraction).padStart(2, '0')}`;
}

function blockRaw(
  block: DraftBlock,
  raw: Record<string, unknown>,
  cellOf: Map<string, CellRef>,
): void {
  const field = block.title;
  switch (block.kind) {
    case 'pairs':
    case 'indicators': {
      const keys =
        block.kind === 'pairs'
          ? { first: 'descricao', second: 'valor' }
          : { first: 'label', second: 'value' };
      const rows: Record<string, unknown>[] = [];
      for (const { first, second } of block.rows) {
        if (first.value === null || second.value === null) continue;
        const prefix = `${block.key}/${String(rows.length)}`;
        rows.push({ [keys.first]: first.value, [keys.second]: second.value });
        cellOf.set(`${prefix}/${keys.first}`, { cell: first.cell, field });
        cellOf.set(`${prefix}/${keys.second}`, { cell: second.cell, field });
      }
      if (rows.length > 0) raw[block.key] = rows;
      break;
    }
    case 'cashCount': {
      const counted: Record<string, unknown> = {};
      for (const { denominationCents, quantity } of block.counts) {
        if (quantity.value === null) continue;
        const key = euroKey(denominationCents);
        counted[key] = quantity.value;
        cellOf.set(`${block.key}/${key}`, { cell: quantity.cell, field });
      }
      if (Object.keys(counted).length > 0) raw[block.key] = counted;
      cellOf.set(block.key, { cell: block.titleCell, field });
      break;
    }
    case 'text':
      if (block.paragraphs.length > 0) {
        raw[block.key] = block.paragraphs.join('\n');
      }
      cellOf.set(block.key, { cell: block.titleCell, field });
      break;
    case 'signatures':
      break;
  }
}

export function toRawParams(draft: SheetDraft): RawParams {
  const raw: Record<string, unknown> = {};
  const cellOf = new Map<string, CellRef>();

  for (const field of draft.fields) {
    cellOf.set(field.key, { cell: field.cell, field: field.label });
    if (field.value !== null) raw[field.key] = field.value;
  }
  for (const block of draft.blocks) blockRaw(block, raw, cellOf);

  return { raw, cellOf };
}

function locate(
  path: readonly PropertyKey[],
  cellOf: ReadonlyMap<string, CellRef>,
): CellRef | null {
  for (let length = path.length; length > 0; length--) {
    const found = cellOf.get(path.slice(0, length).map(String).join('/'));
    if (found !== undefined) return found;
  }
  return null;
}

function isBlankAt(raw: unknown, path: readonly PropertyKey[]): boolean {
  let current = raw;
  for (const step of path) {
    if (typeof current !== 'object' || current === null) return true;
    current = (current as Record<PropertyKey, unknown>)[step];
  }
  return current === undefined || current === '';
}

function fieldLabelFor(spec: ReportSpec, key: string): string {
  return (
    spec.fields.find((field) => field.key === key)?.label ??
    spec.blocks.find((block) => block.key === key)?.title ??
    key
  );
}

export function validateDraft(draft: SheetDraft): DraftValidation {
  const { tipo } = draft;
  if (
    tipo === null ||
    draft.porPreencher ||
    draft.version > SUPPORTED_LAYOUT_VERSION
  ) {
    return { params: null, issues: [...draft.issues] };
  }

  const { raw, cellOf } = toRawParams(draft);
  const spec: ReportSpec = REPORT_SPECS[tipo];
  const parsed = paramsSchemas[tipo].safeParse(raw);
  if (parsed.success) {
    const hasError = draft.issues.some(({ severity }) => severity === 'error');
    return {
      params: hasError ? null : ({ tipo, params: parsed.data } as SheetParams),
      issues: [...draft.issues],
    };
  }

  const located = new Set(
    draft.issues.flatMap((issue) =>
      issue.cell === undefined || issue.severity !== 'error'
        ? []
        : [issue.cell],
    ),
  );
  const missingLabels = new Set(
    draft.issues.flatMap((issue) =>
      issue.code === 'field-missing' && issue.field !== undefined
        ? [issue.field]
        : [],
    ),
  );

  const issues: Issue[] = [...draft.issues];
  const reported = new Set<string>();
  for (const zodIssue of parsed.error.issues) {
    const issue = zodIssueToIssue(zodIssue, {
      draft,
      spec,
      raw,
      cellOf,
      located,
      missingLabels,
    });
    if (issue === null) continue;
    const signature = `${issue.cell ?? ''}|${issue.field ?? ''}|${issue.message}`;
    if (reported.has(signature)) continue;
    reported.add(signature);
    issues.push(issue);
  }
  return { params: null, issues };
}

interface MapContext {
  readonly draft: SheetDraft;
  readonly spec: ReportSpec;
  readonly raw: unknown;
  readonly cellOf: ReadonlyMap<string, CellRef>;
  readonly located: ReadonlySet<string>;
  readonly missingLabels: ReadonlySet<string>;
}

function zodIssueToIssue(
  zodIssue: z.core.$ZodIssue,
  context: MapContext,
): Issue | null {
  const { draft, spec, raw, cellOf, located, missingLabels } = context;
  const path = zodIssue.path;
  const target = locate(path, cellOf);
  const blank = isBlankAt(raw, path);
  const rootKey = path.length === 0 ? null : String(path[0]);
  const label =
    target?.field ??
    (rootKey === null ? 'Relatório' : fieldLabelFor(spec, rootKey));

  if (target === null && missingLabels.has(label)) return null;
  if (target !== null && located.has(target.cell)) return null;

  if (target === null && rootKey !== null) {
    return issueAt('field-missing', issueMessages['field-missing'](label), {
      sheet: draft.sheet,
      field: label,
    });
  }

  const cell = target?.cell ?? draft.typeCell ?? undefined;
  const where = {
    sheet: draft.sheet,
    ...(cell === undefined ? {} : { cell }),
    field: label,
  };
  return blank
    ? issueAt('field-empty', issueMessages['field-empty'](), where)
    : issueAt(
        'field-invalid',
        issueMessages['field-invalid'](zodIssue.message),
        where,
      );
}
