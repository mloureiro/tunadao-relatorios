import { describe, expect, it } from 'vitest';
import {
  ISSUE_SEVERITY,
  formatIssueLocation,
  issueMessages,
  makeIssue,
} from './issues.ts';

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
      'budget-tipo-mismatch',
      'derived-mismatch',
      'duplicate-listas',
      'settled-before-registered',
      'checkpoint-conflict',
      'checkpoint-mismatch',
      'missing-opening-balance',
      'manual-opening-mismatch',
      'report-type-unknown',
      'report-version-newer',
      'field-missing',
      'field-empty',
      'field-invalid',
      'field-duplicate',
      'formula-no-value',
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

describe('formatIssueLocation()', () => {
  it('names the sheet, the cell and the field of a report-sheet issue', () => {
    const issue = makeIssue('field-empty', issueMessages['field-empty'](), {
      sheet: 'Pegada 2026',
      cell: 'B8',
      field: 'Saldo do extrato bancário na data da passagem (€)',
    });

    expect(formatIssueLocation(issue)).toBe(
      'Folha "Pegada 2026", célula B8 — Saldo do extrato bancário na data da passagem (€): Valor em falta.',
    );
  });

  it('omits the cell and the field a sheet-level issue does not have', () => {
    expect(
      formatIssueLocation(
        makeIssue('field-missing', 'Falta o campo "Ano".', {
          sheet: 'Fiscal 2025',
        }),
      ),
    ).toBe('Folha "Fiscal 2025" — Falta o campo "Ano".');
    expect(
      formatIssueLocation(
        makeIssue('field-missing', 'Falta o campo "Ano".', {
          sheet: 'Fiscal 2025',
          field: 'Ano',
        }),
      ),
    ).toBe('Folha "Fiscal 2025" — Ano: Falta o campo "Ano".');
  });

  it.each([
    [
      { tab: 'Movimentos' as const, row: 12, column: 'Rubrica' },
      'Separador Movimentos, linha 12, coluna Rubrica — M',
    ],
    [{ tab: 'Saldos' as const, row: 3 }, 'Separador Saldos, linha 3 — M'],
    [{ tab: 'Listas' as const }, 'Separador Listas — M'],
    [{ file: 'a.xlsx' }, 'M'],
  ])('keeps the data-tab wording for %j', (where, expected) => {
    expect(formatIssueLocation(makeIssue('required-empty', 'M', where))).toBe(
      expected,
    );
  });
});
