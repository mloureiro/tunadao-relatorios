import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import type { ListasSpec } from '../../fixtures/src/listas.ts';
import { loadConfig, type Config } from '../../src/core/config/schema.ts';
import type {
  Checkpoint,
  Direcao,
  IsoDate,
  Pendente,
} from '../../src/core/dataset/types.ts';
import {
  writeReportSheet,
  type ListRanges,
  type ReportSheetSpec,
} from './report-sheet-writer.ts';
import { DATE_FORMAT, MONEY_FORMAT, STYLE, applyStyle } from './sheet-style.ts';
import {
  addListValidation,
  addPromptOnly,
  literalList,
  type Prompt,
} from './validation.ts';

export type { ReportSheetSpec } from './report-sheet-writer.ts';

export interface MovimentoSpec {
  readonly data: IsoDate;
  readonly doc: string | null;
  readonly descricao: string;
  readonly atividade: string | null;
  readonly rubrica: string;
  readonly subRubrica: string | null;
  readonly tipo: Direcao;
  readonly meio: string | null;
  readonly valorCents: number;
  readonly typedOver?: TypedOverDerived;
}

export interface TypedOverDerived {
  readonly conta?: string;
  readonly signedCents?: number;
  readonly contaResultado?: string;
}

export interface PendenteSpec {
  readonly tipo: Pendente['tipo'];
  readonly entidade: string;
  readonly descricao: string;
  readonly atividade: string | null;
  readonly valorCents: number;
  readonly dataRegisto: IsoDate;
  readonly dataLiquidacao: IsoDate | null;
  readonly notas: string | null;
}

export interface OrcamentoSpec {
  readonly ambito: string;
  readonly tipo: Direcao;
  readonly rubrica: string;
  readonly subRubrica: string | null;
  readonly orcadoCents: number;
}

export interface GeneroSpec {
  readonly data: IsoDate | null;
  readonly atividade: string;
  readonly tipo: string;
  readonly quantidade: string | null;
  readonly emFalta: number | null;
  readonly valorEstimadoCents: number | null;
}

export interface SaldoSpec {
  readonly data: IsoDate;
  readonly conta: Checkpoint['conta'];
  readonly saldoCents: number;
  readonly fonte: Checkpoint['fonte'];
}

export interface InstrucaoSpec {
  readonly titulo: string;
  readonly paragrafos: readonly string[];
  readonly tabela?: readonly (readonly string[])[];
}

export interface WorkbookSpec {
  readonly listas: ListasSpec;
  readonly movimentos: readonly MovimentoSpec[];
  readonly pendentes: readonly PendenteSpec[];
  readonly orcamento: readonly OrcamentoSpec[];
  readonly generos: readonly GeneroSpec[];
  readonly saldos: readonly SaldoSpec[];
  readonly instrucoes: readonly InstrucaoSpec[];
  readonly reportSheets: readonly ReportSheetSpec[];
}

interface ColumnDef {
  readonly header: string;
  readonly width: number;
  readonly format?: string;
  readonly automatic?: string;
}

export const DERIVED_ROWS = 5000;
const MAX_CELL_TEXT = 32_767;
const FIXED_TIMESTAMP = new Date(Date.UTC(2026, 0, 1));
const CONFIG_PATH = fileURLToPath(
  new URL('../../config/config.json', import.meta.url),
);

const date = { width: 13, format: DATE_FORMAT };
const money = { width: 16, format: MONEY_FORMAT };
const AUTOMATIC_NOTE =
  'Calculada automaticamente a partir das outras colunas. Não escreva nesta coluna.';

const MOVIMENTOS: readonly ColumnDef[] = [
  { header: 'Data', ...date },
  { header: 'N.º doc', width: 11 },
  { header: 'Descrição', width: 40 },
  { header: 'Atividade', width: 20 },
  { header: 'Rubrica', width: 30 },
  { header: 'Sub-rubrica', width: 26 },
  { header: 'Tipo', width: 10 },
  { header: 'Meio', width: 12 },
  { header: 'Valor (€)', ...money },
  { header: 'Conta (automático)', width: 14, automatic: AUTOMATIC_NOTE },
  {
    header: 'Efeito no saldo (€) (automático)',
    ...money,
    width: 20,
    automatic: AUTOMATIC_NOTE,
  },
  {
    header: 'Conta como receita ou despesa (automático)',
    width: 22,
    automatic: AUTOMATIC_NOTE,
  },
];

