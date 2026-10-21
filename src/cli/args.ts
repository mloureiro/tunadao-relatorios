import { parseArgs } from 'node:util';

export interface CliOptions {
  readonly entrada: string;
  readonly folha: string | null;
  readonly listar: boolean;
  readonly saida: string | null;
  readonly json: string | null;
  readonly agora: string | null;
}

export type ParsedArgs =
  | { readonly kind: 'help' }
  | { readonly kind: 'usage-error'; readonly message: string }
  | { readonly kind: 'run'; readonly options: CliOptions };

const AGORA = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const REMOVED_OPTIONS = {
  tipo: 'O tipo vem da folha do relatório no ficheiro. Use --folha "<nome da folha>" (veja os nomes com --listar).',
  param:
    'Os parâmetros preenchem-se na folha do relatório, dentro do ficheiro .xlsx. Use --folha "<nome da folha>".',
  params:
    'Os parâmetros preenchem-se na folha do relatório, dentro do ficheiro .xlsx. Use --folha "<nome da folha>".',
} as const;

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

function usageError(message: string): ParsedArgs {
  return { kind: 'usage-error', message };
}

export function parseCliArgs(argv: readonly string[]): ParsedArgs {
  let values;
  try {
    ({ values } = parseArgs({
      args: [...argv],
      allowPositionals: false,
      options: {
        entrada: { type: 'string', multiple: true },
        folha: { type: 'string' },
        listar: { type: 'boolean' },
        saida: { type: 'string' },
        json: { type: 'string' },
        agora: { type: 'string' },
        ajuda: { type: 'boolean' },
        tipo: { type: 'string', multiple: true },
        param: { type: 'string', multiple: true },
        params: { type: 'string', multiple: true },
      },
    }));
  } catch (error) {
    return usageError(
      `Argumentos inválidos: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (values.ajuda === true) return { kind: 'help' };

  for (const [name, hint] of Object.entries(REMOVED_OPTIONS)) {
    if (name in values) return usageError(`--${name} já não existe. ${hint}`);
  }

  const entradas = values.entrada ?? [];
  const [entrada] = entradas;
  if (entrada === undefined) {
    return usageError('Falta indicar o ficheiro com --entrada.');
  }
  if (entradas.length > 1) {
    return usageError('Indique um único ficheiro com --entrada.');
  }
  if (!entrada.toLowerCase().endsWith('.xlsx')) {
    return usageError(
      `--entrada "${entrada}" não é um ficheiro .xlsx. Só se aceitam folhas de Tesouraria em .xlsx.`,
    );
  }

  const listar = values.listar === true;
  const folha = values.folha ?? null;
  if (listar && folha !== null) {
    return usageError('--folha e --listar não podem ser usados em conjunto.');
  }
  if (!listar && folha === null) {
    return usageError(
      'Indique --folha "<nome da folha>" para gerar um relatório, ou --listar para ver os relatórios do ficheiro.',
    );
  }

  const { agora } = values;
  if (agora !== undefined && !isLisbonWallClock(agora)) {
    return usageError(
      `--agora "${agora}" inválido. Use aaaa-mm-ddThh:mm, em hora de Lisboa.`,
    );
  }

  return {
    kind: 'run',
    options: {
      entrada,
      folha,
      listar,
      saida: values.saida ?? null,
      json: values.json ?? null,
      agora: agora ?? null,
    },
  };
}
