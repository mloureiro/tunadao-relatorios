import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  paramsSchemas,
  type ReportTipo,
} from '../../src/core/reports/index.ts';
import { REPORT_SPECS } from '../../src/core/sheets/catalogue.ts';
import { buildLayout } from '../../src/core/sheets/layout.ts';
import { validateDraft } from '../../src/core/sheets/raw-params.ts';
import { readReportSheet } from '../../src/core/sheets/read-sheet.ts';
import {
  config,
  filledRows,
  gridOf,
  type TestRows,
} from '../support/report-sheet.ts';

const FIXTURES: readonly [string, ReportTipo][] = [
  ['pegada-2026', 'pegada'],
  ['evento-citadao', 'evento'],
  ['evento-zumba', 'evento'],
  ['letivo-2025-26', 'letivo'],
  ['fiscal-2025', 'fiscal'],
];

async function params(name: string): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(`fixtures/v1/params/${name}.json`, 'utf8'),
  ) as Record<string, unknown>;
}

function shifted(tipo: ReportTipo, rows: TestRows): TestRows {
  const { rows: layout } = buildLayout(tipo, config);
  const titles = new Set(REPORT_SPECS[tipo].blocks.map((block) => block.key));
  const starts = layout.flatMap((row, index) =>
    row.key !== undefined && titles.has(row.key) ? [index] : [],
  );
  const head = rows.slice(0, starts[0]);
  const sections = starts.map((start, position) =>
    rows.slice(start, starts[position + 1] ?? rows.length),
  );
  return [
    ...head.slice(0, 3),
    [null, null, null],
    ['Preencher com cuidado', null, null],
    ...head.slice(3),
    ...sections.toReversed().flat(),
  ];
}

describe.each(FIXTURES)('report sheet filled from %s', (name, tipo) => {
  it('yields exactly the parameters the v1 schema accepts for the same values', async () => {
    const values = await params(name);
    const draft = readReportSheet(gridOf(filledRows(tipo, values)), { config });
    const result = validateDraft(draft);

    expect(result.issues).toEqual([]);
    expect(result.params).toEqual({
      tipo,
      params: paramsSchemas[tipo].parse(values),
    });
  });

  it('parses identically when rows are inserted above the fields and the blocks are reordered', async () => {
    const values = await params(name);
    const plain = validateDraft(
      readReportSheet(gridOf(filledRows(tipo, values)), { config }),
    );
    const moved = validateDraft(
      readReportSheet(gridOf(shifted(tipo, filledRows(tipo, values))), {
        config,
      }),
    );

    expect(moved.params).toEqual(plain.params);
    expect(moved.issues.map(({ code }) => code)).toEqual(['field-unknown']);
  });
});
