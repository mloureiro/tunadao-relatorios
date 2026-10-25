import { describe, expect, it } from 'vitest';
import { emptyDataset, mov, saldo } from '../../../tests/support/dataset.ts';
import { balanceAtEndOf, isDeclaredAtEndOf } from './index.ts';

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

describe('isDeclaredAtEndOf()', () => {
  const declared = (
    data: string,
    conta: 'Caixa' | 'Banco' = 'Caixa',
    fonte: 'Declarado' | 'Extrato' | 'Contagem' = 'Declarado',
  ) => ({ ...saldo(data, 1000, conta), fonte });

  it('is true when the only checkpoint of the day is declared', () => {
    const data = emptyDataset({ saldos: [declared('2025-12-31')] });

    expect(isDeclaredAtEndOf(data, 'Caixa', '2025-12-31')).toBe(true);
  });

  it.each(['Extrato', 'Contagem'] as const)(
    'is false when a %s checkpoint shares the day with the declaration',
    (fonte) => {
      const data = emptyDataset({
        saldos: [
          declared('2025-12-31'),
          declared('2025-12-31', 'Caixa', fonte),
        ],
      });

      expect(isDeclaredAtEndOf(data, 'Caixa', '2025-12-31')).toBe(false);
    },
  );

  it('is false when the declaration is on another date', () => {
    const data = emptyDataset({ saldos: [declared('2025-12-30')] });

    expect(isDeclaredAtEndOf(data, 'Caixa', '2025-12-31')).toBe(false);
  });

  it('ignores a declaration of the other account', () => {
    const data = emptyDataset({ saldos: [declared('2025-12-31', 'Banco')] });

    expect(isDeclaredAtEndOf(data, 'Caixa', '2025-12-31')).toBe(false);
    expect(isDeclaredAtEndOf(data, 'Banco', '2025-12-31')).toBe(true);
  });
});
