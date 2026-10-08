import type {
  Cents,
  Dataset,
  LinhaOrcamento,
  Movimento,
} from '../dataset/types.ts';
import { issueMessages, makeIssue, type Issue } from '../issues.ts';
import { roundHalfAway, sum } from '../money.ts';
import {
  aggregate,
  aggregationKey,
  compareListasOrder,
  type AggregateRow,
  type AggregationLevel,
} from './aggregate.ts';

export interface BudgetFigures {
  readonly orcadoCents: Cents;
  readonly realizadoCents: Cents;
  readonly desvioCents: Cents;
  readonly execucaoPermille: number | null;
}

export interface BudgetRow extends BudgetFigures {
  readonly rubrica: string;
  readonly subRubrica?: string;
  readonly label: string;
}

export interface BudgetTable {
  readonly rows: BudgetRow[];
  readonly total: BudgetFigures;
}

export interface BudgetTables {
  readonly receitas: BudgetTable;
  readonly despesas: BudgetTable;
}

export interface BudgetResult {
  readonly tables: BudgetTables | null;
  readonly issues: Issue[];
}

function figures(orcadoCents: Cents, realizadoCents: Cents): BudgetFigures {
  return {
    orcadoCents,
    realizadoCents,
    desvioCents: realizadoCents - orcadoCents,
    execucaoPermille:
      orcadoCents === 0
        ? null
        : roundHalfAway(realizadoCents * 1000, orcadoCents),
  };
}

function levelMismatches(
  lines: readonly LinhaOrcamento[],
  actual: readonly AggregateRow[],
): string[] {
  const budgeted = new Set(
    lines.map((l) => `${l.rubrica}\u0000${l.subRubrica}`),
  );
  const unbudgeted = actual.filter(
    (r) => !budgeted.has(`${r.rubrica}\u0000${r.subRubrica ?? r.rubrica}`),
  );
  const isPlain = (rubrica: string, sub: string | undefined) =>
    sub === undefined || sub === rubrica;

  const rubricas = new Set(unbudgeted.map((r) => r.rubrica));
  return [...rubricas].filter((rubrica) => {
    const actualOf = unbudgeted.filter((r) => r.rubrica === rubrica);
    const budgetOf = lines.filter((l) => l.rubrica === rubrica);
    return (
      (actualOf.some((r) => !isPlain(rubrica, r.subRubrica)) &&
        budgetOf.some((l) => isPlain(rubrica, l.subRubrica))) ||
      (actualOf.some((r) => isPlain(rubrica, r.subRubrica)) &&
        budgetOf.some((l) => !isPlain(rubrica, l.subRubrica)))
    );
  });
}

export function budgetVsActual(
  dataset: Dataset,
  ambito: string,
  movements: readonly Movimento[],
  level: AggregationLevel,
): BudgetResult {
  const lines = dataset.orcamento.filter((l) => l.ambito === ambito);
  if (lines.length === 0) {
    return {
      tables: null,
      issues: [makeIssue('no-budget', issueMessages['no-budget'](ambito))],
    };
  }

  const actual = aggregate(movements, dataset.lists, level).rows;
  const issues: Issue[] =
    level === 'subRubrica'
      ? levelMismatches(lines, actual).map((rubrica) =>
          makeIssue(
            'budget-level-mismatch',
            issueMessages['budget-level-mismatch'](rubrica),
          ),
        )
      : [];

  const merged = new Map<
    string,
    {
      rubrica: string;
      subRubrica: string;
      side: 'receita' | 'despesa';
      orcado: Cents;
      realizado: Cents;
    }
  >();
  const entry = (
    rubrica: string,
    subRubrica: string,
    side: 'receita' | 'despesa',
  ) => {
    const key = aggregationKey(level, rubrica, subRubrica);
    const existing = merged.get(key) ?? {
      rubrica,
      subRubrica,
      side,
      orcado: 0,
      realizado: 0,
    };
    merged.set(key, existing);
    return existing;
  };
  for (const line of lines) {
    entry(
      line.rubrica,
      line.subRubrica,
      line.tipo === 'Entrada' ? 'receita' : 'despesa',
    ).orcado += line.orcadoCents;
  }
  for (const row of actual) {
    entry(row.rubrica, row.subRubrica ?? row.rubrica, row.side).realizado +=
      row.netCents;
  }

  const rows = [...merged.values()]
    .toSorted((a, b) =>
      compareListasOrder(
        dataset.lists,
        {
          rubrica: a.rubrica,
          subRubrica: level === 'subRubrica' ? a.subRubrica : undefined,
        },
        {
          rubrica: b.rubrica,
          subRubrica: level === 'subRubrica' ? b.subRubrica : undefined,
        },
      ),
    )
    .map((row) => ({
      side: row.side,
      row: {
        rubrica: row.rubrica,
        ...(level === 'subRubrica' ? { subRubrica: row.subRubrica } : {}),
        label: level === 'subRubrica' ? row.subRubrica : row.rubrica,
        ...figures(row.orcado, row.realizado),
      } satisfies BudgetRow,
    }));

  const table = (side: 'receita' | 'despesa'): BudgetTable => {
    const sideRows = rows.filter((r) => r.side === side).map((r) => r.row);
    return {
      rows: sideRows,
      total: figures(
        sum(sideRows.map((r) => r.orcadoCents)),
        sum(sideRows.map((r) => r.realizadoCents)),
      ),
    };
  };

  return {
    tables: { receitas: table('receita'), despesas: table('despesa') },
    issues,
  };
}
