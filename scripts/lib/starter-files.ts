import { REPORT_TIPOS } from '../../src/core/sheets/catalogue.ts';
import type { ReportTipo } from '../../src/core/reports/index.ts';
import { writeReportSheet } from './report-sheet-writer.ts';
import { loadProjectConfig, newWorkbook } from './workbook-writer.ts';

const STARTER_SHEET_NAMES: Readonly<Record<ReportTipo, string>> = {
  pegada: 'Pegada',
  evento: 'Evento',
  letivo: 'Fim de ano letivo',
  fiscal: 'Fim de ano fiscal',
};

export function starterFileName(tipo: ReportTipo): string {
  return `folha-${tipo}.xlsx`;
}

export async function buildStarterFiles(): Promise<Map<string, Uint8Array>> {
  const config = await loadProjectConfig();
  const files = new Map<string, Uint8Array>();
  for (const tipo of REPORT_TIPOS) {
    const workbook = newWorkbook();
    writeReportSheet(
      workbook,
      { tipo, name: STARTER_SHEET_NAMES[tipo] },
      { config },
    );
    files.set(
      starterFileName(tipo),
      new Uint8Array(await workbook.xlsx.writeBuffer()),
    );
  }
  return files;
}
