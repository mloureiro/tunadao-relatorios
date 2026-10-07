import { describe, expect, it } from 'vitest';
import {
  emptyDataset,
  mov,
  pendente,
  saldo,
} from '../../../tests/support/dataset.ts';
import type { Dataset } from '../dataset/types.ts';
import type { IssueCode } from '../issues.ts';
import type { UnresolvedMovimento } from '../normalise/movimentos.ts';
import { validateDataset } from './index.ts';

function codes(dataset: Dataset, unresolved: UnresolvedMovimento[] = []) {
  return validateDataset(dataset, unresolved).map((issue) => issue.code);
}

const clean = emptyDataset({
  movimentos: [mov({ data: '2025-01-10', cents: 1000, descricao: 'Bilhetes' })],
  pendentes: [pendente({ dataLiquidacao: '2025-03-02' })],
});

describe('validateDataset()', () => {
  it('reports nothing for a clean dataset', () => {
    expect(validateDataset(clean, [])).toEqual([]);
  });

  describe.each<[IssueCode, Dataset]>([
    [
      'unknown-rubrica',
      emptyDataset({
        movimentos: [mov({ data: '2025-01-10', cents: 1, rubrica: 'Outra' })],
      }),
    ],
    [
      'unknown-atividade',
      emptyDataset({
        movimentos: [
          mov({ data: '2025-01-10', cents: 1, atividade: 'Desconhecida' }),
        ],
      }),
    ],
    [
      'probable-duplicate',
      emptyDataset({
        movimentos: [
          mov({ data: '2025-01-10', cents: 1 }),
          mov({ data: '2025-01-10', cents: 1 }),
        ],
      }),
    ],
    [
      'transfer-unbalanced',
      emptyDataset({
        movimentos: [
          mov({
            data: '2025-01-10',
            cents: 1,
            rubrica: 'Transferências internas',
          }),
        ],
      }),
    ],
    [
      'settled-before-registered',
      emptyDataset({
        pendentes: [pendente({ dataLiquidacao: '2025-02-28' })],
      }),
    ],
    [
      'checkpoint-conflict',
      emptyDataset({
        saldos: [saldo('2025-01-10', 1), saldo('2025-01-10', 2)],
      }),
    ],
    [
      'checkpoint-mismatch',
      emptyDataset({
        saldos: [saldo('2025-01-10', 1), saldo('2025-01-11', 2)],
      }),
    ],
    [
      'negative-balance',
      emptyDataset({
        saldos: [saldo('2025-01-10', 1)],
        movimentos: [mov({ data: '2025-01-11', cents: 5, tipo: 'Saída' })],
      }),
    ],
  ])('%s', (code, dirty) => {
    it('fires on the minimal dataset', () => {
      expect(codes(dirty)).toContain(code);
    });
  });

  describe('clean twins', () => {
    it.each<[string, Dataset]>([
      [
        'a duplicate-looking pair that differs in value',
        emptyDataset({
          movimentos: [
            mov({ data: '2025-01-10', cents: 1 }),
            mov({ data: '2025-01-10', cents: 2 }),
          ],
        }),
      ],
      [
        'a balanced transfer pair',
        emptyDataset({
          movimentos: [
            mov({
              data: '2025-01-10',
              cents: 1,
              tipo: 'Saída',
              conta: 'Caixa',
              rubrica: 'Transferências internas',
              doc: 'T1',
            }),
            mov({
              data: '2025-01-11',
              cents: 1,
              conta: 'Banco',
              rubrica: 'Transferências internas',
              doc: 'T1',
            }),
          ],
        }),
      ],
      [
        'a pendente settled on the day it was registered',
        emptyDataset({
          pendentes: [pendente({ dataLiquidacao: '2025-03-01' })],
        }),
      ],
      [
        'a balance that stays positive and matches its checkpoints',
        emptyDataset({
          saldos: [saldo('2025-01-10', 10), saldo('2025-01-11', 5)],
          movimentos: [mov({ data: '2025-01-11', cents: 5, tipo: 'Saída' })],
        }),
      ],
      [
        'an empty sub-rubrica',
        emptyDataset({
          movimentos: [mov({ data: '2025-01-10', cents: 1 })],
        }),
      ],
    ])('stays silent for %s', (_name, dataset) => {
      expect(validateDataset(dataset, [])).toEqual([]);
    });
  });

  describe('probable-duplicate', () => {
    it('points each later row at the first and ignores description case and accents', () => {
      const dataset = emptyDataset({
        movimentos: [
          mov({ data: '2025-01-10', cents: 1, descricao: 'Café', row: 4 }),
          mov({ data: '2025-01-10', cents: 1, descricao: 'CAFE ', row: 7 }),
          mov({ data: '2025-01-10', cents: 1, descricao: 'cafe', row: 9 }),
        ],
      });

      const issues = validateDataset(dataset, []);

      expect(issues.map((issue) => issue.row)).toEqual([7, 9]);
      expect(issues.every((issue) => issue.message.includes('linha 4'))).toBe(
        true,
      );
      expect(issues.every((issue) => issue.severity === 'warning')).toBe(true);
    });

    it('treats a different tipo as a different movement', () => {
      const dataset = emptyDataset({
        movimentos: [
          mov({ data: '2025-01-10', cents: 1 }),
          mov({ data: '2025-01-10', cents: 1, tipo: 'Saída' }),
        ],
      });

      expect(codes(dataset)).toEqual([]);
    });
  });

  describe('transfer-unbalanced', () => {
    it('groups by N.º doc when present, across dates', () => {
      const dataset = emptyDataset({
        movimentos: [
          mov({
            data: '2025-01-10',
            cents: 100,
            tipo: 'Saída',
            rubrica: 'Transferências internas',
            doc: 'T1',
            row: 2,
          }),
          mov({
            data: '2025-01-12',
            cents: 90,
            conta: 'Banco',
            rubrica: 'Transferências internas',
            doc: 'T1',
            row: 3,
          }),
        ],
      });

      const issues = validateDataset(dataset, []);

      expect(issues.map((issue) => [issue.code, issue.row])).toEqual([
        ['transfer-unbalanced', 2],
        ['transfer-unbalanced', 3],
      ]);
    });

    it('groups by date when there is no N.º doc', () => {
      const pair = (secondDate: string) =>
        emptyDataset({
          movimentos: [
            mov({
              data: '2025-01-10',
              cents: 100,
              tipo: 'Saída',
              rubrica: 'Transferências internas',
            }),
            mov({
              data: secondDate,
              cents: 100,
              conta: 'Banco',
              rubrica: 'Transferências internas',
            }),
          ],
        });

      expect(codes(pair('2025-01-10'))).toEqual([]);
      expect(codes(pair('2025-01-11'))).toEqual([
        'transfer-unbalanced',
        'transfer-unbalanced',
      ]);
    });
  });

  describe('non-result rubrics other than internal transfers', () => {
    const opening = mov({
      data: '2025-01-10',
      cents: 3000,
      rubrica: 'Saldo inicial',
      row: 5,
    });

    it('warns on the row and does not treat it as an unbalanced transfer', () => {
      const issues = validateDataset(
        emptyDataset({ movimentos: [opening] }),
        [],
      );

      expect(issues).toMatchObject([
        { severity: 'warning', code: 'non-result-row', row: 5 },
      ]);
    });

    it('does not pull the row into a balanced transfer group of the same day', () => {
      const dataset = emptyDataset({
        movimentos: [
          mov({
            data: '2025-01-10',
            cents: 100,
            tipo: 'Saída',
            rubrica: 'Transferências internas',
          }),
          mov({
            data: '2025-01-10',
            cents: 100,
            conta: 'Banco',
            rubrica: 'Transferências internas',
          }),
          opening,
        ],
      });

      expect(codes(dataset)).toEqual(['non-result-row']);
    });
  });

  describe('Listas membership', () => {
    it('suggests the closest rubrica without correcting it', () => {
      const dataset = emptyDataset({
        movimentos: [
          mov({ data: '2025-01-10', cents: 1, rubrica: 'Licencas e SPA' }),
        ],
      });

      expect(validateDataset(dataset, [])).toMatchObject([
        {
          severity: 'error',
          code: 'unknown-rubrica',
          tab: 'Movimentos',
          column: 'Rubrica',
          suggestion: 'Licenças e SPA',
        },
      ]);
    });

    it('rejects a sub-rubrica that is not listed under its rubrica and names the rubrica that has it', () => {
      const dataset = emptyDataset({
        movimentos: [
          mov({
            data: '2025-01-10',
            cents: 1,
            rubrica: 'Bilheteira',
            subRubrica: 'Outros',
          }),
        ],
      });

      const [issue, ...rest] = validateDataset(dataset, []);

      expect(rest).toEqual([]);
      expect(issue).toMatchObject({
        code: 'unknown-rubrica',
        column: 'Sub-rubrica',
      });
      expect(issue?.suggestion).toContain('Licenças e SPA');
    });

    it('suggests the closest sub-rubrica of the same rubrica', () => {
      const dataset = emptyDataset({
        orcamento: [
          {
            ambito: '2025',
            tipo: 'Entrada',
            rubrica: 'Bilheteira',
            subRubrica: 'Bilhetess',
            orcadoCents: 1,
            src: { file: 'a.xlsx', tab: 'Orçamento', row: 2 },
          },
        ],
      });

      expect(validateDataset(dataset, [])).toMatchObject([
        { code: 'unknown-rubrica', suggestion: 'Bilhetes' },
      ]);
    });

    it('rejects a budget line whose tipo contradicts its rubrica', () => {
      const dataset = emptyDataset({
        orcamento: [
          {
            ambito: '2025',
            tipo: 'Saída',
            rubrica: 'Bilheteira',
            subRubrica: 'Bilheteira',
            orcadoCents: 1,
            src: { file: 'a.xlsx', tab: 'Orçamento', row: 2 },
          },
        ],
      });

      expect(validateDataset(dataset, [])).toMatchObject([
        {
          code: 'budget-tipo-mismatch',
          tab: 'Orçamento',
          column: 'Tipo',
          suggestion: 'Entrada',
        },
      ]);
    });

    it('checks the atividade of Pendentes (when present) and Géneros', () => {
      const dataset = emptyDataset({
        pendentes: [
          pendente({ atividade: null }),
          pendente({ atividade: 'Serenatta' }),
        ],
        generos: [
          {
            data: null,
            atividade: 'Festival Alfa',
            tipo: 'Vinho',
            quantidade: null,
            emFalta: null,
            valorEstimadoCents: null,
            src: { file: 'a.xlsx', tab: 'Géneros', row: 2 },
          },
          {
            data: null,
            atividade: 'Outra',
            tipo: 'Vinho',
            quantidade: null,
            emFalta: null,
            valorEstimadoCents: null,
            src: { file: 'a.xlsx', tab: 'Géneros', row: 3 },
          },
        ],
      });

      expect(validateDataset(dataset, [])).toMatchObject([
        { code: 'unknown-atividade', tab: 'Pendentes', suggestion: 'Serenata' },
        { code: 'unknown-atividade', tab: 'Géneros', row: 3 },
      ]);
    });

    it('rejects a Sub-rubricas row whose Rubrica is not in Rubricas', () => {
      const base = emptyDataset();
      const dataset = emptyDataset({
        lists: {
          ...base.lists,
          subRubricas: [
            ...base.lists.subRubricas,
            {
              subRubrica: 'Extra',
              rubrica: 'Bilheteiraa',
              order: 2,
              src: { file: 'a.xlsx', tab: 'Listas', row: 9 },
            },
          ],
        },
      });

      expect(validateDataset(dataset, [])).toMatchObject([
        {
          code: 'unknown-rubrica',
          tab: 'Listas',
          row: 9,
          suggestion: 'Bilheteira',
        },
      ]);
    });
  });

  describe('unresolved movements', () => {
    const src = { file: 'a.xlsx', tab: 'Movimentos' as const, row: 6 };
    const entry = (
      overrides: Partial<UnresolvedMovimento>,
    ): UnresolvedMovimento => ({
      src,
      rubrica: 'Bilheteira',
      subRubrica: null,
      meio: 'Caixa',
      atividade: 'Festival Alfa',
      unknownRubrica: false,
      unknownMeio: false,
      ...overrides,
    });

    it('reports rubrica, meio and atividade together, each with its row', () => {
      const issues = validateDataset(emptyDataset(), [
        entry({
          rubrica: 'Licencas e SPA',
          meio: 'Bancoo',
          atividade: 'Serenatta',
          unknownRubrica: true,
          unknownMeio: true,
        }),
      ]);

      expect(
        issues.map((issue) => [issue.code, issue.row, issue.suggestion]),
      ).toEqual([
        ['unknown-rubrica', 6, 'Licenças e SPA'],
        ['unknown-atividade', 6, 'Serenata'],
        ['unknown-meio', 6, 'Banco'],
      ]);
    });

    it('reports an unresolved row whose only fault is a bad sub-rubrica pair', () => {
      const issues = validateDataset(emptyDataset(), [
        entry({ subRubrica: 'Bilhetess', unknownRubrica: true }),
      ]);

      expect(issues).toMatchObject([
        {
          code: 'unknown-rubrica',
          column: 'Sub-rubrica',
          suggestion: 'Bilhetes',
        },
      ]);
    });
  });
});
