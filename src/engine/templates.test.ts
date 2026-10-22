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
  ByActivitySection,
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

interface PdfWord {
  readonly text: string;
  readonly xMin: number;
  readonly yMin: number;
  readonly xMax: number;
  readonly yMax: number;
}

interface PdfPage {
  readonly width: number;
  readonly height: number;
  readonly words: readonly PdfWord[];
}

function pdfWords(pdf: Uint8Array): PdfPage[] {
  const dir = mkdtempSync(join(tmpdir(), 'templates-'));
  try {
    const file = join(dir, 'out.pdf');
    writeFileSync(file, pdf);
    const html = spawnSync('pdftotext', ['-bbox', file, '-'], {
      encoding: 'utf8',
    }).stdout;
    return [
      ...html.matchAll(
        /<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g,
      ),
    ].map(([, width, height, body]) => ({
      width: Number(width),
      height: Number(height),
      words: [
        ...(body ?? '').matchAll(
          /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g,
        ),
      ].map(([, xMin, yMin, xMax, yMax, text]) => ({
        text: text ?? '',
        xMin: Number(xMin),
        yMin: Number(yMin),
        xMax: Number(xMax),
        yMax: Number(yMax),
      })),
    }));
  } finally {
    rmSync(dir, { recursive: true });
  }
}

function pdfPixels(pdf: Uint8Array): PNG {
  const dir = mkdtempSync(join(tmpdir(), 'templates-'));
  try {
    const file = join(dir, 'out.pdf');
    writeFileSync(file, pdf);
    const result = spawnSync(
      'pdftoppm',
      ['-r', '72', '-f', '1', '-l', '1', '-png', file, join(dir, 'page')],
      { encoding: 'utf8' },
    );
    if (result.status !== 0)
      throw new Error(
        `pdftoppm failed: ${result.stderr || String(result.error)}`,
      );
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

function widestRun(png: PNG, hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  let best = { x0: 0, x1: -1, y: 0 };
  for (let y = 0; y < png.height; y += 1) {
    let start = -1;
    for (let x = 0; x <= png.width; x += 1) {
      const i = (y * png.width + x) * 4;
      const match =
        x < png.width &&
        png.data[i] === r &&
        png.data[i + 1] === g &&
        png.data[i + 2] === b;
      if (match && start < 0) start = x;
      if (!match && start >= 0) {
        if (x - 1 - start > best.x1 - best.x0)
          best = { x0: start, x1: x - 1, y };
        start = -1;
      }
    }
  }
  return best;
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
      expect(text).toMatch(/\b1\/[1-9]\d*\b/);
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
      expect(text).toContain('Total bruto');
    },
  );

  it.skipIf(!hasPoppler)(
    'prints the deviation direction in words next to each deviation figure',
    async () => {
      const report = example('evento-citadao');
      const bare = structuredClone(report) as unknown as {
        sections: { kind: string; rows: object[]; total: object }[];
      };
      for (const section of bare.sections) {
        if (section.kind !== 'budget') continue;
        for (const row of [...section.rows, section.total])
          delete (row as { desvioLabel?: string }).desvioLabel;
      }

      const [shown, hidden] = await Promise.all([
        renderer.render('evento', report),
        renderer.render('evento', bare),
      ]);

      expect(pdfText(shown.pdf)).toContain('Acima do orçado');
      expect(pdfText(shown.pdf)).toContain('Abaixo do orçado');
      expect(pdfText(hidden.pdf)).not.toContain('Acima do orçado');
    },
  );

  it.skipIf(!hasPoppler)(
    'heads the budget label column with the header the report carries',
    async () => {
      const { pdf } = await renderer.render(
        'evento',
        example('evento-citadao'),
      );

      expect(pdfText(pdf)).toContain('SUB-RUBRICA');
    },
  );

  it.skipIf(!hasPoppler)(
    'prints the running result in ink and the gross totals under Entrada and Saída',
    async () => {
      const report = example('evento-citadao');
      const book = report.sections.find((s) => s.kind === 'movements');
      if (book === undefined) throw new Error('no cash book');

      const { pdf } = await renderer.render(
        'evento',
        onlySections(report, [book]),
      );

      expect(hasPixel(pdfPixels(pdf), report.theme.accentRed)).toBe(false);
      expect(pdfText(pdf)).toMatch(/Total bruto\s+20\.225,20 €\s+15\.927,00 €/);
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
        'PENDENTES (A RECEBER E A PAGAR)',
      ])
        expect(text).toContain(heading);
      expect(text.indexOf('CONTAGEM DE CAIXA')).toBeLessThan(
        text.indexOf('DECLARAÇÃO'),
      );
      expect(last).toContain('DECLARAÇÃO');
      expect(last).toContain('Total a pagar');
      for (const line of [
        'Direção cessante',
        'Marta Figueiredo',
        'Direção 2025/26',
        'Direção entrante',
        'Conselho Fiscal',
      ])
        expect(last).toContain(line);
      expect(last.match(/Data: ____\/____\/______/g)).toHaveLength(3);
    },
  );

  it.skipIf(!hasPoppler)(
    'paints the debts segment of the position bar in the theme red',
    async () => {
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
    },
  );

  it.skipIf(!hasPoppler)(
    'draws assets and debts as two left-aligned rows on the same scale',
    async () => {
      const report = example('pegada-2026');
      const position = report.sections.find((s) => s.kind === 'position');
      if (position?.kind !== 'position') throw new Error('no position');
      const [assets, debts] = [position.segments[0], position.segments[3]];
      if (assets === undefined || debts === undefined)
        throw new Error('segments');
      const even = [
        { ...assets, permille: 500 },
        { ...debts, permille: 500 },
      ];

      const png = pdfPixels(
        (
          await renderer.render(
            'pegada',
            onlySections(report, [{ ...position, segments: even }]),
          )
        ).pdf,
      );
      const top = widestRun(png, report.theme.segments[0] ?? '');
      const bottom = widestRun(png, report.theme.accentRed);

      expect(bottom.y).toBeGreaterThan(top.y);
      expect(Math.abs(bottom.x0 - top.x0)).toBeLessThanOrEqual(2);
      expect(
        Math.abs(bottom.x1 - bottom.x0 - (top.x1 - top.x0)),
      ).toBeLessThanOrEqual(4);
    },
  );

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
        p.includes('COMPARAÇÃO COM O MESMO PERÍODO DO ANO ANTERIOR'),
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
        title: 'Comparação com o mesmo período do ano anterior',
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

  it.skipIf(!hasPoppler)(
    'paints the folded "Restantes rubricas" segment in the theme neutral grey',
    async () => {
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
    },
  );
});

