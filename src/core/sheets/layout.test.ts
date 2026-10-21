import { describe, expect, it } from 'vitest';
import {
  config,
  gridOf,
  layoutRows,
} from '../../../tests/support/report-sheet.ts';
import { DENOMINATIONS_CENTS } from '../calc/index.ts';
import { REPORT_SPECS, REPORT_TIPOS } from './catalogue.ts';
import { buildLayout } from './layout.ts';
import { readReportSheet } from './read-sheet.ts';

describe.each(REPORT_TIPOS)('%s starter layout', (tipo) => {
  const layout = buildLayout(tipo, config);

  it('starts with the type marker and the layout version', () => {
    expect(layout.rows[0]?.cells.map((cell) => cell.text)).toEqual([
      'Relatório',
      REPORT_SPECS[tipo].label,
    ]);
    expect(layout.typeCell).toBe('B1');
    expect(layout.valueCells.versao).toBe('B2');
  });

  it('numbers its rows consecutively from 1', () => {
    expect(layout.rows.map(({ row }) => row)).toEqual(
      layout.rows.map((_, index) => index + 1),
    );
  });

  it('puts every catalogue field on the value cell the reader reads it from', () => {
    const rows = layoutRows(tipo);
    for (const field of REPORT_SPECS[tipo].fields) {
      const address = layout.valueCells[field.key];
      expect(address).toBeDefined();
      const index = Number(address?.slice(1)) - 1;
      expect(rows[index]?.[0]).toBe(field.label);
    }
  });

  it('prints the signature cargos of the configuration', () => {
    const rows = layoutRows(tipo);
    const start = rows.findIndex((row) => row[0] === 'Assinaturas');

    expect(rows.slice(start + 2).map((row) => row[0])).toEqual(
      config.signatures[tipo],
    );
  });

  it('reads back as an untouched sheet with no issue', () => {
    const draft = readReportSheet(gridOf(layoutRows(tipo)), { config });

    expect(draft.tipo).toBe(tipo);
    expect(draft.issues).toEqual([]);
    expect(draft.porPreencher).toBe(true);
  });
});

describe('pegada starter layout', () => {
  const rows = layoutRows('pegada');

  it('pre-prints the fifteen denominations, largest first, with a total formula', () => {
    const start = rows.findIndex((row) => row[0] === 'Contagem de caixa') + 2;
    const printed = rows.slice(start, start + DENOMINATIONS_CENTS.length);

    expect(printed.map((row) => row[0])).toEqual(
      DENOMINATIONS_CENTS.map((cents) => cents / 100),
    );
    expect(printed[0]?.[2]).toEqual({
      f: `A${String(start + 1)}*B${String(start + 1)}`,
    });
  });

  it('leaves five empty rows in each uncleared items block', () => {
    const title = rows.findIndex(
      (row) => row[0] === 'Pagamentos emitidos ainda não debitados no extrato',
    );

    expect(
      rows
        .slice(title + 2, title + 7)
        .every((row) => row.every((c) => c === null)),
    ).toBe(true);
    expect(rows[title + 7]).toEqual([null, null, null]);
  });
});
