import ExcelJS from 'exceljs';
import type { ListasSpec } from '../../fixtures/src/listas.ts';
import type {
  Checkpoint,
  Direcao,
  IsoDate,
  Pendente,
} from '../../src/core/dataset/types.ts';

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
}

export interface WorkbookSpec {
  readonly listas: ListasSpec;
  readonly movimentos: readonly MovimentoSpec[];
  readonly pendentes: readonly PendenteSpec[];
  readonly orcamento: readonly OrcamentoSpec[];
  readonly generos: readonly GeneroSpec[];
  readonly saldos: readonly SaldoSpec[];
  readonly instrucoes: readonly InstrucaoSpec[];
}

interface ColumnDef {
  readonly header: string;
  readonly width: number;
  readonly format?: string;
}

const DATE_FORMAT = 'dd/mm/yyyy';
const MONEY_FORMAT = '#,##0.00 "€"';
const LAST_ROW = 1048576;
export const DERIVED_ROWS = 5000;
const FIXED_TIMESTAMP = new Date(Date.UTC(2026, 0, 1));

const date = { width: 13, format: DATE_FORMAT };
const money = { width: 16, format: MONEY_FORMAT };

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
  { header: 'Conta', width: 10 },
  { header: 'Valor com sinal (€)', ...money },
  { header: 'Conta para o resultado', width: 14 },
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
  atividade: 'H',
  meio: 'J',
} as const;

function toDate(iso: IsoDate): Date {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function euros(cents: number): number {
  return cents / 100;
}

function columnLetter(position: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + position - 1);
}

function addTable(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: readonly ColumnDef[],
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name);
  columns.forEach((column, at) => {
    const target = sheet.getColumn(at + 1);
    target.width = column.width;
    if (column.format !== undefined) target.numFmt = column.format;
  });
  const header = sheet.getRow(1);
  columns.forEach((column, at) => {
    const cell = header.getCell(at + 1);
    cell.value = column.header;
    cell.numFmt = '@';
  });
  header.font = { bold: true };
  header.commit();
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return sheet;
}

function put(
  sheet: ExcelJS.Worksheet,
  row: number,
  values: readonly ExcelJS.CellValue[],
): void {
  values.forEach((value, at) => {
    if (value !== null) sheet.getCell(row, at + 1).value = value;
  });
}

interface ValidatedSheet {
  readonly dataValidations: {
    add(range: string, validation: ExcelJS.DataValidation): void;
  };
}

function restrictToList(
  sheet: ExcelJS.Worksheet,
  position: number,
  source: string,
): void {
  const letter = columnLetter(position);
  // exceljs implements dataValidations at runtime but omits it from its typings
  (sheet as unknown as ValidatedSheet).dataValidations.add(
    `${letter}2:${letter}${String(LAST_ROW)}`,
    {
      type: 'list',
      allowBlank: true,
      formulae: [source],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Valor inválido',
      error: 'Escolha um dos valores da lista.',
    },
  );
}

function listasRange(column: string): string {
  return `Listas!$${column}$2:$${column}$${String(LAST_ROW)}`;
}

function literalList(...values: string[]): string {
  return `"${values.join(',')}"`;
}

