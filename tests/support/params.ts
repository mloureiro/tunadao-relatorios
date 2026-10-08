import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  DENOMINATIONS_CENTS,
  type DenominationCents,
  type EventParams,
  type PegadaParams,
} from '../../src/core/calc/index.ts';
import type { Cents } from '../../src/core/dataset/types.ts';
import { parseMoney } from '../../src/core/money.ts';

const PARAMS = fileURLToPath(
  new URL('../../fixtures/params/', import.meta.url),
);

export async function readParams(name: string): Promise<unknown> {
  return JSON.parse(await readFile(`${PARAMS}${name}.json`, 'utf8'));
}

export function cents(euros: number | string): Cents {
  const parsed = parseMoney(euros);
  if ('issue' in parsed) {
    throw new Error(`Not a money value: ${String(euros)}`);
  }
  return parsed.cents;
}

const pegadaFile = z.object({
  dataUltimoRelatorio: z.string(),
  dataPassagem: z.string(),
  saldoExtrato: z.number(),
  naoDebitados: z.array(z.object({ descricao: z.string(), valor: z.number() })),
  naoCreditados: z.array(
    z.object({ descricao: z.string(), valor: z.number() }),
  ),
  contagem: z.record(z.string(), z.number()),
  moedasPequenas: z.number(),
});

const eventFile = z.object({
  atividade: z.string(),
  contarAte: z.string().optional(),
  refPendentes: z.string(),
});

function denomination(euros: string): DenominationCents {
  const value = cents(Number(euros));
  const known = DENOMINATIONS_CENTS.find((d) => d === value);
  if (known === undefined) throw new Error(`Unknown denomination ${euros}`);
  return known;
}

export async function loadPegadaParams(): Promise<PegadaParams> {
  const file = pegadaFile.parse(await readParams('pegada-2026'));
  const item = (i: { descricao: string; valor: number }) => ({
    descricao: i.descricao,
    valorCents: cents(i.valor),
  });
  return {
    dataUltimoRelatorio: file.dataUltimoRelatorio,
    dataPassagem: file.dataPassagem,
    saldoExtratoCents: cents(file.saldoExtrato),
    naoDebitados: file.naoDebitados.map(item),
    naoCreditados: file.naoCreditados.map(item),
    contagem: Object.fromEntries(
      Object.entries(file.contagem).map(([euros, quantity]) => [
        denomination(euros),
        quantity,
      ]),
    ),
    moedasPequenasCents: cents(file.moedasPequenas),
  };
}

export async function loadEventParams(name: string): Promise<EventParams> {
  const file = eventFile.parse(await readParams(name));
  return {
    atividade: file.atividade,
    ...(file.contarAte === undefined ? {} : { contarAte: file.contarAte }),
    refPendentes: file.refPendentes,
  };
}
