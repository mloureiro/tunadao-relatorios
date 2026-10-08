import type { Cents, Lists, Movimento } from '../dataset/types.ts';
import { sum } from '../money.ts';
import { classify } from './classify.ts';

export interface AnnexFooter {
  readonly entradasBrutasCents: Cents;
  readonly saidasBrutasCents: Cents;
  readonly reembolsoEmDespesasCents: Cents;
  readonly reembolsoEmReceitasCents: Cents;
  readonly recebidoCents: Cents;
  readonly pagoCents: Cents;
}

export function annexFooter(
  movements: readonly Movimento[],
  lists: Lists,
): AnnexFooter {
  const classified = movements
    .filter((m) => m.contaResultado)
    .map((m) => ({ m, c: classify(m, lists) }));
  const total = (pick: (row: (typeof classified)[number]) => boolean) =>
    sum(classified.filter(pick).map(({ m }) => m.valorCents));

  const entradasBrutasCents = total(({ m }) => m.tipo === 'Entrada');
  const saidasBrutasCents = total(({ m }) => m.tipo === 'Saída');
  const reembolsoEmDespesasCents = total(
    ({ m, c }) => c.refund && m.tipo === 'Entrada',
  );
  const reembolsoEmReceitasCents = total(
    ({ m, c }) => c.refund && m.tipo === 'Saída',
  );
  const refunds = reembolsoEmDespesasCents + reembolsoEmReceitasCents;

  return {
    entradasBrutasCents,
    saidasBrutasCents,
    reembolsoEmDespesasCents,
    reembolsoEmReceitasCents,
    recebidoCents: entradasBrutasCents - refunds,
    pagoCents: saidasBrutasCents - refunds,
  };
}
