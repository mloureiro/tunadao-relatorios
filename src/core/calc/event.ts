import { compare, type IsoDate } from '../dates.ts';
import type { Cents, Dataset, Genero, Movimento } from '../dataset/types.ts';
import type { Issue } from '../issues.ts';
import { annexFooter, type AnnexFooter } from './annex.ts';
import { classify } from './classify.ts';
import { inKind } from './in-kind.ts';
import { pendingAt, type PendingResult } from './pending.ts';
import {
  countsOf,
  resultCents,
  sortChronologically,
  type MovementCounts,
} from './period.ts';

export interface EventParams {
  readonly atividade: string;
  readonly contarAte?: IsoDate;
  readonly refPendentes: IsoDate;
}

export interface CashBookRow {
  readonly movimento: Movimento;
  readonly refund: boolean;
  readonly entradaCents: Cents | null;
  readonly saidaCents: Cents | null;
  readonly acumuladoCents: Cents;
}

export interface EventFigures {
  readonly atividade: string;
  readonly movements: Movimento[];
  readonly span: { readonly start: IsoDate; readonly end: IsoDate } | null;
  readonly recebidoCents: Cents;
  readonly pagoCents: Cents;
  readonly resultadoCents: Cents;
  readonly counts: MovementCounts;
  readonly pending: PendingResult;
  readonly resultadoPrevistoCents: Cents;
  readonly inKindRows: Genero[];
  readonly inKindCents: Cents;
  readonly cashBook: CashBookRow[];
  readonly footer: AnnexFooter;
  readonly issues: Issue[];
}

export function eventFigures(
  dataset: Dataset,
  params: EventParams,
): EventFigures {
  const { atividade, contarAte, refPendentes } = params;
  const movements = sortChronologically(
    dataset.movimentos.filter(
      (m) =>
        m.atividade === atividade &&
        m.contaResultado &&
        (contarAte === undefined || compare(m.data, contarAte) <= 0),
    ),
  );

  const { recebidoCents, pagoCents } = resultCents(movements, dataset);
  const resultadoCents = recebidoCents - pagoCents;
  const pending = pendingAt(dataset, refPendentes, atividade);
  const kind = inKind(dataset, { atividade });

  let acumuladoCents = 0;
  const cashBook = movements.map((movimento): CashBookRow => {
    acumuladoCents += movimento.signedCents;
    return {
      movimento,
      refund: classify(movimento, dataset.lists).refund,
      entradaCents: movimento.tipo === 'Entrada' ? movimento.valorCents : null,
      saidaCents: movimento.tipo === 'Saída' ? movimento.valorCents : null,
      acumuladoCents,
    };
  });

  const first = movements[0];
  const last = movements.at(-1);
  return {
    atividade,
    movements,
    span:
      first === undefined || last === undefined
        ? null
        : { start: first.data, end: last.data },
    recebidoCents,
    pagoCents,
    resultadoCents,
    counts: countsOf(movements, dataset),
    pending,
    resultadoPrevistoCents:
      resultadoCents + pending.porReceberCents - pending.porPagarCents,
    inKindRows: kind.rows,
    inKindCents: kind.totalCents,
    cashBook,
    footer: annexFooter(movements, dataset.lists),
    issues: kind.issues,
  };
}
