import { describe, expect, it } from 'vitest';
import { makeIssue } from '../core/issues.ts';
import { formatIssue } from './format-issues.ts';

describe('formatIssue()', () => {
  it('prints a data-tab location with the suggestion', () => {
    const issue = makeIssue(
      'unknown-rubrica',
      'A rubrica "Bar" não existe.',
      { tab: 'Movimentos', row: 7, column: 'Rubrica' },
      'Quis dizer "Bar e merchandising"?',
    );

    expect(formatIssue(issue)).toBe(
      'ERRO Separador Movimentos, linha 7, coluna Rubrica — A rubrica "Bar" não existe. (sugestão: Quis dizer "Bar e merchandising"?)',
    );
  });

  it('prints a report-sheet cell location', () => {
    const issue = makeIssue('invalid-date', 'Data inválida.', {
      sheet: 'Pegada 2026',
      cell: 'B8',
      field: 'Data da passagem',
    });

    expect(formatIssue(issue)).toBe(
      'ERRO Folha "Pegada 2026", célula B8 — Data da passagem: Data inválida.',
    );
  });

  it('prints only the message when the issue has no location', () => {
    const issue = makeIssue('no-previous-data', 'Sem dados.');

    expect(formatIssue(issue)).toBe('AVISO Sem dados.');
  });
});
