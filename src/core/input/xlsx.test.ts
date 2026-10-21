import { describe, expect, it } from 'vitest';
import { buildWorkbook } from '../../../tests/support/workbook.ts';
import * as XLSX from 'xlsx';
import {
  serial,
  worksheet,
  type TestRows,
} from '../../../tests/support/report-sheet.ts';
import { readXlsx } from './xlsx.ts';

describe('readXlsx()', () => {
  const bytes = buildWorkbook({
    Instruções: [['texto livre']],
    ORÇAMENTO: [
      ['Âmbito', 'Orçado (€)'],
      ['2026', 1234.5],
      [null, null],
      ['2027', '1.000,00 €'],
    ],
    'géneros ': [['Atividade']],
    Vazio: [],
  });

  it('returns one table per known tab, matched after normalising the sheet name', () => {
    const { tables, issues } = readXlsx('modelo.xlsx', bytes);

    expect(tables.map((table) => table.tab)).toEqual(['Orçamento', 'Géneros']);
    expect(tables.every((table) => table.source === 'modelo.xlsx')).toBe(true);
    expect(issues.map((issue) => issue.message)).toEqual([
      expect.stringContaining('"Vazio"'),
    ]);
  });

  it('keeps cells raw: numbers stay numbers, blanks become null, rows keep their sheet position', () => {
    const [orcamento] = readXlsx('modelo.xlsx', bytes).tables;

    expect(orcamento?.header).toEqual(['Âmbito', 'Orçado (€)']);
    expect(orcamento?.firstDataRow).toBe(2);
    expect(orcamento?.rows).toEqual([
      ['2026', 1234.5],
      [null, null],
      ['2027', '1.000,00 €'],
    ]);
  });

  it('returns a table with an empty header for a known tab with no cells', () => {
    const [table] = readXlsx(
      'vazio.xlsx',
      buildWorkbook({ Movimentos: [] }),
    ).tables;

    expect(table).toMatchObject({ tab: 'Movimentos', header: [], rows: [] });
  });

  it.each([
    [false, false],
    [true, true],
  ])('reads the date system flag (1904: %s)', (date1904, expected) => {
    const [table] = readXlsx(
      'datas.xlsx',
      buildWorkbook({ Saldos: [['Data'], [45930]] }, { date1904 }),
    ).tables;

    expect(table?.date1904).toBe(expected);
  });

  it('warns about a sheet that matches no tab and suggests the near tab', () => {
    const { tables, issues } = readXlsx(
      'a.xlsx',
      buildWorkbook({ 'Pendentes 2025': [['Tipo']], Rel_Evento: [['x']] }),
    );

    expect(tables).toEqual([]);
    expect(issues).toMatchObject([
      {
        severity: 'warning',
        code: 'ignored-sheet',
        file: 'a.xlsx',
        suggestion: 'Pendentes',
      },
      { severity: 'warning', code: 'ignored-sheet', file: 'a.xlsx' },
    ]);
    expect(issues[0]?.message).toContain('Pendentes 2025 → Pendentes?');
    expect(issues[1]).not.toHaveProperty('suggestion');
  });

  it('keeps the first of two sheets that normalise to the same tab and reports the other', () => {
    const { tables, issues } = readXlsx(
      'a.xlsx',
      buildWorkbook({
        Orçamento: [['Âmbito'], ['2026']],
        Orcamento: [['Âmbito'], ['2027']],
      }),
    );

    expect(tables.map((table) => table.rows)).toEqual([[['2026']]]);
    expect(issues).toMatchObject([
      { severity: 'error', code: 'duplicate-sheet', tab: 'Orçamento' },
    ]);
    expect(issues[0]?.message).toContain('"Orçamento" e "Orcamento"');
  });

  describe('report sheets', () => {
    function workbookBytes(
      sheets: Record<string, Parameters<typeof worksheet>[0]>,
      date1904 = false,
    ): Uint8Array {
      const workbook = XLSX.utils.book_new();
      for (const [name, rows] of Object.entries(sheets)) {
        XLSX.utils.book_append_sheet(workbook, worksheet(rows), name);
      }
      if (date1904) workbook.Workbook = { WBProps: { date1904: true } };
      return new Uint8Array(
        XLSX.write(workbook, {
          type: 'array',
          bookType: 'xlsx',
        }) as ArrayBuffer,
      );
    }

    it('returns a sheet with a type marker as a grid, with no ignored-sheet warning', () => {
      const { tables, issues, reportSheets } = readXlsx(
        'a.xlsx',
        workbookBytes({
          Orçamento: [['Âmbito'], ['2026']],
          'Pegada 2026': [['Relatório', 'Pegada de direção']],
          Instruções: [['Relatório', 'texto livre']],
        }),
      );

      expect(tables.map((table) => table.tab)).toEqual(['Orçamento']);
      expect(issues).toEqual([]);
      expect(reportSheets.map((grid) => grid.name)).toEqual(['Pegada 2026']);
    });

    it('finds the marker whatever the sheet is named, even with an unknown type', () => {
      const { reportSheets, issues } = readXlsx(
        'a.xlsx',
        workbookBytes({ Qualquer: [[null], ['Tipo de relatório', 'Outro']] }),
      );

      expect(reportSheets).toHaveLength(1);
      expect(issues).toEqual([]);
    });

    it('still ignores a sheet whose marker is below the first ten rows', () => {
      const rows: TestRows = Array.from({ length: 10 }, () => [null]);
      rows.push(['Relatório', 'Fim de ano fiscal']);
      const { reportSheets, issues } = readXlsx(
        'a.xlsx',
        workbookBytes({ Fiscal: rows }),
      );

      expect(reportSheets).toEqual([]);
      expect(issues).toMatchObject([{ code: 'ignored-sheet' }]);
    });

    it('lets a data-tab name win over a marker in the same sheet', () => {
      const { tables, reportSheets } = readXlsx(
        'a.xlsx',
        workbookBytes({ Orçamento: [['Relatório', 'Pegada de direção']] }),
      );

      expect(tables.map((table) => table.tab)).toEqual(['Orçamento']);
      expect(reportSheets).toEqual([]);
    });

    it('exposes values, formulas, cached values and the date system through the grid', () => {
      const { reportSheets } = readXlsx(
        'a.xlsx',
        workbookBytes(
          {
            Folha: [
              ['Relatório', 'Fim de ano fiscal'],
              ['Ano', { f: 'A9+1', v: 2025 }],
              ['Data', serial('2026-06-15')],
              ['Texto', null],
            ],
          },
          true,
        ),
      );
      const [grid] = reportSheets;

      expect(grid).toMatchObject({
        name: 'Folha',
        rowCount: 4,
        date1904: true,
      });
      expect(grid?.cell(0, 1)).toMatchObject({
        t: 's',
        v: 'Fim de ano fiscal',
      });
      expect(grid?.cell(1, 1)).toMatchObject({ t: 'n', v: 2025, f: 'A9+1' });
      expect(grid?.cell(2, 1)).toMatchObject({
        t: 'n',
        v: serial('2026-06-15'),
      });
      expect(grid?.cell(3, 1)).toBeUndefined();
    });
  });
});
