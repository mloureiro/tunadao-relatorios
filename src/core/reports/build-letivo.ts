import {
  budgetVsActual,
  byActivity,
  inKind,
  inPeriod,
  pendingAt,
  periodFigures,
  resultMovements,
  sortChronologically,
} from '../calc/index.ts';
import type { Config } from '../config/schema.ts';
import type { Dataset } from '../dataset/types.ts';
import { addMonths } from '../dates.ts';
import {
  activitySection,
  bridgeSection,
  budgetSections,
  compositionSection,
  dedupeIssues,
  hasManualOpening,
  headerOf,
  inKindSection,
  negativeNetIssues,
  pendingSection,
  periodKpis,
  periodLabel,
  present,
  signaturesOf,
  signedMovementsSection,
  textSection,
  themeOf,
  traceOf,
  type BuildContext,
  type BuildOutput,
} from './common.ts';
import { comparisonSection } from './comparison.ts';
import type { LetivoParams } from './params.ts';
import type { Section } from './types.ts';

export function buildLetivo(
  dataset: Dataset,
  params: LetivoParams,
  config: Config,
  ctx: BuildContext,
): BuildOutput {
  const { lists } = dataset;
  const { inicio, fim } = params;
  const figures = periodFigures(dataset, inicio, fim, params.aberturaManual);
  const inside = inPeriod(dataset.movimentos, inicio, fim);
  const result = resultMovements(inside);
  const budget =
    params.ambitoOrcamento === undefined
      ? null
      : budgetVsActual(
          dataset,
          params.ambitoOrcamento,
          inside,
          config.aggregation.budgetPeriod,
        );
  const kind = inKind(dataset, { start: inicio, end: fim });
  const comparison = comparisonSection(
    dataset,
    figures,
    inside,
    [
      periodLabel(addMonths(inicio, -12), addMonths(fim, -12)),
      periodLabel(inicio, fim),
    ],
    false,
  );
  const negativeNets = negativeNetIssues(inside, lists, [
    config.aggregation.compositionPeriod,
    ...(budget?.tables == null ? [] : [config.aggregation.budgetPeriod]),
    ...(comparison.section.status === 'ok' ? (['rubrica'] as const) : []),
  ]);

  const sections: Section[] = [
    periodKpis(figures),
    bridgeSection(figures, hasManualOpening(figures.issues)),
    ...present(
      compositionSection(
        'Composição do recebido',
        config.aggregation.compositionPeriod,
        result,
        lists,
        'receita',
      ),
    ),
    ...present(
      compositionSection(
        'Composição do pago',
        config.aggregation.compositionPeriod,
        result,
        lists,
        'despesa',
      ),
    ),
    ...budgetSections(budget?.tables ?? null),
    ...present(activitySection(byActivity(result, lists))),
    ...present(
      pendingSection(
        'Pendentes no fim do período',
        fim,
        pendingAt(dataset, fim),
      ),
    ),
    ...present(inKindSection(kind.rows, kind.totalCents)),
    ...present(textSection('Notas / Comentários', params.notas)),
    comparison.section,
    ...(params.anexar
      ? present(
          signedMovementsSection(
            'Movimentos do período',
            sortChronologically(inside),
            lists,
            config.aggregation.annex,
            figures.closing.totalCents - figures.opening.totalCents,
          ),
        )
      : []),
  ];

  return {
    report: {
      schemaVersion: 1,
      tipo: 'letivo',
      theme: themeOf(config),
      header: headerOf(
        config,
        'Relatório de fim de ano letivo',
        periodLabel(inicio, fim),
      ),
      sections,
      signatures: signaturesOf(config.signatures.letivo),
      trace: traceOf(ctx, params.anexarJson),
    },
    issues: dedupeIssues([
      ...figures.issues,
      ...(budget?.issues ?? []),
      ...kind.issues,
      ...comparison.issues,
      ...negativeNets,
    ]),
  };
}
