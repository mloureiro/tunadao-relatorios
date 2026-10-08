import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { z } from 'zod';
import { loadConfig } from '../core/config/schema.ts';
import type { Issue } from '../core/issues.ts';
import { lisbonDateTime } from '../host/lisbon-time.ts';
import {
  buildReport,
  loadDataset,
  type BuildReportResult,
  type InputFile,
  type LoadResult,
} from '../core/pipeline.ts';
import {
  paramsSchemas,
  type ParamsByTipo,
  type ReportTipo,
} from '../core/reports/index.ts';
import { GENERATOR_VERSION } from '../core/version.ts';
import { createNodeRenderer } from '../engine/typst-node.ts';
import type { Renderer } from '../engine/renderer.ts';
import { parseCliArgs, type CliOptions } from './args.ts';
import { formatIssue, sortedForPrinting } from './format-issues.ts';

export const EXIT = {
  ok: 0,
  blocked: 1,
  usage: 2,
  internal: 3,
} as const;

export const USAGE = `Uso: npm run gerar -- --tipo <tipo> --entrada <ficheiro> [opções]

Tipos de relatório (--tipo):
  evento | pegada | letivo | fiscal

Opções:
  --entrada <ficheiro>   Folha de Tesouraria (.xlsx) ou um CSV por separador. Repetível.
  --params <ficheiro>    Ficheiro JSON com os parâmetros do relatório.
  --param chave=valor    Um parâmetro; repetível e prevalece sobre --params.
                         Use pontos para campos aninhados (aberturaManual.caixa=100).
  --saida <ficheiro>     PDF a escrever (por omissão relatorio-<tipo>.pdf).
  --json <ficheiro>      Escreve também o JSON do relatório.
  --agora <aaaa-mm-ddThh:mm>
                         Data e hora de geração, em hora de Lisboa (por omissão, agora).
  --ajuda                Mostra esta ajuda.

Códigos de saída:
  0  PDF gerado (pode haver avisos)
  1  erros nos dados de entrada; nenhum PDF escrito
  2  utilização incorreta (argumentos, ficheiros ou parâmetros inválidos)
  3  erro interno ao gerar o relatório ou o PDF`;

export interface CliIo {
  stdout(text: string): void;
  stderr(text: string): void;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array | string): Promise<void>;
  now(): Date;
  createRenderer(): Promise<Renderer>;
}

export const nodeIo: CliIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  readFile: async (path) => new Uint8Array(await readFile(path)),
  writeFile,
  now: () => new Date(),
  createRenderer: () => createNodeRenderer(),
};

const CONFIG_PATH = fileURLToPath(
  new URL('../../config/config.json', import.meta.url),
);

class UsageError extends Error {}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function setPath(
  target: Record<string, unknown>,
  key: string,
  value: string,
): void {
  const steps = key.split('.');
  const last = steps.pop() ?? key;
  let cursor = target;
  for (const step of steps) {
    const next = cursor[step];
    if (typeof next === 'object' && next !== null && !Array.isArray(next)) {
      cursor = next as Record<string, unknown>;
    } else {
      const created: Record<string, unknown> = {};
      cursor[step] = created;
      cursor = created;
    }
  }
  cursor[last] = value;
}

async function readParams(
  options: CliOptions,
  io: CliIo,
): Promise<Record<string, unknown>> {
  let raw: Record<string, unknown> = {};
  if (options.paramsFile !== null) {
    let parsed: unknown;
    try {
      const text = new TextDecoder().decode(
        await io.readFile(options.paramsFile),
      );
      parsed = JSON.parse(text);
    } catch (error) {
      throw new UsageError(
        `Não foi possível ler os parâmetros de "${options.paramsFile}": ${reason(error)}`,
      );
    }
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new UsageError(
        `O ficheiro de parâmetros "${options.paramsFile}" tem de conter um objeto JSON.`,
      );
    }
    raw = parsed as Record<string, unknown>;
  }
  for (const [key, value] of options.params) setPath(raw, key, value);
  return raw;
}

async function readInputs(
  paths: readonly string[],
  io: CliIo,
): Promise<InputFile[]> {
  return Promise.all(
    paths.map(async (path) => {
      try {
        return { name: basename(path), bytes: await io.readFile(path) };
      } catch (error) {
        throw new UsageError(
          `Não foi possível ler o ficheiro "${path}": ${reason(error)}`,
        );
      }
    }),
  );
}

