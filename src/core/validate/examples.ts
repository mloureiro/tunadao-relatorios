import type { Cents, Conta, Dataset, FonteSaldo } from '../dataset/types.ts';
import type { IsoDate } from '../dates.ts';
import type { Cell, RawTable } from '../input/raw-table.ts';
import { parseMoney } from '../money.ts';
import { issueMessages, makeIssue, type Issue } from '../issues.ts';
import { normalise, normaliseHeader } from '../text.ts';

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

interface ExampleRow {
  readonly text: Readonly<Record<string, string>>;
  readonly money?: readonly [column: string, cents: Cents];
}

const EXAMPLE_ROWS: Readonly<Record<string, readonly ExampleRow[]>> = {
  Movimentos: [
    ['Inscrições (exemplo fictício)', 12000],
    ['Cartazes e impressões (exemplo fictício)', 4800],
    ['Aluguer de som (exemplo fictício)', 30000],
    ['Patrocínio do ginásio (exemplo fictício)', 50000],
    ['Vendas do bar por TPA (exemplo fictício)', 8550],
    ['Caução do alojamento (exemplo fictício)', 40000],
    ['Devolução de parte da caução (exemplo de reembolso)', 10000],
    ['Depósito de numerário (saída da caixa)', 10000],
    ['Depósito de numerário (entrada no banco)', 10000],
  ].map(([descricao, cents]) => ({
    text: { Descrição: String(descricao) },
    money: ['Valor (€)', Number(cents)] as const,
  })),
  Pendentes: [
    {
      text: { Entidade: 'Câmara Municipal (exemplo)' },
      money: ['Valor (€)', 25000],
    },
    { text: { Entidade: 'Gráfica Exemplo' }, money: ['Valor (€)', 18000] },
  ],
  Orçamento: [
    ['Zumba na Caneca', 'Inscrições e bilheteira', 40000],
    ['Zumba na Caneca', 'Produção (som, luz, palco)', 30000],
    ['2026', 'Comunicação e gráfica', 20000],
  ].map(([ambito, rubrica, cents]) => ({
    text: { Âmbito: String(ambito), Rubrica: String(rubrica) },
    money: ['Orçado (€)', Number(cents)] as const,
  })),
  Géneros: [
    {
      text: {
        Atividade: 'Zumba na Caneca',
        Tipo: 'Cedência de sala (exemplo)',
      },
    },
    {
      text: { Atividade: 'Festivais', Tipo: 'Cartazes oferecidos (exemplo)' },
    },
  ],
};

function cellAt(table: RawTable, cells: readonly Cell[], column: string): Cell {
  const at = table.header.findIndex(
    (name) => normaliseHeader(name) === normaliseHeader(column),
  );
  return at < 0 ? null : (cells[at] ?? null);
}

function matchesExample(
  table: RawTable,
  cells: readonly Cell[],
  example: ExampleRow,
): boolean {
  const textMatches = Object.entries(example.text).every(([column, wanted]) => {
    const cell = cellAt(table, cells, column);
    return typeof cell === 'string' && normalise(cell) === normalise(wanted);
  });
  if (!textMatches || example.money === undefined) return textMatches;
  const [column, cents] = example.money;
  const cell = cellAt(table, cells, column);
  if (typeof cell === 'boolean' || cell === null) return false;
  const parsed = parseMoney(cell);
  return 'cents' in parsed && parsed.cents === cents;
}

export function exampleRowIssues(tables: readonly RawTable[]): Issue[] {
  return tables.flatMap((table) => {
    const { tab } = table;
    if (tab === null || !EXAMPLE_TABS.has(tab)) return [];
    const frozen = EXAMPLE_ROWS[tab] ?? [];
    return table.rows.flatMap((cells, offset) => {
      const at = cells.findIndex(
        (cell) =>
          typeof cell === 'string' && normalise(cell).includes(EXAMPLE_MARKER),
      );
      const marked = at >= 0;
      if (!marked && !frozen.some((row) => matchesExample(table, cells, row))) {
        return [];
      }
      const column = marked ? table.header[at] : undefined;
      return [
        makeIssue('example-row', issueMessages['example-row'](), {
          file: table.source,
          tab,
          row: table.firstDataRow + offset,
          ...(column === undefined || column === '' ? {} : { column }),
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
