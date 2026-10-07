import { describe, expect, it } from 'vitest';
import { emptyDataset, mov, saldo } from '../../../tests/support/dataset.ts';
import { balanceAtEndOf, openingBalance } from './index.ts';

const dataset = emptyDataset({
  saldos: [saldo('2024-12-31', 10000), saldo('2025-12-31', 99999)],
  movimentos: [
    mov({ data: '2024-12-31', cents: 5000 }),
    mov({ data: '2025-01-01', cents: 2000 }),
    mov({ data: '2025-03-14', cents: 700, tipo: 'Saída' }),
    mov({ data: '2025-03-15', cents: 300 }),
    mov({ data: '2025-03-16', cents: 40000, conta: 'Banco' }),
    mov({
      data: '2025-02-01',
      cents: 900,
      tipo: 'Saída',
      rubrica: 'Transferências internas',
    }),
  ],
});

describe('balanceAtEndOf()', () => {
  it('treats a checkpoint as the closing balance of its day, so same-day movements are not added again', () => {
    expect(balanceAtEndOf(dataset, 'Caixa', '2024-12-31')).toBe(10000);
  });

  it('adds movements after the checkpoint date, non-result rubrics included', () => {
    expect(balanceAtEndOf(dataset, 'Caixa', '2025-01-01')).toBe(12000);
    expect(balanceAtEndOf(dataset, 'Caixa', '2025-03-14')).toBe(
      10000 + 2000 - 900 - 700,
    );
  });

  it('restarts from the latest checkpoint on or before the date', () => {
    expect(balanceAtEndOf(dataset, 'Caixa', '2025-12-31')).toBe(99999);
  });

  it('only counts movements of the requested account', () => {
    expect(balanceAtEndOf(dataset, 'Banco', '2025-12-31')).toBeUndefined();
  });

  it('is undefined before the first checkpoint', () => {
    expect(balanceAtEndOf(dataset, 'Caixa', '2024-12-30')).toBeUndefined();
  });
});

describe('openingBalance()', () => {
  it('equals the checkpoint when the period starts the day after it', () => {
    expect(openingBalance(dataset, 'Caixa', '2025-01-01')).toBe(10000);
  });

  it('adds the movements between the checkpoint and the period start', () => {
    expect(openingBalance(dataset, 'Caixa', '2025-03-15')).toBe(
      10000 + 2000 - 900 - 700,
    );
  });

  it('is undefined without an earlier checkpoint or a manual value', () => {
    expect(openingBalance(dataset, 'Caixa', '2024-01-01')).toBeUndefined();
  });

  it('falls back to the manual value when no checkpoint precedes the period', () => {
    expect(openingBalance(dataset, 'Caixa', '2024-01-01', 1234)).toBe(1234);
    expect(openingBalance(dataset, 'Caixa', '2025-01-01', 1234)).toBe(10000);
  });
});
