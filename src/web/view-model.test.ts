import { describe, expect, it } from 'vitest';
import { formatIssueLocation, makeIssue, type Issue } from '@/core/issues';
import type { ReportInstance } from '@/core/sheets/instance';
import type { DataSummary } from '@/core/summary';
import type { WorkbookResult } from '@/core/workbook';
import {
  checkContents,
  checkSelection,
  dataIssueWhere,
  groupDataIssues,
  isReady,
  loadedAnnouncement,
  NOT_A_WORKBOOK,
  ONE_FILE_ONLY,
  sheetIssueParts,
  nextSheetFacts,
  skippedForZip,
  statusNote,
  summaryFacts,
  zipResultLine,
} from './view-model';

const dataIssue = (
  code: 'required-empty' | 'ignored-sheet' | 'unknown-rubrica',
  where: Partial<Issue>,
): Issue => ({ ...makeIssue(code, `msg ${code}`), ...where });

describe('checkSelection()', () => {
  it.each([['tesouraria.xlsx'], ['TESOURARIA.XLSX']])('accepts %s', (name) => {
    expect(checkSelection([name])).toBeNull();
  });

  it.each([
    ['notas.pdf'],
    ['movimentos.csv'],
    ['antigo.xls'],
    ['sem-extensao'],
  ])('refuses %s with the instruction to save as .xlsx', (name) => {
    expect(checkSelection([name])).toBe(NOT_A_WORKBOOK);
  });

  it('refuses more than one file', () => {
    expect(checkSelection(['a.xlsx', 'b.xlsx'])).toBe(ONE_FILE_ONLY);
  });
});

describe('checkContents()', () => {
  it('accepts a ZIP container', () => {
    expect(checkContents(Uint8Array.of(0x50, 0x4b, 0x03, 0x04, 0))).toBeNull();
  });

  it.each([
    ['a PDF', Uint8Array.of(0x25, 0x50, 0x44, 0x46)],
    ['an old binary workbook', Uint8Array.of(0xd0, 0xcf, 0x11, 0xe0)],
    ['an empty file', new Uint8Array()],
  ])('refuses %s renamed to .xlsx', (_name, bytes) => {
    expect(checkContents(bytes)).toBe(NOT_A_WORKBOOK);
  });
});

describe('groupDataIssues()', () => {
  it('groups by tab in the order of work, errors first, then by row', () => {
    const groups = groupDataIssues([
      dataIssue('required-empty', { tab: 'Movimentos', row: 9 }),
      dataIssue('ignored-sheet', { tab: 'Movimentos', row: 2 }),
      dataIssue('required-empty', { tab: 'Movimentos', row: 4 }),
      dataIssue('unknown-rubrica', { tab: 'Listas', row: 7 }),
      dataIssue('required-empty', {}),
    ]);

    expect(groups.map(({ title }) => title)).toEqual([
      'Ficheiro',
      'Listas',
      'Movimentos',
    ]);
    expect(
      groups[2]?.issues.map(({ severity, row }) => [severity, row]),
    ).toEqual([
      ['error', 4],
      ['error', 9],
      ['warning', 2],
    ]);
  });
});

describe('dataIssueWhere()', () => {
  it.each([
    [{ row: 12, column: 'Rubrica' }, 'linha 12, coluna Rubrica'],
    [{ row: 3 }, 'linha 3'],
    [{}, null],
  ])('describes %j', (where, expected) => {
    expect(dataIssueWhere(dataIssue('required-empty', where))).toBe(expected);
  });
});

describe('sheetIssueParts()', () => {
  it('splits a located sheet issue around the cell and rebuilds the same line', () => {
    const issue = makeIssue('field-empty', 'Valor em falta.', {
      sheet: 'Pegada 2026',
      cell: 'B8',
      field: 'Saldo do extrato',
    });

    const { lead, cell, body } = sheetIssueParts(issue);

    expect(cell).toBe('B8');
    expect(lead).toBe('Folha "Pegada 2026", célula ');
    expect(`${lead}${cell ?? ''}${body}`).toBe(formatIssueLocation(issue));
  });

  it('keeps the whole line when there is no cell', () => {
    const issue = makeIssue('field-missing', 'Falta o campo.', {
      sheet: 'Pegada 2026',
    });

    expect(sheetIssueParts(issue)).toEqual({
      lead: '',
      cell: null,
      body: formatIssueLocation(issue),
    });
  });
});

