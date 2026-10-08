import config from '../../config/config.json';
import { loadConfig } from '../../src/core/config/schema.ts';
import type { BuildContext } from '../../src/core/reports/index.ts';
import type {
  BudgetSection,
  CompositionSection,
  MovementsSection,
  ReportJson,
  Section,
} from '../../src/core/reports/index.ts';

export const CONFIG = loadConfig(config);

export const CONTEXT: BuildContext = {
  now: '2026-10-07T12:00:00Z',
  sources: [{ name: 'tesouraria.xlsx', sha256: 'ab'.repeat(32) }],
  generatorVersion: '9.9.9',
};

export const kindsOf = (report: ReportJson): string[] =>
  report.sections.map((section) => section.kind);

export function sectionOf<K extends Section['kind']>(
  report: ReportJson,
  kind: K,
  title?: string,
): Extract<Section, { kind: K }> {
  const found = report.sections.find(
    (section): section is Extract<Section, { kind: K }> =>
      section.kind === kind &&
      (title === undefined || ('title' in section && section.title === title)),
  );
  if (found === undefined) {
    throw new Error(
      `No ${kind} section${title === undefined ? '' : ` "${title}"`}`,
    );
  }
  return found;
}

export const movementsOf = (report: ReportJson): MovementsSection =>
  sectionOf(report, 'movements');

export const budgetOf = (report: ReportJson, title: string): BudgetSection =>
  sectionOf(report, 'budget', title);

export const compositionOf = (
  report: ReportJson,
  title: string,
): CompositionSection => sectionOf(report, 'composition', title);

export const eur = (text: string): string => text.replaceAll(' €', ' €');

export const titlesOf = (report: ReportJson): string[] =>
  report.sections.flatMap((section) =>
    'title' in section ? [section.title] : [],
  );
