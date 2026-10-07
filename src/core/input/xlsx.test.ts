import { describe, expect, it } from 'vitest';
import { buildWorkbook } from '../../../tests/support/workbook.ts';
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
});
