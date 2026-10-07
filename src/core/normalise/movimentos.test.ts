import { describe, expect, it } from 'vitest';
import {
  LISTAS,
  MOVIMENTOS_HEADER,
  movimento,
} from '../../../tests/support/sample.ts';
import { table, type Sheet } from '../../../tests/support/workbook.ts';
import type { Issue } from '../issues.ts';
import { normaliseListas } from './lists.ts';
import { normaliseMovimentos } from './movimentos.ts';

const listIssues: Issue[] = [];
const lists = normaliseListas([table('Listas', LISTAS)], listIssues);

function run(rows: Sheet, header: readonly string[] = MOVIMENTOS_HEADER) {
  const issues: Issue[] = [];
  const result = normaliseMovimentos(
    [table('Movimentos', [[...header], ...rows])],
    lists,
    issues,
  );
  return { ...result, issues };
}

describe('normaliseMovimentos()', () => {
  it('builds a movement with the derived columns resolved from Listas', () => {
    const { movimentos, issues } = run([movimento()]);

    expect(issues).toEqual([]);
    expect(movimentos).toEqual([
      {
        data: '2025-09-30',
        doc: 'F1',
        descricao: 'Bilhetes vendidos',
        atividade: 'Festival Alfa',
        rubrica: 'Bilheteira',
        subRubrica: 'Bilhetes',
        tipo: 'Entrada',
        meio: 'Caixa',
        conta: 'Caixa',
        valorCents: 12050,
        signedCents: 12050,
        contaResultado: true,
        src: { file: 'teste.xlsx', tab: 'Movimentos', row: 2 },
      },
    ]);
  });

  it('signs a Saída negative, maps MB Way to Banco and resolves an empty sub-rubrica to the rubrica', () => {
    const { movimentos } = run([
      movimento({
        Tipo: 'Saída',
        Rubrica: 'Alimentação',
        'Sub-rubrica': null,
        Meio: 'MB Way',
      }),
    ]);

    expect(movimentos[0]).toMatchObject({
      conta: 'Banco',
      signedCents: -12050,
      subRubrica: 'Alimentação',
    });
  });

  it('marks a movement under a rubric that does not count for the result', () => {
    const { movimentos } = run([
      movimento({ Rubrica: 'Transferências internas', 'Sub-rubrica': null }),
    ]);

    expect(movimentos[0]?.contaResultado).toBe(false);
  });

  it('accepts supplied derived columns that agree', () => {
    const { movimentos, issues } = run([
      movimento({
        Conta: 'Caixa',
        'Valor com sinal (€)': 120.5,
        'Conta para o resultado': 'Sim',
      }),
    ]);

    expect(issues).toEqual([]);
    expect(movimentos).toHaveLength(1);
  });

  it.each([
    ['Conta', { Conta: 'Caixa', Meio: 'MB Way' }, 'Conta', /Caixa.*Banco/],
    [
      'Valor com sinal',
      { 'Valor com sinal (€)': -120.5 },
      'Valor com sinal (€)',
      /−120,50.*120,50/,
    ],
    [
      'Conta para o resultado',
      { 'Conta para o resultado': 'Não' },
      'Conta para o resultado',
      /Não.*Sim/,
    ],
  ])(
    'reports derived-mismatch when %s disagrees',
    (_name, overrides, column, message) => {
      const { movimentos, issues } = run([movimento(overrides)]);

      expect(movimentos).toEqual([]);
      expect(issues).toEqual([
        expect.objectContaining({
          code: 'derived-mismatch',
          severity: 'error',
          tab: 'Movimentos',
          row: 2,
          column,
          message: expect.stringMatching(message) as string,
        }),
      ]);
    },
  );

  it.each([
    ['Data', 'required-empty', 'Data'],
    ['Descrição', 'required-empty', 'Descrição'],
    ['Atividade', 'required-empty', 'Atividade'],
    ['Rubrica', 'required-empty', 'Rubrica'],
    ['Tipo', 'required-empty', 'Tipo'],
    ['Meio', 'required-empty', 'Meio'],
    ['Valor (€)', 'required-empty', 'Valor (€)'],
  ] as const)('reports an empty %s', (name, code, column) => {
    const { movimentos, issues } = run([movimento({ [name]: null })]);

    expect(movimentos).toEqual([]);
    expect(issues).toEqual([expect.objectContaining({ code, column, row: 2 })]);
  });

  it.each([
    ['text that is not a date', { Data: 'ontem' }, 'invalid-date', 'Data'],
    ['a serial that is not a date', { Data: 60 }, 'invalid-date', 'Data'],
    [
      'an impossible calendar day',
      { Data: '31/02/2025' },
      'invalid-date',
      'Data',
    ],
    [
      'text that is not a number',
      { 'Valor (€)': 'doze euros' },
      'invalid-number',
      'Valor (€)',
    ],
    [
      'a boolean as value',
      { 'Valor (€)': true },
      'invalid-number',
      'Valor (€)',
    ],
    ['an unknown Tipo', { Tipo: 'Receita' }, 'invalid-enum', 'Tipo'],
    ['an unknown supplied Conta', { Conta: 'Cofre' }, 'invalid-enum', 'Conta'],
  ])('reports %s', (_name, overrides, code, column) => {
    const { movimentos, issues } = run([movimento(overrides)]);

    expect(movimentos).toEqual([]);
    expect(issues).toEqual([
      expect.objectContaining({ code, column, row: 2, tab: 'Movimentos' }),
    ]);
  });

  it('flags a negative value and suggests flipping the Tipo', () => {
    const { issues } = run([movimento({ 'Valor (€)': -50 })]);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: 'non-positive-value',
      column: 'Valor (€)',
    });
    expect(issues[0]?.suggestion).toMatch(/Saída.*50,00/);
  });

  it('flags a zero value without a suggestion', () => {
    const { issues } = run([movimento({ 'Valor (€)': 0 })]);

    expect(issues).toEqual([
      expect.objectContaining({ code: 'non-positive-value' }),
    ]);
    expect(issues[0]).not.toHaveProperty('suggestion');
  });

  it('keeps a row with more than two decimals and warns', () => {
    const { movimentos, issues } = run([movimento({ 'Valor (€)': 10.005 })]);

    expect(movimentos[0]?.valorCents).toBe(1001);
    expect(issues).toEqual([
      expect.objectContaining({
        code: 'sub-cent',
        severity: 'warning',
        row: 2,
      }),
    ]);
  });

  it('warns once when text dates look month-first and still rejects the impossible ones', () => {
    const { movimentos, issues } = run([
      movimento({ Data: '03/25/2025' }),
      movimento({ Data: '01/02/2025' }),
      movimento({ Data: '04/30/2025' }),
    ]);

    expect(movimentos.map((m) => m.data)).toEqual(['2025-02-01']);
    expect(issues.map((i) => [i.code, i.row])).toEqual([
      ['ambiguous-date-order', 2],
      ['invalid-date', 2],
      ['invalid-date', 4],
    ]);
  });

  it('does not warn when a day above 12 shows the order is day-first', () => {
    const { issues } = run([
      movimento({ Data: '25/03/2025' }),
      movimento({ Data: '03/25/2025' }),
    ]);

    expect(issues.map((i) => i.code)).toEqual(['invalid-date']);
  });

  it('leaves references unknown to Listas for the next stage without reporting them', () => {
    const { movimentos, unresolved, issues } = run([
      movimento({ Meio: 'Multibanco' }),
      movimento({ Rubrica: 'Alimentacao', 'Sub-rubrica': null }),
      movimento({ 'Sub-rubrica': 'Bilhetess' }),
      movimento({ Atividade: 'Atividade nova' }),
    ]);

    expect(issues).toEqual([]);
    expect(movimentos.map((m) => m.atividade)).toEqual(['Atividade nova']);
    expect(
      unresolved.map((u) => [u.src.row, u.unknownMeio, u.unknownRubrica]),
    ).toEqual([
      [2, true, false],
      [3, false, true],
      [4, false, true],
    ]);
  });

  it('skips blank rows and numbers the remaining ones by sheet row', () => {
    const blank = MOVIMENTOS_HEADER.map(() => null);
    const { movimentos, issues } = run([
      blank,
      movimento(),
      blank,
      movimento({ Rubrica: null }),
    ]);

    expect(movimentos.map((m) => m.src.row)).toEqual([3]);
    expect(issues.map((i) => i.row)).toEqual([5]);
  });

  it('finds columns by normalised header whatever their order, ignoring unknown columns', () => {
    const reordered = [
      'valor',
      'extra',
      'tipo',
      'meio',
      'DATA',
      'Descricao',
      'atividade',
      'rubrica',
    ];
    const { movimentos, issues } = run(
      [
        [
          120.5,
          'x',
          'Entrada',
          'Caixa',
          45930,
          'Bilhetes',
          'Festival Alfa',
          'Bilheteira',
        ],
      ],
      reordered,
    );

    expect(issues).toEqual([]);
    expect(movimentos[0]).toMatchObject({
      data: '2025-09-30',
      descricao: 'Bilhetes',
      valorCents: 12050,
    });
  });

  it('reports each absent required column at the header row', () => {
    const { issues } = run(
      [],
      ['Data', 'Descrição', 'Atividade', 'Rubrica', 'Tipo', 'Meio'],
    );

    expect(issues).toEqual([
      expect.objectContaining({
        code: 'missing-column',
        tab: 'Movimentos',
        row: 1,
        column: 'Valor (€)',
      }),
    ]);
  });
});
