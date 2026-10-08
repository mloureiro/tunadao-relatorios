import { describe, expect, it } from 'vitest';
import { emptyDataset, genero, mov } from '../../../tests/support/dataset.ts';
import { byActivity } from './activity.ts';
import { composition } from './composition.ts';
import { inKind } from './in-kind.ts';

describe('byActivity()', () => {
  it('lists activities in Listas order with refunds netted and non-result rows ignored', () => {
    const { rows, total } = byActivity(
      [
        mov({ data: '2025-01-01', cents: 1000, atividade: 'Serenata' }),
        mov({
          data: '2025-01-02',
          cents: 300,
          tipo: 'Saída',
          atividade: 'Festival Alfa',
        }),
        mov({
          data: '2025-01-03',
          cents: 100,
          atividade: 'Festival Alfa',
          rubrica: 'Licenças e SPA',
        }),
        mov({
          data: '2025-01-04',
          cents: 900,
          atividade: 'Serenata',
          rubrica: 'Transferências internas',
        }),
      ],
      emptyDataset().lists,
    );

    expect(rows).toEqual([
      {
        atividade: 'Festival Alfa',
        recebidoCents: 0,
        pagoCents: 200,
        resultadoCents: -200,
      },
      {
        atividade: 'Serenata',
        recebidoCents: 1000,
        pagoCents: 0,
        resultadoCents: 1000,
      },
    ]);
    expect(total).toEqual({
      recebidoCents: 1000,
      pagoCents: 200,
      resultadoCents: 800,
    });
  });
});

describe('composition()', () => {
  it('sorts by value, rounds shares half away from zero and does not force them to 1000', () => {
    const { totalCents, segments } = composition([
      { label: 'A', cents: 1 },
      { label: 'B', cents: 3 },
      { label: 'C', cents: 1 },
      { label: 'D', cents: 1 },
    ]);

    expect(totalCents).toBe(6);
    expect(segments.map((s) => [s.label, s.permille])).toEqual([
      ['B', 500],
      ['A', 167],
      ['C', 167],
      ['D', 167],
    ]);
  });

  it('leaves zero rows out of the segments', () => {
    const { segments } = composition([
      { label: 'moved', cents: 0 },
      { label: 'real', cents: 500 },
    ]);

    expect(segments.map((s) => s.label)).toEqual(['real']);
  });

  it('rounds a 0.5 permille share up', () => {
    const { segments } = composition([
      { label: 'big', cents: 1999 },
      { label: 'small', cents: 1 },
    ]);

    expect(segments.map((s) => s.permille)).toEqual([1000, 1]);
  });
});

describe('inKind()', () => {
  const dataset = emptyDataset({
    generos: [
      genero({ data: '2025-03-01', valorEstimadoCents: 1000 }),
      genero({ data: '2025-09-01', valorEstimadoCents: 2000 }),
      genero({ data: null, valorEstimadoCents: 400, atividade: 'Serenata' }),
      genero({ data: '2025-03-02', valorEstimadoCents: null }),
    ],
  });

  it('takes the dated rows of a period, skips undated ones and warns', () => {
    const result = inKind(dataset, { start: '2025-01-01', end: '2025-06-30' });

    expect(result.rows).toHaveLength(2);
    expect(result.totalCents).toBe(1000);
    expect(result.issues.map((i) => [i.code, i.severity])).toEqual([
      ['undated-generos', 'warning'],
    ]);
  });

  it('takes every row of an activity, dated or not, without a warning', () => {
    const result = inKind(dataset, { atividade: 'Serenata' });

    expect(result).toMatchObject({ totalCents: 400, issues: [] });
  });
});
