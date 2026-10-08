import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../src/core/config/schema.ts';
import { buildReport, loadDataset } from '../../src/core/pipeline.ts';
import { paramsSchemas } from '../../src/core/reports/index.ts';
import type { ReportJson, ReportTipo } from '../../src/core/reports/index.ts';
import { GENERATOR_VERSION } from '../../src/core/version.ts';

export const EXAMPLE_NOW = '2026-10-07T12:00:00';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const EXAMPLES = [
  ['evento', 'evento-citadao'],
  ['evento', 'evento-zumba'],
  ['pegada', 'pegada-2026'],
  ['letivo', 'letivo-2025-26'],
  ['fiscal', 'fiscal-2025'],
] as const satisfies readonly (readonly [ReportTipo, string])[];

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(`${ROOT}${path}`, 'utf8')) as unknown;
}

export async function buildExampleReports(): Promise<Map<string, ReportJson>> {
  const config = loadConfig(await readJson('config/config.json'));
  const loaded = await loadDataset([
    {
      name: 'tesouraria.xlsx',
      bytes: new Uint8Array(
        await readFile(`${ROOT}fixtures/generated/tesouraria.xlsx`),
      ),
    },
  ]);

  const reports = new Map<string, ReportJson>();
  for (const [tipo, name] of EXAMPLES) {
    const params = paramsSchemas[tipo].parse(
      await readJson(`fixtures/params/${name}.json`),
    );
    const result = buildReport(tipo, loaded, params, {
      config,
      now: EXAMPLE_NOW,
      generatorVersion: GENERATOR_VERSION,
    });
    if (result.status !== 'report') {
      throw new Error(`Example ${name} did not build: ${result.status}`);
    }
    reports.set(name, result.report);
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
