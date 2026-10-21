import { describe, expect, it } from 'vitest';
import { DERIVED_COLUMN_ADVICE } from '../../src/core/issues.ts';
import { loadWorkbook } from '../../src/core/workbook.ts';
import { loadGenerated, readGenerated } from '../support/generated.ts';
import { CTX } from '../support/report-workbook.ts';

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
        suggestion: DERIVED_COLUMN_ADVICE,
      },
      {
        code: 'derived-mismatch',
        tab: 'Movimentos',
        row: 4,
        column: 'Conta',
        suggestion: DERIVED_COLUMN_ADVICE,
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

  it('raises one intended code at the intended cell on each broken report sheet', async () => {
    const result = await loadWorkbook(
      await readGenerated('invalid/report-sheets.xlsx'),
      CTX,
    );

    expect(result.load.issues).toEqual([]);
    expect(
      Object.fromEntries(
        result.reports.map(({ sheet, status, issues }) => [
          sheet,
          [status, ...issues.map(({ code, cell }) => `${code}@${cell ?? ''}`)],
        ]),
      ),
    ).toEqual({
      Válida: ['pronto'],
      'Sem atividade': ['com-erros', 'field-empty@B4'],
      'Data inválida': ['com-erros', 'field-invalid@B5'],
      'Data em texto': ['pronto-com-avisos', 'date-as-text@B5'],
      'Fórmula sem valor': ['com-erros', 'formula-no-value@B4'],
      'Orçamento desconhecido': ['com-erros', 'unknown-budget@B9'],
      'Versão nova': ['com-erros', 'report-version-newer@B2'],
      'Tipo desconhecido': ['com-erros', 'report-type-unknown@B1'],
      'Denominação errada': ['com-erros', 'field-invalid@A31'],
    });
  });
});
