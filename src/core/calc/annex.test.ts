import { describe, expect, it } from 'vitest';
import { LISTS, mov } from '../../../tests/support/dataset.ts';
import { annexFooter } from './annex.ts';

describe('annexFooter()', () => {
  it('reconciles the gross cash columns to recebido and pago through the refunds of both kinds', () => {
    const footer = annexFooter(
      [
        mov({ data: '2025-01-01', cents: 10000 }),
        mov({
          data: '2025-01-02',
          cents: 1500,
          tipo: 'Saída',
          rubrica: 'Bilheteira',
        }),
        mov({ data: '2025-01-03', cents: 8000, tipo: 'Saída' }),
        mov({ data: '2025-01-04', cents: 2000, rubrica: 'Licenças e SPA' }),
        mov({
          data: '2025-01-05',
          cents: 700,
          tipo: 'Saída',
          rubrica: 'Transferências internas',
        }),
      ],
      LISTS,
    );

    expect(footer).toEqual({
      entradasBrutasCents: 12000,
      saidasBrutasCents: 9500,
      reembolsoEmDespesasCents: 2000,
      reembolsoEmReceitasCents: 1500,
      recebidoCents: 8500,
      pagoCents: 6000,
    });
  });
});