function writeInstrucoes(
  workbook: ExcelJS.Workbook,
  instrucoes: readonly InstrucaoSpec[],
): void {
  const sheet = workbook.addWorksheet('Instruções');
  sheet.getColumn(1).width = 110;
  let row = 1;
  for (const { titulo, paragrafos } of instrucoes) {
    const heading = sheet.getCell(row, 1);
    heading.value = titulo;
    heading.font = { bold: true, size: row === 1 ? 16 : 12 };
    row += 1;
    for (const paragrafo of paragrafos) {
      const cell = sheet.getCell(row, 1);
      cell.value = paragrafo;
      cell.alignment = { wrapText: true, vertical: 'top' };
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
      put(sheet, row, [
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
    sheet.getCell(row, 10).value = typed?.conta ?? {
      formula: `IF(H${r}="","",IFERROR(VLOOKUP(H${r},Listas!$J$2:$K$${String(LAST_ROW)},2,FALSE),""))`,
      result: conta,
    };
    sheet.getCell(row, 11).value =
      typed?.signedCents === undefined
        ? {
            formula: `IF(OR(I${r}="",G${r}=""),"",IF(G${r}="Saída",-I${r},I${r}))`,
            result: movimento ? sign * euros(movimento.valorCents) : '',
          }
        : euros(typed.signedCents);
    sheet.getCell(row, 12).value = typed?.contaResultado ?? {
      formula: `IF(E${r}="","",IFERROR(VLOOKUP(E${r},Listas!$A$2:$C$${String(LAST_ROW)},3,FALSE),""))`,
      result: rubricaResultado,
    };
  }

  restrictToList(sheet, 4, listasRange(LISTAS_COLUMNS.atividade));
  restrictToList(sheet, 5, listasRange(LISTAS_COLUMNS.rubrica));
  restrictToList(sheet, 6, listasRange(LISTAS_COLUMNS.subRubrica));
  restrictToList(sheet, 7, literalList('Entrada', 'Saída'));
  restrictToList(sheet, 8, listasRange(LISTAS_COLUMNS.meio));
}

function writePendentes(workbook: ExcelJS.Workbook, spec: WorkbookSpec): void {
  const sheet = addTable(workbook, 'Pendentes', PENDENTES);
  spec.pendentes.forEach((p, at) => {
    put(sheet, at + 2, [
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
  restrictToList(sheet, 1, literalList('A receber', 'A pagar'));
  restrictToList(sheet, 4, listasRange(LISTAS_COLUMNS.atividade));
}

function writeOrcamento(workbook: ExcelJS.Workbook, spec: WorkbookSpec): void {
  const sheet = addTable(workbook, 'Orçamento', ORCAMENTO);
  spec.orcamento.forEach((o, at) => {
    put(sheet, at + 2, [
      o.ambito,
      o.tipo,
      o.rubrica,
      o.subRubrica,
      euros(o.orcadoCents),
    ]);
  });
  restrictToList(sheet, 2, literalList('Entrada', 'Saída'));
  restrictToList(sheet, 3, listasRange(LISTAS_COLUMNS.rubrica));
  restrictToList(sheet, 4, listasRange(LISTAS_COLUMNS.subRubrica));
}

function writeGeneros(workbook: ExcelJS.Workbook, spec: WorkbookSpec): void {
  const sheet = addTable(workbook, 'Géneros', GENEROS);
  spec.generos.forEach((g, at) => {
    put(sheet, at + 2, [
      g.data === null ? null : toDate(g.data),
      g.atividade,
      g.tipo,
      g.quantidade,
      g.emFalta,
      g.valorEstimadoCents === null ? null : euros(g.valorEstimadoCents),
    ]);
  });
  restrictToList(sheet, 2, listasRange(LISTAS_COLUMNS.atividade));
}

function writeSaldos(workbook: ExcelJS.Workbook, spec: WorkbookSpec): void {
  const sheet = addTable(workbook, 'Saldos', SALDOS);
  spec.saldos.forEach((s, at) => {
    put(sheet, at + 2, [toDate(s.data), s.conta, euros(s.saldoCents), s.fonte]);
  });
  restrictToList(sheet, 2, literalList('Caixa', 'Banco'));
  restrictToList(sheet, 4, literalList('Extrato', 'Contagem', 'Declarado'));
}

function writeListas(workbook: ExcelJS.Workbook, { listas }: WorkbookSpec) {
  const sheet = workbook.addWorksheet('Listas');
  const blocks: readonly (readonly [number, string, number])[] = [
    [1, 'Rubrica', 30],
    [2, 'Tipo', 10],
    [3, 'Conta para o resultado', 14],
    [5, 'Sub-rubrica', 26],
    [6, 'Rubrica', 30],
    [8, 'Atividade', 22],
    [10, 'Meio', 14],
    [11, 'Conta', 10],
  ];
  for (const [position, header, width] of blocks) {
    sheet.getColumn(position).width = width;
    sheet.getCell(1, position).value = header;
  }
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  listas.rubricas.forEach((r, at) => {
    put(sheet, at + 2, [r.rubrica, r.tipo, r.contaResultado ? 'Sim' : 'Não']);
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
}

export async function writeWorkbook(
  spec: WorkbookSpec,
  derivedRows: number = DERIVED_ROWS,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TUNADÃO 1998';
  workbook.created = FIXED_TIMESTAMP;
  workbook.modified = FIXED_TIMESTAMP;

  writeInstrucoes(workbook, spec.instrucoes);
  writeMovimentos(workbook, spec, derivedRows);
  writePendentes(workbook, spec);
  writeOrcamento(workbook, spec);
  writeGeneros(workbook, spec);
  writeSaldos(workbook, spec);
  writeListas(workbook, spec);

  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
