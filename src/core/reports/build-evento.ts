import { budgetVsActual, eventFigures } from '../calc/index.ts';
import type { Config } from '../config/schema.ts';
import type { Dataset } from '../dataset/types.ts';
import { formatDate } from '../format.ts';
import {
  annexFooterLines,
  budgetSections,
  card,
  compositionSection,
  countLabel,
  dedupeIssues,
  headerOf,
  inKindSection,
  movementRow,
  negativeNetIssues,
  pendingSection,
  periodLabel,
  present,
  signaturesOf,
  textSection,
  themeOf,
  traceOf,
  type BuildContext,
  type BuildOutput,
} from './common.ts';
import type { EventoParams } from './params.ts';
import type { Section } from './types.ts';

export function buildEvento(
  dataset: Dataset,
  params: EventoParams,
  config: Config,
  ctx: BuildContext,
): BuildOutput {
  const { lists } = dataset;
  const event = eventFigures(dataset, {
    atividade: params.atividade,
    ...(params.contarAte === undefined ? {} : { contarAte: params.contarAte }),
    refPendentes: params.refPendentes,
  });
  const budget = budgetVsActual(
    dataset,
    params.ambitoOrcamento,
    event.movements,
    config.aggregation.budgetEvent,
  );
  const negativeNets = negativeNetIssues(event.movements, lists, [
    config.aggregation.compositionEvent,
    ...(budget.tables === null ? [] : [config.aggregation.budgetEvent]),
  ]);

  const cards = [
    card(
      'Recebido',
      event.recebidoCents,
      countLabel(event.counts.recebimentos, 'movimento', 'movimentos'),
    ),
    card(
      'Pago',
      event.pagoCents,
      countLabel(event.counts.pagamentos, 'movimento', 'movimentos'),
    ),
    card('Resultado', event.resultadoCents),
    card('Por receber', event.pending.porReceberCents),
    card('Por pagar', event.pending.porPagarCents),
    card(
      'Resultado previsto',
      event.resultadoPrevistoCents,
      'Resultado + por receber − por pagar',
    ),
    ...(event.inKindCents > 0
      ? [card('Apoios em espécie', event.inKindCents, 'Fora do saldo')]
      : []),
  ];

  const sections: Section[] = [
    { kind: 'kpis', cards },
    ...present(
      compositionSection(
        'Composição do recebido',
        config.aggregation.compositionEvent,
        event.movements,
        lists,
        'receita',
      ),
    ),
    ...present(
      compositionSection(
        'Composição do pago',
        config.aggregation.compositionEvent,
        event.movements,
        lists,
        'despesa',
      ),
    ),
    ...budgetSections(budget.tables),
    ...(params.indicadores.length === 0
      ? []
      : [
          {
            kind: 'indicators' as const,
            title: 'Indicadores',
            rows: params.indicadores.map(({ label, value }) => ({
              label,
              value,
            })),
          },
        ]),
    ...present(inKindSection(event.inKindRows, event.inKindCents)),
    pendingSection(
      'Direitos e compromissos do evento',
      params.refPendentes,
      event.pending,
    ),
    ...present(textSection('Notas / Comentários', params.notas)),
    ...(event.cashBook.length === 0
      ? []
      : [
          {
            kind: 'movements' as const,
            title: 'Livro de caixa do evento',
            columns: 'cashbook' as const,
            rows: event.cashBook.map(({ movimento, acumuladoCents }) =>
              movementRow(
                movimento,
                lists,
                config.aggregation.annex,
                acumuladoCents,
              ),
            ),
            footer: annexFooterLines(event.footer),
          },
        ]),
  ];

  const lead =
    event.span === null
      ? params.atividade
      : `${params.atividade} · Movimentos de ${formatDate(event.span.start)} a ${formatDate(event.span.end)}`;

  return {
    report: {
      schemaVersion: 1,
      tipo: 'evento',
      theme: themeOf(config),
      header: headerOf(
        config,
        'Relatório de evento',
        periodLabel(params.eventoInicio, params.eventoFim),
        lead,
      ),
      sections,
      signatures: signaturesOf(config.signatures.evento),
      trace: traceOf(ctx, params.anexarJson),
    },
    issues: dedupeIssues([...event.issues, ...budget.issues, ...negativeNets]),
  };
}
