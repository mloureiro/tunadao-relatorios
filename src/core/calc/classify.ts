import type { Cents, Lists, Movimento } from '../dataset/types.ts';

export interface Classification {
  readonly side: 'receita' | 'despesa' | 'fora';
  readonly contributionCents: Cents;
  readonly refund: boolean;
}

export function classify(movimento: Movimento, lists: Lists): Classification {
  if (!movimento.contaResultado) {
    return { side: 'fora', contributionCents: 0, refund: false };
  }

  const rubricTipo =
    lists.rubricas.find((def) => def.rubrica === movimento.rubrica)?.tipo ??
    movimento.tipo;
  const refund = movimento.tipo !== rubricTipo;
  return {
    side: rubricTipo === 'Entrada' ? 'receita' : 'despesa',
    contributionCents: refund ? -movimento.valorCents : movimento.valorCents,
    refund,
  };
}
