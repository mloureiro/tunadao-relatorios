import { addDays, type IsoDate } from './dates.ts';
import { formatDateLong } from './format.ts';
import { issueMessages, makeIssue, type Issue } from './issues.ts';
import {
  buildReport,
  loadFiles,
  type InputFile,
  type LoadResult,
  type ReportContext,
} from './pipeline.ts';
import type { ReportJson } from './reports/index.ts';
import { REPORT_SPECS } from './sheets/catalogue.ts';
import { crossSheetIssues, type CheckedSheet } from './sheets/checks.ts';
import { reportFileName } from './sheets/file-name.ts';
import type {
  DateLine,
  KeyFigure,
  ReportInstance,
  ReportStatus,
  StarterOffer,
} from './sheets/instance.ts';
import { locateBuilderIssue } from './sheets/locate.ts';
import {
  toRawParams,
  validateDraft,
  type SheetParams,
} from './sheets/raw-params.ts';
import { readReportSheet } from './sheets/read-sheet.ts';
import {
  isReadable,
  periodEndOf,
  resolveDefaults,
  resolvedDate,
  textOf,
  yearOf,
  type Resolution,
} from './sheets/resolve.ts';
import type { SheetDraft } from './sheets/types.ts';
import { summariseDataset, type DataSummary } from './summary.ts';
import {
  exampleCheckpointIssues,
  exampleRowIssues,
} from './validate/examples.ts';

export interface WorkbookResult {
  readonly load: LoadResult;
  readonly summary: DataSummary | null;
  readonly reports: ReportInstance[];
  readonly starters: StarterOffer[];
}

interface Prepared {
  readonly draft: SheetDraft;
  readonly resolution: Resolution;
  readonly order: number;
}

interface ReadyReport {
  readonly sheet: SheetParams;
  readonly end: IsoDate;
}

const hasErrors = (issues: readonly Issue[]): boolean =>
  issues.some(({ severity }) => severity === 'error');

const todayOf = (now: string): IsoDate => now.slice(0, 10);

function statusOf(issues: readonly Issue[]): ReportStatus {
  if (hasErrors(issues)) return 'com-erros';
  return issues.length === 0 ? 'pronto' : 'pronto-com-avisos';
}

function titleOf(draft: SheetDraft): string {
  const { tipo } = draft;
  if (tipo === null) return draft.sheet;
  const { label } = REPORT_SPECS[tipo];
  if (tipo === 'evento') {
    const atividade = textOf(draft, 'atividade');
    return atividade === null ? label : `${label} — ${atividade}`;
  }
  if (tipo === 'fiscal') {
    const year = yearOf(draft);
    return year === null ? label : `${label} ${String(year)}`;
  }
  return label;
}

function endDateOf(
  { draft, resolution }: Prepared,
  load: LoadResult,
): IsoDate | undefined {
  const date = (key: string) => resolvedDate(draft, resolution, key);
  if (!isReadable(draft)) return undefined;
  if (draft.tipo !== 'evento') return periodEndOf(draft) ?? undefined;

  const atividade = textOf(draft, 'atividade');
  const lastOfActivity =
    atividade === null
      ? undefined
      : load.dataset.movimentos
          .filter((m) => m.atividade === atividade)
          .map((m) => m.data)
          .toSorted()
          .at(-1);
  return date('eventoFim') ?? date('contarAte') ?? lastOfActivity;
}

function dateLines({ draft, resolution }: Prepared): DateLine[] {
  const { tipo } = draft;
  if (tipo === null || !isReadable(draft)) return [];
  return REPORT_SPECS[tipo].fields.flatMap((field) => {
    if (field.kind !== 'date') return [];
    const iso = resolvedDate(draft, resolution, field.key);
    if (iso === null) return [];
    const origin = resolution.derived.get(field.key)?.origin;
    return [
      {
        label: field.label,
        text: formatDateLong(iso),
        ...(origin === undefined ? {} : { derivedFrom: origin }),
      },
    ];
  });
}

function keyFiguresOf(report: ReportJson): KeyFigure[] {
  const figures: KeyFigure[] = [];
  for (const section of report.sections) {
    if (section.kind === 'kpis') {
      figures.push(
        ...section.cards.map(({ label, value }) => ({ label, value })),
      );
    }
  }
  if (report.tipo === 'pegada') {
    for (const section of report.sections) {
      if (section.kind === 'cashCount') {
        figures.push({
          label: 'Diferença na contagem de caixa',
          value: section.difference.text,
        });
      }
      if (section.kind === 'reconciliation') {
        figures.push({
          label: 'Diferença na reconciliação bancária',
          value: section.difference.text,
        });
      }
    }
  }
  return figures;
}

interface Evaluated {
  readonly instance: ReportInstance;
  readonly ready?: ReadyReport;
}

