import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import type { Renderer } from '../engine/renderer.ts';
import { EXIT, main, type CliIo } from './gerar-relatorio.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const XLSX = `${ROOT}fixtures/generated/tesouraria.xlsx`;
const PARAMS_DIR = `${ROOT}fixtures/params/`;
const EXAMPLES_DIR = `${ROOT}examples/`;
const AGORA = '2026-10-07T12:00';

interface Harness {
  readonly io: CliIo;
  readonly written: Map<string, Uint8Array | string>;
  readonly stderr: () => string;
  readonly stdout: () => string;
  readonly rendered: { tipo: string; report: unknown }[];
}

function harness(
  options: { now?: Date; render?: Renderer['render'] } = {},
): Harness {
  const written = new Map<string, Uint8Array | string>();
  const rendered: { tipo: string; report: unknown }[] = [];
  let out = '';
  let err = '';
  const render: Renderer['render'] =
    options.render ??
    ((tipo, report) => {
      rendered.push({ tipo, report });
      return Promise.resolve({
        pdf: new TextEncoder().encode('%PDF-fake'),
        warnings: [],
      });
    });
  const io: CliIo = {
    stdout: (text) => {
      out += text;
    },
    stderr: (text) => {
      err += text;
    },
    readFile: async (path) => new Uint8Array(await readFile(path)),
    writeFile: (path, data) => {
      written.set(path, data);
      return Promise.resolve();
    },
    now: () => options.now ?? new Date('2026-10-07T11:00:00Z'),
    createRenderer: () => Promise.resolve({ render }),
  };
  return {
    io,
    written,
    rendered,
    stderr: () => err,
    stdout: () => out,
  };
}

function writtenJson(run: Harness, path: string): Record<string, unknown> {
  const text = run.written.get(path);
  if (typeof text !== 'string') throw new Error(`${path} was not written`);
  return JSON.parse(text) as Record<string, unknown>;
}

function withoutTraceKey(
  report: Record<string, unknown>,
  key: 'generatedAt' | 'sources',
): Record<string, unknown> {
  const copy = structuredClone(report) as { trace: Record<string, unknown> };
  return { ...copy, trace: { ...copy.trace, [key]: undefined } };
}

