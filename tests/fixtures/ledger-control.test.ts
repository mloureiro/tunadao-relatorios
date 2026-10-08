import { describe, expect, it } from 'vitest';
import { balanceAtEndOf } from '../../src/core/ledger/index.ts';
import { loadGenerated } from '../support/generated.ts';

const CHECKPOINTS = [
  { data: '2024-12-31', caixa: 18540, banco: 391275, total: 409815 },
  { data: '2025-12-31', caixa: 24000, banco: 599155, total: 623155 },
  { data: '2026-08-31', caixa: 25830, banco: 1321975, total: 1347805 },
  { data: '2026-09-30', caixa: 57900, banco: 1326505, total: 1384405 },
] as const;

describe('tesouraria.xlsx ledger', () => {
  it('has no verification error and opens from the declared balance of 31/12/2023', async () => {
    const { dataset, issues } = await loadGenerated('tesouraria.xlsx');

    expect(issues).toEqual([]);
    expect(
      dataset.saldos
        .filter((saldo) => saldo.data === '2023-12-31')
        .map(({ conta, saldoCents, fonte }) => ({ conta, saldoCents, fonte })),
    ).toEqual([
      { conta: 'Caixa', saldoCents: 15000, fonte: 'Declarado' },
      { conta: 'Banco', saldoCents: 190860, fonte: 'Declarado' },
    ]);
  });

  it.each(CHECKPOINTS)(
    'rolls the previous checkpoint forward to the balances declared on $data',
    async ({ data, caixa, banco, total }) => {
      const { dataset } = await loadGenerated('tesouraria.xlsx');
      const fromPrevious = {
        ...dataset,
        saldos: dataset.saldos.filter((saldo) => saldo.data < data),
      };

      const computed = {
        caixa: balanceAtEndOf(fromPrevious, 'Caixa', data),
        banco: balanceAtEndOf(fromPrevious, 'Banco', data),
      };

      expect(computed).toEqual({ caixa, banco });
      expect((computed.caixa ?? 0) + (computed.banco ?? 0)).toBe(total);
    },
  );

  it('keeps each event edition on its own activity', async () => {
    const { dataset } = await loadGenerated('tesouraria.xlsx');
    const totals = (atividade: string, upTo: string) => {
      const rows = dataset.movimentos.filter(
        (m) => m.atividade === atividade && m.contaResultado && m.data <= upTo,
      );
      const sum = (tipo: string) =>
        rows
          .filter((m) => m.tipo === tipo)
          .reduce((total, m) => total + m.valorCents, 0);
      return { recebido: sum('Entrada'), pago: sum('Saída') };
    };

    expect(totals('Zumba na Caneca', '9999-12-31')).toEqual({
      recebido: 292750,
      pago: 144740,
    });
    expect(totals('20º CITADÃO', '2026-06-15')).toEqual({
      recebido: 2022520,
      pago: 1592700,
    });
  });
});
