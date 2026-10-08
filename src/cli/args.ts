import { parseArgs } from 'node:util';
import type { ReportTipo } from '../core/reports/index.ts';

export const REPORT_TIPOS = [
  'evento',
  'pegada',
  'letivo',
  'fiscal',
] as const satisfies readonly ReportTipo[];

export interface CliOptions {
  readonly tipo: ReportTipo;
  readonly entradas: readonly string[];
  readonly paramsFile: string | null;
  readonly params: ReadonlyMap<string, string>;
  readonly saida: string;
  readonly json: string | null;
  readonly agora: string | null;
}

export type ParsedArgs =
  | { readonly kind: 'help' }
  | { readonly kind: 'usage-error'; readonly message: string }
  | { readonly kind: 'run'; readonly options: CliOptions };

const AGORA = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function isLisbonWallClock(value: string): boolean {
  const match = AGORA.exec(value);
  if (match === null) return false;
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute
  );
}

function isTipo(value: string): value is ReportTipo {
  return (REPORT_TIPOS as readonly string[]).includes(value);
}

function usageError(message: string): ParsedArgs {
  return { kind: 'usage-error', message };
}

export function parseParamPairs(
  pairs: readonly string[],
): ReadonlyMap<string, string> | string {
  const params = new Map<string, string>();
  for (const pair of pairs) {
    const separator = pair.indexOf('=');
    if (separator <= 0) {
      return `O parâmetro "${pair}" tem de ter a forma chave=valor.`;
    }
    params.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  return params;
}

export function parseCliArgs(argv: readonly string[]): ParsedArgs {
  let values;
  try {
    ({ values } = parseArgs({
      args: [...argv],
      allowPositionals: false,
      options: {
        tipo: { type: 'string' },
        entrada: { type: 'string', multiple: true },
        param: { type: 'string', multiple: true },
        params: { type: 'string' },
        saida: { type: 'string' },
        json: { type: 'string' },
        agora: { type: 'string' },
        ajuda: { type: 'boolean' },
      },
    }));
  } catch (error) {
    return usageError(
      `Argumentos inválidos: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (values.ajuda === true) return { kind: 'help' };

  const { tipo } = values;
  if (tipo === undefined) return usageError('Falta indicar --tipo.');
  if (!isTipo(tipo)) {
    return usageError(
      `Tipo de relatório desconhecido: "${tipo}". Valores aceites: ${REPORT_TIPOS.join(', ')}.`,
    );
  }

  const entradas = values.entrada ?? [];
  if (entradas.length === 0) {
    return usageError('Falta indicar pelo menos um ficheiro com --entrada.');
  }

  const params = parseParamPairs(values.param ?? []);
  if (typeof params === 'string') return usageError(params);

  const { agora } = values;
  if (agora !== undefined && !isLisbonWallClock(agora)) {
    return usageError(
      `--agora "${agora}" inválido. Use aaaa-mm-ddThh:mm, em hora de Lisboa.`,
    );
  }

  return {
    kind: 'run',
    options: {
      tipo,
      entradas,
      paramsFile: values.params ?? null,
      params,
      saida: values.saida ?? `relatorio-${tipo}.pdf`,
      json: values.json ?? null,
      agora: agora ?? null,
    },
  };
}
