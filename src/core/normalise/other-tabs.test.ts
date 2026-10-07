import { describe, expect, it } from 'vitest';
import { table, type Sheet } from '../../../tests/support/workbook.ts';
import type { Issue } from '../issues.ts';
import {
  normaliseGeneros,
  normaliseOrcamento,
  normalisePendentes,
  normaliseSaldos,
} from './other-tabs.ts';

const PENDENTES_HEADER = [
  'Tipo',
  'Entidade',
  'Descrição',
  'Atividade',
  'Valor (€)',
  'Data de registo',
  'Data de liquidação',
  'Notas',
];
const ORCAMENTO_HEADER = [
  'Âmbito',
  'Tipo',
  'Rubrica',
  'Sub-rubrica',
  'Orçado (€)',
];
const GENEROS_HEADER = [
  'Data',
  'Atividade',
  'Tipo',
  'Quantidade',
  'Em falta',
  'Valor estimado (€)',
];
const SALDOS_HEADER = ['Data', 'Conta', 'Saldo (€)', 'Fonte'];

function pendente(i: Partial<Record<number, string | number | null>> = {}) {
  const base = ['A receber', 'Câmara', 'Apoio', null, 300, 45935, null, null];
  return base.map((v, at) => (at in i ? (i[at] ?? null) : v));
}
function orcamento(i: Partial<Record<number, string | number | null>> = {}) {
  const base = ['Festival Alfa', 'Entrada', 'Bilheteira', 'Bilhetes', 500];
  return base.map((v, at) => (at in i ? (i[at] ?? null) : v));
}
function genero(i: Partial<Record<number, string | number | null>> = {}) {
  const base = [null, 'Festival Alfa', 'Alojamento', '4 dias', 2, 80];
  return base.map((v, at) => (at in i ? (i[at] ?? null) : v));
}
function saldo(i: Partial<Record<number, string | number | null>> = {}) {
  const base = [45930, 'Caixa', 100, 'Contagem'];
  return base.map((v, at) => (at in i ? (i[at] ?? null) : v));
}

function collect<T>(read: (issues: Issue[]) => T): {
  rows: T;
  issues: Issue[];
} {
  const issues: Issue[] = [];
  return { rows: read(issues), issues };
}

describe('normalisePendentes()', () => {
  const run = (rows: Sheet, header: readonly string[] = PENDENTES_HEADER) =>
    collect((issues) =>
      normalisePendentes([table('Pendentes', [[...header], ...rows])], issues),
    );

  it('reads a row, leaving the optional columns null', () => {
    const { rows, issues } = run([pendente({ 6: 45940, 3: 'Festival Alfa' })]);

    expect(issues).toEqual([]);
    expect(rows).toEqual([
      {
        tipo: 'A receber',
        entidade: 'Câmara',
        descricao: 'Apoio',
        atividade: 'Festival Alfa',
        valorCents: 30000,
        dataRegisto: '2025-10-05',
        dataLiquidacao: '2025-10-10',
        notas: null,
        src: { file: 'teste.xlsx', tab: 'Pendentes', row: 2 },
      },
    ]);
  });

  it.each([
    ['empty Entidade', pendente({ 1: null }), 'required-empty', 'Entidade'],
    [
      'empty Data de registo',
      pendente({ 5: null }),
      'required-empty',
      'Data de registo',
    ],
    ['unknown Tipo', pendente({ 0: 'Devido' }), 'invalid-enum', 'Tipo'],
    [
      'unparsable settlement date',
      pendente({ 6: 'breve' }),
      'invalid-date',
      'Data de liquidação',
    ],
    [
      'unparsable value',
      pendente({ 4: 'muito' }),
      'invalid-number',
      'Valor (€)',
    ],
    ['negative value', pendente({ 4: -10 }), 'non-positive-value', 'Valor (€)'],
  ])('rejects a row with %s', (_name, row, code, column) => {
    const { rows, issues } = run([row]);

    expect(rows).toEqual([]);
    expect(issues).toEqual([
      expect.objectContaining({ code, column, row: 2, tab: 'Pendentes' }),
    ]);
  });

  it('suggests the opposite Tipo for a negative value', () => {
    const { issues } = run([pendente({ 4: -10 })]);

    expect(issues[0]?.suggestion).toMatch(/A pagar.*10,00/);
  });

  it('reports a missing required column', () => {
    const { issues } = run([], ['Tipo', 'Entidade', 'Descrição', 'Valor (€)']);

    expect(issues).toEqual([
      expect.objectContaining({
        code: 'missing-column',
        column: 'Data de registo',
        row: 1,
      }),
    ]);
  });
});

