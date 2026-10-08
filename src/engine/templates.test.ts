import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import type {
  BudgetSection,
  IndicatorsSection,
  MovementsSection,
  ReportJson,
  Section,
  TextSection,
  YearComparisonSection,
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

function pdfPages(pdf: Uint8Array): string[] {
  return pdfText(pdf)
    .split('\f')
    .filter((page) => page.trim() !== '');
}

function pdfPixels(pdf: Uint8Array): PNG {
  const dir = mkdtempSync(join(tmpdir(), 'templates-'));
  try {
    const file = join(dir, 'out.pdf');
    writeFileSync(file, pdf);
    spawnSync('pdftoppm', [
      '-r',
      '72',
      '-f',
      '1',
      '-l',
      '1',
      '-png',
      file,
      join(dir, 'page'),
    ]);
    const png = readdirSync(dir).find((name) => name.endsWith('.png'));
    if (png === undefined) throw new Error('pdftoppm produced no page');
    return PNG.sync.read(readFileSync(join(dir, png)));
  } finally {
    rmSync(dir, { recursive: true });
  }
}

function hasPixel(png: PNG, hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i] === r && png.data[i + 1] === g && png.data[i + 2] === b)
      return true;
  }
  return false;
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
      expect(text).toMatch(/Página 1 de [1-9]\d*/);
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
      const withoutNote = structuredClone(report) as unknown as {
        sections: { note?: string }[];
      };
      for (const section of withoutNote.sections) delete section.note;

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

  it('renders a composition that carries a zero-share segment', async () => {
    const report = example('evento-zumba');
    const withZero: ReportJson = {
      ...report,
      sections: report.sections.map((section) =>
        section.kind === 'composition'
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

    const { warnings } = await renderer.render('evento', withZero);

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

const PERIOD_EXAMPLES = [
  ['pegada', 'pegada-2026', ['13.844,05 €', '13.964,05 €']],
  ['letivo', 'letivo-2025-26', ['6.231,55 €', '27.792,70 €']],
  ['fiscal', 'fiscal-2025', ['6.231,55 €', '24.445,30 €']],
] as const;

function textOf(paragraphs: readonly string[], title: string): TextSection {
  return { kind: 'text', title, paragraphs };
}

function onlySections(
  report: ReportJson,
  sections: readonly Section[],
): ReportJson {
  return { ...report, sections };
}

describe('period report templates', () => {
  let renderer: Renderer;

  beforeAll(async () => {
    renderer = await createNodeRenderer();
  });

  it.each(PERIOD_EXAMPLES)(
    'compiles the %s example with zero warnings and prints its control amounts',
    async (template, name, amounts) => {
      const { pdf, warnings } = await renderer.render(template, example(name));

      expect(warnings).toEqual([]);
      if (hasPoppler) {
        const text = pdfText(pdf);
        for (const amount of amounts) expect(text).toContain(amount);
      }
    },
  );

  it.skipIf(!hasPoppler)(
    'puts the pegada position bar, reconciliation and cash count before the declaration and its three signature lines',
    async () => {
      const { pdf } = await renderer.render('pegada', example('pegada-2026'));

      const pages = pdfPages(pdf);
      const text = pages.join('\n');
      const last = pages.at(-1) ?? '';

      for (const heading of [
        'POSIÇÃO FINANCEIRA NA PASSAGEM',
        'RECONCILIAÇÃO BANCÁRIA',
        'CONTAGEM DE CAIXA',
        'DIREITOS E COMPROMISSOS',
      ])
        expect(text).toContain(heading);
      expect(text.indexOf('CONTAGEM DE CAIXA')).toBeLessThan(
        text.indexOf('DECLARAÇÃO'),
      );
      expect(last).toContain('DECLARAÇÃO');
      for (const title of [
        'Direção cessante',
        'Direção entrante',
        'Conselho Fiscal',
      ])
        expect(last).toContain(title);
    },
  );

  it('paints the debts segment of the position bar in the theme red', async () => {
    const report = example('pegada-2026');
    const position = report.sections.find((s) => s.kind === 'position');
    if (position?.kind !== 'position') throw new Error('no position section');
    const render = async (negative: boolean) =>
      pdfPixels(
        (
          await renderer.render(
            'pegada',
            onlySections(report, [
              {
                ...position,
                segments: position.segments.map((segment) => ({
                  ...segment,
                  negative: segment.negative && negative,
                })),
              },
            ]),
          )
        ).pdf,
      );

    expect(hasPixel(await render(true), report.theme.accentRed)).toBe(true);
    expect(hasPixel(await render(false), report.theme.accentRed)).toBe(false);
  });

  it.skipIf(!hasPoppler)(
    'lists signed movements, the group outside the result and the variation footer',
    async () => {
      const { pdf } = await renderer.render(
        'letivo',
        example('letivo-2025-26'),
      );

      const text = pdfText(pdf);

      expect(text).toContain('−2.529,50 €');
      expect(text.indexOf('Movimentos fora do resultado')).toBeLessThan(
        text.indexOf('Entradas brutas'),
      );
      expect(text).toContain('Variação no período');
    },
  );

  it.skipIf(!hasPoppler)(
    'gives the year comparison a page of its own in the school-year report',
    async () => {
      const { pdf } = await renderer.render(
        'letivo',
        example('letivo-2025-26'),
      );

      const page = pdfPages(pdf).find((p) =>
        p.includes('COMPARAÇÃO COM O PERÍODO HOMÓLOGO'),
      );

      expect(page).toBeDefined();
      expect(page).toContain('Saldo final');
      expect(page).not.toContain('MOVIMENTOS DO PERÍODO');
      expect(page).not.toContain('NOTAS / COMENTÁRIOS');
    },
  );

  it.skipIf(!hasPoppler)(
    'says "sem dados" instead of printing zeros when the comparison period is empty',
    async () => {
      const report = example('letivo-2025-26');
      const comparison: YearComparisonSection = {
        kind: 'yearComparison',
        title: 'Comparação com o período homólogo',
        status: 'sem-dados',
        labels: ['2024', '2025'],
        message:
          'Sem dados no período de comparação (01/01/2025 a 31/08/2025).',
        rows: [],
      };

      const { pdf, warnings } = await renderer.render(
        'letivo',
        onlySections(report, [comparison]),
      );
      const text = pdfText(pdf).replace(/\s+/g, ' ');

      expect(warnings).toEqual([]);
      expect(text).toContain(comparison.message);
      expect(text).not.toContain('0,00 €');
      expect(text).not.toContain('Saldo inicial');
    },
  );

  it.skipIf(!hasPoppler)(
    'prints the council opinion and the rubric bars in the fiscal report without a reconciliation',
    async () => {
      const { pdf } = await renderer.render('fiscal', example('fiscal-2025'));

      const text = pdfText(pdf);

      expect(text).toContain('PARECER DO CONSELHO FISCAL');
      expect(text).toContain('Recebido por rubrica');
      expect(text).toContain('Pago por rubrica');
      expect(text).not.toContain('RECONCILIAÇÃO');
    },
  );

  it('paints the folded "Restantes rubricas" segment in the theme neutral grey', async () => {
    const report = example('evento-citadao');
    const render = async (keepFlag: boolean) => {
      const sections = report.sections.map((section) =>
        section.kind === 'composition'
          ? {
              ...section,
              segments: section.segments.map(({ folded, ...segment }) =>
                keepFlag && folded ? { ...segment, folded } : segment,
              ),
            }
          : section,
      );
      return pdfPixels(
        (await renderer.render('evento', { ...report, sections })).pdf,
      );
    };

    expect(hasPixel(await render(true), report.theme.neutral)).toBe(true);
    expect(hasPixel(await render(false), report.theme.neutral)).toBe(false);
  });
});

describe('end of the report', () => {
  let renderer: Renderer;

  beforeAll(async () => {
    renderer = await createNodeRenderer();
  });

  it.skipIf(!hasPoppler)(
    'never leaves the signatures and trace alone on the last page of a cash book',
    async () => {
      const lonely: number[] = [];
      for (let rows = 30; rows <= 72; rows += 1) {
        const { pdf } = await renderer.render(
          'evento',
          stretchCashBook(example('evento-citadao'), rows),
        );
        const last = pdfPages(pdf).at(-1) ?? '';
        if (
          !last.includes('Gerado em') ||
          !last.includes(`Movimento de teste ${String(rows)}`) ||
          !last.includes('Pago (saídas brutas − reembolsos)')
        )
          lonely.push(rows);
      }

      expect(lonely).toEqual([]);
    },
    120_000,
  );

  it.skipIf(!hasPoppler)(
    'keeps the last section of a short report with the signatures',
    async () => {
      const lonely: number[] = [];
      const report = example('pegada-2026');
      for (let filler = 0; filler <= 34; filler += 1) {
        const sections = [
          textOf(
            Array.from({ length: filler }, (_, i) => `Linha ${String(i + 1)}`),
            'Enchimento',
          ),
          textOf(['Última secção'], 'Declaração final'),
        ];
        const { pdf } = await renderer.render(
          'pegada',
          onlySections(report, filler === 0 ? sections.slice(1) : sections),
        );
        const last = pdfPages(pdf).at(-1) ?? '';
        if (!last.includes('DECLARAÇÃO FINAL') || !last.includes('Gerado em'))
          lonely.push(filler);
      }

      expect(lonely).toEqual([]);
    },
    120_000,
  );
});

describe('indicators table', () => {
  it.skipIf(!hasPoppler)(
    'is never split across two pages',
    async () => {
      const renderer = await createNodeRenderer();
      const report = example('evento-citadao');
      const indicators = report.sections.find(
        (s): s is IndicatorsSection => s.kind === 'indicators',
      );
      if (indicators === undefined)
        throw new Error('example has no indicators');
      const split: number[] = [];

      for (let filler = 12; filler <= 40; filler += 1) {
        const { pdf } = await renderer.render(
          'evento',
          onlySections(report, [
            textOf(
              Array.from(
                { length: filler },
                (_, i) => `Linha ${String(i + 1)}`,
              ),
              'Enchimento',
            ),
            indicators,
          ]),
        );
        const page = pdfPages(pdf).find((p) => p.includes('INDICADORES')) ?? '';
        if (!indicators.rows.every((row) => page.includes(row.label)))
          split.push(filler);
      }

      expect(split).toEqual([]);
    },
    120_000,
  );
});
