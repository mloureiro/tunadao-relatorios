import { compare, type IsoDate } from '../dates.ts';
import type { Cents, Dataset, Pendente } from '../dataset/types.ts';
import { sum } from '../money.ts';

export interface PendingResult {
  readonly receber: Pendente[];
  readonly pagar: Pendente[];
  readonly porReceberCents: Cents;
  readonly porPagarCents: Cents;
}

export function pendingAt(
  dataset: Dataset,
  ref: IsoDate,
  atividade?: string,
): PendingResult {
  const open = dataset.pendentes.filter(
    (p) =>
      compare(p.dataRegisto, ref) <= 0 &&
      (p.dataLiquidacao === null || compare(p.dataLiquidacao, ref) > 0) &&
      (atividade === undefined || p.atividade === atividade),
  );
  const receber = open.filter((p) => p.tipo === 'A receber');
  const pagar = open.filter((p) => p.tipo === 'A pagar');
  return {
    receber,
    pagar,
    porReceberCents: sum(receber.map((p) => p.valorCents)),
    porPagarCents: sum(pagar.map((p) => p.valorCents)),
  };
}
