import { describe, expect, it } from 'vitest';
import {
  emptyDataset,
  mov,
  pendente,
  saldo,
} from '../../../tests/support/dataset.ts';
import { pegadaFigures, type PegadaParams } from './pegada.ts';

const dataset = emptyDataset({
  saldos: [
    saldo('2025-08-31', 10000, 'Caixa'),
    saldo('2025-08-31', 90000, 'Banco'),
  ],
  movimentos: [
    mov({ data: '2025-09-05', cents: 4000 }),
    mov({ data: '2025-09-06', cents: 1500, tipo: 'Saída', conta: 'Banco' }),
    mov({ data: '2025-10-02', cents: 50 }),
  ],
  pendentes: [
    pendente({ valorCents: 700, dataRegisto: '2025-08-01' }),
    pendente({ tipo: 'A pagar', valorCents: 200, dataRegisto: '2025-08-01' }),
  ],
});

const params: PegadaParams = {
  dataUltimoRelatorio: '2025-08-31',
  dataPassagem: '2025-09-30',
  saldoExtratoCents: 88500,
  naoDebitados: [],
  naoCreditados: [],
  contagem: { 5000: 2, 200: 2, 20: 1 },
  moedasPequenasCents: 80,
};

describe('pegadaFigures()', () => {
  it('opens from the previous report date and closes split by account', () => {
    const figures = pegadaFigures(dataset, params);

    expect(figures.period).toMatchObject({
      start: '2025-09-01',
      opening: { totalCents: 100000 },
      recebidoCents: 4000,
      pagoCents: 1500,
      closing: { caixaCents: 14000, bancoCents: 88500, totalCents: 102500 },
    });
    expect(figures.variacaoCents).toBe(2500);
    expect(figures.movements).toHaveLength(2);
  });

  it('closes the reconciliation and the cash count with no warning when they match', () => {
    const figures = pegadaFigures(dataset, {
      ...params,
      contagem: { 5000: 2, 2000: 2 },
      moedasPequenasCents: 0,
    });

    expect(figures.reconciliation.differenceCents).toBe(0);
    expect(figures.cashCount).toMatchObject({
      countedCents: 14000,
      differenceCents: 0,
    });
    expect(figures.issues).toEqual([]);
  });

  it('applies uncleared items to the statement and warns about both differences', () => {
    const figures = pegadaFigures(dataset, {
      ...params,
      saldoExtratoCents: 90000,
      naoDebitados: [{ descricao: 'Cheque 1', valorCents: 1000 }],
      naoCreditados: [{ descricao: 'Depósito', valorCents: 300 }],
    });

    expect(figures.reconciliation).toMatchObject({
      adjustedCents: 89300,
      differenceCents: 800,
    });
    expect(figures.cashCount).toMatchObject({
      countedCents: 10500,
      differenceCents: -3500,
    });
    expect(figures.issues.map((i) => [i.code, i.severity])).toEqual([
      ['reconciliation-difference', 'warning'],
      ['cash-count-difference', 'warning'],
    ]);
  });

  it('sizes the position bar on absolute values with the debts flagged negative', () => {
    const { position } = pegadaFigures(dataset, params);

    expect(position.netCents).toBe(102500 + 700 - 200);
    expect(position.segments).toEqual([
      { label: 'Caixa', cents: 14000, permille: 135, negative: false },
      { label: 'Banco', cents: 88500, permille: 856, negative: false },
      { label: 'A receber', cents: 700, permille: 7, negative: false },
      { label: 'Dívidas', cents: 200, permille: 2, negative: true },
    ]);
  });
});
