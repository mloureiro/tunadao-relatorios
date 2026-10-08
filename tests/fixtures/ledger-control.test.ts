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
});
