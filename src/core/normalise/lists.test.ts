import { describe, expect, it } from 'vitest';
import { LISTAS } from '../../../tests/support/sample.ts';
import { table, type Sheet } from '../../../tests/support/workbook.ts';
import type { Issue } from '../issues.ts';
import { normaliseListas } from './lists.ts';

const HEADER = LISTAS[0] ?? [];

function read(rows: Sheet): {
  lists: ReturnType<typeof normaliseListas>;
  issues: Issue[];
} {
  const issues: Issue[] = [];
  const lists = normaliseListas([table('Listas', rows)], issues);
  return { lists, issues };
}

function row(cells: Partial<Record<number, string | null>>): (string | null)[] {
  return HEADER.map((_, at) => cells[at] ?? null);
}

describe('normaliseListas()', () => {
  it('reads the four side-by-side blocks, each in row order', () => {
    const { lists, issues } = read(LISTAS);

    expect(issues).toEqual([]);
    expect(
      lists.rubricas.map((r) => [r.rubrica, r.tipo, r.contaResultado, r.order]),
    ).toEqual([
      ['Bilheteira', 'Entrada', true, 0],
      ['Alimentação', 'Saída', true, 1],
      ['Transferências internas', null, false, 2],
    ]);
    expect(lists.subRubricas.map((s) => [s.subRubrica, s.rubrica])).toEqual([
      ['Bilhetes', 'Bilheteira'],
      ['Outros', 'Bilheteira'],
      ['Outros', 'Alimentação'],
    ]);
    expect(lists.atividades).toEqual(['Festival Alfa', 'Serenata']);
    expect(lists.meios).toEqual([
      { meio: 'Caixa', conta: 'Caixa' },
      { meio: 'Banco', conta: 'Banco' },
      { meio: 'MB Way', conta: 'Banco' },
    ]);
    expect(lists.rubricas[1]?.src).toEqual({
      file: 'teste.xlsx',
      tab: 'Listas',
      row: 3,
    });
  });

  it('accepts the same sub-rubric name under two different rubrics', () => {
    const { lists, issues } = read(LISTAS);

    expect(
      lists.subRubricas.filter((s) => s.subRubrica === 'Outros'),
    ).toHaveLength(2);
    expect(issues).toEqual([]);
  });

  it('ignores the Tipo of a rubric that does not count for the result', () => {
    const { lists, issues } = read([
      HEADER,
      row({ 0: 'Saldo inicial', 1: 'Receita', 2: 'Não' }),
    ]);

    expect(issues.filter((i) => i.code === 'invalid-enum')).toEqual([]);
    expect(lists.rubricas[0]).toMatchObject({
      tipo: null,
      contaResultado: false,
    });
  });

  it.each([
    [
      'the same rubric twice',
      [
        row({ 0: 'Bilheteira', 1: 'Entrada', 2: 'Sim' }),
        row({ 0: 'Bilheteira', 1: 'Saída', 2: 'Sim' }),
      ],
      { row: 3, column: 'Rubrica', message: /Bilheteira.*Rubricas/ },
    ],
    [
      'the same (sub-rubrica, rubrica) pair twice',
      [
        row({ 4: 'Outros', 5: 'Bilheteira' }),
        row({ 4: 'Outros', 5: 'Bilheteira' }),
      ],
      { row: 3, column: 'Sub-rubrica', message: /Outros \(Bilheteira\)/ },
    ],
    [
      'the same atividade twice',
      [row({ 7: 'Serenata' }), row({ 7: 'Serenata' })],
      { row: 3, column: 'Atividade', message: /Serenata.*Atividades/ },
    ],
    [
      'the same meio twice',
      [row({ 9: 'TPA', 10: 'Banco' }), row({ 9: 'TPA', 10: 'Caixa' })],
      { row: 3, column: 'Meio', message: /TPA.*Meios/ },
    ],
  ])('reports duplicate-listas for %s', (_name, rows, expected) => {
    const { issues } = read([HEADER, ...rows]);

    expect(issues).toEqual([
      expect.objectContaining({
        code: 'duplicate-listas',
        severity: 'error',
        tab: 'Listas',
        row: expected.row,
        column: expected.column,
        message: expect.stringMatching(expected.message) as string,
      }),
    ]);
  });

  it.each([
    [
      'Sim without a Tipo',
      row({ 0: 'Bilheteira', 2: 'Sim' }),
      'required-empty',
      'Tipo',
    ],
    [
      'an unknown Tipo',
      row({ 0: 'Bilheteira', 1: 'Lucro', 2: 'Sim' }),
      'invalid-enum',
      'Tipo',
    ],
    [
      'a missing result flag',
      row({ 0: 'Bilheteira', 1: 'Entrada' }),
      'required-empty',
      'Conta para o resultado',
    ],
    [
      'an unknown Conta',
      row({ 9: 'TPA', 10: 'Cofre' }),
      'invalid-enum',
      'Conta',
    ],
    [
      'a sub-rubrica without rubrica',
      row({ 4: 'Outros' }),
      'required-empty',
      'Rubrica',
    ],
  ])('reports %s', (_name, cells, code, column) => {
    const { issues } = read([HEADER, cells]);

    expect(issues).toEqual([
      expect.objectContaining({ code, column, row: 2, tab: 'Listas' }),
    ]);
  });

  it('reports each header of a block that is absent', () => {
    const { issues } = read([
      [
        'Rubrica',
        'Tipo',
        'Conta para o resultado',
        null,
        'Sub-rubrica',
        'Rubrica',
        null,
        'Atividade',
      ],
    ]);

    expect(issues.map((i) => [i.code, i.column, i.row])).toEqual([
      ['missing-column', 'Meios: Meio', 1],
      ['missing-column', 'Meios: Conta', 1],
    ]);
  });

  it('reports a block whose second header is absent', () => {
    const { issues } = read([
      [
        'Rubrica',
        'Tipo',
        'Conta para o resultado',
        'Sub-rubrica',
        null,
        'Atividade',
        'Meio',
      ],
    ]);

    expect(issues.map((i) => [i.code, i.column])).toEqual([
      ['missing-column', 'Rubrica'],
      ['missing-column', 'Conta'],
    ]);
  });
});
