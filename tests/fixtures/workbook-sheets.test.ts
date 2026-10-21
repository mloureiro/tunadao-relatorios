import { describe, expect, it } from 'vitest';
import type { Issue } from '../../src/core/issues.ts';
import type { ReportTipo } from '../../src/core/reports/index.ts';
import { buildLayout } from '../../src/core/sheets/layout.ts';
import { loadWorkbook, type WorkbookResult } from '../../src/core/workbook.ts';
import { config, type TestRows } from '../support/report-sheet.ts';
import {
  CTX,
  V1_FIXTURE,
  emptySheetRows,
  sheetFrom,
  withReportSheets,
  withOnlySheets,
  withoutLabel,
} from '../support/report-workbook.ts';

type Entry = readonly [name: string, rows: TestRows];

async function load(
  entries: readonly Entry[],
  base = V1_FIXTURE,
): Promise<WorkbookResult> {
  const bytes = await withReportSheets(base, Object.fromEntries(entries));
  return loadWorkbook({ name: 'tesouraria.xlsx', bytes }, CTX);
}

const cellOf = (tipo: ReportTipo, key: string): string | undefined =>
  buildLayout(tipo, config).valueCells[key];

const instance = (result: WorkbookResult, sheet: string) => {
  const found = result.reports.find((report) => report.sheet === sheet);
  if (found === undefined) throw new Error(`No instance ${sheet}`);
  return found;
};

const codes = (issues: readonly Issue[]): string[] =>
  issues.map(({ code }) => code);

const fiscal2025 = async (name = 'Fiscal 2025'): Promise<Entry> => [
  name,
  await sheetFrom('fiscal-2025', 'fiscal'),
];