const PENDENTES: readonly ColumnDef[] = [
  { header: 'Tipo', width: 12 },
  { header: 'Entidade', width: 28 },
  { header: 'Descrição', width: 40 },
  { header: 'Atividade', width: 20 },
  { header: 'Valor (€)', ...money },
  { header: 'Data de registo', ...date },
  { header: 'Data de liquidação', ...date },
  { header: 'Notas', width: 36 },
];

const ORCAMENTO: readonly ColumnDef[] = [
  { header: 'Âmbito', width: 22 },
  { header: 'Tipo', width: 10 },
  { header: 'Rubrica', width: 30 },
  { header: 'Sub-rubrica', width: 26 },
  { header: 'Orçado (€)', ...money },
];

const GENEROS: readonly ColumnDef[] = [
  { header: 'Data', ...date },
  { header: 'Atividade', width: 20 },
  { header: 'Tipo', width: 28 },
  { header: 'Quantidade', width: 14 },
  { header: 'Em falta', width: 10 },
  { header: 'Valor estimado (€)', ...money },
];

const SALDOS: readonly ColumnDef[] = [
  { header: 'Data', ...date },
  { header: 'Conta', width: 10 },
  { header: 'Saldo (€)', ...money },
  { header: 'Fonte', width: 12 },
];

export const TABLE_HEADERS = {
  movimentos: MOVIMENTOS.map((column) => column.header),
  pendentes: PENDENTES.map((column) => column.header),
  orcamento: ORCAMENTO.map((column) => column.header),
  generos: GENEROS.map((column) => column.header),
  saldos: SALDOS.map((column) => column.header),
} as const;

const LISTAS_COLUMNS = {
  rubrica: 'A',
  subRubrica: 'E',
  rubricaDaSub: 'F',
  atividade: 'H',
  meio: 'J',
  orcamento: 'M',
} as const;

const LISTAS_RANGES: ListRanges = {
  atividade: listasRange(LISTAS_COLUMNS.atividade),
  orcamento: listasRange(LISTAS_COLUMNS.orcamento),
};

const SIDE_BY_SIDE =
  'Esta lista aparece nas listas suspensas dos outros separadores.';

function toDate(iso: IsoDate): Date {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function euros(cents: number): number {
  return cents / 100;
}

function listasRange(column: string): string {
  return `Listas!$${column}$2:$${column}$${String(DERIVED_ROWS)}`;
}

function addTable(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: readonly ColumnDef[],
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name);
  columns.forEach((column, at) => {
    sheet.getColumn(at + 1).width = column.width;
  });
  const header = sheet.getRow(1);
  columns.forEach((column, at) => {
    const cell = header.getCell(at + 1);
    cell.value = column.header;
    cell.numFmt = '@';
    cell.alignment = { vertical: 'top', wrapText: true };
    applyStyle(
      cell,
      column.automatic === undefined
        ? STYLE.inputHeader
        : STYLE.automaticHeader,
    );
    if (column.automatic !== undefined) cell.note = column.automatic;
  });
  header.height = 45;
  header.commit();
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: DERIVED_ROWS, column: columns.length },
  };
  return sheet;
}

function put(
  sheet: ExcelJS.Worksheet,
  row: number,
  columns: readonly ColumnDef[],
  values: readonly ExcelJS.CellValue[],
): void {
  values.forEach((value, at) => {
    if (value === null) return;
    const cell = sheet.getCell(row, at + 1);
    cell.value = value;
    const format = columns[at]?.format;
    if (format !== undefined) cell.numFmt = format;
  });
}

const prompt = (title: string, text: string): Prompt => ({ title, text });

