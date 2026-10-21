import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig } from '../core/config/schema.ts';
import type { Issue } from '../core/issues.ts';
import { lisbonDateTime } from '../host/lisbon-time.ts';
import type { ReportInstance, ReportStatus } from '../core/sheets/instance.ts';
import { REPORT_SPECS } from '../core/sheets/index.ts';
import { closest } from '../core/text.ts';
import { GENERATOR_VERSION } from '../core/version.ts';
import { loadWorkbook } from '../core/workbook.ts';
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

export const USAGE = `Uso:
  npm run gerar -- --entrada <ficheiro.xlsx> --listar
  npm run gerar -- --entrada <ficheiro.xlsx> --folha "<nome da folha>" [opções]

Cada relatório é uma folha do ficheiro; o tipo e os parâmetros vêm dessa folha.

Opções:
  --entrada <ficheiro>   Folha de Tesouraria (.xlsx). Um único ficheiro.
  --listar               Lista as folhas de relatório, o estado e os problemas de cada uma.
  --folha <nome>         Gera o relatório da folha com este nome (use --listar para ver os nomes).
  --saida <ficheiro>     PDF a escrever (por omissão "<data> <relatório>.pdf" na pasta atual).
                         Substitui um ficheiro existente.
  --json <ficheiro>      Escreve também o JSON do relatório. Substitui um ficheiro existente.
  --agora <aaaa-mm-ddThh:mm>
                         Data e hora de geração, em hora de Lisboa (por omissão, agora).
  --ajuda                Mostra esta ajuda.

Códigos de saída:
  0  PDF gerado (pode haver avisos), ou lista impressa
  1  erros nos dados ou na folha; nenhum PDF escrito
  2  utilização incorreta (argumentos, ficheiro ou nome de folha inválidos)
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

const STATUS_LABEL: Record<ReportStatus, string> = {
  'por-preencher': 'por preencher',
  'bloqueado-dados': 'bloqueado pelos dados',
  'com-erros': 'com erros',
  'pronto-com-avisos': 'pronto, com avisos',
  pronto: 'pronto',
};

function printIssues(
  issues: readonly Issue[],
  io: CliIo,
  stream: 'stdout' | 'stderr',
): void {
  for (const issue of sortedForPrinting(issues)) {
    io[stream](`${formatIssue(issue)}\n`);
  }
}

async function readWorkbook(options: CliOptions, io: CliIo) {
  let bytes: Uint8Array;
  try {
    bytes = await io.readFile(options.entrada);
  } catch (error) {
    throw new UsageError(
      `Não foi possível ler o ficheiro "${options.entrada}": ${reason(error)}`,
    );
  }
  const config = loadConfig(
    JSON.parse(new TextDecoder().decode(await io.readFile(CONFIG_PATH))),
  );
  const now =
    options.agora === null ? lisbonDateTime(io.now()) : `${options.agora}:00`;
  return loadWorkbook(
    { name: basename(options.entrada), bytes },
    { config, now, generatorVersion: GENERATOR_VERSION },
  );
}

function describeInstance(instance: ReportInstance): string {
  const tipo =
    instance.tipo === null
      ? 'tipo desconhecido'
      : REPORT_SPECS[instance.tipo].label;
  const dates = instance.dates.map(({ label, text }) => `${label}: ${text}`);
  return [
    `"${instance.sheet}"`,
    tipo,
    STATUS_LABEL[instance.status],
    ...dates,
  ].join(' · ');
}

function listReports(reports: readonly ReportInstance[], io: CliIo): void {
  if (reports.length === 0) {
    io.stdout('O ficheiro não tem folhas de relatório.\n');
    return;
  }
  for (const instance of reports) {
    io.stdout(`${describeInstance(instance)}\n`);
    for (const issue of sortedForPrinting(instance.issues)) {
      io.stdout(`  ${formatIssue(issue)}\n`);
    }
  }
}

function findSheet(
  reports: readonly ReportInstance[],
  name: string,
): ReportInstance {
  const found = reports.find(
    ({ sheet }) => sheet.normalize('NFC') === name.normalize('NFC'),
  );
  if (found !== undefined) return found;
  const names = reports.map(({ sheet }) => sheet);
  const near = closest(name, names);
  const hint =
    near === null
      ? names.length === 0
        ? 'O ficheiro não tem folhas de relatório.'
        : `Folhas de relatório: ${names.map((sheet) => `"${sheet}"`).join(', ')}.`
      : `Quis dizer "${near}"?`;
  throw new UsageError(`Não existe a folha de relatório "${name}". ${hint}`);
}

async function writeOutput(
  io: CliIo,
  path: string,
  data: Uint8Array | string,
): Promise<void> {
  try {
    await io.writeFile(path, data);
  } catch (error) {
    throw new UsageError(
      `Não foi possível escrever "${path}": ${reason(error)}`,
    );
  }
}

async function run(options: CliOptions, io: CliIo): Promise<number> {
  const workbook = await readWorkbook(options, io);
  const dataIssues = workbook.load.issues;

  if (options.listar) {
    printIssues(dataIssues, io, 'stdout');
    listReports(workbook.reports, io);
    return dataIssues.some(({ severity }) => severity === 'error')
      ? EXIT.blocked
      : EXIT.ok;
  }

  const instance = findSheet(workbook.reports, options.folha ?? '');
  const { report } = instance;
  if (report === undefined || instance.tipo === null) {
    printIssues(
      instance.status === 'bloqueado-dados' ? dataIssues : instance.issues,
      io,
      'stderr',
    );
    io.stderr(
      `A folha "${instance.sheet}" não está pronta (${STATUS_LABEL[instance.status]}); nenhum PDF escrito.\n`,
    );
    return EXIT.blocked;
  }

  printIssues([...dataIssues, ...instance.issues], io, 'stderr');
  if (options.json !== null) {
    await writeOutput(io, options.json, `${JSON.stringify(report, null, 2)}\n`);
  }
  let pdf: Uint8Array;
  try {
    const renderer = await io.createRenderer();
    const rendered = await renderer.render(instance.tipo, report);
    for (const warning of rendered.warnings) {
      io.stderr(`AVISO motor de PDF: ${warning}\n`);
    }
    pdf = rendered.pdf;
  } catch (error) {
    io.stderr(`Erro ao gerar o PDF: ${reason(error)}\n`);
    return EXIT.internal;
  }
  const saida = options.saida ?? `${instance.fileStem}.pdf`;
  await writeOutput(io, saida, pdf);

  io.stdout(`PDF escrito em ${saida}\n`);
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