describe('normaliseOrcamento()', () => {
  const run = (rows: Sheet) =>
    collect((issues) =>
      normaliseOrcamento(
        [table('Orçamento', [ORCAMENTO_HEADER, ...rows])],
        issues,
      ),
    );

  it('reads a row and resolves an empty sub-rubrica to the rubrica', () => {
    const { rows, issues } = run([orcamento(), orcamento({ 3: null })]);

    expect(issues).toEqual([]);
    expect(rows.map((r) => [r.rubrica, r.subRubrica, r.orcadoCents])).toEqual([
      ['Bilheteira', 'Bilhetes', 50000],
      ['Bilheteira', 'Bilheteira', 50000],
    ]);
  });

  it('accepts a zero budget', () => {
    const { rows } = run([orcamento({ 4: 0 })]);

    expect(rows[0]?.orcadoCents).toBe(0);
  });

  it.each([
    [
      'negative budget',
      orcamento({ 4: -1 }),
      'non-positive-value',
      'Orçado (€)',
    ],
    ['empty Âmbito', orcamento({ 0: null }), 'required-empty', 'Âmbito'],
    ['unknown Tipo', orcamento({ 1: 'Despesa' }), 'invalid-enum', 'Tipo'],
    ['empty Rubrica', orcamento({ 2: null }), 'required-empty', 'Rubrica'],
  ])('rejects a row with %s', (_name, row, code, column) => {
    const { rows, issues } = run([row]);

    expect(rows).toEqual([]);
    expect(issues).toEqual([
      expect.objectContaining({ code, column, row: 2, tab: 'Orçamento' }),
    ]);
  });
});

describe('normaliseGeneros()', () => {
  const run = (rows: Sheet) =>
    collect((issues) =>
      normaliseGeneros([table('Géneros', [GENEROS_HEADER, ...rows])], issues),
    );

  it('reads an undated row with its optional values', () => {
    const { rows, issues } = run([genero()]);

    expect(issues).toEqual([]);
    expect(rows).toEqual([
      {
        data: null,
        atividade: 'Festival Alfa',
        tipo: 'Alojamento',
        quantidade: '4 dias',
        emFalta: 2,
        valorEstimadoCents: 8000,
        src: { file: 'teste.xlsx', tab: 'Géneros', row: 2 },
      },
    ]);
  });

  it('reads a dated row and a decimal-comma count', () => {
    const { rows } = run([genero({ 0: 45930, 4: '3,5', 5: null })]);

    expect(rows[0]).toMatchObject({
      data: '2025-09-30',
      emFalta: 3.5,
      valorEstimadoCents: null,
    });
  });

  it.each([
    ['empty Atividade', genero({ 1: null }), 'required-empty', 'Atividade'],
    ['empty Tipo', genero({ 2: null }), 'required-empty', 'Tipo'],
    [
      'count that is not a number',
      genero({ 4: 'muitos' }),
      'invalid-number',
      'Em falta',
    ],
    ['negative count', genero({ 4: -1 }), 'invalid-number', 'Em falta'],
    [
      'negative estimated value',
      genero({ 5: -5 }),
      'non-positive-value',
      'Valor estimado (€)',
    ],
    ['bad date', genero({ 0: 'em breve' }), 'invalid-date', 'Data'],
  ])('rejects a row with %s', (_name, row, code, column) => {
    const { rows, issues } = run([row]);

    expect(rows).toEqual([]);
    expect(issues).toEqual([
      expect.objectContaining({ code, column, row: 2, tab: 'Géneros' }),
    ]);
  });
});

describe('normaliseSaldos()', () => {
  const run = (rows: Sheet) =>
    collect((issues) =>
      normaliseSaldos([table('Saldos', [SALDOS_HEADER, ...rows])], issues),
    );

  it('reads a checkpoint, accepting a negative balance', () => {
    const { rows, issues } = run([saldo({ 2: -25.5 })]);

    expect(issues).toEqual([]);
    expect(rows).toEqual([
      {
        data: '2025-09-30',
        conta: 'Caixa',
        saldoCents: -2550,
        fonte: 'Contagem',
        src: { file: 'teste.xlsx', tab: 'Saldos', row: 2 },
      },
    ]);
  });

  it.each([
    ['empty Data', saldo({ 0: null }), 'required-empty', 'Data'],
    ['unknown Conta', saldo({ 1: 'Cofre' }), 'invalid-enum', 'Conta'],
    ['empty Saldo', saldo({ 2: null }), 'required-empty', 'Saldo (€)'],
    ['unknown Fonte', saldo({ 3: 'Palpite' }), 'invalid-enum', 'Fonte'],
  ])('rejects a row with %s', (_name, row, code, column) => {
    const { rows, issues } = run([row]);

    expect(rows).toEqual([]);
    expect(issues).toEqual([
      expect.objectContaining({ code, column, row: 2, tab: 'Saldos' }),
    ]);
  });
});