describe('summaryFacts()', () => {
  const summary: DataSummary = {
    firstDate: '2024-01-05',
    lastDate: '2026-09-30',
    movimentos: 412,
    atividades: 9,
    caixa: { cents: 57900, text: '579,00 €' },
    banco: { cents: 1326505, text: '13.265,05 €' },
  };

  it('words the period and dates the balances', () => {
    expect(summaryFacts(summary)).toEqual([
      { label: 'Período dos movimentos', value: '05/01/2024 a 30/09/2026' },
      { label: 'Movimentos', value: '412' },
      { label: 'Atividades', value: '9' },
      { label: 'Caixa a 30/09/2026', value: '579,00 €' },
      { label: 'Banco a 30/09/2026', value: '13.265,05 €' },
    ]);
  });

  it('leaves out a balance the ledger cannot give', () => {
    const labels = summaryFacts({ ...summary, banco: null }).map(
      ({ label }) => label,
    );

    expect(labels).not.toContain('Banco a 30/09/2026');
    expect(labels).toContain('Caixa a 30/09/2026');
  });
});

describe('report status wording', () => {
  const instance = (status: ReportInstance['status']): ReportInstance => ({
    sheet: 'Folha',
    tipo: 'fiscal',
    status,
    issues: [],
    dates: [],
    title: 'Fim de ano fiscal 2025',
    fileStem: '2025-12-31 Fim de ano fiscal 2025',
    keyFigures: [],
  });

  it.each([
    ['pronto', true, null],
    ['pronto-com-avisos', true, null],
    ['com-erros', false, 'Corrija as células'],
    ['por-preencher', false, 'ainda não tem dados'],
    ['bloqueado-dados', false, 'erros dos dados'],
  ] as const)('%s: ready=%s, note %s', (status, ready, note) => {
    expect(isReady(instance(status))).toBe(ready);
    const text = statusNote(instance(status));
    if (note === null) expect(text).toBeNull();
    else expect(text).toContain(note);
  });
});

describe('loadedAnnouncement()', () => {
  const result = (issues: Issue[], reports: number): WorkbookResult =>
    ({
      load: { issues },
      reports: Array.from({ length: reports }),
    }) as unknown as WorkbookResult;

  it.each([
    [[], 5, 'Ficheiro lido. 5 relatórios neste ficheiro.'],
    [[], 1, 'Ficheiro lido. 1 relatório neste ficheiro.'],
    [[], 0, 'Ficheiro lido. Ainda não tem folhas de relatório.'],
    [
      [dataIssue('required-empty', {}), dataIssue('required-empty', {})],
      5,
      'Ficheiro lido. 2 erros nos dados a corrigir.',
    ],
  ])('says %j with %i reports', (issues, reports, expected) => {
    expect(loadedAnnouncement(result(issues, reports))).toBe(expected);
  });
});

describe('zip result line', () => {
  const sheet = (name: string, status: ReportInstance['status']) =>
    ({ sheet: name, status }) as ReportInstance;

  it('names every sheet left out, with the reason', () => {
    const skipped = skippedForZip(
      [
        sheet('Pegada 2026', 'pronto'),
        sheet('Evento X', 'com-erros'),
        sheet('Modelo Fiscal', 'por-preencher'),
      ],
      [sheet('Fiscal 2025', 'pronto')],
    );

    expect(zipResultLine(4, skipped)).toBe(
      'Zip descarregado com 4 relatórios. Não incluídos: "Evento X" (com erros), "Modelo Fiscal" (por preencher), "Fiscal 2025" (não foi possível gerar o PDF).',
    );
  });

  it('says nothing about skipped sheets when none were left out, and counts one in the singular', () => {
    expect(zipResultLine(1, [])).toBe('Zip descarregado com 1 relatório.');
  });
});

describe('nextSheetFacts()', () => {
  it('writes dates in words and keeps text as it is', () => {
    expect(
      nextSheetFacts({
        tipo: 'pegada',
        fileName: 'folha-proxima-pegada.xlsx',
        values: {
          dataUltimoRelatorio: '2026-09-30',
          direcaoCessante: 'Direção 2026/27',
        },
      }),
    ).toEqual([
      { label: 'Data do último relatório', value: '30 de setembro de 2026' },
      { label: 'Direção cessante', value: 'Direção 2026/27' },
    ]);
  });
});