function restrictToList(
  sheet: ExcelJS.Worksheet,
  column: string,
  source: string,
  about: Prompt,
  error: string,
): void {
  addListValidation(sheet, {
    range: `${column}2:${column}${String(DERIVED_ROWS)}`,
    source,
    prompt: about,
    error,
  });
}

function dependentSubRubrica(
  sheet: ExcelJS.Worksheet,
  rubricaColumn: string,
  subColumn: string,
): void {
  const by = listasRange(LISTAS_COLUMNS.rubricaDaSub);
  const rubrica = `$${rubricaColumn}2`;
  const range = `${subColumn}2:${subColumn}${String(DERIVED_ROWS)}`;
  addListValidation(sheet, {
    range,
    source: `OFFSET(Listas!$${LISTAS_COLUMNS.subRubrica}$2,MATCH(${rubrica},${by},0)-1,0,COUNTIF(${by},${rubrica}),1)`,
    prompt: prompt(
      'Sub-rubrica',
      'A lista mostra só as sub-rubricas da rubrica escolhida. Escolha primeiro a rubrica. Pode deixar em branco.',
    ),
    error:
      'Esta sub-rubrica não pertence à rubrica escolhida. Confirme a rubrica e a sub-rubrica.',
    stop: false,
  });
  sheet.addConditionalFormatting({
    ref: range,
    rules: [
      {
        type: 'expression',
        priority: 1,
        formulae: [
          `AND($${subColumn}2<>"",COUNTIFS(${listasRange(LISTAS_COLUMNS.subRubrica)},$${subColumn}2,${by},${rubrica})=0)`,
        ],
        style: {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            bgColor: { argb: 'FFFFC7CE' },
          },
          font: { color: { argb: 'FF9C0006' } },
        },
      },
    ],
  });
}

function writeInstrucoes(
  workbook: ExcelJS.Workbook,
  instrucoes: readonly InstrucaoSpec[],
): void {
  const sheet = workbook.addWorksheet('Instruções');
  const widths = [14, 38, 22, 28, 10, 12, 16];
  widths.forEach((width, at) => {
    sheet.getColumn(at + 1).width = width;
  });
  const lineChars = widths.reduce((sum, width) => sum + width, 0) - 12;
  let row = 1;

  for (const { titulo, paragrafos, tabela } of instrucoes) {
    const heading = sheet.getCell(row, 1);
    heading.value = titulo;
    heading.font = { bold: true, size: row === 1 ? 16 : 13 };
    row += 1;
    for (const paragrafo of paragrafos) {
      const cell = sheet.getCell(row, 1);
      cell.value = paragrafo;
      cell.alignment = { wrapText: true, vertical: 'top' };
      sheet.mergeCells(row, 1, row, widths.length);
      sheet.getRow(row).height = 16 * Math.ceil(paragrafo.length / lineChars);
      row += 1;
    }
    for (const [at, line] of (tabela ?? []).entries()) {
      line.forEach((text, column) => {
        const cell = sheet.getCell(row, column + 1);
        cell.value = text;
        cell.alignment = { vertical: 'top', wrapText: true };
        applyStyle(cell, at === 0 ? STYLE.header : STYLE.input);
      });
      sheet.getRow(row).height = 32;
      row += 1;
    }
    row += 1;
  }
}

