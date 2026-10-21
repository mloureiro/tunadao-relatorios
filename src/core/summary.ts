import type { Dataset } from './dataset/types.ts';
import type { IsoDate } from './dates.ts';
import { formatMoney } from './format.ts';
import { balanceAtEndOf } from './ledger/index.ts';
import type { Money } from './reports/index.ts';

export interface DataSummary {
  readonly firstDate: IsoDate;
  readonly lastDate: IsoDate;
  readonly movimentos: number;
  readonly atividades: number;
  readonly caixa: Money | null;
  readonly banco: Money | null;
}

function money(cents: number | undefined): Money | null {
  return cents === undefined ? null : { cents, text: formatMoney(cents) };
}

export function summariseDataset(dataset: Dataset): DataSummary | null {
  const dates = dataset.movimentos.map(({ data }) => data).toSorted();
  const firstDate = dates.at(0);
  const lastDate = dates.at(-1);
  if (firstDate === undefined || lastDate === undefined) return null;

  return {
    firstDate,
    lastDate,
    movimentos: dataset.movimentos.length,
    atividades: new Set(dataset.movimentos.map(({ atividade }) => atividade))
      .size,
    caixa: money(balanceAtEndOf(dataset, 'Caixa', lastDate)),
    banco: money(balanceAtEndOf(dataset, 'Banco', lastDate)),
  };
}
