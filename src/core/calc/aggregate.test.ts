import { describe, expect, it } from 'vitest';
import { LISTS, LISTS_WITH_VIP, mov } from '../../../tests/support/dataset.ts';
import { aggregate } from './aggregate.ts';

describe('aggregate()', () => {
  it('nets an Entrada in an expense rubric against that expense and keeps the gross and refund parts', () => {
    const { rows, issues } = aggregate(
      [
        mov({ data: '2025-01-02', cents: 50000, tipo: 'Saída' }),
        mov({ data: '2025-01-03', cents: 20000, tipo: 'Saída' }),
        mov({
          data: '2025-01-04',
          cents: 15000,
          tipo: 'Entrada',
          rubrica: 'Licenças e SPA',
        }),
      ],
      LISTS,
      'rubrica',
    );

    expect(rows).toEqual([
      {
        rubrica: 'Licenças e SPA',
        side: 'despesa',
        netCents: 55000,
        grossCents: 70000,
        refundCents: 15000,
        count: 3,
      },
    ]);
    expect(issues).toEqual([]);
  });

  it('nets a Saída in an income rubric out of that income', () => {
    const { rows } = aggregate(
      [
        mov({ data: '2025-01-02', cents: 10000 }),
        mov({
          data: '2025-01-03',
          cents: 2500,
          tipo: 'Saída',
          rubrica: 'Bilheteira',
        }),
      ],
      LISTS,
      'rubrica',
    );

    expect(rows).toMatchObject([
      {
        rubrica: 'Bilheteira',
        side: 'receita',
        netCents: 7500,
        refundCents: 2500,
        count: 2,
      },
    ]);
  });

  it('keeps a negative net as a negative row and warns', () => {
    const { rows, issues } = aggregate(
      [
        mov({
          data: '2025-01-03',
          cents: 4000,
          tipo: 'Entrada',
          rubrica: 'Licenças e SPA',
        }),
      ],
      LISTS,
      'rubrica',
    );

    expect(rows).toMatchObject([
      { rubrica: 'Licenças e SPA', netCents: -4000 },
    ]);
    expect(issues.map((i) => [i.code, i.severity])).toEqual([
      ['negative-rubric-net', 'warning'],
    ]);
  });

  it('omits a rubric that nets to zero and movements outside the result', () => {
    const { rows } = aggregate(
      [
        mov({ data: '2025-01-02', cents: 3000 }),
        mov({
          data: '2025-01-03',
          cents: 3000,
          tipo: 'Saída',
          rubrica: 'Bilheteira',
        }),
        mov({
          data: '2025-01-04',
          cents: 900,
          tipo: 'Saída',
          rubrica: 'Transferências internas',
        }),
      ],
      LISTS,
      'rubrica',
    );

    expect(rows).toEqual([]);
  });

  it('splits by sub-rubric in Listas order with the rubric-named line first', () => {
    const { rows } = aggregate(
      [
        mov({ data: '2025-01-02', cents: 100, tipo: 'Saída' }),
        mov({ data: '2025-01-03', cents: 200, subRubrica: 'Bilhetes VIP' }),
        mov({ data: '2025-01-04', cents: 300, subRubrica: 'Bilhetes' }),
        mov({ data: '2025-01-05', cents: 400 }),
      ],
      LISTS_WITH_VIP,
      'subRubrica',
    );

    expect(rows.map((r) => [r.rubrica, r.subRubrica, r.netCents])).toEqual([
      ['Bilheteira', 'Bilheteira', 400],
      ['Bilheteira', 'Bilhetes', 300],
      ['Bilheteira', 'Bilhetes VIP', 200],
      ['Licenças e SPA', 'Licenças e SPA', 100],
    ]);
  });

  it('rolls sub-rubrics up into one row per rubric at rubric level', () => {
    const { rows } = aggregate(
      [
        mov({ data: '2025-01-03', cents: 200, subRubrica: 'Bilhetes VIP' }),
        mov({ data: '2025-01-04', cents: 300, subRubrica: 'Bilhetes' }),
      ],
      LISTS_WITH_VIP,
      'rubrica',
    );

    expect(rows).toMatchObject([
      { rubrica: 'Bilheteira', netCents: 500, count: 2 },
    ]);
    expect(rows[0]).not.toHaveProperty('subRubrica');
  });
});
