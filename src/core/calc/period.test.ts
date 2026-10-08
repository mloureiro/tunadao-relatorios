import { describe, expect, it } from 'vitest';
import { emptyDataset, mov, saldo } from '../../../tests/support/dataset.ts';
import { periodFigures } from './period.ts';

const checkpoints = [
  saldo('2024-12-31', 10000, 'Caixa'),
  saldo('2024-12-31', 50000, 'Banco'),
];

describe('periodFigures()', () => {
  it('closes the bridge when a transfer has only one leg, exposing it as outros', () => {
    const dataset = emptyDataset({
      saldos: checkpoints,
      movimentos: [
        mov({ data: '2025-02-01', cents: 7000 }),
        mov({ data: '2025-02-02', cents: 2500, tipo: 'Saída' }),
        mov({
          data: '2025-02-03',
          cents: 3000,
          tipo: 'Saída',
          rubrica: 'Transferências internas',
        }),
        mov({
          data: '2025-02-03',
          cents: 1000,
          conta: 'Banco',
          rubrica: 'Transferências internas',
        }),
        mov({ data: '2026-01-01', cents: 999 }),
      ],
    });

    const figures = periodFigures(dataset, '2025-01-01', '2025-12-31');

    expect(figures).toMatchObject({
      recebidoCents: 7000,
      pagoCents: 2500,
      outrosCents: -2000,
      counts: { recebimentos: 1, pagamentos: 1 },
      opening: { caixaCents: 10000, bancoCents: 50000, totalCents: 60000 },
      closing: { caixaCents: 11500, bancoCents: 51000, totalCents: 62500 },
      issues: [],
    });
  });

  it('counts a refund on the side of its rubric and leaves it out of the other side', () => {
    const dataset = emptyDataset({
      saldos: checkpoints,
      movimentos: [
        mov({ data: '2025-02-01', cents: 1000, tipo: 'Saída' }),
        mov({ data: '2025-02-02', cents: 400, rubrica: 'Licenças e SPA' }),
      ],
    });

    const figures = periodFigures(dataset, '2025-01-01', '2025-12-31');

    expect(figures).toMatchObject({
      recebidoCents: 0,
      pagoCents: 600,
      counts: { recebimentos: 0, pagamentos: 2 },
    });
  });

  it('uses a manual opening when no checkpoint precedes the period and says so', () => {
    const dataset = emptyDataset({
      movimentos: [mov({ data: '2025-02-01', cents: 700 })],
    });

    const figures = periodFigures(dataset, '2025-01-01', '2025-12-31', {
      Caixa: 1000,
      Banco: 2000,
    });

    expect(figures.opening.totalCents).toBe(3000);
    expect(figures.closing.totalCents).toBe(3700);
    expect(figures.issues.map((i) => [i.code, i.severity])).toEqual([
      ['manual-opening-balance', 'warning'],
      ['manual-opening-balance', 'warning'],
    ]);
  });

  it('flags a manual opening that a later checkpoint contradicts', () => {
    const dataset = emptyDataset({
      saldos: [
        saldo('2025-06-30', 9999, 'Caixa'),
        saldo('2025-06-30', 0, 'Banco'),
      ],
      movimentos: [mov({ data: '2025-02-01', cents: 700 })],
    });

    const { issues } = periodFigures(dataset, '2025-01-01', '2025-12-31', {
      Caixa: 1000,
      Banco: 0,
    });

    expect(issues.map((i) => i.code)).toContain('manual-opening-mismatch');
  });

  it('reports a missing opening as an error instead of throwing', () => {
    const dataset = emptyDataset({
      movimentos: [mov({ data: '2025-02-01', cents: 700 })],
    });

    const { issues } = periodFigures(dataset, '2025-01-01', '2025-12-31');

    expect(issues.map((i) => [i.code, i.severity])).toEqual([
      ['missing-opening-balance', 'error'],
      ['missing-opening-balance', 'error'],
    ]);
  });
});
