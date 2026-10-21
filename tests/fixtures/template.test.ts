import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  DERIVED_ROWS,
  writeWorkbook,
} from '../../scripts/lib/workbook-writer.ts';
import { MODEL_SHEETS, TEMPLATE_SPEC } from '../../scripts/template-spec.ts';
import { REPORT_TIPOS } from '../../src/core/sheets/catalogue.ts';
import { buildLayout } from '../../src/core/sheets/layout.ts';
import { loadWorkbook } from '../../src/core/workbook.ts';
import { CTX } from '../support/report-workbook.ts';
import { sheetXml } from '../support/xlsx-parts.ts';
import { zipEntries } from '../support/zip-entries.ts';

const COMMITTED = fileURLToPath(
  new URL('../../public/modelo-tesouraria.xlsx', import.meta.url),
);

const TAB_ORDER = [
  'Instruções',
  'Listas',
  'Saldos',
  'Movimentos',
  'Pendentes',
  'Orçamento',
  'Géneros',
  'Modelo Pegada',
  'Modelo Evento',
  'Modelo Letivo',
  'Modelo Fiscal',
];

async function committedBytes(): Promise<Uint8Array> {
  return new Uint8Array(await readFile(COMMITTED));
}

async function committedWorkbook(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(COMMITTED);
  return workbook;
}

function validationRanges(xml: string): string[] {
  return [...xml.matchAll(/<dataValidation [^>]*sqref="([^"]+)"/g)].map(
    ([, range]) => range ?? '',
  );
}

