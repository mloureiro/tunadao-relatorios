import type { Config } from './config/schema.ts';
import type { Dataset } from './dataset/types.ts';
import { closestTab } from './input/columns.ts';
import { readCsv } from './input/csv.ts';
import type { RawTable } from './input/raw-table.ts';
import { readXlsx } from './input/xlsx.ts';
import { didYouMean, issueMessages, makeIssue, type Issue } from './issues.ts';
import { closest } from './text.ts';
import { normaliseTables } from './normalise/normalise-tables.ts';
import type { UnresolvedMovimento } from './normalise/movimentos.ts';
import {
  buildEvento,
  buildFiscal,
  buildLetivo,
  buildPegada,
  type BuildContext,
  type BuildOutput,
  type ParamsByTipo,
  type ReportJson,
  type ReportTipo,
} from './reports/index.ts';
import { validateDataset } from './validate/validate-dataset.ts';

export interface InputFile {
  readonly name: string;
  readonly bytes: Uint8Array;
}

export interface LoadResult {
  readonly dataset: Dataset;
  readonly issues: Issue[];
  readonly unresolved: UnresolvedMovimento[];
}

const ZIP_MAGIC = [0x50, 0x4b];
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  return magic.every((byte, position) => bytes[position] === byte);
}

function readTables(file: InputFile): {
  tables: RawTable[];
  issues: Issue[];
} {
  return startsWith(file.bytes, ZIP_MAGIC) || startsWith(file.bytes, OLE_MAGIC)
    ? readXlsx(file.name, file.bytes)
    : { tables: [readCsv(file.name, file.bytes)], issues: [] };
}

function readFile(file: InputFile): { tables: RawTable[]; issues: Issue[] } {
  let tables: RawTable[];
  let sheetIssues: Issue[];
  try {
    ({ tables, issues: sheetIssues } = readTables(file));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      tables: [],
      issues: [
        makeIssue(
          'unreadable-file',
          issueMessages['unreadable-file'](file.name, reason),
          { file: file.name },
        ),
      ],
    };
  }

  const recognised = tables.some((table) => table.tab !== null);
  if (recognised) return { tables, issues: sheetIssues };

  const closest =
    tables.length === 0 ? null : closestTab(tables[0]?.header ?? []);
  return {
    tables: [],
    issues: [
      makeIssue(
        'unrecognised-file',
        issueMessages['unrecognised-file'](file.name, closest),
        { file: file.name },
      ),
      ...sheetIssues,
    ],
  };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export async function loadDataset(
  files: readonly InputFile[],
): Promise<LoadResult> {
  const sources = await Promise.all(
    files.map(async ({ name, bytes }) => ({
      name,
      sha256: await sha256Hex(bytes),
    })),
  );
  const read = files.map(readFile);
  const { dataset, issues, unresolved } = normaliseTables(
    read.flatMap(({ tables }) => tables),
  );
  const listasMissing = !read.some(({ tables }) =>
    tables.some((table) => table.tab === 'Listas'),
  );
  const full: Dataset = { sources, ...dataset };
  return {
    dataset: full,
    issues: [
      ...read.flatMap((result) => result.issues),
      ...issues,
      ...validateDataset(full, unresolved, { listasMissing }),
    ],
    unresolved,
  };
}

export interface ReportContext {
  readonly config: Config;
  readonly now: string;
  readonly generatorVersion: string;
}

export type BuildReportResult =
  | {
      readonly status: 'report';
      readonly report: ReportJson;
      readonly issues: Issue[];
    }
  | { readonly status: 'blocked'; readonly issues: Issue[] }
  | { readonly status: 'failure'; readonly message: string };

type Builder<T extends ReportTipo> = (
  dataset: Dataset,
  params: ParamsByTipo[T],
  config: Config,
  ctx: BuildContext,
) => BuildOutput;

const BUILDERS: { [T in ReportTipo]: Builder<T> } = {
  evento: buildEvento,
  pegada: buildPegada,
  letivo: buildLetivo,
  fiscal: buildFiscal,
};

const hasErrors = (issues: readonly Issue[]): boolean =>
  issues.some((issue) => issue.severity === 'error');

function unknownActivity(
  tipo: ReportTipo,
  dataset: Dataset,
  params: ParamsByTipo[ReportTipo],
): Issue | null {
  if (tipo !== 'evento' || !('atividade' in params)) return null;
  const { atividade } = params;
  const { atividades } = dataset.lists;
  if (atividades.includes(atividade)) return null;
  return makeIssue(
    'unknown-atividade',
    issueMessages['unknown-atividade'](atividade),
    {},
    didYouMean(closest(atividade, atividades)),
  );
}

export function buildReport<T extends ReportTipo>(
  tipo: T,
  loadResult: LoadResult,
  params: ParamsByTipo[T],
  ctx: ReportContext,
): BuildReportResult {
  if (hasErrors(loadResult.issues)) {
    return { status: 'blocked', issues: loadResult.issues };
  }

  const unknown = unknownActivity(tipo, loadResult.dataset, params);
  if (unknown !== null) return { status: 'blocked', issues: [unknown] };

  let output: BuildOutput;
  try {
    output = BUILDERS[tipo](loadResult.dataset, params, ctx.config, {
      now: ctx.now,
      sources: loadResult.dataset.sources,
      generatorVersion: ctx.generatorVersion,
    });
  } catch (error) {
    return {
      status: 'failure',
      message: error instanceof Error ? error.message : String(error),
    };
  }

  return hasErrors(output.issues)
    ? { status: 'blocked', issues: output.issues }
    : { status: 'report', report: output.report, issues: output.issues };
}