function evaluate(
  prepared: Prepared,
  context: {
    readonly load: LoadResult;
    readonly ctx: ReportContext;
    readonly dataBlocked: boolean;
    readonly cross: ReadonlyMap<string, Issue[]>;
  },
): Evaluated {
  const { draft, resolution } = prepared;
  const { load, ctx, dataBlocked, cross } = context;
  const endDate = endDateOf(prepared, load);
  const title = titleOf(draft);
  const dates = draft.porPreencher ? [] : dateLines(prepared);

  const finish = (
    status: ReportStatus,
    issues: Issue[],
    report?: ReportJson,
  ): ReportInstance => ({
    sheet: draft.sheet,
    tipo: draft.tipo,
    status,
    issues,
    dates,
    title,
    fileStem: reportFileName({
      title,
      ...(endDate === undefined ? {} : { endDate }),
    }),
    ...(report === undefined ? {} : { report }),
    keyFigures: report === undefined ? [] : keyFiguresOf(report),
    ...(endDate === undefined ? {} : { endDate }),
  });

  if (draft.porPreencher) {
    return { instance: finish('por-preencher', []) };
  }

  const validation = validateDraft(draft, resolution);
  const sheetIssues = [...validation.issues, ...(cross.get(draft.sheet) ?? [])];

  if (dataBlocked) {
    return { instance: finish('bloqueado-dados', sheetIssues) };
  }

  const { params } = validation;
  if (params === null || hasErrors(sheetIssues)) {
    return { instance: finish('com-erros', sheetIssues) };
  }

  const result = buildReport(params.tipo, load, params.params, ctx);
  if (result.status === 'failure') {
    return {
      instance: finish('com-erros', [
        ...sheetIssues,
        makeIssue(
          'build-failed',
          issueMessages['build-failed'](result.message),
          { sheet: draft.sheet },
        ),
      ]),
    };
  }

  const { cellOf } = toRawParams(draft);
  const issues = [
    ...sheetIssues,
    ...result.issues.map((issue) =>
      locateBuilderIssue(issue, draft.sheet, cellOf),
    ),
  ];
  if (result.status === 'blocked') {
    return { instance: finish('com-erros', issues) };
  }

  return {
    instance: finish(statusOf(issues), issues, result.report),
    ...(endDate === undefined
      ? {}
      : { ready: { sheet: params, end: endDate } }),
  };
}

function rank(instance: ReportInstance): number {
  if (instance.status === 'por-preencher' || instance.tipo === null) return 2;
  return instance.endDate === undefined ? 1 : 0;
}

function sortReports(instances: readonly ReportInstance[]): ReportInstance[] {
  return instances
    .map((instance, index) => ({ instance, index }))
    .toSorted((a, b) => {
      const byRank = rank(a.instance) - rank(b.instance);
      if (byRank !== 0) return byRank;
      const endA = a.instance.endDate ?? '';
      const endB = b.instance.endDate ?? '';
      if (endA !== endB) return endA < endB ? 1 : -1;
      return a.index - b.index;
    })
    .map(({ instance }) => instance);
}

function startersFrom(ready: readonly ReadyReport[]): StarterOffer[] {
  const offers: StarterOffer[] = [];
  const pegadas = ready.filter(({ sheet }) => sheet.tipo === 'pegada');
  const latestPegada = pegadas.toSorted((a, b) => (a.end < b.end ? 1 : -1))[0];
  if (latestPegada?.sheet.tipo === 'pegada') {
    offers.push({
      tipo: 'pegada',
      fileName: 'folha-proxima-pegada.xlsx',
      values: {
        dataUltimoRelatorio: latestPegada.end,
        direcaoCessante: latestPegada.sheet.params.direcaoEntrante,
      },
    });
  }

  const periodEnds = ready
    .filter(({ sheet }) => sheet.tipo !== 'evento')
    .map(({ end }) => end)
    .toSorted();
  const latestEnd = periodEnds.at(-1);
  if (latestEnd !== undefined) {
    offers.push({
      tipo: 'letivo',
      fileName: 'folha-proximo-letivo.xlsx',
      values: { inicio: addDays(latestEnd, 1) },
    });
  }
  return offers;
}

export async function loadWorkbook(
  file: InputFile,
  ctx: ReportContext,
): Promise<WorkbookResult> {
  const { result, tables, reportSheets } = await loadFiles([file]);
  const load: LoadResult = {
    ...result,
    issues: [
      ...result.issues,
      ...exampleRowIssues(tables),
      ...exampleCheckpointIssues(result.dataset),
    ],
  };
  const dataBlocked = hasErrors(load.issues);

  const drafts = reportSheets.map((grid) =>
    readReportSheet(grid, { config: ctx.config }),
  );
  const prepared: Prepared[] = drafts.map((draft, order) => ({
    draft,
    resolution: resolveDefaults(draft, drafts, load.dataset),
    order,
  }));
  const checked: CheckedSheet[] = prepared.map(({ draft, resolution }) => ({
    draft,
    resolution,
  }));
  const cross = crossSheetIssues(checked, load.dataset, todayOf(ctx.now));

  const evaluated = prepared.map((item) =>
    evaluate(item, { load, ctx, dataBlocked, cross }),
  );
  const reports = sortReports(evaluated.map(({ instance }) => instance));
  const ready = evaluated.flatMap(({ ready: report }) =>
    report === undefined ? [] : [report],
  );

  return {
    load,
    summary: dataBlocked ? null : summariseDataset(load.dataset),
    reports,
    starters: startersFrom(ready),
  };
}
