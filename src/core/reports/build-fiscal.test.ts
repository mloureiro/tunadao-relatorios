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
  eur,
  kindsOf,
  sectionOf,
} from '../../../tests/support/reports.ts';
import type { Checkpoint } from '../dataset/types.ts';
import { buildFiscal } from './build-fiscal.ts';
import { fiscalParamsSchema } from './params.ts';

const extrato = (
  data: string,
  cents: number,
  fonte: Checkpoint['fonte'] = 'Extrato',
): Checkpoint => ({ ...saldo(data, cents, 'Banco'), fonte });

const openingBalances = [
  saldo('2024-12-31', 10000, 'Caixa'),
  saldo('2024-12-31', 50000, 'Banco'),
];

const movements = [
  mov({ data: '2024-05-01', cents: 4000 }),
  mov({ data: '2024-05-02', cents: 1000, tipo: 'Saída' }),
  mov({ data: '2025-05-01', cents: 8000 }),
  mov({ data: '2025-05-02', cents: 2000, tipo: 'Saída' }),
];

const build = (
  dataset: ReturnType<typeof emptyDataset>,
  extra: Record<string, unknown> = {},
) =>
  buildFiscal(
    dataset,
    fiscalParamsSchema.parse({ ano: 2025, ...extra }),
    CONFIG,
    CONTEXT,
  );

const year = emptyDataset({ saldos: openingBalances, movimentos: movements });

describe('buildFiscal()', () => {
  it('adds the conferido row only when a Banco Extrato checkpoint exists on 31/12 of the year', () => {
    const rowsOf = (extra: Checkpoint[]) =>
      sectionOf(
        build({ ...year, saldos: [...openingBalances, ...extra] }).report,
        'bridge',
      ).rows.map((row) => [row.label, row.value.text]);

    expect(rowsOf([extrato('2025-12-31', 50000)])).toContainEqual([
      'Saldo conferido com o extrato de 31/12/2025',
      eur('500,00 €'),
    ]);
    expect(
      rowsOf([extrato('2025-12-31', 50000, 'Contagem')]).map(([l]) => l),
    ).not.toContain('Saldo conferido com o extrato de 31/12/2025');
    expect(
      rowsOf([extrato('2025-12-30', 50000)]).map(([l]) => l),
    ).not.toContain('Saldo conferido com o extrato de 31/12/2025');
  });

  it('puts the optional sections in the fiscal order and leaves the movement annex out by default', () => {
    const dataset = emptyDataset({
      saldos: openingBalances,
      movimentos: movements,
      orcamento: [
        linha({ ambito: '2025', orcadoCents: 5000 }),
        linha({ ambito: '2025', tipo: 'Saída', orcadoCents: 1000 }),
      ],
      pendentes: [pendente({ dataRegisto: '2025-11-01' })],
      generos: [genero({ data: '2025-06-01' })],
    });

    const { report } = build(dataset, {
      parecerCF: 'Parecer favorável',
      notas: 'Sem comentários',
    });

    expect(kindsOf(report)).toEqual([
      'kpis',
      'bridge',
      'budget',
      'budget',
      'byActivity',
      'pending',
      'yearComparison',
      'inKind',
      'text',
      'text',
    ]);
    expect(
      report.sections.filter((s) => s.kind === 'text').map((s) => s.title),
    ).toEqual(['Parecer do Conselho Fiscal', 'Notas / Comentários']);
  });

  it('appends the movement annex when it is asked for', () => {
    const { report } = build(year, { anexoMovimentos: true });

    expect(kindsOf(report).at(-1)).toBe('movements');
  });

  it('uses the budget lines of the year as text and warns when there are none', () => {
    const withBudget = emptyDataset({
      saldos: openingBalances,
      movimentos: movements,
      orcamento: [
        linha({ ambito: '2025', orcadoCents: 5000 }),
        linha({ ambito: '2024', orcadoCents: 9999 }),
      ],
    });

    const budget = sectionOf(build(withBudget).report, 'budget');
    const missing = build(year);

    expect(budget.total.orcado.cents).toBe(5000);
    expect(kindsOf(missing.report)).not.toContain('budget');
    expect(missing.issues.map((issue) => issue.code)).toContain('no-budget');
  });

  it('compares with the previous year, labelling the columns with the years and scaling the bars to the largest rubric', () => {
    const comparison = sectionOf(build(year).report, 'yearComparison');

    expect(comparison.status).toBe('ok');
    expect(comparison.labels).toEqual(['2024', '2025']);
    expect(
      comparison.rows.find((row) => row.label === 'Total recebido'),
    ).toEqual({
      label: 'Total recebido',
      kind: 'total',
      previous: eur('40,00 €'),
      current: eur('80,00 €'),
      variation: eur('+40,00 €'),
    });
    expect(
      comparison.bars?.map((bar) => [
        bar.label,
        bar.previousPermille,
        bar.currentPermille,
      ]),
    ).toEqual([
      ['Bilheteira', 500, 1000],
      ['Licenças e SPA', 125, 250],
    ]);
  });

  it('compares at the configured level', () => {
    const detailed = emptyDataset({
      saldos: openingBalances,
      movimentos: [
        mov({ data: '2024-05-01', cents: 4000, subRubrica: 'Bilhetes' }),
        mov({ data: '2025-05-01', cents: 8000, subRubrica: 'Bilhetes' }),
      ],
    });
    const config = {
      ...CONFIG,
      aggregation: { ...CONFIG.aggregation, comparison: 'subRubrica' as const },
    };

    const byRubrica = sectionOf(
      buildFiscal(
        detailed,
        fiscalParamsSchema.parse({ ano: 2025 }),
        CONFIG,
        CONTEXT,
      ).report,
      'yearComparison',
    );
    const bySub = sectionOf(
      buildFiscal(
        detailed,
        fiscalParamsSchema.parse({ ano: 2025 }),
        config,
        CONTEXT,
      ).report,
      'yearComparison',
    );

    expect(byRubrica.rows.map((r) => r.label)).toContain('Bilheteira');
    expect(bySub.rows.map((r) => r.label)).toContain('Bilhetes');
    expect(bySub.rows.map((r) => r.label)).not.toContain('Bilheteira');
  });

  it('prints n.d. for a previous opening balance the ledger cannot supply', () => {
    const comparison = sectionOf(build(year).report, 'yearComparison');

    expect(comparison.rows[0]).toMatchObject({
      label: 'Saldo inicial',
      previous: 'n.d.',
      variation: 'n.d.',
    });
  });

  it('labels the header with the dated period of the year', () => {
    expect(build(year).report.header).toMatchObject({
      title: 'Relatório de fim de ano fiscal',
      periodLabel: '01/01/2025 a 31/12/2025',
      lead: 'Exercício de 2025',
    });
  });
});