function writeMovimentos(
  workbook: ExcelJS.Workbook,
  spec: WorkbookSpec,
  derivedRows: number,
): void {
  const sheet = addTable(workbook, 'Movimentos', MOVIMENTOS);
  const contaDoMeio = new Map(spec.listas.meios.map((m) => [m.meio, m.conta]));
  const resultado = new Map(
    spec.listas.rubricas.map((r) => [r.rubrica, r.contaResultado]),
  );

  const lastRow = Math.max(derivedRows, spec.movimentos.length + 1);
  for (let row = 2; row <= lastRow; row++) {
    const movimento = spec.movimentos[row - 2];
    const sign = movimento?.tipo === 'Saída' ? -1 : 1;
    const conta = (movimento?.meio && contaDoMeio.get(movimento.meio)) ?? '';
    const rubricaResultado =
      movimento && resultado.get(movimento.rubrica) !== undefined
        ? resultado.get(movimento.rubrica)
          ? 'Sim'
          : 'Não'
        : '';

    if (movimento) {
      put(sheet, row, MOVIMENTOS, [
        toDate(movimento.data),
        movimento.doc,
        movimento.descricao,
        movimento.atividade,
        movimento.rubrica,
        movimento.subRubrica,
        movimento.tipo,
        movimento.meio,
        euros(movimento.valorCents),
      ]);
    }
    const r = String(row);
    const typed = movimento?.typedOver;
    const automatic = (column: number, value: ExcelJS.CellValue) => {
      const cell = sheet.getCell(row, column);
      cell.value = value;
      applyStyle(cell, STYLE.automatic);
      const format = MOVIMENTOS[column - 1]?.format;
      if (format !== undefined) cell.numFmt = format;
    };
    automatic(
      10,
      typed?.conta ?? {
        formula: `IF(H${r}="","",IFERROR(VLOOKUP(H${r},Listas!$J$2:$K$${String(DERIVED_ROWS)},2,FALSE),""))`,
        result: conta,
      },
    );
    automatic(
      11,
      typed?.signedCents === undefined
        ? {
            formula: `IF(OR(I${r}="",G${r}=""),"",IF(G${r}="Saída",-I${r},I${r}))`,
            result: movimento ? sign * euros(movimento.valorCents) : '',
          }
        : euros(typed.signedCents),
    );
    automatic(
      12,
      typed?.contaResultado ?? {
        formula: `IF(E${r}="","",IFERROR(VLOOKUP(E${r},Listas!$A$2:$C$${String(DERIVED_ROWS)},3,FALSE),""))`,
        result: rubricaResultado,
      },
    );
  }

  restrictToList(
    sheet,
    'D',
    LISTAS_RANGES.atividade,
    prompt('Atividade', 'Escolha a atividade na lista.'),
    'Escolha uma atividade da lista (separador Listas).',
  );
  restrictToList(
    sheet,
    'E',
    listasRange(LISTAS_COLUMNS.rubrica),
    prompt('Rubrica', 'Escolha a rubrica na lista.'),
    'Escolha uma rubrica da lista (separador Listas).',
  );
  dependentSubRubrica(sheet, 'E', 'F');
  restrictToList(
    sheet,
    'G',
    literalList('Entrada', 'Saída'),
    prompt('Tipo', 'Entrada: o dinheiro entrou. Saída: o dinheiro saiu.'),
    'Escolha Entrada ou Saída.',
  );
  restrictToList(
    sheet,
    'H',
    listasRange(LISTAS_COLUMNS.meio),
    prompt('Meio', 'Escolha como o dinheiro entrou ou saiu.'),
    'Escolha um meio da lista (separador Listas).',
  );
  addPromptOnly(
    sheet,
    `J2:L${String(DERIVED_ROWS)}`,
    prompt('Calculado sozinho', 'Não escreva nesta coluna.'),
  );
}

function writePendentes(workbook: ExcelJS.Workbook, spec: WorkbookSpec): void {
  const sheet = addTable(workbook, 'Pendentes', PENDENTES);
  spec.pendentes.forEach((p, at) => {
    put(sheet, at + 2, PENDENTES, [
      p.tipo,
      p.entidade,
      p.descricao,
      p.atividade,
      euros(p.valorCents),
      toDate(p.dataRegisto),
      p.dataLiquidacao === null ? null : toDate(p.dataLiquidacao),
      p.notas,
    ]);
  });
  restrictToList(
    sheet,
    'A',
    literalList('A receber', 'A pagar'),
    prompt('Tipo', 'A receber: alguém nos deve. A pagar: nós devemos.'),
    'Escolha A receber ou A pagar.',
  );
  restrictToList(
    sheet,
    'D',
    LISTAS_RANGES.atividade,
    prompt('Atividade', 'Escolha a atividade na lista.'),
    'Escolha uma atividade da lista (separador Listas).',
  );
}

