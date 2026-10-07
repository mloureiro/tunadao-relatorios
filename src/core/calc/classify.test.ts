import { describe, expect, it } from 'vitest';
import { LISTS, mov } from '../../../tests/support/dataset.ts';
import { classify } from './classify.ts';

describe('classify()', () => {
  it.each([
    [
      'an Entrada in an income rubric',
      mov({ data: '2025-01-01', cents: 1000 }),
      { side: 'receita', contributionCents: 1000, refund: false },
    ],
    [
      'a Saída in an expense rubric',
      mov({ data: '2025-01-01', cents: 1000, tipo: 'Saída' }),
      { side: 'despesa', contributionCents: 1000, refund: false },
    ],
    [
      'an Entrada in an expense rubric (refund)',
      mov({ data: '2025-01-01', cents: 1000, rubrica: 'Licenças e SPA' }),
      { side: 'despesa', contributionCents: -1000, refund: true },
    ],
    [
      'a Saída in an income rubric (refund)',
      mov({
        data: '2025-01-01',
        cents: 1000,
        tipo: 'Saída',
        rubrica: 'Bilheteira',
      }),
      { side: 'receita', contributionCents: -1000, refund: true },
    ],
    [
      'a transfer rubric',
      mov({
        data: '2025-01-01',
        cents: 1000,
        rubrica: 'Transferências internas',
      }),
      { side: 'fora', contributionCents: 0, refund: false },
    ],
  ])('classifies %s', (_name, movimento, expected) => {
    expect(classify(movimento, LISTS)).toEqual(expected);
  });
});
