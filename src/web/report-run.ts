import type { z } from 'zod';
import type { Config } from '@/core/config/schema';
import type { Issue } from '@/core/issues';
import { buildReport, type LoadResult } from '@/core/pipeline';
import {
  paramsSchemas,
  type ParamsByTipo,
  type ReportJson,
  type ReportTipo,
} from '@/core/reports';
import { fieldErrors, type FieldErrors } from '@/core/reports/field-errors';
import { GENERATOR_VERSION } from '@/core/version';
import { eventoStem, fiscalStem, letivoStem, pegadaStem } from './report-files';
import { toRawParams, type ReportFormValues } from './report-form';

export type Evaluation =
  | { readonly status: 'invalid'; readonly errors: FieldErrors }
  | { readonly status: 'failure'; readonly message: string }
  | { readonly status: 'blocked'; readonly issues: readonly Issue[] }
  | {
      readonly status: 'report';
      readonly report: ReportJson;
      readonly issues: readonly Issue[];
      readonly stem: string;
    };

function run<T extends ReportTipo>(
  tipo: T,
  schema: z.ZodType<ParamsByTipo[T]>,
  stemOf: (params: ParamsByTipo[T]) => string,
  raw: Record<string, unknown>,
  loaded: LoadResult,
  config: Config,
  now: string,
): Evaluation {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: 'invalid',
      errors: fieldErrors(parsed.error.issues, raw),
    };
  }
  const result = buildReport(tipo, loaded, parsed.data, {
    config,
    now,
    generatorVersion: GENERATOR_VERSION,
  });
  return result.status === 'report'
    ? { ...result, stem: stemOf(parsed.data) }
    : result;
}

export function evaluateForm(
  tipo: ReportTipo,
  form: ReportFormValues,
  loaded: LoadResult,
  config: Config,
  now: string,
): Evaluation {
  const raw = toRawParams(tipo, form);
  switch (tipo) {
    case 'evento':
      return run(
        'evento',
        paramsSchemas.evento,
        (p) => eventoStem(p.atividade, p.eventoFim),
        raw,
        loaded,
        config,
        now,
      );
    case 'pegada':
      return run(
        'pegada',
        paramsSchemas.pegada,
        (p) => pegadaStem(p.dataPassagem),
        raw,
        loaded,
        config,
        now,
      );
    case 'letivo':
      return run(
        'letivo',
        paramsSchemas.letivo,
        (p) => letivoStem(p.fim),
        raw,
        loaded,
        config,
        now,
      );
    case 'fiscal':
      return run(
        'fiscal',
        paramsSchemas.fiscal,
        (p) => fiscalStem(p.ano),
        raw,
        loaded,
        config,
        now,
      );
  }
}

export function reportIssues(evaluation: Evaluation): readonly Issue[] {
  return evaluation.status === 'report' || evaluation.status === 'blocked'
    ? evaluation.issues
    : [];
}

export function needsManualOpening(evaluation: Evaluation): boolean {
  return reportIssues(evaluation).some(
    ({ code }) =>
      code === 'missing-opening-balance' || code === 'manual-opening-balance',
  );
}
