import type { Dataset, TabName } from '../dataset/types.ts';
import type { RawTable } from '../input/raw-table.ts';
import { issueMessages, makeIssue, type Issue } from '../issues.ts';
import { normaliseListas } from './lists.ts';
import { normaliseMovimentos, type UnresolvedMovimento } from './movimentos.ts';
import {
  normaliseGeneros,
  normaliseOrcamento,
  normalisePendentes,
  normaliseSaldos,
} from './other-tabs.ts';

export interface NormalisedTables {
  readonly dataset: Omit<Dataset, 'sources'>;
  readonly issues: Issue[];
  readonly unresolved: UnresolvedMovimento[];
}

const REQUIRED_TABS = ['Movimentos', 'Listas'] as const;

export function normaliseTables(tables: readonly RawTable[]): NormalisedTables {
  const issues: Issue[] = [];
  const forTab = (tab: TabName): RawTable[] =>
    tables.filter((table) => table.tab === tab);

  for (const tab of REQUIRED_TABS) {
    if (forTab(tab).length === 0) {
      issues.push(
        makeIssue('missing-tab', issueMessages['missing-tab'](tab), { tab }),
      );
    }
  }

  const lists = normaliseListas(forTab('Listas'), issues);
  const { movimentos, unresolved } = normaliseMovimentos(
    forTab('Movimentos'),
    lists,
    issues,
  );

  return {
    dataset: {
      lists,
      movimentos,
      pendentes: normalisePendentes(forTab('Pendentes'), issues),
      orcamento: normaliseOrcamento(forTab('Orçamento'), issues),
      generos: normaliseGeneros(forTab('Géneros'), issues),
      saldos: normaliseSaldos(forTab('Saldos'), issues),
    },
    issues,
    unresolved,
  };
}
