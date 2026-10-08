import { describe, expect, it, vi } from 'vitest';
import { emptyDataset, mov, saldo } from '../../tests/support/dataset.ts';
import { CONFIG } from '../../tests/support/reports.ts';
import { eventFigures, periodFigures } from './calc/index.ts';
import { makeIssue } from './issues.ts';
import { buildReport, type LoadResult } from './pipeline.ts';
import {
  eventoParamsSchema,
  fiscalParamsSchema,
  letivoParamsSchema,
  pegadaParamsSchema,
  type ParamsByTipo,
  type ReportTipo,
} from './reports/index.ts';

vi.mock('./calc/index.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./calc/index.ts')>();
  return {
    ...actual,
    periodFigures: vi.fn(actual.periodFigures),
    eventFigures: vi.fn(actual.eventFigures),
  };
});

const ctx = {
  config: CONFIG,
  now: '2026-10-07T12:00:00',
  generatorVersion: '9.9.9',
};

const dataset = emptyDataset({
  sources: [{ name: 'tesouraria.xlsx', sha256: 'ab'.repeat(32) }],
  saldos: [
    saldo('2024-12-31', 10000, 'Caixa'),
    saldo('2024-12-31', 50000, 'Banco'),
  ],
  movimentos: [
    mov({ data: '2025-05-01', cents: 8000 }),
    mov({ data: '2025-05-02', cents: 2000, tipo: 'Saída' }),
    mov({ data: '2025-09-02', cents: 1500 }),
  ],
});

const loaded = (overrides: Partial<LoadResult> = {}): LoadResult => ({
  dataset,
  issues: [],
  unresolved: [],
  ...overrides,
});

const letivo = letivoParamsSchema.parse({
  inicio: '2025-01-01',
  fim: '2025-12-31',
});

const PARAMS: { [T in ReportTipo]: ParamsByTipo[T] } = {
  evento: eventoParamsSchema.parse({
    atividade: 'Festival Alfa',
    eventoInicio: '2025-05-01',
    eventoFim: '2025-05-02',
    refPendentes: '2025-05-03',
  }),
  pegada: pegadaParamsSchema.parse({
    dataUltimoRelatorio: '2025-08-31',
    dataPassagem: '2025-09-30',
    direcaoCessante: 'Direção A',
    direcaoEntrante: 'Direção B',
    saldoExtrato: 0,
  }),
  letivo,
  fiscal: fiscalParamsSchema.parse({ ano: 2025 }),
};