describe('derived dates', () => {
  it('takes the last day of the only earlier report for a blank pegada start', async () => {
    const result = await load([
      await fiscal2025(),
      [
        'Pegada',
        await sheetFrom('pegada-2026', 'pegada', {}, ['dataUltimoRelatorio']),
      ],
    ]);

    expect(instance(result, 'Pegada').dates[0]).toEqual({
      label: 'Data do último relatório',
      text: '31 de dezembro de 2025',
      derivedFrom: 'fim do relatório da folha "Fiscal 2025"',
    });
  });

  it('uses the latest earlier end when two pegadas precede, ignoring later ones', async () => {
    const result = await load([
      [
        'Pegada março',
        await sheetFrom('pegada-2026', 'pegada', {
          dataUltimoRelatorio: '2025-12-31',
          dataPassagem: '2026-03-31',
        }),
      ],
      [
        'Pegada setembro',
        await sheetFrom('pegada-2026', 'pegada', {}, ['dataUltimoRelatorio']),
      ],
      [
        'Pegada dezembro',
        await sheetFrom('pegada-2026', 'pegada', {
          dataUltimoRelatorio: '2026-09-30',
          dataPassagem: '2026-12-31',
        }),
      ],
    ]);

    expect(instance(result, 'Pegada setembro').dates[0]).toMatchObject({
      text: '31 de março de 2026',
      derivedFrom: 'fim do relatório da folha "Pegada março"',
    });
  });

  it('asks for the pegada start on its own cell when no earlier report exists', async () => {
    const result = await load([
      [
        'Pegada',
        await sheetFrom('pegada-2026', 'pegada', {}, ['dataUltimoRelatorio']),
      ],
    ]);

    const issues = instance(result, 'Pegada').issues;
    expect(issues).toMatchObject([
      {
        code: 'field-empty',
        cell: cellOf('pegada', 'dataUltimoRelatorio'),
        field: 'Data do último relatório',
      },
    ]);
    expect(issues[0]?.message).toContain('nenhuma outra folha de relatório');
    expect(instance(result, 'Pegada').status).toBe('com-erros');
  });

  it('starts a blank letivo the day after a fiscal report, the only earlier one', async () => {
    const result = await load([
      await fiscal2025(),
      ['Letivo', await sheetFrom('letivo-2025-26', 'letivo', {}, ['inicio'])],
    ]);

    expect(instance(result, 'Letivo').dates[0]).toMatchObject({
      text: '1 de janeiro de 2026',
      derivedFrom: 'dia seguinte ao relatório da folha "Fiscal 2025"',
    });
  });

  it('warns on the derived start when the report it came from has errors, and stays silent when that report is fine', async () => {
    const letivo: Entry = [
      'Letivo',
      await sheetFrom('letivo-2025-26', 'letivo', {}, ['inicio']),
    ];
    const broken = await load([
      [
        'Fiscal',
        await sheetFrom('fiscal-2025', 'fiscal', {
          ambitoOrcamento: 'Inexistente',
        }),
      ],
      letivo,
    ]);
    const fine = await load([await fiscal2025('Fiscal'), letivo]);

    expect(instance(broken, 'Fiscal').status).toBe('com-erros');
    expect(instance(broken, 'Letivo').status).toBe('pronto-com-avisos');
    expect(instance(broken, 'Letivo').issues).toMatchObject([
      {
        code: 'derived-from-erroneous-sheet',
        severity: 'warning',
        cell: cellOf('letivo', 'inicio'),
        field: 'Início do período',
      },
    ]);
    expect(instance(broken, 'Letivo').issues[0]?.message).toContain('"Fiscal"');
    expect(instance(fine, 'Letivo').status).toBe('pronto');
    expect(instance(fine, 'Letivo').issues).toEqual([]);
  });

  it('does not derive a letivo start from a report that ends after it', async () => {
    const result = await load([
      ['Letivo', await sheetFrom('letivo-2025-26', 'letivo', {}, ['inicio'])],
      ['Pegada', await sheetFrom('pegada-2026', 'pegada')],
    ]);

    expect(instance(result, 'Letivo').issues).toMatchObject([
      { code: 'field-empty', cell: cellOf('letivo', 'inicio') },
    ]);
  });

  it('skips a report whose own end did not parse when deriving', async () => {
    const result = await load([
      [
        'Fiscal ilegível',
        await sheetFrom('fiscal-2025', 'fiscal', { ano: 'xx' }),
      ],
      ['Letivo', await sheetFrom('letivo-2025-26', 'letivo', {}, ['inicio'])],
    ]);

    expect(instance(result, 'Letivo').issues).toMatchObject([
      { code: 'field-empty', cell: cellOf('letivo', 'inicio') },
    ]);
  });

  it.each([
    [
      { contarAte: '2026-06-15' },
      '15 de junho de 2026',
      'data de "Contar movimentos até"',
    ],
    [{}, '30 de setembro de 2026', 'data do último movimento do ficheiro'],
  ] as const)(
    'resolves a blank pending reference for %j',
    async (overrides, text, origin) => {
      const result = await load([
        [
          'Evento',
          await sheetFrom('evento-citadao', 'evento', overrides, [
            'refPendentes',
            ...('contarAte' in overrides ? [] : ['contarAte']),
          ]),
        ],
      ]);

      expect(
        instance(result, 'Evento').dates.find(
          ({ label }) => label === 'Pendentes à data de',
        ),
      ).toEqual({ label: 'Pendentes à data de', text, derivedFrom: origin });
    },
  );

  it('asks for the pending reference when the file has no movements', async () => {
    const result = await loadWorkbook(
      {
        name: 'so-folha.xlsx',
        bytes: withOnlySheets({
          Evento: await sheetFrom('evento-citadao', 'evento', {}, [
            'refPendentes',
            'contarAte',
          ]),
        }),
      },
      CTX,
    );

    expect(instance(result, 'Evento').issues).toMatchObject([
      { code: 'field-empty', cell: cellOf('evento', 'refPendentes') },
    ]);
  });

  it.each([
    [
      'only the start',
      { eventoInicio: '2026-03-14' },
      ['eventoFim'],
      'Fim do evento',
      'igual ao início do evento (evento de um dia)',
    ],
    [
      'only the end',
      { eventoFim: '2026-03-14' },
      ['eventoInicio'],
      'Início do evento',
      'igual ao fim do evento (evento de um dia)',
    ],
  ] as const)(
    'makes the event one day long when %s is given',
    async (_name, overrides, without, label, origin) => {
      const result = await load([
        [
          'Evento',
          await sheetFrom('evento-zumba', 'evento', overrides, without),
        ],
      ]);

      expect(
        instance(result, 'Evento').dates.filter(
          ({ derivedFrom }) => derivedFrom === origin,
        ),
      ).toMatchObject([{ label, text: '14 de março de 2026' }]);
      expect(instance(result, 'Evento').issues).toEqual([
        expect.objectContaining({ code: 'no-budget' }),
      ]);
    },
  );

  it('gives an event with neither date the derivation wording, also when the label row is missing', async () => {
    const rows = withoutLabel(
      await sheetFrom('evento-zumba', 'evento', {}, [
        'eventoInicio',
        'eventoFim',
      ]),
      'Fim do evento',
    );
    const result = await load([['Evento', rows]]);

    const issues = instance(result, 'Evento').issues;
    expect(codes(issues)).toEqual(['field-empty', 'field-empty']);
    expect(issues.map(({ field }) => field)).toEqual([
      'Início do evento',
      'Fim do evento',
    ]);
    expect(issues[1]?.cell).toBeUndefined();
    expect(issues[0]?.message).toContain('Indique o início e o fim do evento');
  });
});

