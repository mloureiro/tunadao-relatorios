import { REPORT_SPECS, REPORT_TIPOS } from '../../src/core/sheets/catalogue.ts';
import { starterFileName } from '../../src/core/sheets/file-name.ts';
import { writeReportSheet } from './report-sheet-writer.ts';
import { loadProjectConfig, newWorkbook } from './workbook-writer.ts';

export async function buildStarterFiles(): Promise<Map<string, Uint8Array>> {
  const config = await loadProjectConfig();
  const files = new Map<string, Uint8Array>();
  for (const tipo of REPORT_TIPOS) {
    const workbook = newWorkbook();
    writeReportSheet(
      workbook,
      { tipo, name: REPORT_SPECS[tipo].label },
      { config },
    );
    files.set(
      starterFileName(tipo),
      new Uint8Array(await workbook.xlsx.writeBuffer()),
    );
  }
  return files;
}