describe('modelo-tesouraria.xlsx', () => {
  it('loads with no errors, no data rows and four untouched report sheets', async () => {
    const result = await loadWorkbook(
      { name: 'modelo-tesouraria.xlsx', bytes: await committedBytes() },
      CTX,
    );
    const { dataset } = result.load;

    expect(result.load.issues).toEqual([]);
    expect(result.load.unresolved).toEqual([]);
    expect(dataset.movimentos).toHaveLength(0);
    expect(dataset.saldos).toHaveLength(0);
    expect(dataset.lists.rubricas).toHaveLength(
      TEMPLATE_SPEC.listas.rubricas.length,
    );
    expect(dataset.lists.orcamentos).toEqual([]);
    expect(result.reports.map(({ tipo, status }) => [tipo, status])).toEqual(
      REPORT_TIPOS.map((tipo) => [tipo, 'por-preencher']),
    );
  });

  it('is byte-for-byte the workbook the build script generates from the spec', async () => {
    const rebuilt = await zipEntries(await writeWorkbook(TEMPLATE_SPEC));
    const committed = await zipEntries(await committedBytes());

    expect(rebuilt).toEqual(committed);
  });

  it('orders the tabs as the work is done and recalculates on open', async () => {
    const workbook = await committedWorkbook();

    expect(workbook.worksheets.map(({ name }) => name)).toEqual(TAB_ORDER);
    expect(
      (await zipEntries(await committedBytes()))['xl/workbook.xml'],
    ).toContain('fullCalcOnLoad="1"');
  });

  it('heads Movimentos, Listas and Orçamento with the renamed columns', async () => {
    const workbook = await committedWorkbook();
    const headerOf = (name: string) =>
      (workbook.getWorksheet(name)?.getRow(1).values as string[]).slice(1);

    expect(headerOf('Movimentos').slice(8)).toEqual([
      'Valor (€)',
      'Conta (automático)',
      'Efeito no saldo (€) (automático)',
      'Conta como receita ou despesa (automático)',
    ]);
    expect(headerOf('Listas').filter(Boolean)).toEqual([
      'Rubrica',
      'Tipo',
      'Conta como receita ou despesa',
      'Sub-rubrica',
      'Rubrica',
      'Atividade',
      'Meio',
      'Conta',
      'Orçamento',
    ]);
  });

  it('keeps every validation inside rows 2 to 5000 and never reaches the end of the sheet', async () => {
    const bytes = await committedBytes();
    const ranges = (
      await Promise.all(
        ['Movimentos', 'Pendentes', 'Orçamento', 'Géneros', 'Saldos'].map(
          async (name) => validationRanges(await sheetXml(bytes, name)),
        ),
      )
    ).flat();

    expect(ranges.length).toBeGreaterThan(10);
    for (const range of ranges) {
      expect(range).toMatch(
        new RegExp(`^[A-Z]+2:[A-Z]+${String(DERIVED_ROWS)}$`),
      );
    }
  });

  it('derives the sub-rubrica list from the chosen rubrica and flags a pair that is not in Listas', async () => {
    const bytes = await committedBytes();
    const movimentos = await sheetXml(bytes, 'Movimentos');
    const orcamento = await sheetXml(bytes, 'Orçamento');

    expect(movimentos).toContain(
      '<formula1>OFFSET(Listas!$E$2,MATCH($E2,Listas!$F$2:$F$5000,0)-1,0,COUNTIF(Listas!$F$2:$F$5000,$E2),1)</formula1>',
    );
    expect(orcamento).toContain(
      '<formula1>OFFSET(Listas!$E$2,MATCH($C2,Listas!$F$2:$F$5000,0)-1,0,COUNTIF(Listas!$F$2:$F$5000,$C2),1)</formula1>',
    );
    expect(movimentos).toContain(
      'COUNTIFS(Listas!$E$2:$E$5000,$F2,Listas!$F$2:$F$5000,$E2)=0',
    );
    expect(orcamento).toContain(
      'COUNTIFS(Listas!$E$2:$E$5000,$D2,Listas!$F$2:$F$5000,$C2)=0',
    );
  });

  it('offers the Orçamentos list on Orçamento and on every report sheet', async () => {
    const bytes = await committedBytes();

    expect(await sheetXml(bytes, 'Orçamento')).toContain(
      '<formula1>Listas!$M$2:$M$5000</formula1>',
    );
    for (const name of ['Modelo Evento', 'Modelo Letivo', 'Modelo Fiscal']) {
      expect(await sheetXml(bytes, name), name).toContain(
        '<formula1>Listas!$M$2:$M$5000</formula1>',
      );
    }
  });

  it('computes the derived columns on every row it promises to', async () => {
    const sheet = await sheetXml(await committedBytes(), 'Movimentos');
    const derivedRows = (column: string) =>
      [
        ...sheet.matchAll(new RegExp(`<c r="${column}(\\d+)"[^>]*><f>`, 'g')),
      ].map(([, row]) => Number(row));

    for (const column of ['J', 'K', 'L']) {
      const rows = derivedRows(column);
      expect([rows[0], rows.at(-1), rows.length]).toEqual([
        2,
        DERIVED_ROWS,
        DERIVED_ROWS - 1,
      ]);
    }
  });

  it('filters the header of every data tab', async () => {
    const bytes = await committedBytes();

    for (const name of ['Movimentos', 'Pendentes', 'Orçamento', 'Géneros']) {
      expect(await sheetXml(bytes, name), name).toMatch(
        new RegExp(`<autoFilter ref="A1:[A-Z]+${String(DERIVED_ROWS)}"/>`),
      );
    }
  });

  it.each(REPORT_TIPOS)(
    'lays the %s model sheet out exactly as the starter layout, without merged cells',
    async (tipo) => {
      const workbook = await committedWorkbook();
      const name = MODEL_SHEETS.find((model) => model.tipo === tipo)?.name;
      const sheet = workbook.getWorksheet(name ?? '');
      const { rows } = buildLayout(tipo, CTX.config);

      expect(sheet).toBeDefined();
      for (const { row, cells } of rows) {
        for (const cell of cells) {
          const value = sheet?.getCell(`${cell.column}${String(row)}`).value;
          if (cell.formula !== undefined) {
            expect(value).toMatchObject({ formula: cell.formula });
          } else if (cell.text !== undefined || cell.number !== undefined) {
            expect(value).toBe(cell.text ?? cell.number);
          }
        }
      }
      expect(sheet?.model.merges ?? []).toEqual([]);
    },
  );

  it('explains the template without accountant vocabulary', async () => {
    const texts: string[] = [];
    (await committedWorkbook()).getWorksheet('Instruções')?.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === 'string') texts.push(cell.value);
      });
    });
    const instrucoes = texts.join('\n');

    expect(instrucoes).not.toMatch(/contabilístico/i);
    expect(instrucoes).toContain('Versão do modelo de tesouraria: 2');
  });
});
