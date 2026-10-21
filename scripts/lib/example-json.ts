import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../src/core/config/schema.ts';
import type { ReportJson } from '../../src/core/reports/index.ts';
import { loadWorkbook } from '../../src/core/workbook.ts';
import { GENERATOR_VERSION } from '../../src/core/version.ts';

export const EXAMPLE_NOW = '2026-10-07T12:00:00';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const EXAMPLES = [
  ['evento-citadao', 'CITADÃO 2026'],
  ['evento-zumba', 'Zumba 2026'],
  ['pegada-2026', 'Pegada 2026'],
  ['letivo-2025-26', 'Letivo 2025-26'],
  ['fiscal-2025', 'Fiscal 2025'],
] as const;

export async function buildExampleReports(): Promise<Map<string, ReportJson>> {
  const config = loadConfig(
    JSON.parse(await readFile(`${ROOT}config/config.json`, 'utf8')),
  );
  const { reports: instances } = await loadWorkbook(
    {
      name: 'tesouraria.xlsx',
      bytes: new Uint8Array(
        await readFile(`${ROOT}fixtures/generated/tesouraria.xlsx`),
      ),
    },
    { config, now: EXAMPLE_NOW, generatorVersion: GENERATOR_VERSION },
  );

  const reports = new Map<string, ReportJson>();
  for (const [name, sheet] of EXAMPLES) {
    const report = instances.find(
      (instance) => instance.sheet === sheet,
    )?.report;
    if (report === undefined) {
      throw new Error(`Example ${name} did not build from sheet "${sheet}"`);
    }
    reports.set(name, report);
  }
  return reports;
}

export async function buildExampleJson(): Promise<Map<string, string>> {
  return new Map(
    [...(await buildExampleReports())].map(([name, report]) => [
      `${name}.json`,
      `${JSON.stringify(report, null, 2)}\n`,
    ]),
  );
}