function writeOrcamento(workbook: ExcelJS.Workbook, spec: WorkbookSpec): void {
  const sheet = addTable(workbook, 'Orçamento', ORCAMENTO);
  spec.orcamento.forEach((o, at) => {
    put(sheet, at + 2, ORCAMENTO, [
      o.ambito,
      o.tipo,
      o.rubrica,
      o.subRubrica,
      euros(o.orcadoCents),
    ]);
  });
  restrictToList(
    sheet,
    'A',
    LISTAS_RANGES.orcamento,
    prompt(
      'Âmbito',
      'Escolha um orçamento da lista. Para criar um novo, acrescente o nome na coluna Orçamento do separador Listas.',
    ),
    'Escolha um orçamento da lista (separador Listas).',
  );
  restrictToList(
    sheet,
    'B',
    literalList('Entrada', 'Saída'),
    prompt('Tipo', 'Entrada: receita orçada. Saída: despesa orçada.'),
    'Escolha Entrada ou Saída.',
  );
  restrictToList(
    sheet,
    'C',
    listasRange(LISTAS_COLUMNS.rubrica),
    prompt('Rubrica', 'Escolha a rubrica na lista.'),
    'Escolha uma rubrica da lista (separador Listas).',
  );
  dependentSubRubrica(sheet, 'C', 'D');
}

function writeGeneros(workbook: ExcelJS.Workbook, spec: WorkbookSpec): void {
  const sheet = addTable(workbook, 'Géneros', GENEROS);
  spec.generos.forEach((g, at) => {
    put(sheet, at + 2, GENEROS, [
      g.data === null ? null : toDate(g.data),
      g.atividade,
      g.tipo,
      g.quantidade,
      g.emFalta,
      g.valorEstimadoCents === null ? null : euros(g.valorEstimadoCents),
    ]);
  });
  restrictToList(
    sheet,
    'B',
    LISTAS_RANGES.atividade,
    prompt('Atividade', 'Escolha a atividade na lista.'),
    'Escolha uma atividade da lista (separador Listas).',
  );
}

function writeSaldos(workbook: ExcelJS.Workbook, spec: WorkbookSpec): void {
  const sheet = addTable(workbook, 'Saldos', SALDOS);
  spec.saldos.forEach((s, at) => {
    put(sheet, at + 2, SALDOS, [
      toDate(s.data),
      s.conta,
      euros(s.saldoCents),
      s.fonte,
    ]);
  });
  restrictToList(
    sheet,
    'B',
    literalList('Caixa', 'Banco'),
    prompt('Conta', 'Caixa: dinheiro em numerário. Banco: conta bancária.'),
    'Escolha Caixa ou Banco.',
  );
  restrictToList(
    sheet,
    'D',
    literalList('Extrato', 'Contagem', 'Declarado'),
    prompt(
      'Fonte',
      'Extrato: do extrato bancário. Contagem: da contagem do dinheiro. Declarado: indicado sem comprovativo.',
    ),
    'Escolha Extrato, Contagem ou Declarado.',
  );
}

function assertGroupedByRubrica(listas: ListasSpec): void {
  const seen = new Set<string>();
  let current: string | undefined;
  for (const { rubrica, subRubrica } of listas.subRubricas) {
    if (rubrica !== current && seen.has(rubrica)) {
      throw new Error(
        `Sub-rubrica "${subRubrica}" separates the sub-rubricas of "${rubrica}"; keep them together`,
      );
    }
    seen.add(rubrica);
    current = rubrica;
  }
}

