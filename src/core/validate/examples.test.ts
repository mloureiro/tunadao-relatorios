import { describe, expect, it } from 'vitest';
import { emptyDataset, saldo } from '../../../tests/support/dataset.ts';
import { table } from '../../../tests/support/workbook.ts';
import type { Checkpoint, Conta, FonteSaldo } from '../dataset/types.ts';
import { exampleCheckpointIssues, exampleRowIssues } from './examples.ts';

const MOVIMENTOS_HEADER = ['Data', 'Descrição', 'Valor (€)'];

describe('exampleRowIssues()', () => {
  it('flags a row whose text carries the marker, ignoring case and accents', () => {
    const issues = exampleRowIssues([
      table('Movimentos', [
        MOVIMENTOS_HEADER,
        [45930, 'Inscrições (EXEMPLO FICTICIO)', 10],
        [45931, 'Bilhetes', 12],
        [45932, 'Som (exemplo fictício)', 30],
      ]),
    ]);

    expect(issues).toEqual([
      expect.objectContaining({
        code: 'example-row',
        severity: 'error',
        tab: 'Movimentos',
        row: 2,
        column: 'Descrição',
      }),
      expect.objectContaining({ row: 4 }),
    ]);
  });

  it.each(['Pendentes', 'Orçamento', 'Géneros'] as const)(
    'also checks the %s tab',
    (tab) => {
      const issues = exampleRowIssues([
        table(tab, [['Texto'], ['Linha (exemplo fictício)']]),
      ]);

      expect(issues).toMatchObject([{ code: 'example-row', tab, row: 2 }]);
    },
  );

  it('leaves Listas and Saldos alone', () => {
    expect(
      exampleRowIssues([
        table('Listas', [['Atividade'], ['Festa (exemplo fictício)']]),
        table('Saldos', [['Fonte'], ['exemplo fictício']]),
      ]),
    ).toEqual([]);
  });

  it('flags the v1 example rows that carry no marker, matching date, description and amount exactly', () => {
    const issues = exampleRowIssues([
      table('Movimentos', [
        MOVIMENTOS_HEADER,
        [46075, 'Depósito de numerário (saída da caixa)', 100],
        [46075, 'Depósito de numerário (saída da caixa)', 100.5],
        [46075, 'Depósito de numerário', 100],
        [46103, 'Depósito de numerário (saída da caixa)', 100],
        ['22/02/2026', 'Depósito de numerário (entrada no banco)', '100,00 €'],
      ]),
      table('Pendentes', [
        ['Entidade', 'Valor (€)'],
        ['Gráfica Exemplo', '180,00 €'],
        ['Gráfica Exemplo', 181],
      ]),
      table('Orçamento', [
        ['Âmbito', 'Tipo', 'Rubrica', 'Sub-rubrica', 'Orçado (€)'],
        ['2026', 'Saída', 'Comunicação e gráfica', null, 200],
        ['2027', 'Saída', 'Comunicação e gráfica', null, 200],
        ['2026', 'Entrada', 'Comunicação e gráfica', null, 200],
        [
          '2026',
          'Saída',
          'Comunicação e gráfica',
          'Cartazes e impressões',
          200,
        ],
      ]),
      table('Géneros', [
        ['Atividade', 'Tipo'],
        ['Festivais', 'Cartazes oferecidos (exemplo)'],
        ['Festivais', 'Cartazes'],
      ]),
    ]);

    expect(issues.map(({ tab, row }) => [tab, row])).toEqual([
      ['Movimentos', 2],
      ['Movimentos', 6],
      ['Pendentes', 2],
      ['Orçamento', 2],
      ['Géneros', 2],
    ]);
  });
});

const checkpoint = (
  data: string,
  cents: number,
  conta: Conta,
  fonte: FonteSaldo,
): Checkpoint => ({ ...saldo(data, cents, conta), fonte });

describe('exampleCheckpointIssues()', () => {
  it('warns for each row equal in date, account, balance and source to a v1 example', () => {
    const issues = exampleCheckpointIssues(
      emptyDataset({
        saldos: [
          checkpoint('2026-01-31', 15000, 'Caixa', 'Contagem'),
          checkpoint('2026-02-28', 308550, 'Banco', 'Extrato'),
        ],
      }),
    );

    expect(issues).toMatchObject([
      { code: 'example-checkpoint', severity: 'warning', tab: 'Saldos' },
      { code: 'example-checkpoint' },
    ]);
  });

  it.each<[string, Checkpoint]>([
    ['another date', checkpoint('2026-01-30', 15000, 'Caixa', 'Contagem')],
    ['another amount', checkpoint('2026-01-31', 15001, 'Caixa', 'Contagem')],
    ['another account', checkpoint('2026-01-31', 15000, 'Banco', 'Contagem')],
    ['another source', checkpoint('2026-01-31', 15000, 'Caixa', 'Declarado')],
  ])('does not warn for a row with %s', (_name, row) => {
    expect(exampleCheckpointIssues(emptyDataset({ saldos: [row] }))).toEqual(
      [],
    );
  });
});
