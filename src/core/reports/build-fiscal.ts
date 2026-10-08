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
import { formatDate } from '../format.ts';
import {
  activitySection,
  bridgeSection,
  budgetSections,
  dedupeIssues,
  hasManualOpening,
  headerOf,
  inKindSection,
  money,
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
import type { FiscalParams } from './params.ts';
import type { BridgeRow, Section } from './types.ts';

function checkedRows(dataset: Dataset, end: string): BridgeRow[] {
  const statement = dataset.saldos.find(
    (checkpoint) =>
      checkpoint.conta === 'Banco' &&
      checkpoint.fonte === 'Extrato' &&
      checkpoint.data === end,
  );
  return statement === undefined
    ? []
    : [
        {
          label: `Saldo conferido com o extrato de ${formatDate(end)}`,
          value: money(statement.saldoCents),
        },
      ];
}

export function buildFiscal(
  dataset: Dataset,
  params: FiscalParams,
  config: Config,
  ctx: BuildContext,
): BuildOutput {
  const { lists } = dataset;
  const year = String(params.ano).padStart(4, '0');
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const figures = periodFigures(dataset, start, end, params.aberturaManual);
  const inside = inPeriod(dataset.movimentos, start, end);
  const result = resultMovements(inside);
  const budget = budgetVsActual(
    dataset,
    params.ambitoOrcamento,
    inside,
    config.aggregation.budgetPeriod,
  );
  const kind = inKind(dataset, { start, end });
  const comparison = comparisonSection(
    dataset,
    figures,
    inside,
    [String(params.ano - 1), String(params.ano)],
    true,
    config.aggregation.comparison,
  );
  const negativeNets = negativeNetIssues(inside, lists, [
    ...(budget.tables === null ? [] : [config.aggregation.budgetPeriod]),
    ...(comparison.section.status === 'ok'
      ? [config.aggregation.comparison]
      : []),
  ]);

  const sections: Section[] = [
    periodKpis(figures),
    bridgeSection(
      figures,
      hasManualOpening(figures.issues),
      checkedRows(dataset, end),
    ),
    ...budgetSections(budget.tables),
    ...present(activitySection(byActivity(result, lists))),
    pendingSection(
      `Direitos e compromissos a 31/12/${year}`,
      end,
      pendingAt(dataset, end),
    ),
    comparison.section,
    ...present(inKindSection(kind.rows, kind.totalCents)),
    ...present(textSection('Parecer do Conselho Fiscal', params.parecerCF)),
    ...present(textSection('Notas / Comentários', params.notas)),
    ...(params.anexoMovimentos
      ? present(
          signedMovementsSection(
            'Movimentos do ano',
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
      tipo: 'fiscal',
      theme: themeOf(config),
      header: headerOf(
        config,
        'Relatório de fim de ano fiscal',
        periodLabel(start, end),
        `Exercício de ${String(params.ano)}`,
      ),
      sections,
      signatures: signaturesOf(config.signatures.fiscal),
      trace: traceOf(ctx, params.anexarJson),
    },
    issues: dedupeIssues([
      ...figures.issues,
      ...budget.issues,
      ...kind.issues,
      ...comparison.issues,
      ...negativeNets,
    ]),
  };
}
