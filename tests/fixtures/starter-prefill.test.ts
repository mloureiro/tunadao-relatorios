import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';
import * as XLSX from 'xlsx';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/core/config/schema.ts';
import { readXlsx } from '../../src/core/input/xlsx.ts';
import { readReportSheet } from '../../src/core/sheets/read-sheet.ts';
import { prefillStarter } from '../../src/core/starter/prefill.ts';

const SHEET = 'xl/worksheets/sheet1.xml';

function valueAt(bytes: Uint8Array, address: string): unknown {
  const workbook = XLSX.read(bytes, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ''];
  return (sheet?.[address] as XLSX.CellObject | undefined)?.v;
}
const PATCHED = ['B4', 'B6'] as const;

let starter: Uint8Array;
const config = loadConfig(
  JSON.parse(await readFile('config/config.json', 'utf8')),
);

beforeAll(async () => {
  starter = new Uint8Array(await readFile('public/folhas/folha-pegada.xlsx'));
});

const values = {
  dataUltimoRelatorio: '2026-09-30',
  direcaoCessante: 'Direção 2026/27',
};

function cellElement(xml: string, address: string): string {
  const match = new RegExp(`<c r="${address}"[^>]*?(?:/>|>.*?</c>)`).exec(xml);
  if (match === null) throw new Error(`No cell ${address}`);
  return match[0];
}

describe('prefillStarter()', () => {
  it('writes the values at the layout addresses, read back by a spreadsheet reader', () => {
    const filled = prefillStarter(starter, 'pegada', values);

    expect(valueAt(filled, 'B4')).toBe(46295);
    expect(valueAt(filled, 'B6')).toBe('Direção 2026/27');
    expect(valueAt(filled, 'A4')).toBe('Data do último relatório');
  });

  it('reads back through the report-sheet reader as the pre-filled values and nothing else', () => {
    const filled = prefillStarter(starter, 'pegada', values);

    const [grid] = readXlsx('a.xlsx', filled).reportSheets;
    if (grid === undefined) throw new Error('No report sheet');
    const draft = readReportSheet(grid, { config });

    expect(draft.issues).toEqual([]);
    expect(draft.porPreencher).toBe(false);
    expect(
      draft.fields.filter((f) => f.value !== null).map((f) => [f.key, f.value]),
    ).toEqual([
      ['dataUltimoRelatorio', '2026-09-30'],
      ['direcaoCessante', 'Direção 2026/27'],
    ]);
  });

  it('changes only the patched cells: every other byte of the sheet and every other part is untouched', () => {
    const before = unzipSync(starter);
    const after = unzipSync(prefillStarter(starter, 'pegada', values));
    const beforeXml = strFromU8(before[SHEET] ?? new Uint8Array());
    const afterXml = strFromU8(after[SHEET] ?? new Uint8Array());

    const restored = PATCHED.reduce(
      (xml, address) =>
        xml.replace(cellElement(xml, address), cellElement(beforeXml, address)),
      afterXml,
    );

    expect(restored).toBe(beforeXml);
    expect(afterXml).not.toBe(beforeXml);
    expect(Object.keys(after)).toEqual(Object.keys(before));
    for (const name of Object.keys(before)) {
      if (name !== SHEET) expect(after[name], name).toEqual(before[name]);
    }
    for (const address of PATCHED) {
      expect(cellElement(afterXml, address)).toContain(
        / s="\d+"/.exec(cellElement(beforeXml, address))?.[0] ?? 'no style',
      );
    }
  });

  it('escapes the characters XML reserves', () => {
    const filled = prefillStarter(starter, 'pegada', {
      direcaoCessante: 'A & B <"direção">',
    });

    expect(valueAt(filled, 'B6')).toBe('A & B <"direção">');
  });

  it('drops characters XML 1.0 cannot carry and keeps tabs, new lines and accents', () => {
    const filled = prefillStarter(starter, 'pegada', {
      direcaoCessante: 'Ana\u0001 \u000bSilva\u0000\tJosé\nCosta\uFFFE\uD800',
    });

    expect(valueAt(filled, 'B6')).toBe('Ana Silva\tJosé\nCosta');
  });

  it('refuses a field the starter does not have', () => {
    expect(() =>
      prefillStarter(starter, 'pegada', { inicio: '2026-01-01' }),
    ).toThrow(/Unknown pegada field/);
  });
});
