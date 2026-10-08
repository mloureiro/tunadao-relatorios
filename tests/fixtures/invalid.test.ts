import { describe, expect, it } from 'vitest';
import { loadGenerated } from '../support/generated.ts';

async function issuesOf(file: string) {
  const { issues } = await loadGenerated(`invalid/${file}`);
  return issues.map(({ code, tab, row, column, suggestion }) => ({
    code,
    tab,
    row,
    column,
    suggestion,
  }));
}

describe('invalid fixtures', () => {
  it('flags derived columns that disagree with the row', async () => {
    expect(await issuesOf('value-mismatch.xlsx')).toEqual([
      {
        code: 'derived-mismatch',
        tab: 'Movimentos',
        row: 3,
        column: 'Valor com sinal (€)',
      },
      {
        code: 'derived-mismatch',
        tab: 'Movimentos',
        row: 4,
        column: 'Conta',
      },
    ]);
  });

  it('flags a sub-rubric of another rubric, a misspelt rubric and a negative value', async () => {
    expect(await issuesOf('misclassified.xlsx')).toEqual([
      {
        code: 'non-positive-value',
        tab: 'Movimentos',
        row: 4,
        column: 'Valor (€)',
        suggestion: expect.stringContaining(
          'altere o Tipo para "Entrada"',
        ) as unknown,
      },
      {
        code: 'unknown-rubrica',
        tab: 'Movimentos',
        row: 2,
        column: 'Sub-rubrica',
        suggestion:
          'A sub-rubrica "Bar" existe na rubrica "Bar e merchandising".',
      },
      {
        code: 'unknown-rubrica',
        tab: 'Movimentos',
        row: 3,
        column: 'Rubrica',
        suggestion: 'Quis dizer "Produção (som, luz, palco)"?',
      },
    ]);
  });

  it('flags a row without activity and a row without means of payment', async () => {
    expect(await issuesOf('missing-fields.xlsx')).toEqual([
      {
        code: 'required-empty',
        tab: 'Movimentos',
        row: 2,
        column: 'Atividade',
      },
      { code: 'required-empty', tab: 'Movimentos', row: 3, column: 'Meio' },
    ]);
  });

  it('flags a declared balance the movements do not support', async () => {
    expect(await issuesOf('checkpoint-mismatch.xlsx')).toEqual([
      {
        code: 'checkpoint-mismatch',
        tab: 'Saldos',
        row: 3,
        column: 'Saldo (€)',
      },
    ]);
  });
});
