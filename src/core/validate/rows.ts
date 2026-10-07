import { formatDate } from '../format.ts';
import type { Dataset, Movimento } from '../dataset/types.ts';
import { issueMessages, makeIssue, type Issue } from '../issues.ts';
import { sum } from '../money.ts';
import { normalise } from '../text.ts';

export const TRANSFER_RUBRICA = 'Transferências internas';

const KEY_SEPARATOR = '\u0000';

export function duplicateIssues(dataset: Dataset): Issue[] {
  const firstRow = new Map<string, number>();
  const issues: Issue[] = [];

  for (const m of dataset.movimentos) {
    const key = [
      m.data,
      String(m.valorCents),
      m.tipo,
      normalise(m.descricao),
    ].join(KEY_SEPARATOR);
    const first = firstRow.get(key);
    if (first === undefined) {
      firstRow.set(key, m.src.row);
      continue;
    }
    issues.push(
      makeIssue(
        'probable-duplicate',
        issueMessages['probable-duplicate'](m.data, m.valorCents, first),
        { file: m.src.file, tab: m.src.tab, row: m.src.row },
      ),
    );
  }
  return issues;
}

function transferGroupKey(m: Movimento): { key: string; label: string } {
  return m.doc === null
    ? { key: `data:${m.data}`, label: formatDate(m.data) }
    : { key: `doc:${m.doc}`, label: `N.º doc ${m.doc}` };
}

export function transferIssues(dataset: Dataset): Issue[] {
  const groups = new Map<string, { label: string; rows: Movimento[] }>();
  for (const m of dataset.movimentos) {
    if (m.rubrica !== TRANSFER_RUBRICA) continue;
    const { key, label } = transferGroupKey(m);
    const group = groups.get(key) ?? { label, rows: [] };
    group.rows.push(m);
    groups.set(key, group);
  }

  return [...groups.values()].flatMap(({ label, rows }) => {
    const difference = sum(rows.map((m) => m.signedCents));
    return difference === 0
      ? []
      : rows.map((m) =>
          makeIssue(
            'transfer-unbalanced',
            issueMessages['transfer-unbalanced'](label, difference),
            { file: m.src.file, tab: m.src.tab, row: m.src.row },
          ),
        );
  });
}

export function nonResultRowIssues(dataset: Dataset): Issue[] {
  return dataset.movimentos.flatMap((m) =>
    m.contaResultado || m.rubrica === TRANSFER_RUBRICA
      ? []
      : [
          makeIssue(
            'non-result-row',
            issueMessages['non-result-row'](m.rubrica),
            { file: m.src.file, tab: m.src.tab, row: m.src.row },
          ),
        ],
  );
}

export function settledBeforeRegisteredIssues(dataset: Dataset): Issue[] {
  return dataset.pendentes.flatMap((p) =>
    p.dataLiquidacao !== null && p.dataLiquidacao < p.dataRegisto
      ? [
          makeIssue(
            'settled-before-registered',
            issueMessages['settled-before-registered'](
              p.dataLiquidacao,
              p.dataRegisto,
            ),
            {
              file: p.src.file,
              tab: p.src.tab,
              row: p.src.row,
              column: 'Data de liquidação',
            },
          ),
        ]
      : [],
  );
}