describe('buildReport()', () => {
  it('returns the load errors and no report, without calling any calculator', () => {
    const conflict = makeIssue(
      'checkpoint-conflict',
      'Dois saldos de Banco em 31/12/2024 discordam.',
    );
    vi.mocked(periodFigures).mockClear();

    const result = buildReport(
      'letivo',
      loaded({ issues: [makeIssue('sub-cent', 'aviso'), conflict] }),
      letivo,
      ctx,
    );

    expect(result.status).toBe('blocked');
    expect('issues' in result && result.issues).toContain(conflict);
    expect(periodFigures).not.toHaveBeenCalled();
  });

  it('blocks an event whose activity is not in Listas, suggesting the closest one, before any calculator runs', () => {
    vi.mocked(eventFigures).mockClear();
    const withLists = loaded({
      dataset: emptyDataset({
        ...dataset,
        lists: { ...dataset.lists, atividades: ['Festival Alfa'] },
      }),
    });

    const result = buildReport(
      'evento',
      withLists,
      eventoParamsSchema.parse({
        atividade: 'Festival Alpha',
        eventoInicio: '2025-05-01',
        eventoFim: '2025-05-02',
        refPendentes: '2025-05-03',
      }),
      ctx,
    );

    expect(result.status).toBe('blocked');
    expect(result.status === 'blocked' && result.issues).toMatchObject([
      {
        code: 'unknown-atividade',
        severity: 'error',
        suggestion: 'Quis dizer "Festival Alfa"?',
      },
    ]);
    expect(eventFigures).not.toHaveBeenCalled();
  });

  it('builds the report when the load result has warnings only', () => {
    const result = buildReport(
      'letivo',
      loaded({ issues: [makeIssue('sub-cent', 'aviso')] }),
      letivo,
      ctx,
    );

    expect(result.status).toBe('report');
    expect(result.status === 'report' && result.report.tipo).toBe('letivo');
  });

  it('returns no report when a calculator raises an error, such as a missing opening balance', () => {
    const result = buildReport(
      'letivo',
      loaded({ dataset: emptyDataset({ movimentos: dataset.movimentos }) }),
      letivo,
      ctx,
    );

    expect(result.status).toBe('blocked');
    expect(
      'issues' in result && result.issues.map((issue) => issue.code),
    ).toContain('missing-opening-balance');
  });

  it('reports report-time warnings next to the report', () => {
    const result = buildReport('letivo', loaded(), letivo, ctx);

    expect(
      result.status === 'report' && result.issues.map((i) => i.code),
    ).toEqual(['no-previous-data']);
  });

  it('turns an Error thrown by a calculator into a generation failure instead of letting it escape', () => {
    const broken = emptyDataset({
      saldos: [
        saldo('2024-12-31', 1000, 'Caixa'),
        saldo('2024-12-31', 1000, 'Banco'),
        saldo('2025-06-30', 99999, 'Caixa'),
      ],
      movimentos: [mov({ data: '2025-03-01', cents: 500 })],
    });

    const result = buildReport(
      'letivo',
      loaded({ dataset: broken }),
      letivo,
      ctx,
    );

    expect(result.status).toBe('failure');
    expect(result.status === 'failure' && result.message).toContain(
      'Balance bridge does not close',
    );
  });

  it('turns a thrown non-Error value into a generation failure too', () => {
    vi.mocked(periodFigures).mockImplementationOnce(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'falha estranha';
    });

    expect(buildReport('letivo', loaded(), letivo, ctx)).toEqual({
      status: 'failure',
      message: 'falha estranha',
    });
  });
});

describe.each(['evento', 'pegada', 'letivo', 'fiscal'] as const)(
  'the %s report envelope',
  (tipo) => {
    const build = (extra: Partial<typeof ctx> = {}) =>
      buildReport(tipo, loaded(), PARAMS[tipo], { ...ctx, ...extra });

    it('carries the identity, theme, signature titles and trace from config and context', () => {
      const result = build();

      if (result.status !== 'report') throw new Error(result.status);
      const { report } = result;
      expect(report).toMatchObject({
        schemaVersion: 1,
        tipo,
        theme: CONFIG.theme,
        trace: {
          generatedAt: '2026-10-07T12:00:00',
          generatedAtLabel: '07/10/2026 12:00',
          sources: [{ name: 'tesouraria.xlsx', sha256Short: 'abababababab' }],
          generatorVersion: '9.9.9',
          attachReport: true,
        },
      });
      expect(report.header.org).toBe(CONFIG.org.name);
      expect(report.header.subtitle).toBe(CONFIG.org.subtitle);
      expect(report.signatures.map((line) => line.title)).toEqual(
        CONFIG.signatures[tipo],
      );
      expect(Object.keys(report.header).toSorted()).toEqual(
        expect.not.arrayContaining(['code', 'codigo']),
      );
    });

    it('always carries the commitments block, saying so when a side is empty', () => {
      const result = build();

      if (result.status !== 'report') throw new Error(result.status);
      const pending = result.report.sections.find((s) => s.kind === 'pending');
      expect(pending?.kind === 'pending' && pending.title).toMatch(
        /^Direitos e compromissos/,
      );
      expect(pending).toMatchObject({
        emptyReceber: 'Nada a receber',
        emptyPagar: 'Nada a pagar',
        totals: {
          receber: { cents: 0, text: '0,00\u00A0€' },
          pagar: { cents: 0, text: '0,00\u00A0€' },
        },
      });
    });

    it('produces byte-identical JSON for the same inputs and clock', () => {
      expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
    });
  },
);

describe('the report JSON attachment flag', () => {
  it('follows anexarJson', () => {
    const result = buildReport(
      'fiscal',
      loaded(),
      fiscalParamsSchema.parse({ ano: 2025, anexarJson: false }),
      ctx,
    );

    expect(result.status === 'report' && result.report.trace.attachReport).toBe(
      false,
    );
  });
});
