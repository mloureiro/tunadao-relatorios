import { describe, expect, it } from 'vitest';
import {
  emptyDataset,
  genero,
  linha,
  mov,
  pendente,
  saldo,
} from '../../../tests/support/dataset.ts';
import {
  CONFIG,
  CONTEXT,
  budgetOf,
  eur,
  titlesOf,
  kindsOf,
  movementsOf,
  sectionOf,
} from '../../../tests/support/reports.ts';
import { buildLetivo } from './build-letivo.ts';
import { letivoParamsSchema } from './params.ts';

const opening = [
  saldo('2025-12-31', 10000, 'Caixa'),
  saldo('2025-12-31', 50000, 'Banco'),
];

const params = (extra: Record<string, unknown> = {}) =>
  letivoParamsSchema.parse({
    inicio: '2026-01-01',
    fim: '2026-06-30',
    ...extra,
  });

const build = (
  dataset: ReturnType<typeof emptyDataset>,
  extra: Record<string, unknown> = {},
) => buildLetivo(dataset, params(extra), CONFIG, CONTEXT);

const simple = emptyDataset({
  saldos: opening,
  movimentos: [
    mov({ data: '2026-02-01', cents: 7000 }),
    mov({ data: '2026-02-02', cents: 2500, tipo: 'Saída' }),
  ],
});

