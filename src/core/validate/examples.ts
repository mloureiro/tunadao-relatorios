import type { Cents, Conta, Dataset, FonteSaldo } from '../dataset/types.ts';
import type { IsoDate } from '../dates.ts';
import type { RawTable } from '../input/raw-table.ts';
import { issueMessages, makeIssue, type Issue } from '../issues.ts';
import { normalise } from '../text.ts';

const EXAMPLE_MARKER = normalise('exemplo fictício');
const EXAMPLE_TABS: ReadonlySet<string> = new Set([
  'Movimentos',
  'Pendentes',
  'Orçamento',
  'Géneros',
]);

interface ExampleCheckpoint {
  readonly data: IsoDate;
  readonly conta: Conta;
  readonly saldoCents: Cents;
  readonly fonte: FonteSaldo;
}

const EXAMPLE_CHECKPOINTS: readonly ExampleCheckpoint[] = [
  { data: '2026-01-31', conta: 'Caixa', saldoCents: 15000, fonte: 'Contagem' },
  { data: '2026-01-31', conta: 'Banco', saldoCents: 300000, fonte: 'Extrato' },
  { data: '2026-02-28', conta: 'Caixa', saldoCents: 12200, fonte: 'Contagem' },
  { data: '2026-02-28', conta: 'Banco', saldoCents: 308550, fonte: 'Extrato' },
];

export function exampleRowIssues(tables: readonly RawTable[]): Issue[] {
  return tables.flatMap((table) => {
    const { tab } = table;
    if (tab === null || !EXAMPLE_TABS.has(tab)) return [];
    return table.rows.flatMap((cells, offset) => {
      const at = cells.findIndex(
        (cell) =>
          typeof cell === 'string' && normalise(cell).includes(EXAMPLE_MARKER),
      );
      if (at < 0) return [];
      return [
        makeIssue('example-row', issueMessages['example-row'](), {
          file: table.source,
          tab,
          row: table.firstDataRow + offset,
          ...(table.header[at] === undefined || table.header[at] === ''
            ? {}
            : { column: table.header[at] }),
        }),
      ];
    });
  });
}

export function exampleCheckpointIssues(dataset: Dataset): Issue[] {
  return dataset.saldos.flatMap((saldo) =>
    EXAMPLE_CHECKPOINTS.some(
      (example) =>
        example.data === saldo.data &&
        example.conta === saldo.conta &&
        example.saldoCents === saldo.saldoCents &&
        example.fonte === saldo.fonte,
    )
      ? [
          makeIssue(
            'example-checkpoint',
            issueMessages['example-checkpoint'](
              saldo.conta,
              saldo.data,
              saldo.saldoCents,
              saldo.fonte,
            ),
            { file: saldo.src.file, tab: saldo.src.tab, row: saldo.src.row },
          ),
        ]
      : [],
  );
}