describe('end of the report', () => {
  let renderer: Renderer;

  beforeAll(async () => {
    renderer = await createNodeRenderer();
  });

  it.skipIf(!hasPoppler)(
    'keeps the last three cash book rows and the totals with the signatures and trace',
    async () => {
      const lonely: number[] = [];
      for (let rows = 30; rows <= 72; rows += 1) {
        const { pdf } = await renderer.render(
          'evento',
          stretchCashBook(example('evento-citadao'), rows),
        );
        const last = pdfPages(pdf).at(-1) ?? '';
        if (
          !last.includes('Gerado a ') ||
          !last.includes(`Movimento de teste ${String(rows - 2)}`) ||
          !last.includes('Total bruto')
        )
          lonely.push(rows);
      }

      expect(lonely).toEqual([]);
    },
    120_000,
  );

  it.skipIf(!hasPoppler)(
    'keeps the pegada declaration with the last note and, for short notes, with the pending figures',
    async () => {
      const lonely: number[] = [];
      const detached: number[] = [];
      const report = example('pegada-2026');
      for (let count = 1; count <= 31; count += 3) {
        const sections = report.sections.map((section) =>
          section.kind === 'text'
            ? {
                ...section,
                paragraphs: Array.from(
                  { length: count },
                  (_, i) => `Nota ${String(i + 1)}`,
                ),
              }
            : section,
        );
        const { pdf } = await renderer.render(
          'pegada',
          onlySections(report, sections),
        );
        const last = pdfPages(pdf).at(-1) ?? '';
        if (
          !last.includes('DECLARAÇÃO') ||
          !last.includes(`Nota ${String(count)}`) ||
          !last.includes('Gerado a ')
        )
          lonely.push(count);
        if (count <= 4 && !last.includes('Total a pagar')) detached.push(count);
      }

      expect(lonely).toEqual([]);
      expect(detached).toEqual([]);
    },
    120_000,
  );

  it.skipIf(!hasPoppler)(
    'prints every word of a single long note inside the page body and keeps the end of the note with the declaration',
    async () => {
      const BODY_TOP = 95;
      const BODY_BOTTOM = 842 - 62;
      const problems: string[] = [];
      const base = example('pegada-2026');
      for (const chars of [
        500, 1500, 3000, 3500, 4500, 5000, 6000, 8000, 12000,
      ]) {
        const count = Math.ceil(chars / 5);
        const note = Array.from(
          { length: count },
          (_, i) => `w${String(i + 1)}`,
        ).join(' ');
        const sections = base.sections.map((section) =>
          section.kind === 'text'
            ? { ...section, paragraphs: [note] }
            : section,
        );
        const { pdf } = await renderer.render(
          'pegada',
          onlySections(base, sections),
        );
        const pages = pdfWords(pdf);
        const noteWords = pages.map((page) =>
          page.words.filter((word) => /^w\d+$/.test(word.text)),
        );
        const found = noteWords.flat().length;
        const outside = noteWords
          .flat()
          .some(
            (word) =>
              word.yMin < BODY_TOP ||
              word.yMax > BODY_BOTTOM ||
              word.xMax > 595 - 56,
          );
        const lastPage = pages.at(-1);
        const lastNote = noteWords.at(-1) ?? [];
        const heading = pages.findIndex((page) =>
          page.words.some((word) => word.text === 'COMENTÁRIOS'),
        );
        if (found !== count)
          problems.push(
            `${String(chars)}: ${String(count - found)} words missing`,
          );
        if (outside) problems.push(`${String(chars)}: text outside the body`);
        if (
          lastPage === undefined ||
          !lastPage.words.some((word) => word.text === 'DECLARAÇÃO') ||
          lastNote.length === 0
        )
          problems.push(
            `${String(chars)}: declaration without the end of the note`,
          );
        if (heading >= 0 && (noteWords[heading]?.length ?? 0) === 0)
          problems.push(`${String(chars)}: heading without text`);
      }

      expect(problems).toEqual([]);
    },
    180_000,
  );

  it.skipIf(!hasPoppler)(
    'prints each cash book refund line under the column it belongs to',
    async () => {
      const report = example('evento-citadao');
      const book = report.sections.find((s) => s.kind === 'movements');
      if (book === undefined) throw new Error('no cash book');
      const line = (
        label: string,
        text: string,
        column: 'entrada' | 'saida',
      ) => ({
        label,
        value: { cents: 1, text },
        column,
      });
      const withRefunds = {
        ...book,
        footer: [
          line('Reembolsos teste (entradas)', '11,11 €', 'entrada'),
          line('Reembolsos teste (saídas)', '22,22 €', 'saida'),
        ],
      };

      const { pdf } = await renderer.render(
        'evento',
        onlySections(report, [withRefunds]),
      );
      const words = pdfWords(pdf).flatMap((page) => page.words);
      const right = (text: string) =>
        words.find((word) => word.text === text)?.xMax ?? -1;

      expect(right('11,11')).toBeCloseTo(right('20.225,20'), 0);
      expect(right('22,22')).toBeCloseTo(right('15.927,00'), 0);
    },
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
        if (!last.includes('DECLARAÇÃO FINAL') || !last.includes('Gerado a '))
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

describe('table pagination', () => {
  const sweep = async (
    table: BudgetSection | ByActivitySection,
    labels: readonly string[],
  ) => {
    const renderer = await createNodeRenderer();
    const report = example('letivo-2025-26');
    const pagesOfRows: number[][] = [];
    for (let filler = 0; filler <= 44; filler += 1) {
      const { pdf } = await renderer.render(
        'letivo',
        onlySections(report, [
          textOf(
            Array.from({ length: filler }, (_, i) => `Linha ${String(i + 1)}`),
            'Enchimento',
          ),
          table,
        ]),
      );
      const pages = pdfPages(pdf);
      pagesOfRows.push(
        pages
          .map((page) => labels.filter((label) => page.includes(label)).length)
          .filter((count) => count > 0),
      );
    }
    return pagesOfRows;
  };

  it.skipIf(!hasPoppler)(
    'keeps a table of six rows or fewer whole on one page',
    async () => {
      const report = example('letivo-2025-26');
      const base = report.sections.find(
        (s): s is ByActivitySection => s.kind === 'byActivity',
      );
      if (base === undefined) throw new Error('no byActivity');
      const table: ByActivitySection = {
        ...base,
        rows: Array.from({ length: 6 }, (_, i) => ({
          ...pick(base.rows, i),
          atividade: `Atividade ${String(i + 1)}`,
        })),
      };

      const spread = await sweep(
        table,
        table.rows.map((row) => row.atividade),
      );

      expect(spread.filter((counts) => counts.length > 1)).toEqual([]);
    },
    120_000,
  );

  it.skipIf(!hasPoppler)(
    'breaks a longer table only with at least three rows before and two rows plus the total after',
    async () => {
      const report = example('evento-citadao');
      const table = report.sections.find(
        (s): s is BudgetSection => s.kind === 'budget' && s.side === 'despesa',
      );
      if (table === undefined) throw new Error('no budget');

      const spread = await sweep(
        table,
        table.rows.map((row) => row.label),
      );

      const broken = spread.filter((counts) => counts.length > 1);
      expect(broken.length).toBeGreaterThan(0);
      for (const counts of broken) {
        expect(counts[0]).toBeGreaterThanOrEqual(3);
        expect(counts.at(-1)).toBeGreaterThanOrEqual(2);
      }
    },
    120_000,
  );
});