const LISTAS_BLOCKS: readonly (readonly [
  position: number,
  header: string,
  width: number,
  note: string,
])[] = [
  [
    1,
    'Rubrica',
    30,
    `Categorias dos movimentos. ${SIDE_BY_SIDE} Acrescente as suas no fim da coluna.`,
  ],
  [2, 'Tipo', 18, 'Entrada (receita) ou Saída (despesa) desta rubrica.'],
  [
    3,
    'Conta como receita ou despesa',
    18,
    'Sim: o movimento é receita ou despesa. Não: só muda o dinheiro disponível (por exemplo, transferências entre caixa e banco).',
  ],
  [
    5,
    'Sub-rubrica',
    26,
    'Divisões de uma rubrica. Mantenha as sub-rubricas da mesma rubrica juntas.',
  ],
  [6, 'Rubrica', 30, 'A rubrica a que cada sub-rubrica pertence.'],
  [
    8,
    'Atividade',
    26,
    `Eventos e outras atividades. Use uma atividade por edição de um evento. ${SIDE_BY_SIDE}`,
  ],
  [10, 'Meio', 14, 'Como o dinheiro entrou ou saiu.'],
  [11, 'Conta', 10, 'Caixa ou Banco: onde fica o dinheiro deste meio.'],
  [
    13,
    'Orçamento',
    26,
    'Nomes dos orçamentos (o nome de uma atividade ou um ano). Acrescente aqui cada orçamento que usar no separador Orçamento.',
  ],
];

function tipoDaRubrica(rubrica: ListasSpec['rubricas'][number]): string {
  if (rubrica.tipo !== null) return rubrica.tipo;
  return rubrica.contaResultado ? '' : 'Entrada e Saída';
}

function writeListas(workbook: ExcelJS.Workbook, { listas }: WorkbookSpec) {
  assertGroupedByRubrica(listas);
  const sheet = workbook.addWorksheet('Listas');
  for (const [position, header, width, note] of LISTAS_BLOCKS) {
    sheet.getColumn(position).width = width;
    const cell = sheet.getCell(1, position);
    cell.value = header;
    cell.note = note;
    applyStyle(cell, STYLE.inputHeader);
  }
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  listas.rubricas.forEach((r, at) => {
    put(
      sheet,
      at + 2,
      [],
      [r.rubrica, tipoDaRubrica(r), r.contaResultado ? 'Sim' : 'Não'],
    );
  });
  listas.subRubricas.forEach((s, at) => {
    sheet.getCell(at + 2, 5).value = s.subRubrica;
    sheet.getCell(at + 2, 6).value = s.rubrica;
  });
  listas.atividades.forEach((atividade, at) => {
    sheet.getCell(at + 2, 8).value = atividade;
  });
  listas.meios.forEach((m, at) => {
    sheet.getCell(at + 2, 10).value = m.meio;
    sheet.getCell(at + 2, 11).value = m.conta;
  });
  listas.orcamentos.forEach((orcamento, at) => {
    sheet.getCell(at + 2, 13).value = orcamento;
  });
}

function assertCellTextFits(workbook: ExcelJS.Workbook): void {
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (
          typeof cell.value === 'string' &&
          cell.value.length > MAX_CELL_TEXT
        ) {
          throw new Error(
            `${sheet.name}!${cell.address} holds ${String(cell.value.length)} characters; a spreadsheet cell takes at most ${String(MAX_CELL_TEXT)}`,
          );
        }
      });
    });
  });
}

export async function loadProjectConfig(): Promise<Config> {
  return loadConfig(JSON.parse(await readFile(CONFIG_PATH, 'utf8')));
}

export function newWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TUNADÃO 1998';
  workbook.created = FIXED_TIMESTAMP;
  workbook.modified = FIXED_TIMESTAMP;
  workbook.calcProperties.fullCalcOnLoad = true;
  return workbook;
}

export async function writeWorkbook(
  spec: WorkbookSpec,
  derivedRows: number = DERIVED_ROWS,
): Promise<Uint8Array> {
  const config = await loadProjectConfig();
  const workbook = newWorkbook();

  writeInstrucoes(workbook, spec.instrucoes);
  writeListas(workbook, spec);
  writeSaldos(workbook, spec);
  writeMovimentos(workbook, spec, derivedRows);
  writePendentes(workbook, spec);
  writeOrcamento(workbook, spec);
  writeGeneros(workbook, spec);
  for (const reportSheet of spec.reportSheets) {
    writeReportSheet(workbook, reportSheet, {
      config,
      lists: LISTAS_RANGES,
    });
  }

  assertCellTextFits(workbook);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