type Evaluation =
  | { readonly status: 'invalid'; readonly messages: readonly string[] }
  | BuildReportResult;

function paramMessages(issues: readonly z.core.$ZodIssue[]): string[] {
  return issues.map(({ path, message }) => {
    const where = path.map(String).join('.');
    return `ERRO parâmetro ${where === '' ? '' : `${where}: `}${message}`;
  });
}

type BuildContext = Parameters<typeof buildReport>[3];

function evaluateWith<T extends ReportTipo>(
  tipo: T,
  schema: z.ZodType<ParamsByTipo[T]>,
  raw: Record<string, unknown>,
  loaded: LoadResult,
  context: BuildContext,
): Evaluation {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { status: 'invalid', messages: paramMessages(parsed.error.issues) };
  }
  return buildReport(tipo, loaded, parsed.data, context);
}

function evaluate(
  tipo: ReportTipo,
  raw: Record<string, unknown>,
  loaded: LoadResult,
  context: BuildContext,
): Evaluation {
  switch (tipo) {
    case 'evento':
      return evaluateWith(tipo, paramsSchemas.evento, raw, loaded, context);
    case 'pegada':
      return evaluateWith(tipo, paramsSchemas.pegada, raw, loaded, context);
    case 'letivo':
      return evaluateWith(tipo, paramsSchemas.letivo, raw, loaded, context);
    case 'fiscal':
      return evaluateWith(tipo, paramsSchemas.fiscal, raw, loaded, context);
  }
}

function printIssues(issues: readonly Issue[], io: CliIo): void {
  for (const issue of sortedForPrinting(issues)) {
    io.stderr(`${formatIssue(issue)}\n`);
  }
}

async function run(options: CliOptions, io: CliIo): Promise<number> {
  const raw = await readParams(options, io);
  const inputs = await readInputs(options.entradas, io);
  const config = loadConfig(
    JSON.parse(new TextDecoder().decode(await io.readFile(CONFIG_PATH))),
  );
  const now =
    options.agora === null ? lisbonDateTime(io.now()) : `${options.agora}:00`;

  const loaded = await loadDataset(inputs);
  const result = evaluate(options.tipo, raw, loaded, {
    config,
    now,
    generatorVersion: GENERATOR_VERSION,
  });

  if (result.status === 'invalid') {
    for (const message of result.messages) io.stderr(`${message}\n`);
    return EXIT.usage;
  }
  if (result.status === 'blocked') {
    printIssues(result.issues, io);
    return EXIT.blocked;
  }
  if (result.status === 'failure') {
    io.stderr(`Erro interno ao gerar o relatório: ${result.message}\n`);
    return EXIT.internal;
  }

  printIssues(result.issues, io);
  try {
    if (options.json !== null) {
      await io.writeFile(
        options.json,
        `${JSON.stringify(result.report, null, 2)}\n`,
      );
    }
    const renderer = await io.createRenderer();
    const { pdf, warnings } = await renderer.render(
      options.tipo,
      result.report,
    );
    for (const warning of warnings)
      io.stderr(`AVISO motor de PDF: ${warning}\n`);
    await io.writeFile(options.saida, pdf);
  } catch (error) {
    io.stderr(`Erro ao gerar o PDF: ${reason(error)}\n`);
    return EXIT.internal;
  }

  io.stdout(`PDF escrito em ${options.saida}\n`);
  return EXIT.ok;
}

export async function main(
  argv: readonly string[],
  io: CliIo = nodeIo,
): Promise<number> {
  const parsed = parseCliArgs(argv);
  if (parsed.kind === 'help') {
    io.stdout(`${USAGE}\n`);
    return EXIT.ok;
  }
  if (parsed.kind === 'usage-error') {
    io.stderr(`${parsed.message}\n\n${USAGE}\n`);
    return EXIT.usage;
  }
  try {
    return await run(parsed.options, io);
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`${error.message}\n`);
      return EXIT.usage;
    }
    io.stderr(`Erro interno ao gerar o relatório: ${reason(error)}\n`);
    return EXIT.internal;
  }
}

if (process.argv[1] !== undefined) {
  if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exitCode = await main(process.argv.slice(2));
  }
}
