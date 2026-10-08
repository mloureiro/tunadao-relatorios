import { describe, expect, it } from 'vitest';
import { emptyDataset, mov, saldo } from '../../../tests/support/dataset.ts';
import {
  CONFIG,
  CONTEXT,
  eur,
  kindsOf,
  movementsOf,
  sectionOf,
} from '../../../tests/support/reports.ts';
import { buildPegada } from './build-pegada.ts';
import { pegadaParamsSchema } from './params.ts';

const dataset = emptyDataset({
  saldos: [
    saldo('2026-08-31', 10000, 'Caixa'),
    saldo('2026-08-31', 100000, 'Banco'),
  ],
  movimentos: [
    mov({ data: '2026-09-02', cents: 5000 }),
    mov({
      data: '2026-09-05',
      cents: 3000,
      tipo: 'Saída',
      rubrica: 'Transferências internas',
    }),
    mov({
      data: '2026-09-05',
      cents: 3000,
      conta: 'Banco',
      rubrica: 'Transferências internas',
    }),
  ],
});

const build = (extra: Record<string, unknown> = {}) =>
  buildPegada(
    dataset,
    pegadaParamsSchema.parse({
      dataUltimoRelatorio: '2026-08-31',
      dataPassagem: '2026-09-30',
      direcaoCessante: 'Direção 2025/26',
      direcaoEntrante: 'Direção 2026/27',
      saldoExtrato: 1030,
      contagem: { '50': 2 },
      ...extra,
    }),
    CONFIG,
    CONTEXT,
  );

describe('buildPegada()', () => {
  it('orders the handover sections and omits the ones with nothing to show', () => {
    expect(kindsOf(build().report)).toEqual([
      'kpis',
      'position',
      'bridge',
      'movements',
      'reconciliation',
      'cashCount',
      'declaration',
    ]);
  });

  it('carries the board names on the cessante and entrante signature lines only', () => {
    expect(build().report.signatures).toEqual([
      { title: 'Direção cessante', name: 'Direção 2025/26' },
      { title: 'Direção entrante', name: 'Direção 2026/27' },
      { title: 'Conselho Fiscal' },
    ]);
  });

  it('opens the period the day after the last report', () => {
    expect(build().report.header.periodLabel).toBe('01/09/2026 a 30/09/2026');
  });

  it('lists the uncleared items in the reconciliation and warns about a difference', () => {
    const { report, issues } = build({
      naoDebitados: [{ descricao: 'Cheque 12', valor: 100 }],
      naoCreditados: [{ descricao: 'Depósito MB', valor: 50 }],
    });

    const reconciliation = sectionOf(report, 'reconciliation');
    expect(
      reconciliation.rows.map((row) => [row.label, row.value.text]),
    ).toEqual([
      ['Saldo segundo o extrato bancário', eur('1.030,00 €')],
      ['(−) Pagamento não debitado: Cheque 12', eur('100,00 €')],
      ['(+) Depósito não creditado: Depósito MB', eur('50,00 €')],
      ['Saldo bancário ajustado', eur('980,00 €')],
      ['Saldo de banco nos livros', eur('1.030,00 €')],
    ]);
    expect(reconciliation.difference).toEqual({
      cents: -5000,
      text: eur('−50,00 €'),
    });
    expect(issues.map((issue) => issue.code)).toContain(
      'reconciliation-difference',
    );
  });

  it('prints only the denominations that were counted, with notes and coins named apart, and the small coins', () => {
    const { report, issues } = build({
      contagem: { '50': 2, '2': 3, '0.5': 0 },
      moedasPequenas: '1,50',
    });

    const count = sectionOf(report, 'cashCount');
    expect(
      count.rows.map((row) => [row.label, row.qty, row.value.text]),
    ).toEqual([
      [eur('Notas de 50,00 €'), '2', eur('100,00 €')],
      [eur('Moedas de 2,00 €'), '3', eur('6,00 €')],
      ['Moedas pequenas', '', eur('1,50 €')],
    ]);
    expect(count.total.cents).toBe(10750);
    expect(count.book.cents).toBe(12000);
    expect(issues.map((issue) => issue.code)).toContain(
      'cash-count-difference',
    );
  });

  it('draws the position bar from the closing balances with debts flagged', () => {
    const position = sectionOf(build().report, 'position');

    expect(position.segments.map((s) => [s.label, s.negative])).toEqual([
      ['Caixa', false],
      ['Banco', false],
    ]);
    expect(position.net.cents).toBe(
      position.segments.reduce((total, s) => total + s.value.cents, 0),
    );
  });

  it('lists the transfer legs apart from the result movements', () => {
    const section = movementsOf(build().report);

    expect(section.rows).toHaveLength(1);
    expect(section.outside?.rows).toHaveLength(2);
    expect(section.outside?.subtotal.cents).toBe(0);
    expect(section.footer.at(-1)).toEqual({
      label: 'Variação no período',
      value: { cents: 5000, text: eur('50,00 €') },
    });
  });

  it('declares the handover between the two boards', () => {
    const declaration = sectionOf(build().report, 'declaration');

    expect(declaration.paragraphs[0]).toContain(
      'entre Direção 2025/26 (direção cessante) e Direção 2026/27 (direção entrante)',
    );
  });
});
