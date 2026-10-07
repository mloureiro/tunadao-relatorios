import { describe, expect, it } from 'vitest';
import { ISSUE_SEVERITY, issueMessages, makeIssue } from './issues.ts';

describe('makeIssue()', () => {
  it('takes the severity from the catalogue and carries the location', () => {
    const issue = makeIssue(
      'unknown-rubrica',
      issueMessages['unknown-rubrica']('Licencas', null),
      { file: 'a.xlsx', tab: 'Movimentos', row: 4, column: 'Rubrica' },
      'Licenças',
    );

    expect(issue).toEqual({
      severity: 'error',
      code: 'unknown-rubrica',
      file: 'a.xlsx',
      tab: 'Movimentos',
      row: 4,
      column: 'Rubrica',
      message: 'A rubrica "Licencas" não existe na lista Rubricas.',
      suggestion: 'Licenças',
    });
  });

  it('omits the optional fields it was not given', () => {
    const issue = makeIssue(
      'no-previous-data',
      issueMessages['no-previous-data'](),
    );

    expect(Object.keys(issue).sort()).toEqual(['code', 'message', 'severity']);
    expect(issue.severity).toBe('warning');
  });
});

describe('issue catalogue', () => {
  it('blocks generation only for the codes the validation table marks as errors', () => {
    const errors = Object.entries(ISSUE_SEVERITY)
      .filter(([, severity]) => severity === 'error')
      .map(([code]) => code);

    expect(errors).toEqual([
      'missing-column',
      'missing-tab',
      'unreadable-file',
      'duplicate-sheet',
      'unrecognised-file',
      'required-empty',
      'invalid-date',
      'invalid-number',
      'invalid-enum',
      'non-positive-value',
      'negative-value',
      'unknown-rubrica',
      'unknown-atividade',
      'unknown-meio',
      'derived-mismatch',
      'duplicate-listas',
      'settled-before-registered',
      'checkpoint-conflict',
      'checkpoint-mismatch',
      'missing-opening-balance',
      'manual-opening-mismatch',
    ]);
  });
});

describe('issueMessages', () => {
  it('words a sub-rubrica error with the pair', () => {
    expect(issueMessages['unknown-rubrica']('Material', 'Outros')).toBe(
      'A sub-rubrica "Outros" não existe na rubrica "Material" da lista Sub-rubricas.',
    );
  });

  it('formats money and dates in pt-PT', () => {
    expect(
      issueMessages['checkpoint-mismatch'](
        'Banco',
        '2025-12-31',
        843015,
        842015,
      ),
    ).toBe(
      'O saldo de Banco em 31/12/2025 é 8.430,15 € mas os movimentos dão 8.420,15 € (diferença +10,00 €).',
    );
  });
});

describe('file-level messages', () => {
  it('carries the reason for an unreadable file', () => {
    expect(issueMessages['unreadable-file']('a.xlsx', 'cifrado')).toBe(
      'Não foi possível ler o ficheiro "a.xlsx" (detalhe técnico: cifrado).',
    );
  });

  it.each([
    [
      null,
      'O ficheiro "a.csv" não corresponde a nenhum separador da Tesouraria.',
    ],
    [
      { tab: 'Saldos' as const, missing: ['Fonte', 'Conta'] },
      'O ficheiro "a.csv" não corresponde a nenhum separador da Tesouraria. O separador mais próximo é Saldos. Colunas em falta: Fonte, Conta.',
    ],
    [
      { tab: 'Saldos' as const, missing: [] },
      'O ficheiro "a.csv" não corresponde a nenhum separador da Tesouraria. O separador mais próximo é Saldos.',
    ],
  ])('words an unrecognised file with closest %j', (closest, expected) => {
    expect(issueMessages['unrecognised-file']('a.csv', closest)).toBe(expected);
  });
});
