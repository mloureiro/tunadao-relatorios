import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  sheetFrom,
  withReportSheets,
} from '../../tests/support/report-workbook.ts';
import type { Renderer } from '../engine/renderer.ts';
import { EXIT, main, type CliIo } from './gerar-relatorio.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const XLSX = `${ROOT}fixtures/generated/tesouraria.xlsx`;
const SHEETS_XLSX = `${ROOT}fixtures/generated/invalid/report-sheets.xlsx`;
const BROKEN_DATA_XLSX = `${ROOT}fixtures/generated/invalid/missing-fields.xlsx`;
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

describe('main()', () => {
  it.each([
    ['Pegada 2026', 'pegada-2026'],
    ['Letivo 2025-26', 'letivo-2025-26'],
    ['CITADÃO 2026', 'evento-citadao'],
    ['Zumba 2026', 'evento-zumba'],
    ['Fiscal 2025', 'fiscal-2025'],
  ])(
    'writes the PDF and a report JSON for %s that matches the published example',
    async (folha, name) => {
      const run = harness();
      const example = JSON.parse(
        await readFile(`${EXAMPLES_DIR}${name}.json`, 'utf8'),
      ) as { tipo: string };

      const code = await main(
        [
          '--entrada',
          XLSX,
          '--folha',
          folha,
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
      expect(run.rendered.map(({ tipo }) => tipo)).toEqual([example.tipo]);
      expect(run.stdout()).toContain('r.pdf');
      expect(writtenJson(run, 'r.json')).toEqual(example);
    },
  );

  it('finds a sheet whose name is typed in decomposed Unicode', async () => {
    const run = harness();

    const code = await main(
      [
        '--entrada',
        XLSX,
        '--folha',
        'CITADÃO 2026'.normalize('NFD'),
        '--saida',
        'r.pdf',
      ],
      run.io,
    );

    expect(code).toBe(EXIT.ok);
    expect(run.written.has('r.pdf')).toBe(true);
  });

  it('names the PDF after the report when --saida is omitted', async () => {
    const run = harness();

    const code = await main(
      ['--entrada', XLSX, '--folha', 'Pegada 2026', '--agora', AGORA],
      run.io,
    );

    expect(code).toBe(EXIT.ok);
    expect([...run.written.keys()]).toEqual([
      '2026-09-30 Pegada de direção.pdf',
    ]);
  });

  it('lists the fixture reports newest first with their dates in words', async () => {
    const run = harness();

    const code = await main(['--entrada', XLSX, '--listar'], run.io);

    expect(code).toBe(EXIT.ok);
    const lines = run
      .stdout()
      .split('\n')
      .filter((line) => !line.startsWith('  '));
    expect(
      lines.filter((line) => line !== '').map((line) => line.split(' · ')[0]),
    ).toEqual([
      '"Pegada 2026"',
      '"Letivo 2025-26"',
      '"CITADÃO 2026"',
      '"Zumba 2026"',
      '"Fiscal 2025"',
    ]);
    expect(run.stdout()).toContain(
      '"Pegada 2026" · Pegada de direção · pronto · Data do último relatório: 31 de agosto de 2026 · Data da passagem: 30 de setembro de 2026',
    );
    expect(run.stdout()).toContain(
      '"Fiscal 2025" · Fim de ano fiscal · pronto · Ano: 2025 (1 de janeiro a 31 de dezembro de 2025)',
    );
    expect(run.written.size).toBe(0);
  });

  it('lists each sheet followed by its located issues', async () => {
    const run = harness();

    const code = await main(['--entrada', SHEETS_XLSX, '--listar'], run.io);

    expect(code).toBe(EXIT.ok);
    expect(run.stdout()).toContain(
      '"Data inválida" · Relatório de evento · com erros',
    );
    expect(run.stdout()).toContain(
      '  ERRO Folha "Data inválida", célula B5 — Início do evento: Data inválida: "31/02/2026".',
    );
  });

  it('exits 1 when listing a file whose data tabs have errors', async () => {
    const run = harness();

    const code = await main(
      ['--entrada', BROKEN_DATA_XLSX, '--listar'],
      run.io,
    );

    expect(code).toBe(EXIT.blocked);
    expect(run.stderr()).toContain(
      'ERRO Separador Movimentos, linha 2, coluna Atividade',
    );
  });

  it('exits 2 and suggests the closest sheet when the name is unknown', async () => {
    const run = harness();

    const code = await main(
      ['--entrada', XLSX, '--folha', 'Citadao 2026'],
      run.io,
    );

    expect(code).toBe(EXIT.usage);
    expect(run.stderr()).toContain(
      'Não existe a folha de relatório "Citadao 2026". Quis dizer "CITADÃO 2026"?',
    );
    expect(run.written.size).toBe(0);
  });

  it('lists the available sheets when no sheet name is close', async () => {
    const run = harness();

    const code = await main(['--entrada', XLSX, '--folha', 'xyz'], run.io);

    expect(code).toBe(EXIT.usage);
    expect(run.stderr()).toContain('Folhas de relatório: "Pegada 2026"');
  });

  it('prints the located issues of a sheet with errors and writes no PDF', async () => {
    const run = harness();

    const code = await main(
      ['--entrada', SHEETS_XLSX, '--folha', 'Data inválida'],
      run.io,
    );

    expect(code).toBe(EXIT.blocked);
    expect(run.stderr()).toContain(
      'ERRO Folha "Data inválida", célula B5 — Início do evento:',
    );
    expect(run.written.size).toBe(0);
    expect(run.rendered).toEqual([]);
  });

  it('prints the data-tab issues and writes no PDF when the data has errors', async () => {
    const run = harness();
    const bytes = await withReportSheets(BROKEN_DATA_XLSX, {
      'Fiscal 2025': await sheetFrom('fiscal-2025', 'fiscal'),
    });
    const io: CliIo = {
      ...run.io,
      readFile: (path) =>
        path === 'dados.xlsx' ? Promise.resolve(bytes) : run.io.readFile(path),
    };

    const code = await main(
      ['--entrada', 'dados.xlsx', '--folha', 'Fiscal 2025'],
      io,
    );

    expect(code).toBe(EXIT.blocked);
    expect(run.stderr()).toContain(
      'ERRO Separador Movimentos, linha 2, coluna Atividade',
    );
    expect(run.written.size).toBe(0);
    expect(run.rendered).toEqual([]);
  });

  it('refuses a removed flag with code 2 and the replacement hint', async () => {
    const run = harness();

    const code = await main(
      ['--entrada', XLSX, '--folha', 'Fiscal 2025', '--tipo', 'evento'],
      run.io,
    );

    expect(code).toBe(EXIT.usage);
    expect(run.stderr()).toContain('--tipo já não existe');
    expect(run.written.size).toBe(0);
  });

  it.each([['--saida'], ['--json']])(
    'exits 2, naming the path, when %s cannot be written',
    async (flag) => {
      const run = harness();
      const failing: CliIo = {
        ...run.io,
        writeFile: (path) =>
          path === '/nonexistent/out'
            ? Promise.reject(new Error('ENOENT: no such directory'))
            : Promise.resolve(),
      };

      const code = await main(
        ['--entrada', XLSX, '--folha', 'Fiscal 2025', flag, '/nonexistent/out'],
        failing,
      );

      expect(code).toBe(EXIT.usage);
      expect(run.stderr()).toContain(
        'Não foi possível escrever "/nonexistent/out": ENOENT',
      );
    },
  );

  it('exits 2 when the input file cannot be read', async () => {
    const run = harness();

    const code = await main(
      ['--entrada', 'nao-existe.xlsx', '--listar'],
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
      ['--entrada', XLSX, '--folha', 'Fiscal 2025', '--saida', 'r.pdf'],
      run.io,
    );

    expect(code).toBe(EXIT.internal);
    expect(run.stderr()).toContain('motor indisponível');
    expect(run.written.has('r.pdf')).toBe(false);
  });

  it('stamps the Lisbon wall-clock time, not UTC, when --agora is omitted', async () => {
    const run = harness({ now: new Date('2026-07-15T11:30:00Z') });

    await main(
      ['--entrada', XLSX, '--folha', 'Fiscal 2025', '--json', 'r.json'],
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
        '--entrada',
        XLSX,
        '--folha',
        'Fiscal 2025',
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
          '--entrada',
          XLSX,
          '--folha',
          'CITADÃO 2026',
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
