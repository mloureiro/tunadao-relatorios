import type { Cents, Lists, Movimento } from '../dataset/types.ts';
import { issueMessages, makeIssue, type Issue } from '../issues.ts';
import { sum } from '../money.ts';
import { classify } from './classify.ts';

export type AggregationLevel = 'rubrica' | 'subRubrica';

export interface AggregateRow {
  readonly rubrica: string;
  readonly subRubrica?: string;
  readonly side: 'receita' | 'despesa';
  readonly netCents: Cents;
  readonly grossCents: Cents;
  readonly refundCents: Cents;
  readonly count: number;
}

export interface AggregateResult {
  readonly rows: AggregateRow[];
  readonly issues: Issue[];
}

const KEY_SEPARATOR = '\u0000';
const UNLISTED = Number.MAX_SAFE_INTEGER;

export function aggregationKey(
  level: AggregationLevel,
  rubrica: string,
  subRubrica: string,
): string {
  return level === 'rubrica'
    ? rubrica
    : [rubrica, subRubrica].join(KEY_SEPARATOR);
}

function listasPosition(
  lists: Lists,
  rubrica: string,
  subRubrica: string | undefined,
): readonly [number, number] {
  const rubricaOrder =
    lists.rubricas.find((def) => def.rubrica === rubrica)?.order ?? UNLISTED;
  if (subRubrica === undefined || subRubrica === rubrica) {
    return [rubricaOrder, -1];
  }
  const subOrder =
    lists.subRubricas.find(
      (def) => def.rubrica === rubrica && def.subRubrica === subRubrica,
    )?.order ?? UNLISTED;
  return [rubricaOrder, subOrder];
}

export function compareListasOrder(
  lists: Lists,
  a: { readonly rubrica: string; readonly subRubrica?: string | undefined },
  b: { readonly rubrica: string; readonly subRubrica?: string | undefined },
): number {
  const [aRubrica, aSub] = listasPosition(lists, a.rubrica, a.subRubrica);
  const [bRubrica, bSub] = listasPosition(lists, b.rubrica, b.subRubrica);
  return aRubrica - bRubrica || aSub - bSub;
}

export function aggregate(
  movements: readonly Movimento[],
  lists: Lists,
  level: AggregationLevel,
): AggregateResult {
  const groups = new Map<
    string,
    {
      rubrica: string;
      subRubrica: string;
      side: 'receita' | 'despesa';
      gross: Cents[];
      refund: Cents[];
    }
  >();

  for (const movimento of movements) {
    const { side, refund } = classify(movimento, lists);
    if (side === 'fora') continue;
    const key = aggregationKey(level, movimento.rubrica, movimento.subRubrica);
    const group = groups.get(key) ?? {
      rubrica: movimento.rubrica,
      subRubrica: movimento.subRubrica,
      side,
      gross: [],
      refund: [],
    };
    (refund ? group.refund : group.gross).push(movimento.valorCents);
    groups.set(key, group);
  }

  const rows = [...groups.values()]
    .map((group): AggregateRow => {
      const grossCents = sum(group.gross);
      const refundCents = sum(group.refund);
      return {
        rubrica: group.rubrica,
        ...(level === 'subRubrica' ? { subRubrica: group.subRubrica } : {}),
        side: group.side,
        netCents: grossCents - refundCents,
        grossCents,
        refundCents,
        count: group.gross.length + group.refund.length,
      };
    })
    .filter((row) => row.netCents !== 0)
    .toSorted((a, b) => compareListasOrder(lists, a, b));

  const issues = rows
    .filter((row) => row.netCents < 0)
    .map((row) =>
      makeIssue(
        'negative-rubric-net',
        issueMessages['negative-rubric-net'](
          row.subRubrica ?? row.rubrica,
          row.netCents,
        ),
      ),
    );

  return { rows, issues };
}
