import { describe, expect, it } from 'vitest';
import { emptyDataset, pendente } from '../../../tests/support/dataset.ts';
import { pendingAt } from './pending.ts';

const REF = '2025-06-30';

function openAt(overrides: Parameters<typeof pendente>[0]) {
  const result = pendingAt(
    emptyDataset({ pendentes: [pendente(overrides)] }),
    REF,
  );
  return result.receber.length + result.pagar.length === 1;
}

describe('pendingAt()', () => {
  it.each([
    ['registered on the reference date', { dataRegisto: REF }, true],
    [
      'registered after the reference date',
      { dataRegisto: '2025-07-01' },
      false,
    ],
    ['settled on the reference date', { dataLiquidacao: REF }, false],
    [
      'settled after the reference date',
      { dataLiquidacao: '2025-07-01' },
      true,
    ],
    [
      'settled before the reference date',
      { dataLiquidacao: '2025-06-29' },
      false,
    ],
  ] as const)('%s', (_, overrides, expected) => {
    expect(openAt(overrides)).toBe(expected);
  });

  it('sums receivables and payables apart and filters by activity', () => {
    const dataset = emptyDataset({
      pendentes: [
        pendente({ valorCents: 100 }),
        pendente({ valorCents: 250, atividade: 'Serenata' }),
        pendente({ tipo: 'A pagar', valorCents: 40, atividade: 'Serenata' }),
      ],
    });

    expect(pendingAt(dataset, REF)).toMatchObject({
      porReceberCents: 350,
      porPagarCents: 40,
    });
    expect(pendingAt(dataset, REF, 'Serenata')).toMatchObject({
      porReceberCents: 250,
      porPagarCents: 40,
    });
  });
});
