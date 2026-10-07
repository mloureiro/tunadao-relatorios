import { describe, expect, it } from 'vitest';
import {
  CSV_FILES,
  LISTAS,
  MOVIMENTOS_HEADER,
  XLSX_SHEETS,
  movimento,
} from '../../tests/support/sample.ts';
import { buildWorkbook, encodeCsv } from '../../tests/support/workbook.ts';
import type { Dataset } from './dataset/types.ts';
import { loadDataset } from './pipeline.ts';

const ABC_SHA256 =
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

function withoutFileNames(dataset: Dataset): unknown {
  const text = JSON.stringify({ ...dataset, sources: [] });
  return JSON.parse(text.replace(/"file":"[^"]*"/g, '"file":""')) as unknown;
}

describe('loadDataset()', () => {
  it('loads a workbook with every tab into a dataset with no issues', async () => {
    const { dataset, issues, unresolved } = await loadDataset([
      { name: 'tesouraria.xlsx', bytes: buildWorkbook(XLSX_SHEETS) },
    ]);

    expect(issues).toEqual([]);
    expect(unresolved).toEqual([]);
    expect(
      dataset.movimentos.map((m) => [m.src.row, m.conta, m.signedCents]),
    ).toEqual([
      [2, 'Caixa', 12050],
      [3, 'Banco', -123456],
    ]);
    expect(dataset.pendentes).toHaveLength(1);
    expect(dataset.orcamento).toHaveLength(1);
    expect(dataset.generos).toHaveLength(1);
    expect(dataset.saldos).toHaveLength(1);
    expect(dataset.lists.rubricas).toHaveLength(3);
    expect(dataset.lists.subRubricas).toHaveLength(3);
    expect(dataset.lists.atividades).toHaveLength(2);
    expect(dataset.lists.meios).toHaveLength(3);
  });

  it('records the SHA-256 of each file in the order given', async () => {
    const { dataset } = await loadDataset([
      { name: 'a.csv', bytes: new TextEncoder().encode('abc') },
      { name: 'b.xlsx', bytes: buildWorkbook(XLSX_SHEETS) },
    ]);

    expect(dataset.sources[0]).toEqual({ name: 'a.csv', sha256: ABC_SHA256 });
    expect(dataset.sources[1]?.name).toBe('b.xlsx');
    expect(dataset.sources[1]?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each(['utf-8-bom', 'windows-1252'] as const)(
    'reads a %s CSV set like the workbook',
    async (encoding) => {
      const fromXlsx = await loadDataset([
        { name: 'a.xlsx', bytes: buildWorkbook(XLSX_SHEETS) },
      ]);
      const fromCsv = await loadDataset(
        Object.entries(CSV_FILES).map(([name, text]) => ({
          name,
          bytes: encodeCsv(text, encoding),
        })),
      );

      expect(withoutFileNames(fromCsv.dataset)).toEqual(
        withoutFileNames(fromXlsx.dataset),
      );
    },
  );

  it('normalises columns in a different order, with an extra column, like the canonical order', async () => {
    const order = [8, 0, 3, 2, 4, 6, 7, 5, 1];
    const pick = (row: readonly (string | number | boolean | null)[]) => [
      ...order.map((at) => row[at] ?? null),
      'ignorada',
    ];
    const shuffled = {
      ...XLSX_SHEETS,
      Movimentos: [
        [...order.map((at) => MOVIMENTOS_HEADER[at] ?? ''), 'Extra'],
        pick(movimento()),
        pick(XLSX_SHEETS.Movimentos?.[2] ?? []),
      ],
    };

    const canonical = await loadDataset([
      { name: 'a.xlsx', bytes: buildWorkbook(XLSX_SHEETS) },
    ]);
    const reordered = await loadDataset([
      { name: 'a.xlsx', bytes: buildWorkbook(shuffled) },
    ]);

    expect(reordered.issues).toEqual([]);
    expect(reordered.dataset.movimentos).toEqual(canonical.dataset.movimentos);
  });

  it('reports a missing Movimentos or Listas tab', async () => {
    const { issues } = await loadDataset([
      {
        name: 'a.xlsx',
        bytes: buildWorkbook({ Pendentes: XLSX_SHEETS.Pendentes ?? [] }),
      },
    ]);

    expect(issues.map((i) => [i.code, i.tab])).toEqual([
      ['missing-tab', 'Movimentos'],
      ['missing-tab', 'Listas'],
    ]);
  });

  it('keeps the issues of rejected rows while the valid rows load', async () => {
    const { dataset, issues } = await loadDataset([
      {
        name: 'a.xlsx',
        bytes: buildWorkbook({
          ...XLSX_SHEETS,
          Movimentos: [
            [...MOVIMENTOS_HEADER],
            movimento({ Conta: 'Caixa', Meio: 'MB Way' }),
            movimento(),
          ],
        }),
      },
    ]);

    expect(dataset.movimentos.map((m) => m.src.row)).toEqual([3]);
    expect(issues).toEqual([
      expect.objectContaining({
        code: 'derived-mismatch',
        file: 'a.xlsx',
        tab: 'Movimentos',
        row: 2,
        column: 'Conta',
      }),
    ]);
  });

  it('lets the same sub-rubrica sit under two rubrics but not twice under one', async () => {
    const ok = await loadDataset([
      { name: 'a.xlsx', bytes: buildWorkbook(XLSX_SHEETS) },
    ]);
    const duplicated = LISTAS.map((row, at) =>
      at === 3
        ? row.map((cell, col) => (col === 5 ? 'Bilheteira' : cell))
        : row,
    );
    const bad = await loadDataset([
      {
        name: 'a.xlsx',
        bytes: buildWorkbook({ ...XLSX_SHEETS, Listas: duplicated }),
      },
    ]);

    expect(ok.issues).toEqual([]);
    expect(bad.issues.map((i) => [i.code, i.row, i.column])).toEqual([
      ['duplicate-listas', 4, 'Sub-rubrica'],
    ]);
  });
});
