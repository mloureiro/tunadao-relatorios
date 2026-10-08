import type { Cents, Lists, Movimento } from '../dataset/types.ts';
import { sum } from '../money.ts';
import { classify } from './classify.ts';

export interface ActivityRow {
  readonly atividade: string;
  readonly recebidoCents: Cents;
  readonly pagoCents: Cents;
  readonly resultadoCents: Cents;
}

export interface ActivityResult {
  readonly rows: ActivityRow[];
  readonly total: Omit<ActivityRow, 'atividade'>;
}

export function byActivity(
  movements: readonly Movimento[],
  lists: Lists,
): ActivityResult {
  const grouped = new Map<string, Movimento[]>();
  for (const m of movements.filter((m) => m.contaResultado)) {
    grouped.set(m.atividade, [...(grouped.get(m.atividade) ?? []), m]);
  }
  const position = (atividade: string) => {
    const at = lists.atividades.indexOf(atividade);
    return at < 0 ? lists.atividades.length : at;
  };

  const rows = [...grouped.entries()]
    .toSorted(([a], [b]) => position(a) - position(b))
    .map(([atividade, group]): ActivityRow => {
      const classified = group.map((m) => classify(m, lists));
      const total = (side: 'receita' | 'despesa') =>
        sum(
          classified
            .filter((c) => c.side === side)
            .map((c) => c.contributionCents),
        );
      const recebidoCents = total('receita');
      const pagoCents = total('despesa');
      return {
        atividade,
        recebidoCents,
        pagoCents,
        resultadoCents: recebidoCents - pagoCents,
      };
    });

  const recebidoCents = sum(rows.map((r) => r.recebidoCents));
  const pagoCents = sum(rows.map((r) => r.pagoCents));
  return {
    rows,
    total: {
      recebidoCents,
      pagoCents,
      resultadoCents: recebidoCents - pagoCents,
    },
  };
}
