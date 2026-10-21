import { describe, expect, it } from 'vitest';
import { emptyDataset, mov, saldo } from '../../tests/support/dataset.ts';
import { summariseDataset } from './summary.ts';
import { formatMoney } from './format.ts';

describe('summariseDataset()', () => {
  it('counts the movements and activities and takes the balances at the last movement date', () => {
    const summary = summariseDataset(
      emptyDataset({
        saldos: [
          saldo('2025-01-01', 10000, 'Caixa'),
          saldo('2025-01-01', 50000, 'Banco'),
        ],
        movimentos: [
          mov({ data: '2025-03-10', cents: 2500, atividade: 'Serenata' }),
          mov({ data: '2025-02-01', cents: 1000, atividade: 'Festival Alfa' }),
          mov({
            data: '2025-02-02',
            cents: 400,
            tipo: 'Saída',
            atividade: 'Festival Alfa',
          }),
        ],
      }),
    );

    expect(summary).toMatchObject({
      firstDate: '2025-02-01',
      lastDate: '2025-03-10',
      movimentos: 3,
      atividades: 2,
      caixa: { cents: 13100, text: formatMoney(13100) },
      banco: { cents: 50000, text: formatMoney(50000) },
    });
  });

  it('leaves a balance empty when the account has no checkpoint', () => {
    const summary = summariseDataset(
      emptyDataset({ movimentos: [mov({ data: '2025-02-01', cents: 1000 })] }),
    );

    expect(summary).toMatchObject({ caixa: null, banco: null });
  });

  it('has nothing to summarise without movements', () => {
    expect(summariseDataset(emptyDataset())).toBeNull();
  });
});
