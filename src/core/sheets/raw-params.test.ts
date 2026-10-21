import { describe, expect, it } from 'vitest';
import {
  config,
  gridOf,
  serial,
  type TestCell,
} from '../../../tests/support/report-sheet.ts';
import { toRawParams, validateDraft } from './raw-params.ts';
import { readReportSheet } from './read-sheet.ts';

type Rows = TestCell[][];

const draftOf = (rows: Rows) =>
  readReportSheet(gridOf(rows, { name: 'Pegada 2026' }), { config });

const pegada = (...rows: Rows): Rows => [
  ['Relatório', 'Pegada de direção'],
  ['Data do último relatório', serial('2026-08-31')],
  ['Data da passagem', serial('2026-09-30')],
  ['Direção cessante', 'Direção 2025/26'],
  ['Direção entrante', 'Direção 2026/27'],
  ['Saldo do extrato bancário na data da passagem (€)', 13265.05],
  ...rows,
];

const without = (rows: Rows, label: string): Rows =>
  rows.filter((row) => row[0] !== label);

const set = (rows: Rows, label: string, value: TestCell): Rows =>
  rows.map((row) => (row[0] === label ? [label, value] : row));

const SALDO = 'Saldo do extrato bancário na data da passagem (€)';

describe('toRawParams()', () => {
  it('shapes the raw object like the v1 input and maps each path to its cell', () => {
    const { raw, cellOf } = toRawParams(
      draftOf(
        pegada(
          ['Pagamentos não debitados'],
          ['Descrição', 'Valor (€)'],
          ['Cheque 12', 50],
          [null, null],
          ['Fornecedor', '1.234,50 €'],
          ['Contagem de caixa'],
          ['Denominação (€)', 'Quantidade', 'Total (€)'],
          [50, 8],
          [0.5, 3],
          ['Notas'],
          ['Primeira'],
          ['Segunda'],
        ),
      ),
    );

    expect(raw).toEqual({
      dataUltimoRelatorio: '2026-08-31',
      dataPassagem: '2026-09-30',
      direcaoCessante: 'Direção 2025/26',
      direcaoEntrante: 'Direção 2026/27',
      saldoExtrato: 13265.05,
      naoDebitados: [
        { descricao: 'Cheque 12', valor: 50 },
        { descricao: 'Fornecedor', valor: '1.234,50 €' },
      ],
      contagem: { '50': 8, '0,50': 3 },
      notas: 'Primeira\nSegunda',
    });
    expect(Object.fromEntries(cellOf)).toMatchObject({
      saldoExtrato: { cell: 'B6', field: SALDO },
      'naoDebitados/0/valor': { cell: 'B9' },
      'naoDebitados/1/descricao': { cell: 'A11' },
      'contagem/0,50': { cell: 'B15' },
    });
  });

  it('leaves out blank fields so the schema defaults apply', () => {
    const { raw } = toRawParams(
      draftOf([
        ['Relatório', 'Fim de ano letivo'],
        ['Fim do período', serial('2026-08-31')],
        ['Incluir a lista de movimentos', null],
      ]),
    );

    expect(raw).toEqual({ fim: '2026-08-31' });
  });
});

describe('validateDraft()', () => {
  it('returns the parsed parameters when the sheet is clean', () => {
    const result = validateDraft(draftOf(pegada()));

    expect(result.issues).toEqual([]);
    expect(result.params).toMatchObject({
      tipo: 'pegada',
      params: {
        saldoExtratoCents: 1326505,
        direcaoCessante: 'Direção 2025/26',
      },
    });
  });

  it('locates a blank required field as field-empty on its value cell', () => {
    const result = validateDraft(draftOf(set(pegada(), SALDO, null)));

    expect(result.params).toBeNull();
    expect(result.issues).toMatchObject([
      {
        severity: 'error',
        code: 'field-empty',
        sheet: 'Pegada 2026',
        cell: 'B6',
        field: SALDO,
        message: 'Valor em falta.',
      },
    ]);
  });

  it.each([
    ['texto', 'Valor monetário inválido'],
    [10.005, 'mais de 2 casas decimais'],
  ])('locates the invalid money value %j on its cell', (value, text) => {
    const rows = set(pegada(), SALDO, value);
    const result = validateDraft(draftOf(rows));

    expect(result.issues).toMatchObject([
      { code: 'field-invalid', cell: 'B6', field: SALDO },
    ]);
    expect(result.issues[0]?.message).toContain(text);
  });

  it('locates a rule that spans two fields on the field it names', () => {
    const rows = set(pegada(), 'Data da passagem', serial('2026-08-01'));
    const result = validateDraft(draftOf(rows));

    expect(result.issues).toMatchObject([
      {
        code: 'field-invalid',
        cell: 'B3',
        field: 'Data da passagem',
        message: 'A passagem tem de ser posterior ao último relatório.',
      },
    ]);
  });

  it('counts block rows after blank ones when it points at a value', () => {
    const result = validateDraft(
      draftOf(
        pegada(
          ['Pagamentos não debitados'],
          ['Descrição', 'Valor (€)'],
          ['Cheque 12', 50],
          [null, null],
          ['Fornecedor', 0],
        ),
      ),
    );

    expect(result.issues).toMatchObject([
      {
        code: 'field-invalid',
        cell: 'B11',
        field: 'Pagamentos emitidos ainda não debitados no extrato',
        message: 'O valor tem de ser superior a zero.',
      },
    ]);
  });

  it('does not repeat on the schema a problem the reader already located', () => {
    const rows = set(pegada(), 'Data da passagem', 'ontem');
    const result = validateDraft(draftOf(rows));

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      code: 'field-invalid',
      cell: 'B3',
    });
  });

  it('keeps a warning the reader raised without hiding a schema error on the same cell', () => {
    const rows = set(pegada(), 'Data da passagem', '01/08/2026');
    const result = validateDraft(draftOf(rows));

    expect(result.issues.map(({ code }) => code)).toEqual([
      'date-as-text',
      'field-invalid',
    ]);
  });

  it('does not repeat a missing label as an empty field', () => {
    const result = validateDraft(
      draftOf(without(pegada(), 'Direção cessante')),
    );

    expect(result.issues).toMatchObject([
      { code: 'field-missing', field: 'Direção cessante' },
    ]);
  });

  it('locates a derivable field left blank on its own cell', () => {
    const rows = set(pegada(), 'Data do último relatório', null);
    const result = validateDraft(draftOf(rows));

    expect(result.issues).toMatchObject([
      { code: 'field-empty', cell: 'B2', field: 'Data do último relatório' },
    ]);
  });

  it('puts a derivable field whose label is absent on the type cell', () => {
    const result = validateDraft(
      draftOf(without(pegada(), 'Data do último relatório')),
    );

    expect(result.issues).toMatchObject([
      {
        code: 'field-empty',
        cell: 'B1',
        field: 'Data do último relatório',
      },
    ]);
  });

  it('returns nothing for a sheet still to be filled', () => {
    const result = validateDraft(draftOf([['Relatório', 'Pegada de direção']]));

    expect(result).toEqual({ params: null, issues: [] });
  });

  it('withholds the parameters while the reader reports an error, even if the schema accepts them', () => {
    const rows = pegada(
      ['Contagem de caixa'],
      ['Denominação (€)', 'Quantidade'],
      [3, 1],
    );
    const result = validateDraft(draftOf(rows));

    expect(result.params).toBeNull();
    expect(result.issues).toMatchObject([
      { code: 'field-invalid', cell: 'A9' },
    ]);
  });
});