describe('main()', () => {
  it('writes the PDF and a report JSON that matches the published example', async () => {
    const run = harness();

    const code = await main(
      [
        '--tipo',
        'evento',
        '--entrada',
        XLSX,
        '--params',
        `${PARAMS_DIR}evento-citadao.json`,
        '--agora',
        AGORA,
        '--json',
        'r.json',
        '--saida',
        'r.pdf',
      ],
      run.io,
    );

    expect(code).toBe(EXIT.ok);
    expect(run.written.get('r.pdf')).toBeInstanceOf(Uint8Array);
    expect(run.rendered.map(({ tipo }) => tipo)).toEqual(['evento']);
    expect(run.stdout()).toContain('r.pdf');
  });

  it.each(readdirSync(PARAMS_DIR).map((file) => file.replace(/\.json$/, '')))(
    'builds the same report as the page for %s',
    async (name) => {
      const example = JSON.parse(
        await readFile(`${EXAMPLES_DIR}${name}.json`, 'utf8'),
      ) as { tipo: string };
      const run = harness();

      const code = await main(
        [
          '--tipo',
          example.tipo,
          '--entrada',
          XLSX,
          '--params',
          `${PARAMS_DIR}${name}.json`,
          '--agora',
          AGORA,
          '--json',
          'r.json',
        ],
        run.io,
      );

      expect(code).toBe(EXIT.ok);
      expect(
        withoutTraceKey(writtenJson(run, 'r.json'), 'generatedAt'),
      ).toEqual(withoutTraceKey(example, 'generatedAt'));
    },
  );

  it('builds the same report from the CSV set as from the workbook', async () => {
    const csvDir = `${ROOT}fixtures/generated/csv/`;
    const csvArgs = (await readdir(csvDir)).flatMap((file) => [
      '--entrada',
      `${csvDir}${file}`,
    ]);
    const common = [
      '--tipo',
      'fiscal',
      '--params',
      `${PARAMS_DIR}fiscal-2025.json`,
      '--agora',
      AGORA,
      '--json',
      'r.json',
    ];
    const fromCsv = harness();
    const fromXlsx = harness();

    await main([...common, ...csvArgs], fromCsv.io);
    await main([...common, '--entrada', XLSX], fromXlsx.io);

    expect(withoutTraceKey(writtenJson(fromCsv, 'r.json'), 'sources')).toEqual(
      withoutTraceKey(writtenJson(fromXlsx, 'r.json'), 'sources'),
    );
  });

  it('lets --param override the params file', async () => {
    const run = harness();

    await main(
      [
        '--tipo',
        'evento',
        '--entrada',
        XLSX,
        '--params',
        `${PARAMS_DIR}evento-citadao.json`,
        '--param',
        'notas=Nota substituída.',
        '--json',
        'r.json',
      ],
      run.io,
    );

    const text = run.written.get('r.json') as string;
    expect(text).toContain('Nota substituída.');
    expect(text).not.toContain('fechar patrocínios');
  });

  it('prints blocking issues with tab, row and column and writes no PDF', async () => {
    const run = harness();

    const code = await main(
      [
        '--tipo',
        'fiscal',
        '--entrada',
        `${ROOT}fixtures/generated/invalid/missing-fields.xlsx`,
        '--param',
        'ano=2025',
      ],
      run.io,
    );

    expect(code).toBe(EXIT.blocked);
    expect(run.stderr()).toContain(
      'ERRO missing-fields.xlsx › Movimentos linha 2, coluna Atividade:',
    );
    expect(run.written.size).toBe(0);
    expect(run.rendered).toEqual([]);
  });

  it('exits with usage and code 2 when --tipo is missing', async () => {
    const run = harness();

    const code = await main(['--entrada', XLSX], run.io);

    expect(code).toBe(EXIT.usage);
    expect(run.stderr()).toContain('Falta indicar --tipo.');
    expect(run.stderr()).toContain('Uso: npm run gerar');
  });

  it('reports invalid params in Portuguese with code 2', async () => {
    const run = harness();

    const code = await main(
      ['--tipo', 'fiscal', '--entrada', XLSX, '--param', 'ano=abc'],
      run.io,
    );

    expect(code).toBe(EXIT.usage);
    expect(run.stderr()).toContain('ERRO parâmetro ano:');
    expect(run.written.size).toBe(0);
  });

  it('exits 2 when an input file cannot be read', async () => {
    const run = harness();

    const code = await main(
      [
        '--tipo',
        'fiscal',
        '--entrada',
        'nao-existe.xlsx',
        '--param',
        'ano=2025',
      ],
      run.io,
    );

    expect(code).toBe(EXIT.usage);
    expect(run.stderr()).toContain('nao-existe.xlsx');
  });

  it('exits 3 and writes no PDF when rendering fails', async () => {
    const run = harness({
      render: () => Promise.reject(new Error('motor indisponível')),
    });

    const code = await main(
      [
        '--tipo',
        'fiscal',
        '--entrada',
        XLSX,
        '--params',
        `${PARAMS_DIR}fiscal-2025.json`,
        '--saida',
        'r.pdf',
      ],
      run.io,
    );

    expect(code).toBe(EXIT.internal);
    expect(run.stderr()).toContain('motor indisponível');
    expect(run.written.has('r.pdf')).toBe(false);
  });

  it('stamps the Lisbon wall-clock time, not UTC, when --agora is omitted', async () => {
    const run = harness({ now: new Date('2026-07-15T11:30:00Z') });

    await main(
      [
        '--tipo',
        'fiscal',
        '--entrada',
        XLSX,
        '--params',
        `${PARAMS_DIR}fiscal-2025.json`,
        '--json',
        'r.json',
      ],
      run.io,
    );

    const { trace } = writtenJson(run, 'r.json') as {
      trace: { generatedAt: string; generatedAtLabel: string };
    };
    expect(trace.generatedAt).toBe('2026-07-15T12:30:00');
    expect(trace.generatedAtLabel).toBe('15/07/2026 12:30');
  });

  it('takes --agora as Lisbon wall-clock time', async () => {
    const run = harness({ now: new Date('2026-07-15T11:30:00Z') });

    await main(
      [
        '--tipo',
        'fiscal',
        '--entrada',
        XLSX,
        '--params',
        `${PARAMS_DIR}fiscal-2025.json`,
        '--agora',
        '2026-07-15T09:05',
        '--json',
        'r.json',
      ],
      run.io,
    );

    const { trace } = writtenJson(run, 'r.json') as {
      trace: { generatedAtLabel: string };
    };
    expect(trace.generatedAtLabel).toBe('15/07/2026 09:05');
  });
});

const hasPoppler = spawnSync('pdftotext', ['-v']).error === undefined;

describe('the gerar script', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gerar-'));
  afterAll(() => {
    rmSync(dir, { recursive: true });
  });

  it.skipIf(!hasPoppler)(
    'renders a PDF carrying the control value from the fixture workbook',
    () => {
      const pdf = join(dir, 'evento.pdf');

      const run = spawnSync(
        `${ROOT}node_modules/.bin/tsx`,
        [
          `${ROOT}src/cli/gerar-relatorio.ts`,
          '--tipo',
          'evento',
          '--entrada',
          XLSX,
          '--params',
          `${PARAMS_DIR}evento-citadao.json`,
          '--agora',
          AGORA,
          '--saida',
          pdf,
        ],
        { encoding: 'utf8', cwd: ROOT },
      );
      const text = spawnSync('pdftotext', [pdf, '-'], {
        encoding: 'utf8',
      }).stdout.replaceAll(' ', ' ');

      expect(run.status).toBe(EXIT.ok);
      expect(text).toContain('20.225,20 €');
    },
    30_000,
  );
});
