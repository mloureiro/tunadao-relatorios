import type { Dataset } from '../dataset/types.ts';
import { addDays, type IsoDate } from '../dates.ts';
import { formatDate } from '../format.ts';
import { didYouMean, issueMessages, makeIssue, type Issue } from '../issues.ts';
import { closest } from '../text.ts';
import {
  dateOf,
  isReadable,
  periodEndOf,
  previousPeriod,
  resolvedDate,
  textOf,
  yearOf,
  type Resolution,
} from './resolve.ts';
import type { SheetDraft } from './types.ts';

export interface CheckedSheet {
  readonly draft: SheetDraft;
  readonly resolution: Resolution;
}

interface CheckContext {
  readonly sheets: readonly CheckedSheet[];
  readonly dataset: Dataset;
  readonly today: IsoDate;
}

function cellOfField(draft: SheetDraft, key: string) {
  const field = draft.fields.find((candidate) => candidate.key === key);
  return field === undefined
    ? { sheet: draft.sheet }
    : { sheet: draft.sheet, cell: field.cell, field: field.label };
}

function unknownBudget({ draft }: CheckedSheet, dataset: Dataset): Issue[] {
  const ambito = textOf(draft, 'ambitoOrcamento');
  if (ambito === null || dataset.orcamento.some((l) => l.ambito === ambito)) {
    return [];
  }
  const known = [
    ...new Set([
      ...dataset.orcamento.map((line) => line.ambito),
      ...(dataset.lists.orcamentos ?? []),
    ]),
  ];
  return [
    makeIssue(
      'unknown-budget',
      issueMessages['unknown-budget'](ambito),
      cellOfField(draft, 'ambitoOrcamento'),
      didYouMean(closest(ambito, known)),
    ),
  ];
}

function explicitStart(
  draft: SheetDraft,
): { key: string; start: IsoDate } | null {
  if (draft.tipo === 'pegada') {
    const last = dateOf(draft, 'dataUltimoRelatorio');
    return last === null
      ? null
      : { key: 'dataUltimoRelatorio', start: addDays(last, 1) };
  }
  if (draft.tipo === 'letivo') {
    const start = dateOf(draft, 'inicio');
    return start === null ? null : { key: 'inicio', start };
  }
  return null;
}

function continuity(
  { draft }: CheckedSheet,
  { sheets }: CheckContext,
): Issue[] {
  const explicit = explicitStart(draft);
  const end = periodEndOf(draft);
  if (explicit === null || end === null) return [];

  const previous = previousPeriod(
    sheets.map((sheet) => sheet.draft),
    draft,
    end,
  );
  if (previous === null) return [];

  const expected = addDays(previous.end, 1);
  if (explicit.start === expected) return [];
  return [
    makeIssue(
      'period-continuity',
      issueMessages['period-continuity'](
        explicit.start > expected ? 'gap' : 'overlap',
        explicit.start,
        previous.sheet,
        previous.end,
      ),
      cellOfField(draft, explicit.key),
    ),
  ];
}

function identity(
  draft: SheetDraft,
): { key: string; label: string; cellKey: string } | null {
  switch (draft.tipo) {
    case 'pegada': {
      const date = dateOf(draft, 'dataPassagem');
      return date === null
        ? null
        : {
            key: date,
            label: `passagem a ${formatDate(date)}`,
            cellKey: 'dataPassagem',
          };
    }
    case 'evento': {
      const atividade = textOf(draft, 'atividade');
      if (atividade === null) return null;
      const limit = dateOf(draft, 'contarAte');
      return {
        key: `${atividade}\u0000${limit ?? ''}`,
        label:
          limit === null
            ? `atividade "${atividade}"`
            : `atividade "${atividade}" até ${formatDate(limit)}`,
        cellKey: 'atividade',
      };
    }
    case 'letivo': {
      const end = dateOf(draft, 'fim');
      return end === null
        ? null
        : { key: end, label: `fim a ${formatDate(end)}`, cellKey: 'fim' };
    }
    case 'fiscal': {
      const year = yearOf(draft);
      return year === null
        ? null
        : { key: String(year), label: `ano ${String(year)}`, cellKey: 'ano' };
    }
    case null:
      return null;
  }
}

function duplicates(checked: CheckedSheet, { sheets }: CheckContext): Issue[] {
  const { draft } = checked;
  const own = identity(draft);
  if (own === null) return [];
  const twin = sheets.find(({ draft: other }) => {
    if (other === draft || other.tipo !== draft.tipo || !isReadable(other)) {
      return false;
    }
    return identity(other)?.key === own.key;
  });
  return twin === undefined
    ? []
    : [
        makeIssue(
          'duplicate-report',
          issueMessages['duplicate-report'](twin.draft.sheet, own.label),
          cellOfField(draft, own.cellKey),
        ),
      ];
}

function reportPeriod({
  draft,
  resolution,
}: CheckedSheet): { from: IsoDate; to: IsoDate; endKey: string } | null {
  const date = (key: string) => resolvedDate(draft, resolution, key);
  switch (draft.tipo) {
    case 'pegada': {
      const last = date('dataUltimoRelatorio');
      const end = date('dataPassagem');
      return last === null || end === null
        ? null
        : { from: addDays(last, 1), to: end, endKey: 'dataPassagem' };
    }
    case 'letivo': {
      const from = date('inicio');
      const to = date('fim');
      return from === null || to === null ? null : { from, to, endKey: 'fim' };
    }
    case 'evento': {
      const from = date('eventoInicio');
      const to = date('eventoFim');
      return from === null || to === null
        ? null
        : { from, to, endKey: 'eventoFim' };
    }
    case 'fiscal': {
      const year = yearOf(draft);
      return year === null
        ? null
        : {
            from: `${String(year)}-01-01`,
            to: `${String(year)}-12-31`,
            endKey: 'ano',
          };
    }
    case null:
      return null;
  }
}

function outsideData(
  checked: CheckedSheet,
  { dataset }: CheckContext,
): Issue[] {
  const period = reportPeriod(checked);
  const dates = dataset.movimentos.map(({ data }) => data).toSorted();
  const first = dates.at(0);
  const last = dates.at(-1);
  if (period === null || first === undefined || last === undefined) return [];
  if (period.to >= first && period.from <= last) return [];
  return [
    makeIssue(
      'period-outside-data',
      issueMessages['period-outside-data'](period.from, period.to, first, last),
      cellOfField(checked.draft, period.endKey),
    ),
  ];
}

function inFuture({ draft }: CheckedSheet, { today }: CheckContext): Issue[] {
  const key =
    draft.tipo === 'pegada'
      ? 'dataPassagem'
      : draft.tipo === 'letivo'
        ? 'fim'
        : null;
  const date = key === null ? null : dateOf(draft, key);
  if (key === null || date === null || date <= today) return [];
  return [
    makeIssue(
      'date-in-future',
      issueMessages['date-in-future'](date),
      cellOfField(draft, key),
    ),
  ];
}

export function crossSheetIssues(
  sheets: readonly CheckedSheet[],
  dataset: Dataset,
  today: IsoDate,
): Map<string, Issue[]> {
  const context: CheckContext = { sheets, dataset, today };
  const bySheet = new Map<string, Issue[]>();
  for (const checked of sheets) {
    if (!isReadable(checked.draft)) continue;
    bySheet.set(checked.draft.sheet, [
      ...unknownBudget(checked, dataset),
      ...continuity(checked, context),
      ...duplicates(checked, context),
      ...outsideData(checked, context),
      ...inFuture(checked, context),
    ]);
  }
  return bySheet;
}
