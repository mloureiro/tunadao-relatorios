import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { readXlsx } from '../../src/core/input/xlsx.ts';
import { readReportSheet } from '../../src/core/sheets/read-sheet.ts';
import { config } from '../support/report-sheet.ts';

const PLAIN_CELL = '<c r="B2"><v>2025</v></c>';

async function fiscalFile(cellXml: string): Promise<Uint8Array> {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Relatório', 'Fim de ano fiscal'],
      ['Ano', 2025],
      ['Anexo de movimentos', 'Sim'],
    ]),
    'Fiscal',
  );
  const zip = await JSZip.loadAsync(
    XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer,
  );
  const path = 'xl/worksheets/sheet1.xml';
  const xml = (await zip.file(path)?.async('string')) ?? '';
  expect(xml).toContain(PLAIN_CELL);
  zip.file(path, xml.replace(PLAIN_CELL, cellXml));
  return zip.generateAsync({ type: 'uint8array' });
}

function draftFrom(bytes: Uint8Array) {
  const { reportSheets } = readXlsx('a.xlsx', bytes);
  const [grid] = reportSheets;
  if (grid === undefined) throw new Error('No report sheet');
  return readReportSheet(grid, { config });
}

describe('a formula in an input cell, read from real file bytes', () => {
  it.each([
    ['no cached value', '<c r="B2"><f>A9+1</f></c>'],
    ['an empty cached value', '<c r="B2"><f>A9+1</f><v></v></c>'],
    ['a string result with no value', '<c r="B2" t="str"><f>A9+1</f></c>'],
    ['an error result with no value', '<c r="B2" t="e"><f>A9+1</f></c>'],
  ])('refuses a formula with %s', async (_name, cell) => {
    const draft = draftFrom(await fiscalFile(cell));

    expect(draft.fields.find((f) => f.key === 'ano')).toMatchObject({
      value: null,
    });
    expect(draft.issues).toMatchObject([
      { code: 'formula-no-value', severity: 'error', cell: 'B2', field: 'Ano' },
    ]);
  });

  it('uses a cached value and warns', async () => {
    const draft = draftFrom(
      await fiscalFile('<c r="B2"><f>A9+1</f><v>2025</v></c>'),
    );

    expect(draft.fields.find((f) => f.key === 'ano')).toMatchObject({
      value: 2025,
    });
    expect(draft.issues).toMatchObject([
      { code: 'formula-input', severity: 'warning', cell: 'B2' },
    ]);
  });

  it('still reads a plain cell without a warning', async () => {
    expect(draftFrom(await fiscalFile(PLAIN_CELL)).issues).toEqual([]);
  });
});
