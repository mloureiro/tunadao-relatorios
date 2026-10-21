import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildExampleReports } from '../../scripts/lib/example-json.ts';
import type { ReportJson } from '../../src/core/reports/index.ts';

type Figure = string | number;

const PERMILLE_KEY = /permille$/i;

function collect(value: unknown, into: Figure[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collect(item, into);
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'cents' || PERMILLE_KEY.test(key)) into.push(child as number);
      else collect(child, into);
    }
  }
}

function fingerprint(report: ReportJson): Figure[][] {
  return report.sections.map((section) => {
    if (section.kind === 'kpis') {
      return [section.kind, ...section.cards.map((card) => card.value)];
    }
    const figures: Figure[] = [];
    collect(section, figures);
    return [section.kind, ...figures];
  });
}

const EXAMPLES = [
  'evento-citadao',
  'evento-zumba',
  'pegada-2026',
  'letivo-2025-26',
  'fiscal-2025',
] as const;

let built: Map<string, ReportJson>;

const exampleOf = (name: string): ReportJson => {
  const report = built.get(name);
  if (report === undefined) throw new Error(`No example ${name}`);
  return report;
};

beforeAll(async () => {
  built = await buildExampleReports();
});

describe('figure fingerprint of the examples', () => {
  it.each(EXAMPLES)(
    '%s keeps every figure the v1 report printed',
    async (name) => {
      const v1 = JSON.parse(
        await readFile(`fixtures/v1/examples/${name}.json`, 'utf8'),
      ) as ReportJson;

      expect(fingerprint(exampleOf(name))).toEqual(fingerprint(v1));
    },
  );

  it('notices a single cent that moves', () => {
    const original = exampleOf('pegada-2026');
    const moved = JSON.parse(JSON.stringify(original)) as {
      sections: { kind: string; rows?: { value: { cents: number } }[] }[];
    };
    const row = moved.sections.find((s) => s.kind === 'bridge')?.rows?.[0];
    if (row === undefined) throw new Error('no bridge row');
    row.value.cents += 1;

    expect(fingerprint(moved as unknown as ReportJson)).not.toEqual(
      fingerprint(original),
    );
  });
});
