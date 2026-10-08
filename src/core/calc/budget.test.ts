import { describe, expect, it } from 'vitest';
import {
  LISTS_WITH_VIP,
  emptyDataset,
  linha,
  mov,
} from '../../../tests/support/dataset.ts';
import { budgetVsActual } from './budget.ts';

describe('budgetVsActual()', () => {
  it('computes deviation with its sign and execution in permille, null without a budget amount', () => {
    const dataset = emptyDataset({
      orcamento: [
        linha({ orcadoCents: 20000 }),
        linha({ tipo: 'Saída', orcadoCents: 0 }),
      ],
    });
    const movements = [
      mov({ data: '2025-03-01', cents: 15000 }),
      mov({ data: '2025-03-02', cents: 500, tipo: 'Saída' }),
    ];

    const { tables, issues } = budgetVsActual(
      dataset,
      'Festival Alfa',
      movements,
      'rubrica',
    );

    expect(issues).toEqual([]);
    expect(tables?.receitas.rows).toMatchObject([
      {
        label: 'Bilheteira',
        orcadoCents: 20000,
        realizadoCents: 15000,
        desvioCents: -5000,
        execucaoPermille: 750,
      },
    ]);
    expect(tables?.despesas.rows).toMatchObject([
      {
        label: 'Licenças e SPA',
        orcadoCents: 0,
        realizadoCents: 500,
        desvioCents: 500,
        execucaoPermille: null,
      },
    ]);
    expect(tables?.despesas.total.execucaoPermille).toBeNull();
  });

  it('rounds execution half up and keeps actuals that have no budget line', () => {
    const dataset = emptyDataset({
      orcamento: [linha({ orcadoCents: 350000 })],
    });

    const { tables } = budgetVsActual(
      dataset,
      'Festival Alfa',
      [
        mov({ data: '2025-03-01', cents: 387000 }),
        mov({ data: '2025-03-02', cents: 1000, tipo: 'Saída' }),
      ],
      'rubrica',
    );

    expect(tables?.receitas.total.execucaoPermille).toBe(1106);
    expect(tables?.despesas.rows).toMatchObject([
      { label: 'Licenças e SPA', orcadoCents: 0, realizadoCents: 1000 },
    ]);
  });

  it('rolls budget lines with sub-rubrics up at rubric level and splits them at sub-rubric level', () => {
    const dataset = emptyDataset({
      lists: LISTS_WITH_VIP,
      orcamento: [
        linha({ subRubrica: 'Bilhetes', orcadoCents: 1000 }),
        linha({ subRubrica: 'Bilhetes VIP', orcadoCents: 500 }),
      ],
    });
    const movements = [
      mov({ data: '2025-03-01', cents: 900, subRubrica: 'Bilhetes' }),
      mov({ data: '2025-03-02', cents: 600, subRubrica: 'Bilhetes VIP' }),
    ];

    const byRubric = budgetVsActual(
      dataset,
      'Festival Alfa',
      movements,
      'rubrica',
    );
    const bySub = budgetVsActual(
      dataset,
      'Festival Alfa',
      movements,
      'subRubrica',
    );

    expect(byRubric.tables?.receitas.rows).toMatchObject([
      { label: 'Bilheteira', orcadoCents: 1500, realizadoCents: 1500 },
    ]);
    expect(
      bySub.tables?.receitas.rows.map((r) => [
        r.label,
        r.orcadoCents,
        r.realizadoCents,
      ]),
    ).toEqual([
      ['Bilhetes', 1000, 900],
      ['Bilhetes VIP', 500, 600],
    ]);
    expect(bySub.issues).toEqual([]);
  });

  it.each([
    [
      'a rubric-level budget against sub-rubric actuals',
      'Bilheteira',
      'Bilhetes',
    ],
    [
      'sub-rubric budget lines against rubric-level actuals',
      'Bilhetes',
      'Bilheteira',
    ],
  ])('warns about %s', (_, budgetSub, actualSub) => {
    const dataset = emptyDataset({
      lists: LISTS_WITH_VIP,
      orcamento: [linha({ subRubrica: budgetSub, orcadoCents: 1000 })],
    });

    const { issues } = budgetVsActual(
      dataset,
      'Festival Alfa',
      [mov({ data: '2025-03-01', cents: 900, subRubrica: actualSub })],
      'subRubrica',
    );

    expect(issues.map((i) => [i.code, i.severity])).toEqual([
      ['budget-level-mismatch', 'warning'],
    ]);
  });

  it('returns no tables and a no-budget warning when the scope has no lines', () => {
    const dataset = emptyDataset({
      orcamento: [linha({ ambito: '2024', orcadoCents: 1 })],
    });

    const result = budgetVsActual(dataset, '2025', [], 'rubrica');

    expect(result.tables).toBeNull();
    expect(result.issues.map((i) => [i.code, i.severity])).toEqual([
      ['no-budget', 'warning'],
    ]);
  });
});