describe('buildLetivo()', () => {
  it('omits sections with nothing to show and prints the comparison as sem dados without previous movements', () => {
    const { report, issues } = build(simple);

    expect(kindsOf(report)).toEqual([
      'kpis',
      'bridge',
      'composition',
      'composition',
      'byActivity',
      'pending',
      'yearComparison',
      'movements',
    ]);
    const comparison = sectionOf(report, 'yearComparison');
    expect(comparison).toMatchObject({ status: 'sem-dados', rows: [] });
    expect(comparison.message).toContain('01/01/2025 a 30/06/2025');
    expect(issues.map((issue) => issue.code)).toEqual(['no-previous-data']);
  });

  it('joins each account label to its amount in the closing balance caption so only the separator can wrap', () => {
    const { report } = build(simple);

    const caption = sectionOf(report, 'kpis').cards.at(-1)?.caption;

    expect(caption).toMatch(/^Caixa\u00A0\S+\u00A0€ · Banco\u00A0\S+\u00A0€$/u);
  });

  it('adds budget, pending, in-kind and notes in the report order when there is something to show', () => {
    const dataset = emptyDataset({
      saldos: opening,
      movimentos: simple.movimentos,
      orcamento: [
        linha({ ambito: 'Plano', orcadoCents: 10000 }),
        linha({ ambito: 'Plano', tipo: 'Saída', orcadoCents: 4000 }),
      ],
      pendentes: [pendente({ dataRegisto: '2026-03-01' })],
      generos: [genero({ data: '2026-03-01' })],
    });

    const { report } = build(dataset, {
      ambitoOrcamento: 'Plano',
      notas: 'Tudo certo',
    });

    expect(kindsOf(report)).toEqual([
      'kpis',
      'bridge',
      'composition',
      'composition',
      'budget',
      'budget',
      'byActivity',
      'pending',
      'inKind',
      'text',
      'yearComparison',
      'movements',
    ]);
  });

  it('warns without a budget section when the scope has no lines', () => {
    const { report, issues } = build(simple, {
      ambitoOrcamento: 'Inexistente',
    });

    expect(kindsOf(report)).not.toContain('budget');
    expect(issues.map((issue) => issue.code)).toContain('no-budget');
  });

  it('states in the bridge that the opening balance was declared manually', () => {
    const dataset = emptyDataset({ movimentos: simple.movimentos });

    const { report, issues } = build(dataset, {
      aberturaManual: { caixa: 100, banco: 500 },
    });

    const bridge = sectionOf(report, 'bridge');
    expect(bridge.rows[0]).toEqual({
      label: 'Saldo inicial (declarado manualmente)',
      value: { cents: 60000, text: eur('600,00 €') },
    });
    expect(issues.map((issue) => issue.code)).toContain(
      'manual-opening-balance',
    );
  });

  it('keeps the plain opening label when the ledger supplies the balance', () => {
    const bridge = sectionOf(build(simple).report, 'bridge');

    expect(bridge.rows[0]?.label).toBe('Saldo inicial');
  });

  it('prints the transfer line in the bridge only when it is not zero, and closes onto the final balance', () => {
    const withTransfer = emptyDataset({
      saldos: opening,
      movimentos: [
        ...simple.movimentos,
        mov({
          data: '2026-03-01',
          cents: 3000,
          tipo: 'Saída',
          rubrica: 'Transferências internas',
        }),
      ],
    });

    const closed = sectionOf(build(simple).report, 'bridge');
    const open = sectionOf(build(withTransfer).report, 'bridge');

    expect(closed.rows.map((row) => row.label)).not.toContain(
      'Outros movimentos fora do resultado',
    );
    expect(open.rows.find((row) => row.emphasis)?.value.cents).toBe(61500);
    expect(open.rows.map((row) => row.label)).toContain(
      'Outros movimentos fora do resultado',
    );
  });

  it.each([
    ['the same level', CONFIG],
    [
      'different levels',
      {
        ...CONFIG,
        aggregation: {
          ...CONFIG.aggregation,
          budgetPeriod: 'subRubrica' as const,
        },
      },
    ],
  ])('warns once about a negative rubric net aggregated at %s', (_, config) => {
    const dataset = emptyDataset({
      saldos: opening,
      movimentos: [
        mov({ data: '2025-03-01', cents: 2000, tipo: 'Saída' }),
        mov({ data: '2026-02-01', cents: 2000, tipo: 'Saída' }),
        mov({
          data: '2026-02-02',
          cents: 5000,
          tipo: 'Entrada',
          rubrica: 'Licenças e SPA',
        }),
        mov({ data: '2026-02-03', cents: 9000 }),
      ],
      orcamento: [linha({ ambito: 'Plano', tipo: 'Saída', orcadoCents: 1000 })],
    });

    const { report, issues } = buildLetivo(
      dataset,
      params({ ambitoOrcamento: 'Plano' }),
      config,
      CONTEXT,
    );

    expect(
      issues.filter((issue) => issue.code === 'negative-rubric-net'),
    ).toHaveLength(1);
    expect(titlesOf(report)).not.toContain('Composição do pago');
  });

  it('lists transfer legs under their own label so the footer reconciles with the balance variation', () => {
    const dataset = emptyDataset({
      saldos: opening,
      movimentos: [
        ...simple.movimentos,
        mov({
          data: '2026-03-01',
          cents: 3000,
          tipo: 'Saída',
          rubrica: 'Transferências internas',
        }),
        mov({
          data: '2026-03-01',
          cents: 2000,
          conta: 'Banco',
          rubrica: 'Transferências internas',
        }),
      ],
    });

    const section = movementsOf(build(dataset).report);

    expect(section.rows).toHaveLength(2);
    expect(section.outside?.title).toBe('Movimentos fora do resultado');
    expect(section.outside?.rows.every((row) => row.outsideResult)).toBe(true);
    expect(section.outside?.subtotal).toEqual({
      cents: -1000,
      text: eur('−10,00 €'),
    });
    const footer = Object.fromEntries(
      section.footer.map((line) => [line.label, line.value.cents]),
    );
    expect(Object.keys(footer)).not.toContain(
      'Recebido (entradas brutas − reembolsos)',
    );
    expect(Object.keys(footer)).not.toContain(
      'Pago (saídas brutas − reembolsos)',
    );
    expect(
      (footer['Entradas brutas'] ?? 0) -
        (footer['Saídas brutas'] ?? 0) +
        (footer['Movimentos fora do resultado'] ?? 0),
    ).toBe(footer['Variação no período']);
    expect(footer['Variação no período']).toBe(3500);
  });

  it('marks refund rows and reconciles gross columns to recebido and pago', () => {
    const dataset = emptyDataset({
      saldos: opening,
      movimentos: [
        mov({ data: '2026-02-01', cents: 9000, tipo: 'Saída' }),
        mov({
          data: '2026-02-02',
          cents: 2000,
          rubrica: 'Licenças e SPA',
        }),
        mov({ data: '2026-02-03', cents: 6000 }),
      ],
    });

    const section = movementsOf(build(dataset).report);

    expect(section.rows.map((row) => row.refund)).toEqual([false, true, false]);
    const footer = Object.fromEntries(
      section.footer.map((line) => [line.label, line.value.text]),
    );
    expect(footer).toMatchObject({
      'Entradas brutas': eur('80,00 €'),
      'Saídas brutas': eur('90,00 €'),
      'Reembolsos abatidos às despesas (entradas)': eur('20,00 €'),
      'Recebido (entradas brutas − reembolsos)': eur('60,00 €'),
      'Pago (saídas brutas − reembolsos)': eur('70,00 €'),
    });
  });

  it('drops the movement annex when anexar is off', () => {
    expect(kindsOf(build(simple, { anexar: false }).report)).not.toContain(
      'movements',
    );
  });

  it('prints a rubric with movements netting to zero as a 0,00 € budget row and keeps it out of the composition', () => {
    const dataset = emptyDataset({
      saldos: opening,
      movimentos: [
        mov({ data: '2026-02-01', cents: 5000 }),
        mov({
          data: '2026-02-02',
          cents: 5000,
          tipo: 'Saída',
          rubrica: 'Bilheteira',
        }),
      ],
      orcamento: [linha({ ambito: 'Plano', orcadoCents: 10000 })],
    });

    const { report } = build(dataset, { ambitoOrcamento: 'Plano' });

    expect(
      budgetOf(report, 'Receitas: orçado e realizado').rows[0],
    ).toMatchObject({
      label: 'Bilheteira',
      realizado: { cents: 0, text: eur('0,00 €') },
      execucao: '0,0%',
    });
    expect(titlesOf(report)).not.toContain('Composição do recebido');
  });

  it('leaves the execution blank when nothing was budgeted', () => {
    const dataset = emptyDataset({
      saldos: opening,
      movimentos: simple.movimentos,
      orcamento: [linha({ ambito: 'Plano', orcadoCents: 0 })],
    });

    const row = budgetOf(
      build(dataset, { ambitoOrcamento: 'Plano' }).report,
      'Receitas: orçado e realizado',
    ).rows[0];

    expect(row?.execucao).toBe('');
  });
});
