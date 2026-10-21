import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildStarterFiles } from '../../scripts/lib/starter-files.ts';
import type { ReportTipo } from '../../src/core/reports/index.ts';
import { REPORT_TIPOS } from '../../src/core/sheets/catalogue.ts';
import { starterFileName } from '../../src/core/sheets/file-name.ts';
import { buildLayout } from '../../src/core/sheets/layout.ts';
import { loadWorkbook } from '../../src/core/workbook.ts';
import { CTX } from '../support/report-workbook.ts';
import { readFileBytes, withSheetsFrom } from '../support/xlsx-parts.ts';
import { zipEntries } from '../support/zip-entries.ts';

const STARTERS = fileURLToPath(
  new URL('../../public/folhas/', import.meta.url),
);
const TEMPLATE = 'public/modelo-tesouraria.xlsx';
const FIXTURE = 'fixtures/generated/tesouraria.xlsx';
const DATA_TABS = [
  'Instruções',
  'Listas',
  'Saldos',
  'Movimentos',
  'Pendentes',
  'Orçamento',
  'Géneros',
];

const FILLED: Readonly<
  Record<ReportTipo, Record<string, Date | string | number>>
> = {
  pegada: {
    dataUltimoRelatorio: new Date(Date.UTC(2026, 7, 31)),
    dataPassagem: new Date(Date.UTC(2026, 8, 30)),
    direcaoCessante: 'Direção 2025/26',
    direcaoEntrante: 'Direção 2026/27',
    saldoExtrato: 13265.05,
  },
  evento: {
    atividade: '20º CITADÃO',
    eventoInicio: new Date(Date.UTC(2026, 3, 30)),
    eventoFim: new Date(Date.UTC(2026, 4, 3)),
    contarAte: new Date(Date.UTC(2026, 5, 15)),
  },
  letivo: {
    inicio: new Date(Date.UTC(2026, 0, 1)),
    fim: new Date(Date.UTC(2026, 7, 31)),
  },
  fiscal: { ano: 2025 },
};

async function starterBytes(tipo: ReportTipo): Promise<Uint8Array> {
  return readFileBytes(`${STARTERS}${starterFileName(tipo)}`);
}

async function filledStarter(tipo: ReportTipo): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(`${STARTERS}${starterFileName(tipo)}`);
  const sheet = workbook.worksheets[0];
  const { valueCells } = buildLayout(tipo, CTX.config);
  for (const [key, value] of Object.entries(FILLED[tipo])) {
    const address = valueCells[key];
    if (address === undefined || sheet === undefined) throw new Error(key);
    sheet.getCell(address).value = value;
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

describe('starter sheets', () => {
  it('are the files the build script generates, and nothing else is in the folder', async () => {
    const built = await buildStarterFiles();

    for (const [name, expected] of built) {
      const committed = new Uint8Array(await readFile(`${STARTERS}${name}`));
      expect(await zipEntries(committed), name).toEqual(
        await zipEntries(expected),
      );
    }
    expect((await readdir(STARTERS)).toSorted()).toEqual(
      [...built.keys()].toSorted(),
    );
  });

  it.each(REPORT_TIPOS)(
    'the %s starter, put next to the template data tabs, is one untouched report sheet of its type',
    async (tipo) => {
      const bytes = withSheetsFrom(
        await readFileBytes(TEMPLATE),
        await starterBytes(tipo),
        { drop: (name) => name.startsWith('Modelo') },
      );

      const result = await loadWorkbook({ name: 'a.xlsx', bytes }, CTX);

      expect(result.load.issues).toEqual([]);
      expect(result.reports.map((r) => [r.tipo, r.status, r.issues])).toEqual([
        [tipo, 'por-preencher', []],
      ]);
    },
  );

  it.each(REPORT_TIPOS)(
    'the %s starter filled in the spreadsheet app gives a ready report',
    async (tipo) => {
      const bytes = withSheetsFrom(
        await readFileBytes(FIXTURE),
        await filledStarter(tipo),
        { drop: (name) => !DATA_TABS.includes(name) },
      );

      const result = await loadWorkbook({ name: 'a.xlsx', bytes }, CTX);
      const [instance] = result.reports;

      expect(result.reports).toHaveLength(1);
      expect(instance?.tipo).toBe(tipo);
      expect(['pronto', 'pronto-com-avisos']).toContain(instance?.status);
    },
  );
});
