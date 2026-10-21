import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { formatMoney } from '../../src/core/format.ts';
import type { ReportJson } from '../../src/core/reports/index.ts';
import { loadWorkbook, type WorkbookResult } from '../../src/core/workbook.ts';
import {
  CTX,
  V1_FIXTURE,
  V1_TEMPLATE,
  readParams,
  sheetRows,
  withReportSheets,
} from '../support/report-workbook.ts';
import type { TestRows } from '../support/report-sheet.ts';

const SHEETS = [
  ['Pegada 2026', 'pegada', 'pegada-2026', ['dataUltimoRelatorio']],
  ['Evento CITADÃO', 'evento', 'evento-citadao', ['refPendentes']],
  ['Evento Zumba', 'evento', 'evento-zumba', []],
  ['Letivo 2025-26', 'letivo', 'letivo-2025-26', ['inicio']],
  ['Fiscal 2025', 'fiscal', 'fiscal-2025', []],
] as const;

function withoutHashes(report: ReportJson): unknown {
  return {
    ...report,
    trace: {
      ...report.trace,
      sources: report.trace.sources.map(({ name }) => ({ name })),
    },
  };
}

async function workbookOf(): Promise<WorkbookResult> {
  const sheets: Record<string, TestRows> = {};
  for (const [sheet, tipo, name, blank] of SHEETS) {
    sheets[sheet] = sheetRows(tipo, await readParams(name), blank);
  }
  const bytes = await withReportSheets(V1_FIXTURE, sheets);
  return loadWorkbook({ name: 'tesouraria.xlsx', bytes }, CTX);
}

describe('loadWorkbook with the five v1 report sheets and three dates left blank', () => {
  let result: WorkbookResult;
  beforeAll(async () => {
    result = await workbookOf();
  });

  it('loads the data tabs with no errors and summarises them', () => {
    expect(result.load.issues.filter((i) => i.severity === 'error')).toEqual(
      [],
    );
    expect(result.summary?.movimentos).toBeGreaterThan(0);
    expect(result.summary).toMatchObject({
      firstDate: '2024-02-10',
      lastDate: '2026-09-30',
    });
  });

  it('builds five ready reports that match the committed v1 examples', async () => {
    expect(result.reports).toHaveLength(5);
    for (const [sheet, , name] of SHEETS) {
      const instance = result.reports.find((r) => r.sheet === sheet);
      expect(['pronto', 'pronto-com-avisos'], sheet).toContain(
        instance?.status,
      );
      const expected = JSON.parse(
        await readFile(`fixtures/v1/examples/${name}.json`, 'utf8'),
      ) as ReportJson;
      const built = instance?.report;
      if (built === undefined) throw new Error(`${sheet} has no report`);
      expect(withoutHashes(built), sheet).toEqual(withoutHashes(expected));
    }
  });

  it('derives the three blank dates and shows where each came from', () => {
    const dateOf = (sheet: string, label: string) =>
      result.reports
        .find((r) => r.sheet === sheet)
        ?.dates.find((d) => d.label === label);

    expect(dateOf('Letivo 2025-26', 'Início do período')).toEqual({
      label: 'Início do período',
      text: '1 de janeiro de 2026',
      derivedFrom: 'dia seguinte ao relatório da folha "Fiscal 2025"',
    });
    expect(dateOf('Pegada 2026', 'Data do último relatório')).toEqual({
      label: 'Data do último relatório',
      text: '31 de agosto de 2026',
      derivedFrom: 'fim do relatório da folha "Letivo 2025-26"',
    });
    expect(dateOf('Evento CITADÃO', 'Pendentes à data de')).toEqual({
      label: 'Pendentes à data de',
      text: '15 de junho de 2026',
      derivedFrom: 'data de "Contar movimentos até"',
    });
  });

  it('orders the reports newest first and names each file', () => {
    expect(result.reports.map((r) => r.fileStem)).toEqual([
      '2026-09-30 Pegada de direção',
      '2026-08-31 Fim de ano letivo',
      '2026-05-03 Relatório de evento - 20º CITADÃO',
      '2026-03-14 Relatório de evento - Zumba na Caneca',
      '2025-12-31 Fim de ano fiscal 2025',
    ]);
  });

  it('copies the key figures from the report and adds the pegada differences', () => {
    const pegada = result.reports.find((r) => r.tipo === 'pegada');
    const kpis = pegada?.report?.sections.find((s) => s.kind === 'kpis');

    expect(pegada?.keyFigures.slice(0, -2)).toEqual(
      kpis?.cards.map(({ label, value }) => ({ label, value })),
    );
    expect(pegada?.keyFigures.slice(-2).map(({ label }) => label)).toEqual([
      'Diferença na reconciliação bancária',
      'Diferença na contagem de caixa',
    ]);
    expect(pegada?.keyFigures.slice(-2).map(({ value }) => value)).toEqual([
      formatMoney(0),
      formatMoney(0),
    ]);
  });

  it('offers the next pegada and the next letivo from the latest ready reports', () => {
    expect(result.starters).toEqual([
      {
        tipo: 'pegada',
        fileName: 'folha-proxima-pegada.xlsx',
        values: {
          dataUltimoRelatorio: '2026-09-30',
          direcaoCessante: 'Direção 2026/27',
        },
      },
      {
        tipo: 'letivo',
        fileName: 'folha-proximo-letivo.xlsx',
        values: { inicio: '2026-10-01' },
      },
    ]);
  });
});

describe('data tab shipped with v1', () => {
  it('loads the v1 fixture with zero errors and no report instances', async () => {
    const result = await loadWorkbook(
      {
        name: 'tesouraria.xlsx',
        bytes: new Uint8Array(await readFile(V1_FIXTURE)),
      },
      CTX,
    );

    expect(result.load.issues.filter((i) => i.severity === 'error')).toEqual(
      [],
    );
    expect(result.reports).toEqual([]);
    expect(result.starters).toEqual([]);
  });

  it('flags every example row and example checkpoint of the v1 template', async () => {
    const result = await loadWorkbook(
      {
        name: 'modelo.xlsx',
        bytes: new Uint8Array(await readFile(V1_TEMPLATE)),
      },
      CTX,
    );
    const issues = result.load.issues;

    expect(issues.filter((i) => i.code === 'example-row')).toHaveLength(6);
    expect(
      issues.filter((i) => i.code === 'example-row').map((i) => i.row),
    ).toEqual([2, 3, 4, 5, 6, 7]);
    expect(issues.filter((i) => i.code === 'example-checkpoint')).toHaveLength(
      4,
    );
    expect(result.summary).toBeNull();
  });
});
