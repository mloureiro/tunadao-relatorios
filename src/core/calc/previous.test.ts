import { describe, expect, it } from 'vitest';
import { emptyDataset, mov, saldo } from '../../../tests/support/dataset.ts';
import { previousPeriod } from './previous.ts';

describe('previousPeriod()', () => {
  it('shifts the dates back twelve months, a 29 February ending on 28 February', () => {
    const dataset = emptyDataset({
      saldos: [
        saldo('2022-12-31', 1000, 'Caixa'),
        saldo('2022-12-31', 2000, 'Banco'),
      ],
      movimentos: [
        mov({ data: '2023-02-28', cents: 300 }),
        mov({ data: '2023-03-01', cents: 999 }),
      ],
    });

    const previous = previousPeriod(dataset, '2024-02-01', '2024-02-29');

    expect(previous).toMatchObject({
      status: 'ok',
      start: '2023-02-01',
      end: '2023-02-28',
      recebidoCents: 300,
      pagoCents: 0,
      closing: { caixaCents: 1300, bancoCents: 2000, totalCents: 3300 },
    });
  });

  it('leaves balances null where no checkpoint exists instead of printing zeros', () => {
    const dataset = emptyDataset({
      saldos: [saldo('2023-06-30', 500, 'Caixa')],
      movimentos: [mov({ data: '2023-07-10', cents: 100 })],
    });

    const previous = previousPeriod(dataset, '2024-01-01', '2024-12-31');

    expect(previous).toMatchObject({
      status: 'ok',
      opening: { caixaCents: null, bancoCents: null, totalCents: null },
      closing: { caixaCents: 600, bancoCents: null, totalCents: null },
    });
  });

  it('reports sem-dados with a warning when the earlier period has no result movements', () => {
    const dataset = emptyDataset({
      movimentos: [
        mov({ data: '2024-05-01', cents: 100 }),
        mov({
          data: '2023-05-01',
          cents: 100,
          rubrica: 'Transferências internas',
        }),
      ],
    });

    const previous = previousPeriod(dataset, '2024-01-01', '2024-12-31');

    expect(previous.status).toBe('sem-dados');
    expect(previous.issues.map((i) => [i.code, i.severity])).toEqual([
      ['no-previous-data', 'warning'],
    ]);
  });
});
