import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { formatMoney } from '../../src/core/format.ts';
import { loadFiles } from '../../src/core/pipeline.ts';
import { paramsSchemas } from '../../src/core/reports/index.ts';
import { validateDraft } from '../../src/core/sheets/raw-params.ts';
import { readReportSheet } from '../../src/core/sheets/read-sheet.ts';
import { resolveDefaults } from '../../src/core/sheets/resolve.ts';
import { loadWorkbook, type WorkbookResult } from '../../src/core/workbook.ts';
import {
  CTX,
  V1_FIXTURE,
  V1_TEMPLATE,
  readParams,
} from '../support/report-workbook.ts';

const GENERATED_FIXTURE = 'fixtures/generated/tesouraria.xlsx';

const SHEETS = [
  ['Pegada 2026', 'pegada', 'pegada-2026'],
  ['CITADÃO 2026', 'evento', 'evento-citadao'],
  ['Zumba 2026', 'evento', 'evento-zumba'],
  ['Letivo 2025-26', 'letivo', 'letivo-2025-26'],
  ['Fiscal 2025', 'fiscal', 'fiscal-2025'],
] as const;

const SIGNATORIES = {
  'pegada-2026': [
    { cargo: 'Direção cessante', nome: 'Marta Figueiredo' },
    { cargo: 'Direção entrante', nome: 'Duarte Pinheiro' },
    { cargo: 'Conselho Fiscal', nome: 'Helena Quintela' },
  ],
} as const;

async function workbookOf(): Promise<WorkbookResult> {
  const bytes = new Uint8Array(await readFile(GENERATED_FIXTURE));
  return loadWorkbook({ name: 'tesouraria.xlsx', bytes }, CTX);
}

describe('loadWorkbook with the generated fixture, five report sheets and three dates left blank', () => {
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

  it('builds a ready report for each of the five sheets', () => {
    expect(result.reports).toHaveLength(5);
    for (const [sheet] of SHEETS) {
      const instance = result.reports.find((r) => r.sheet === sheet);
      expect(['pronto', 'pronto-com-avisos'], sheet).toContain(
        instance?.status,
      );
      expect(instance?.report, sheet).toBeDefined();
    }
  });

  it('reads from every sheet exactly the parameters the v1 schema accepts for the v1 file, derived dates included', async () => {
    const bytes = new Uint8Array(await readFile(GENERATED_FIXTURE));
    const { result: loaded, reportSheets } = await loadFiles([
      { name: 'tesouraria.xlsx', bytes },
    ]);
    const drafts = reportSheets.map((grid) =>
      readReportSheet(grid, { config: CTX.config }),
    );

    for (const [sheet, tipo, name] of SHEETS) {
      const draft = drafts.find((d) => d.sheet === sheet);
      if (draft === undefined) throw new Error(`No sheet ${sheet}`);
      const resolution = resolveDefaults(draft, drafts, loaded.dataset);

      expect(validateDraft(draft, resolution).params, sheet).toEqual({
        tipo,
        params: {
          ...paramsSchemas[tipo].parse(await readParams(name)),
          ...(name in SIGNATORIES
            ? { assinaturas: SIGNATORIES[name as keyof typeof SIGNATORIES] }
            : {}),
        },
      });
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
    expect(dateOf('CITADÃO 2026', 'Pendentes à data de')).toEqual({
      label: 'Pendentes à data de',
      text: '15 de junho de 2026',
      derivedFrom: 'data de "Contar movimentos até"',
    });
  });

  it('shows the fiscal year as a period in words', () => {
    expect(
      result.reports
        .find((r) => r.sheet === 'Fiscal 2025')
        ?.dates.find((d) => d.label === 'Ano'),
    ).toEqual({
      label: 'Ano',
      text: '2025 (1 de janeiro a 31 de dezembro de 2025)',
    });
  });

  it('orders the reports newest first and names each file', () => {
    expect(result.reports.map((r) => r.fileStem)).toEqual([
      '2026-09-30 Pegada de direção',
      '2026-08-31 Fim de ano letivo',
      '2026-06-15 Relatório de evento - 20º CITADÃO',
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

  it('flags every fictitious row of the v1 template, in all four tabs, and nothing in the v1 fixture', async () => {
    const result = await loadWorkbook(
      {
        name: 'modelo.xlsx',
        bytes: new Uint8Array(await readFile(V1_TEMPLATE)),
      },
      CTX,
    );
    const issues = result.load.issues;
    const rowsOf = (tab: string) =>
      issues
        .filter((i) => i.code === 'example-row' && i.tab === tab)
        .map((i) => i.row);

    expect(rowsOf('Movimentos')).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(rowsOf('Pendentes')).toEqual([2, 3]);
    expect(rowsOf('Orçamento')).toEqual([2, 3, 4]);
    expect(rowsOf('Géneros')).toEqual([2, 3]);
    expect(issues.filter((i) => i.code === 'example-checkpoint')).toHaveLength(
      4,
    );
    expect(result.summary).toBeNull();
  });

  it('flags no example row in the v1 fixture', async () => {
    const result = await loadWorkbook(
      {
        name: 'tesouraria.xlsx',
        bytes: new Uint8Array(await readFile(V1_FIXTURE)),
      },
      CTX,
    );

    expect(result.load.issues.map(({ code }) => code)).not.toContain(
      'example-row',
    );
  });
});
