import { describe, expect, it } from 'vitest';
import {
  emptyDataset,
  genero,
  linha,
  mov,
  pendente,
} from '../../../tests/support/dataset.ts';
import {
  CONFIG,
  CONTEXT,
  budgetOf,
  eur,
  kindsOf,
  movementsOf,
  sectionOf,
} from '../../../tests/support/reports.ts';
import { buildEvento } from './build-evento.ts';
import { eventoParamsSchema } from './params.ts';

const build = (
  dataset: ReturnType<typeof emptyDataset>,
  extra: Record<string, unknown> = {},
) =>
  buildEvento(
    dataset,
    eventoParamsSchema.parse({
      atividade: 'Festival Alfa',
      eventoInicio: '2026-04-30',
      eventoFim: '2026-05-03',
      refPendentes: '2026-06-15',
      ...extra,
    }),
    CONFIG,
    CONTEXT,
  );

const movimentos = [
  mov({ data: '2026-05-01', cents: 10000 }),
  mov({ data: '2026-05-02', cents: 4000, tipo: 'Saída' }),
  mov({ data: '2026-05-03', cents: 500, rubrica: 'Licenças e SPA' }),
  mov({
    data: '2026-05-03',
    cents: 3000,
    tipo: 'Saída',
    rubrica: 'Transferências internas',
  }),
  mov({ data: '2026-05-04', cents: 900, atividade: 'Serenata' }),
];

describe('buildEvento()', () => {
  it('lists the cash book with the result movements only, a running result and the refund marked', () => {
    const section = movementsOf(build(emptyDataset({ movimentos })).report);

    expect(section.columns).toBe('cashbook');
    expect(section.rows.map((row) => row.acumulado?.cents)).toEqual([
      10000, 6000, 6500,
    ]);
    expect(section.rows.map((row) => row.refund)).toEqual([false, false, true]);
    expect(section.rows.some((row) => row.outsideResult)).toBe(false);
    expect(section.outside).toBeUndefined();
    expect(
      section.footer.find((line) => line.label.startsWith('Recebido'))?.value
        .text,
    ).toBe(eur('100,00 €'));
  });

  it('puts the optional sections in the event order and shows in-kind in the summary only when it has a value', () => {
    const dataset = emptyDataset({
      movimentos,
      orcamento: [
        linha({ orcadoCents: 12000 }),
        linha({ tipo: 'Saída', orcadoCents: 5000 }),
      ],
      pendentes: [pendente({ dataRegisto: '2026-05-01' })],
      generos: [genero({ valorEstimadoCents: 25000 })],
    });

    const { report } = build(dataset, {
      indicadores: [{ label: 'Bilhetes vendidos', value: '645' }],
      notas: 'Correu bem',
    });

    expect(kindsOf(report)).toEqual([
      'kpis',
      'composition',
      'composition',
      'budget',
      'budget',
      'indicators',
      'inKind',
      'pending',
      'text',
      'movements',
    ]);
    expect(sectionOf(report, 'kpis').cards.map((c) => c.label)).toContain(
      'Apoios em espécie',
    );
  });

  it('drops the optional sections and the in-kind card when there is nothing to show', () => {
    const { report } = build(emptyDataset({ movimentos }));

    expect(kindsOf(report)).toEqual([
      'kpis',
      'composition',
      'composition',
      'movements',
    ]);
    expect(
      sectionOf(report, 'kpis').cards.map((card) => card.label),
    ).not.toContain('Apoios em espécie');
  });

  it('shows the summary cards with whole euros and the exact figures in the composition', () => {
    const { report } = build(emptyDataset({ movimentos }));

    const cards = Object.fromEntries(
      sectionOf(report, 'kpis').cards.map((card) => [card.label, card.value]),
    );
    expect(cards).toMatchObject({
      Recebido: eur('100 €'),
      Pago: eur('35 €'),
      Resultado: eur('65 €'),
    });
    expect(
      sectionOf(report, 'composition', 'Composição do recebido').total.text,
    ).toBe(eur('100,00 €'));
  });

  it('reads the budget of the activity unless another scope is given', () => {
    const dataset = emptyDataset({
      movimentos,
      orcamento: [
        linha({ ambito: 'Festival Alfa', orcadoCents: 12000 }),
        linha({ ambito: 'Outro', orcadoCents: 777 }),
      ],
    });

    const own = budgetOf(build(dataset).report, 'Receitas: orçado e realizado');
    const other = budgetOf(
      build(dataset, { ambitoOrcamento: 'Outro' }).report,
      'Receitas: orçado e realizado',
    );

    expect(own.total.orcado.cents).toBe(12000);
    expect(other.total.orcado.cents).toBe(777);
  });

  it('labels a one-day event with a single date and the lead with the movement span', () => {
    const { report } = build(emptyDataset({ movimentos }), {
      eventoInicio: '2026-05-01',
      eventoFim: '2026-05-01',
    });

    expect(report.header.periodLabel).toBe('01/05/2026');
    expect(report.header.lead).toBe(
      'Festival Alfa · Movimentos de 01/05/2026 a 03/05/2026',
    );
  });
});
