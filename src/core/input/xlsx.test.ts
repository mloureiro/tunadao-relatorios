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
    const tables = readXlsx('modelo.xlsx', bytes);

    expect(tables.map((table) => table.tab)).toEqual(['Orçamento', 'Géneros']);
    expect(tables.every((table) => table.source === 'modelo.xlsx')).toBe(true);
  });

  it('keeps cells raw: numbers stay numbers, blanks become null, rows keep their sheet position', () => {
    const [orcamento] = readXlsx('modelo.xlsx', bytes);

    expect(orcamento?.header).toEqual(['Âmbito', 'Orçado (€)']);
    expect(orcamento?.firstDataRow).toBe(2);
    expect(orcamento?.rows).toEqual([
      ['2026', 1234.5],
      [null, null],
      ['2027', '1.000,00 €'],
    ]);
  });

  it('returns a table with an empty header for a known tab with no cells', () => {
    const [table] = readXlsx('vazio.xlsx', buildWorkbook({ Movimentos: [] }));

    expect(table).toMatchObject({ tab: 'Movimentos', header: [], rows: [] });
  });

  it.each([
    [false, false],
    [true, true],
  ])('reads the date system flag (1904: %s)', (date1904, expected) => {
    const [table] = readXlsx(
      'datas.xlsx',
      buildWorkbook({ Saldos: [['Data'], [45930]] }, { date1904 }),
    );

    expect(table?.date1904).toBe(expected);
  });
});
