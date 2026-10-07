import { describe, expect, it } from 'vitest';
import {
  LISTAS,
  MOVIMENTOS_HEADER,
  XLSX_SHEETS,
  movimento,
} from '../../../tests/support/sample.ts';
import { buildWorkbook } from '../../../tests/support/workbook.ts';
import { loadDataset } from '../pipeline.ts';

const load = (sheets: Parameters<typeof buildWorkbook>[0]) =>
  loadDataset([{ name: 'tesouraria.xlsx', bytes: buildWorkbook(sheets) }]);

describe('loadDataset() validation', () => {
  it('accounts for every Movimentos row: it is loaded or has an unknown-* error naming its row', async () => {
    const rows = [
      movimento(),
      movimento({ Meio: 'Multibanco' }),
      movimento({ Rubrica: 'Bilheteiraa', 'Sub-rubrica': null }),
      movimento({ 'Sub-rubrica': 'Bilhetess' }),
      movimento({ Atividade: 'Atividade nova' }),
      movimento({
        Rubrica: 'Bilheteiraa',
        'Sub-rubrica': null,
        Atividade: 'Serenatta',
      }),
    ];

    const { dataset, issues } = await load({
      ...XLSX_SHEETS,
      Movimentos: [[...MOVIMENTOS_HEADER], ...rows],
    });

    const sheetRows = rows.map((_row, at) => at + 2);
    const loaded = new Set(dataset.movimentos.map((m) => m.src.row));
    const reported = new Set(
      issues
        .filter(
          (issue) =>
            issue.severity === 'error' &&
            issue.code.startsWith('unknown-') &&
            issue.tab === 'Movimentos',
        )
        .map((issue) => issue.row),
    );

    expect(
      sheetRows.filter((row) => !loaded.has(row) && !reported.has(row)),
    ).toEqual([]);
    expect([...loaded]).toEqual([2, 6]);
    expect(
      issues
        .filter((issue) => issue.row === 7)
        .map((issue) => issue.code)
        .toSorted(),
    ).toEqual(['unknown-atividade', 'unknown-rubrica']);
  });

  it('warns about a renamed sheet and suggests the tab it looks like', async () => {
    const { Pendentes, ...rest } = XLSX_SHEETS;

    const { issues, dataset } = await load({
      ...rest,
      'Pendentes 2025': Pendentes ?? [],
    });

    expect(dataset.pendentes).toEqual([]);
    expect(issues).toMatchObject([
      { severity: 'warning', code: 'ignored-sheet', suggestion: 'Pendentes' },
    ]);
  });

  it('allows an extra report sheet with a warning and no suggestion', async () => {
    const { issues } = await load({
      ...XLSX_SHEETS,
      Rel_Evento: [['Resumo']],
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      severity: 'warning',
      code: 'ignored-sheet',
    });
    expect(issues[0]).not.toHaveProperty('suggestion');
  });

  it('rejects two sheets that normalise to the same tab, naming both', async () => {
    const { issues } = await load({
      ...XLSX_SHEETS,
      Orcamento: XLSX_SHEETS.Orçamento ?? [],
    });

    expect(issues).toMatchObject([
      { severity: 'error', code: 'duplicate-sheet', tab: 'Orçamento' },
    ]);
    expect(issues[0]?.message).toContain('"Orçamento" e "Orcamento"');
  });

  it('returns validator findings from the dataset alongside the load-stage ones', async () => {
    const { issues } = await load({
      ...XLSX_SHEETS,
      Movimentos: [
        [...MOVIMENTOS_HEADER],
        movimento(),
        movimento({ 'Valor (€)': 0 }),
        movimento(),
      ],
      Listas: LISTAS,
    });

    expect(issues.map((issue) => issue.code).toSorted()).toEqual(
      ['non-positive-value', 'probable-duplicate'].toSorted(),
    );
  });
});
