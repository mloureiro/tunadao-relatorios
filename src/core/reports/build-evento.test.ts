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
    expect(section.rows.map((row) => row.meio)).toEqual([
      'Caixa',
      'Caixa',
      'Caixa',
    ]);
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
      'pending',
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

  it('marks only the Resultado card for emphasis', () => {
    const { report } = build(emptyDataset({ movimentos }));

    const cards = sectionOf(report, 'kpis').cards;

    expect(
      cards.filter((c) => c.emphasis === true).map((c) => c.label),
    ).toEqual(['Resultado']);
  });

  it('tags each budget table with its side, its sub-rubric header and the deviation in words', () => {
    const dataset = emptyDataset({
      movimentos,
      orcamento: [
        linha({ ambito: 'Festival Alfa', orcadoCents: 12000 }),
        linha({
          ambito: 'Festival Alfa',
          tipo: 'Saída',
          rubrica: 'Licenças e SPA',
          orcadoCents: 400,
        }),
      ],
    });
    const { report } = build(dataset);

    const receitas = budgetOf(report, 'Receitas: orçado e realizado');
    const despesas = budgetOf(report, 'Despesas: orçado e realizado');

    expect([receitas.side, receitas.labelHeader]).toEqual([
      'receita',
      'Sub-rubrica',
    ]);
    expect([despesas.side, despesas.labelHeader]).toEqual([
      'despesa',
      'Sub-rubrica',
    ]);
    expect(receitas.total.desvioLabel).toBe('Abaixo do orçado');
    expect(despesas.total.desvioLabel).toBe('Acima do orçado');
  });

  it('prints no deviation words when the figure is on budget', () => {
    const dataset = emptyDataset({
      movimentos: [mov({ data: '2026-05-01', cents: 12000 })],
      orcamento: [linha({ ambito: 'Festival Alfa', orcadoCents: 12000 })],
    });

    const { report } = build(dataset);

    expect(
      budgetOf(report, 'Receitas: orçado e realizado').total,
    ).not.toHaveProperty('desvioLabel');
  });

  it('labels the event period and the movement range separately, and the cut-off when there is one', () => {
    const plain = build(emptyDataset({ movimentos }));
    const cut = build(emptyDataset({ movimentos }), {
      contarAte: '2026-05-03',
    });

    expect(plain.report.header.periodLabel).toBe(
      'Evento de 30/04/2026 a 03/05/2026',
    );
    expect(plain.report.header.lead).toBe(
      'Festival Alfa · Valores dos movimentos de 01/05/2026 a 03/05/2026',
    );
    expect(cut.report.header.lead).toBe(
      'Festival Alfa · Valores dos movimentos de 01/05/2026 a 03/05/2026 (contados até 03/05/2026)',
    );
  });

  it('labels a one-day event with a single date', () => {
    const { report } = build(emptyDataset({ movimentos }), {
      eventoInicio: '2026-05-01',
      eventoFim: '2026-05-01',
    });

    expect(report.header.periodLabel).toBe('Evento de 01/05/2026');
  });

  it('moves the gross totals out of the footer lines into the cash book totals', () => {
    const section = movementsOf(build(emptyDataset({ movimentos })).report);

    expect(section.title).toBe('Movimentos do evento');
    expect(section.totals).toEqual({
      entrada: { cents: 10500, text: eur('105,00 €') },
      saida: { cents: 4000, text: eur('40,00 €') },
    });
    expect(section.footer.map((line) => line.label)).not.toContain(
      'Entradas brutas',
    );
  });
});
