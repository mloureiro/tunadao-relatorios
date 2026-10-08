import { describe, expect, it } from 'vitest';
import { makeIssue } from '../core/issues.ts';
import { formatIssue } from './format-issues.ts';

describe('formatIssue()', () => {
  it('prints file, tab, row, column, message and suggestion', () => {
    const issue = makeIssue(
      'unknown-rubrica',
      'A rubrica "Bar" não existe.',
      { file: 'tesouraria.xlsx', tab: 'Movimentos', row: 7, column: 'Rubrica' },
      'Quis dizer "Bar e merchandising"?',
    );

    expect(formatIssue(issue)).toBe(
      'ERRO tesouraria.xlsx › Movimentos linha 7, coluna Rubrica: A rubrica "Bar" não existe. (sugestão: Quis dizer "Bar e merchandising"?)',
    );
  });

  it('prints only the message when the issue has no location', () => {
    const issue = makeIssue('no-previous-data', 'Sem dados.');

    expect(formatIssue(issue)).toBe('AVISO Sem dados.');
  });

  it('prints a file-level issue without row or column', () => {
    const issue = makeIssue('unrecognised-file', 'Ficheiro desconhecido.', {
      file: 'x.csv',
    });

    expect(formatIssue(issue)).toBe('ERRO x.csv: Ficheiro desconhecido.');
  });
});