describe('cross-sheet and reference checks', () => {
  it('rejects a typed budget with no lines on its cell and suggests the closest one', async () => {
    const result = await load([
      [
        'Letivo',
        await sheetFrom('letivo-2025-26', 'letivo', {
          ambitoOrcamento: '21º CITADÃO',
        }),
      ],
    ]);

    const { issues, status } = instance(result, 'Letivo');
    expect(status).toBe('com-erros');
    expect(issues).toMatchObject([
      {
        code: 'unknown-budget',
        severity: 'error',
        cell: cellOf('letivo', 'ambitoOrcamento'),
        field: 'Orçamento a usar',
        suggestion: 'Quis dizer "20º CITADÃO"?',
      },
    ]);
  });

  it.each([
    ['a gap', '2026-02-01', 'ficam dias sem relatório'],
    ['an overlap', '2025-12-01', 'sobrepõem-se'],
  ])(
    'warns on the start cell when it leaves %s after the previous report',
    async (_name, inicio, fragment) => {
      const result = await load([
        await fiscal2025(),
        ['Letivo', await sheetFrom('letivo-2025-26', 'letivo', { inicio })],
      ]);

      const warning = instance(result, 'Letivo').issues.find(
        ({ code }) => code === 'period-continuity',
      );
      expect(warning).toMatchObject({
        severity: 'warning',
        cell: cellOf('letivo', 'inicio'),
      });
      expect(warning?.message).toContain(fragment);
      expect(warning?.message).toContain('"Fiscal 2025"');
    },
  );

  it('checks a pegada against the previous report through its explicit last-report date', async () => {
    const result = await load([
      await fiscal2025(),
      [
        'Pegada',
        await sheetFrom('pegada-2026', 'pegada', {
          dataUltimoRelatorio: '2026-01-15',
        }),
      ],
    ]);

    expect(
      instance(result, 'Pegada').issues.find(
        ({ code }) => code === 'period-continuity',
      ),
    ).toMatchObject({ cell: cellOf('pegada', 'dataUltimoRelatorio') });
  });

  it('flags both sheets of a duplicated report on their key cells', async () => {
    const result = await load([
      await fiscal2025('Fiscal A'),
      await fiscal2025('Fiscal B'),
    ]);

    for (const [sheet, other] of [
      ['Fiscal A', 'Fiscal B'],
      ['Fiscal B', 'Fiscal A'],
    ] as const) {
      const duplicate = instance(result, sheet).issues.find(
        ({ code }) => code === 'duplicate-report',
      );
      expect(duplicate).toMatchObject({
        severity: 'warning',
        cell: cellOf('fiscal', 'ano'),
      });
      expect(duplicate?.message).toContain(`"${other}"`);
    }
  });

  it('tells two events apart by activity', async () => {
    const result = await load([
      ['Zumba', await sheetFrom('evento-zumba', 'evento')],
      ['Citadão', await sheetFrom('evento-citadao', 'evento')],
    ]);

    expect(result.reports.flatMap(({ issues }) => codes(issues))).not.toContain(
      'duplicate-report',
    );
  });

  it('warns when the report period has no movements', async () => {
    const result = await load([
      [
        'Fiscal 2031',
        await sheetFrom('fiscal-2025', 'fiscal', {
          ano: 2031,
          ambitoOrcamento: undefined,
        }),
      ],
    ]);

    expect(
      instance(result, 'Fiscal 2031').issues.find(
        ({ code }) => code === 'period-outside-data',
      ),
    ).toMatchObject({ severity: 'warning', cell: cellOf('fiscal', 'ano') });
  });

  it('warns when a pegada or a letivo ends after today', async () => {
    const result = await load([
      [
        'Letivo futuro',
        await sheetFrom('letivo-2025-26', 'letivo', {
          inicio: '2026-09-01',
          fim: '2027-08-31',
        }),
      ],
      [
        'Pegada futura',
        await sheetFrom('pegada-2026', 'pegada', {
          dataUltimoRelatorio: '2026-09-30',
          dataPassagem: '2026-12-01',
        }),
      ],
    ]);

    expect(
      instance(result, 'Letivo futuro').issues.find(
        ({ code }) => code === 'date-in-future',
      ),
    ).toMatchObject({ cell: cellOf('letivo', 'fim') });
    expect(
      instance(result, 'Pegada futura').issues.find(
        ({ code }) => code === 'date-in-future',
      ),
    ).toMatchObject({ cell: cellOf('pegada', 'dataPassagem') });
  });

  it('raises none of the checks for a consistent set of reports', async () => {
    const result = await load([
      await fiscal2025(),
      ['Letivo', await sheetFrom('letivo-2025-26', 'letivo')],
      ['Pegada', await sheetFrom('pegada-2026', 'pegada')],
    ]);

    expect(result.reports.flatMap(({ issues }) => codes(issues))).toEqual([]);
  });
});

