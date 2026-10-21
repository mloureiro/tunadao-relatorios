import type { Cents, Conta, Dataset, FonteSaldo } from '../dataset/types.ts';
import { fromExcelSerial, parseDateText, type IsoDate } from '../dates.ts';
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
  readonly text: Readonly<Record<string, string | null>>;
  readonly money?: readonly [column: string, cents: Cents];
  readonly date?: IsoDate;
}

const EXAMPLE_ROWS: Readonly<Record<string, readonly ExampleRow[]>> = {
  Movimentos: [
    ['2026-02-05', 'Inscrições (exemplo fictício)', 12000],
    ['2026-02-06', 'Cartazes e impressões (exemplo fictício)', 4800],
    ['2026-02-10', 'Aluguer de som (exemplo fictício)', 30000],
    ['2026-02-12', 'Patrocínio do ginásio (exemplo fictício)', 50000],
    ['2026-02-15', 'Vendas do bar por TPA (exemplo fictício)', 8550],
    ['2026-02-16', 'Caução do alojamento (exemplo fictício)', 40000],
    [
      '2026-02-20',
      'Devolução de parte da caução (exemplo de reembolso)',
      10000,
    ],
    ['2026-02-22', 'Depósito de numerário (saída da caixa)', 10000],
    ['2026-02-22', 'Depósito de numerário (entrada no banco)', 10000],
  ].map(([date, descricao, cents]) => ({
    date: String(date),
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
    [
      'Zumba na Caneca',
      'Entrada',
      'Inscrições e bilheteira',
      'Bilheteira',
      40000,
    ],
    [
      'Zumba na Caneca',
      'Saída',
      'Produção (som, luz, palco)',
      'Som e luz',
      30000,
    ],
    ['2026', 'Saída', 'Comunicação e gráfica', null, 20000],
  ].map(([ambito, tipo, rubrica, sub, cents]) => ({
    text: {
      Âmbito: String(ambito),
      Tipo: String(tipo),
      Rubrica: String(rubrica),
      'Sub-rubrica': sub === null ? null : String(sub),
    },
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

function dateMatches(
  table: RawTable,
  cells: readonly Cell[],
  wanted: IsoDate,
): boolean {
  const cell = cellAt(table, cells, 'Data');
  if (typeof cell === 'number') {
    return fromExcelSerial(cell, table.date1904) === wanted;
  }
  return typeof cell === 'string' && parseDateText(cell) === wanted;
}

function matchesExample(
  table: RawTable,
  cells: readonly Cell[],
  example: ExampleRow,
): boolean {
  const textMatches = Object.entries(example.text).every(([column, wanted]) => {
    const cell = cellAt(table, cells, column);
    return wanted === null
      ? cell === null
      : typeof cell === 'string' && normalise(cell) === normalise(wanted);
  });
  if (!textMatches) return false;
  if (example.date !== undefined && !dateMatches(table, cells, example.date)) {
    return false;
  }
  if (example.money === undefined) return true;
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
