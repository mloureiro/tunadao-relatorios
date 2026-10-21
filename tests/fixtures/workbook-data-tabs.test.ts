import { describe, expect, it } from 'vitest';
import { DERIVED_COLUMN_ADVICE } from '../../src/core/issues.ts';
import { loadWorkbook } from '../../src/core/workbook.ts';
import { CTX } from '../support/report-workbook.ts';
import { LISTAS, MOVIMENTOS_HEADER, XLSX_SHEETS } from '../support/sample.ts';
import { buildWorkbook, type Sheet } from '../support/workbook.ts';

const RENAMED_HEADER = MOVIMENTOS_HEADER.map((name) =>
  name === 'Conta'
    ? 'Conta (automático)'
    : name === 'Valor com sinal (€)'
      ? 'Efeito no saldo (€) (automático)'
      : name === 'Conta para o resultado'
        ? 'Conta como receita ou despesa'
        : name,
);

const renamedMovimentos: Sheet = (XLSX_SHEETS.Movimentos ?? []).map(
  (row, at) => (at === 0 ? RENAMED_HEADER : row),
);

const renamedListas: Sheet = LISTAS.map((row, at) => [
  ...(at === 0
    ? row.map((cell) =>
        cell === 'Conta para o resultado'
          ? 'Conta como receita ou despesa'
          : cell,
      )
    : row),
  null,
  at === 0 ? 'Orçamento' : at === 1 ? 'Festival Alfa' : null,
]);

async function load(sheets: Record<string, Sheet>) {
  return loadWorkbook(
    { name: 'dados.xlsx', bytes: buildWorkbook(sheets) },
    CTX,
  );
}

describe('data tabs read from real workbook bytes', () => {
  it('accepts the renamed calculated columns and the Orçamentos list', async () => {
    const result = await load({
      ...XLSX_SHEETS,
      Movimentos: renamedMovimentos,
      Listas: renamedListas,
    });

    expect(result.load.issues).toEqual([]);
    expect(result.load.dataset.lists.orcamentos).toEqual(['Festival Alfa']);
    expect(result.load.dataset.movimentos).toHaveLength(2);
  });

  it('still reads a wrong value in a renamed calculated column and says the column is automatic', async () => {
    const movimentos: Sheet = renamedMovimentos.map((row, at) =>
      at === 1 ? row.map((cell, column) => (column === 10 ? 999 : cell)) : row,
    );
    const result = await load({ ...XLSX_SHEETS, Movimentos: movimentos });

    expect(result.load.issues).toMatchObject([
      {
        code: 'derived-mismatch',
        tab: 'Movimentos',
        row: 2,
        suggestion: DERIVED_COLUMN_ADVICE,
      },
    ]);
  });

  it('flags a budget Âmbito outside the Orçamentos list on its row', async () => {
    const result = await load({
      ...XLSX_SHEETS,
      Listas: renamedListas,
      Orçamento: [
        ['Âmbito', 'Tipo', 'Rubrica', 'Sub-rubrica', 'Orçado (€)'],
        ['Festival Alfa', 'Entrada', 'Bilheteira', 'Bilhetes', 500],
        ['Festival Alpha', 'Entrada', 'Bilheteira', 'Bilhetes', 500],
      ],
    });

    expect(result.load.issues).toMatchObject([
      {
        code: 'unknown-ambito',
        tab: 'Orçamento',
        row: 3,
        column: 'Âmbito',
        suggestion: 'Quis dizer "Festival Alfa"?',
      },
    ]);
  });
});