describe('builder issues', () => {
  it('locates a reconciliation difference on the statement balance cell', async () => {
    const result = await load([
      [
        'Pegada',
        await sheetFrom('pegada-2026', 'pegada', { saldoExtrato: 13260.05 }),
      ],
    ]);

    const pegada = instance(result, 'Pegada');
    expect(pegada.status).toBe('pronto-com-avisos');
    expect(
      pegada.issues.find(({ code }) => code === 'reconciliation-difference'),
    ).toMatchObject({
      cell: cellOf('pegada', 'saldoExtrato'),
      field: 'Saldo do extrato bancário na data da passagem (€)',
    });
  });

  it('locates a cash count difference on the block title', async () => {
    const result = await load([
      [
        'Pegada',
        await sheetFrom('pegada-2026', 'pegada', { moedasPequenas: 7 }),
      ],
    ]);

    expect(
      instance(result, 'Pegada').issues.find(
        ({ code }) => code === 'cash-count-difference',
      ),
    ).toMatchObject({ field: 'Contagem de caixa', sheet: 'Pegada' });
  });

  it('locates a missing budget on the budget cell and leaves report-level issues unlocated', async () => {
    const result = await load([
      ['Zumba', await sheetFrom('evento-zumba', 'evento')],
    ]);

    const { issues } = instance(result, 'Zumba');
    expect(issues).toMatchObject([
      { code: 'no-budget', cell: cellOf('evento', 'ambitoOrcamento') },
    ]);
  });

  it('blocks an unknown activity on the activity cell', async () => {
    const result = await load([
      [
        'Evento',
        await sheetFrom('evento-zumba', 'evento', {
          atividade: 'Zumba na Canecas',
        }),
      ],
    ]);

    expect(instance(result, 'Evento')).toMatchObject({
      status: 'com-erros',
      issues: [
        {
          code: 'unknown-atividade',
          cell: cellOf('evento', 'atividade'),
        },
      ],
    });
    expect(instance(result, 'Evento').report).toBeUndefined();
  });
});

describe('statuses and ordering', () => {
  it('lists empty and unrecognised sheets last and the rest newest first', async () => {
    const unknownType = emptySheetRows('fiscal').map((row, index) =>
      index === 0 ? [row[0] ?? null, 'Balancete', row[2] ?? null] : row,
    );
    const result = await load([
      ['Modelo Fiscal', emptySheetRows('fiscal')],
      ['Tipo estranho', unknownType],
      await fiscal2025(),
      ['Letivo', await sheetFrom('letivo-2025-26', 'letivo')],
    ]);

    expect(result.reports.map(({ sheet, status }) => [sheet, status])).toEqual([
      ['Letivo', 'pronto'],
      ['Fiscal 2025', 'pronto'],
      ['Modelo Fiscal', 'por-preencher'],
      ['Tipo estranho', 'com-erros'],
    ]);
    expect(instance(result, 'Modelo Fiscal').issues).toEqual([]);
    expect(codes(instance(result, 'Tipo estranho').issues)).toEqual([
      'report-type-unknown',
    ]);
  });

  it('blocks every filled sheet on a data error without building a report', async () => {
    const result = await load(
      [
        await fiscal2025(),
        ['Modelo Fiscal', emptySheetRows('fiscal')],
        ['Letivo', await sheetFrom('letivo-2025-26', 'letivo')],
      ],
      'fixtures/generated/invalid/missing-fields.xlsx',
    );

    expect(result.summary).toBeNull();
    expect(
      result.reports.map(({ sheet, status, report }) => [
        sheet,
        status,
        report,
      ]),
    ).toEqual([
      ['Letivo', 'bloqueado-dados', undefined],
      ['Fiscal 2025', 'bloqueado-dados', undefined],
      ['Modelo Fiscal', 'por-preencher', undefined],
    ]);
  });
});
