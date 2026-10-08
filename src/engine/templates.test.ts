import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type {
  BudgetSection,
  MovementsSection,
  ReportJson,
} from '../core/reports/types.ts';
import type { Renderer } from './renderer';
import { createNodeRenderer } from './typst-node';

const hasPoppler = spawnSync('pdftotext', ['-v']).error === undefined;

function example(name: string): ReportJson {
  return JSON.parse(
    readFileSync(
      new URL(`../../examples/${name}.json`, import.meta.url),
      'utf8',
    ),
  ) as ReportJson;
}

function pdfText(pdf: Uint8Array): string {
  const dir = mkdtempSync(join(tmpdir(), 'templates-'));
  try {
    const file = join(dir, 'out.pdf');
    writeFileSync(file, pdf);
    return spawnSync('pdftotext', ['-layout', file, '-'], {
      encoding: 'utf8',
    }).stdout.replaceAll(' ', ' ');
  } finally {
    rmSync(dir, { recursive: true });
  }
}

function withMovementRows(
  report: ReportJson,
  edit: (section: MovementsSection) => MovementsSection,
): ReportJson {
  return {
    ...report,
    sections: report.sections.map((section) =>
      section.kind === 'movements' ? edit(section) : section,
    ),
  };
}

function pick<T>(items: readonly T[], index: number): T {
  const item = items[index % items.length];
  if (item === undefined) throw new Error('nothing to pick from');
  return item;
}

function stretchCashBook(report: ReportJson, rows: number): ReportJson {
  return withMovementRows(report, (section) => ({
    ...section,
    rows: Array.from({ length: rows }, (_, i) => ({
      ...pick(section.rows, i),
      descricao: `Movimento de teste ${String(i + 1)}`,
    })),
  }));
}

const EVENT_EXAMPLES = ['evento-citadao', 'evento-zumba'] as const;

describe('evento template', () => {
  let renderer: Renderer;

  beforeAll(async () => {
    renderer = await createNodeRenderer();
  });

  it.each(EVENT_EXAMPLES)('compiles %s with zero warnings', async (name) => {
    const { pdf, warnings } = await renderer.render('evento', example(name));

    expect(warnings).toEqual([]);
    expect(pdf.byteLength).toBeGreaterThan(10_000);
  });

  it.skipIf(!hasPoppler)(
    'prints the summary cards and the control amounts without glyph loss',
    async () => {
      const { pdf } = await renderer.render(
        'evento',
        example('evento-citadao'),
      );

      const text = pdfText(pdf);

      expect(text).toContain('20.225 €');
      expect(text).toContain('4.548 €');
      expect(text).toContain('20.225,20 €');
      expect(text).toContain('15.927,00 €');
      expect(text).toContain('Página 1 de 3');
    },
  );

  it.skipIf(!hasPoppler)(
    'puts the summary cards before everything else on the first page',
    async () => {
      const { pdf } = await renderer.render(
        'evento',
        example('evento-citadao'),
      );

      const text = pdfText(pdf);

      expect(text.indexOf('RECEBIDO')).toBeLessThan(
        text.indexOf('COMPOSIÇÃO DO RECEBIDO'),
      );
    },
  );

  it.skipIf(!hasPoppler)(
    'repeats the cash-book header on every page of an 80-row book',
    async () => {
      const { pdf, warnings } = await renderer.render(
        'evento',
        stretchCashBook(example('evento-citadao'), 80),
      );

      const text = pdfText(pdf);

      expect(warnings).toEqual([]);
      expect(text.match(/ACUMULADO/g)?.length).toBeGreaterThanOrEqual(3);
      expect(text).toContain('Movimento de teste 80');
      expect(text).toContain('Pago (saídas brutas − reembolsos)');
    },
  );

  it.skipIf(!hasPoppler)(
    'explains the deviation sign under the expenses table only',
    async () => {
      const report = example('evento-citadao');
      const note = report.sections.find(
        (s): s is BudgetSection => s.kind === 'budget' && s.side === 'despesa',
      )?.note;
      if (note === undefined) throw new Error('example has no expenses note');
      const withoutNote: ReportJson = {
        ...report,
        sections: report.sections.map((section) =>
          section.kind === 'budget' ? { ...section, note: '' } : section,
        ),
      };

      const [shown, hidden] = await Promise.all([
        renderer.render('evento', report),
        renderer.render('evento', withoutNote),
      ]);

      expect(pdfText(shown.pdf).replace(/\s+/g, ' ')).toContain(note);
      expect(pdfText(hidden.pdf).replace(/\s+/g, ' ')).not.toContain(note);
    },
  );

  it.skipIf(!hasPoppler)(
    'prints the empty-side messages with a zero total',
    async () => {
      const { pdf } = await renderer.render('evento', example('evento-zumba'));

      const text = pdfText(pdf);

      expect(text).toContain('Nada a receber');
      expect(text).toContain('Nada a pagar');
      expect(text.match(/0,00 €/g)?.length).toBeGreaterThanOrEqual(2);
    },
  );

  it.skipIf(!hasPoppler)('marks a refund row in the cash book', async () => {
    const report = withMovementRows(example('evento-zumba'), (section) => ({
      ...section,
      rows: section.rows.map((row, i) => ({ ...row, refund: i === 0 })),
    }));

    const text = pdfText((await renderer.render('evento', report)).pdf);

    expect(text.match(/ · reembolso/g)).toHaveLength(1);
  });

  it('renders a composition with more segments than palette slots and a zero-share segment', async () => {
    const report = example('evento-citadao');
    const crowded: ReportJson = {
      ...report,
      sections: report.sections.map((section) =>
        section.kind === 'composition' && section.segments.length > 8
          ? {
              ...section,
              segments: [
                ...section.segments,
                {
                  ...pick(section.segments, 0),
                  label: 'Sem peso',
                  permille: 0,
                },
              ],
            }
          : section,
      ),
    };

    const { warnings } = await renderer.render('evento', crowded);

    expect(warnings).toEqual([]);
  });

  it('rejects a section kind the template does not know', async () => {
    const report = {
      ...example('evento-zumba'),
      sections: [{ kind: 'desconhecida' }],
    };

    await expect(renderer.render('evento', report)).rejects.toThrow(
      /secção desconhecida: desconhecida/,
    );
  });

  it('places user text as plain strings, never as markup', async () => {
    const hostile = '*negrito* #panic("injetado") $x$ _it_';
    const report: ReportJson = {
      ...example('evento-zumba'),
      sections: [
        { kind: 'text', title: 'Notas / Comentários', paragraphs: [hostile] },
      ],
    };

    const { pdf, warnings } = await renderer.render('evento', report);

    expect(warnings).toEqual([]);
    if (hasPoppler)
      expect(pdfText(pdf).replace(/\s+/g, ' ')).toContain(hostile);
  });
});
