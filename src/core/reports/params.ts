import { z } from 'zod';
import { DENOMINATIONS_CENTS, type DenominationCents } from '../calc/index.ts';
import type { ManualOpening } from '../calc/index.ts';
import type { Cents } from '../dataset/types.ts';
import { compare, parseDateText, type IsoDate } from '../dates.ts';
import { parseMoney } from '../money.ts';

export interface Indicator {
  readonly label: string;
  readonly value: string;
}

export interface UnclearedParam {
  readonly descricao: string;
  readonly valorCents: Cents;
}

export interface EventoParams {
  readonly atividade: string;
  readonly eventoInicio: IsoDate;
  readonly eventoFim: IsoDate;
  readonly contarAte?: IsoDate;
  readonly refPendentes: IsoDate;
  readonly ambitoOrcamento: string;
  readonly indicadores: readonly Indicator[];
  readonly notas?: string;
  readonly anexarJson: boolean;
}

export interface PegadaParams {
  readonly dataUltimoRelatorio: IsoDate;
  readonly dataPassagem: IsoDate;
  readonly direcaoCessante: string;
  readonly direcaoEntrante: string;
  readonly saldoExtratoCents: Cents;
  readonly naoDebitados: readonly UnclearedParam[];
  readonly naoCreditados: readonly UnclearedParam[];
  readonly contagem: Readonly<Partial<Record<DenominationCents, number>>>;
  readonly moedasPequenasCents?: Cents;
  readonly aberturaManual?: ManualOpening;
  readonly notas?: string;
  readonly anexarJson: boolean;
}

export interface LetivoParams {
  readonly inicio: IsoDate;
  readonly fim: IsoDate;
  readonly ambitoOrcamento?: string;
  readonly aberturaManual?: ManualOpening;
  readonly notas?: string;
  readonly anexar: boolean;
  readonly anexarJson: boolean;
}

export interface FiscalParams {
  readonly ano: number;
  readonly ambitoOrcamento: string;
  readonly parecerCF?: string;
  readonly notas?: string;
  readonly anexoMovimentos: boolean;
  readonly aberturaManual?: ManualOpening;
  readonly anexarJson: boolean;
}

function definedOnly<T extends object>(
  value: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as { [K in keyof T]?: Exclude<T[K], undefined> };
}

const blankAsAbsent = (value: unknown): unknown =>
  value === '' || value === null ? undefined : value;

function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess(blankAsAbsent, schema.optional());
}

const money = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const parsed = parseMoney(value);
  if ('issue' in parsed) {
    ctx.issues.push({
      code: 'custom',
      message: `Valor monetário inválido: "${String(value)}".`,
      input: value,
    });
    return z.NEVER;
  }
  return parsed.cents;
});

const date = z.string().transform((value, ctx): IsoDate => {
  const parsed = parseDateText(value);
  if (parsed === null) {
    ctx.issues.push({
      code: 'custom',
      message: `Data inválida: "${value}". Use aaaa-mm-dd ou dd/mm/aaaa.`,
      input: value,
    });
    return z.NEVER;
  }
  return parsed;
});

const text = z.string().trim().min(1, 'Campo obrigatório.');

const notes = optional(z.string()).transform((value) => {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? undefined : trimmed;
});

const flag = (fallback: boolean) =>
  z
    .union([
      z.boolean(),
      z.enum(['true', 'false']).transform((v) => v === 'true'),
    ])
    .default(fallback);

const positiveMoney = money.refine((cents) => cents > 0, {
  message: 'O valor tem de ser superior a zero.',
});

const uncleared = z.strictObject({
  descricao: text,
  valor: positiveMoney,
});

const manualOpening = optional(
  z.strictObject({ caixa: optional(money), banco: optional(money) }),
).transform((value): ManualOpening | undefined => {
  if (value === undefined) return undefined;
  const opening = definedOnly({ Caixa: value.caixa, Banco: value.banco });
  return Object.keys(opening).length === 0 ? undefined : opening;
});

const indicators = z
  .array(
    z
      .strictObject({ label: z.string(), value: z.string() })
      .refine(
        ({ label, value }) => (label.trim() === '') === (value.trim() === ''),
        { message: 'Indique a designação e o valor do indicador.' },
      ),
  )
  .default([])
  .transform((rows): Indicator[] =>
    rows
      .filter(({ label }) => label.trim() !== '')
      .map(({ label, value }) => ({
        label: label.trim(),
        value: value.trim(),
      })),
  );

const denominationByCents = new Map<number, DenominationCents>(
  DENOMINATIONS_CENTS.map((cents) => [cents, cents]),
);

const cashCount = z
  .record(z.string(), z.coerce.number().int().min(0))
  .default({})
  .transform((entries, ctx) => {
    const counted: Partial<Record<DenominationCents, number>> = {};
    for (const [euros, quantity] of Object.entries(entries)) {
      const parsed = parseMoney(euros);
      const denomination =
        'cents' in parsed ? denominationByCents.get(parsed.cents) : undefined;
      if (denomination === undefined) {
        ctx.issues.push({
          code: 'custom',
          message: `Denominação desconhecida: "${euros}".`,
          input: euros,
        });
      } else if (counted[denomination] !== undefined) {
        ctx.issues.push({
          code: 'custom',
          message: `Denominação repetida: "${euros}".`,
          input: euros,
        });
      } else {
        counted[denomination] = quantity;
      }
    }
    return counted;
  });

const ordered = (from: IsoDate, to: IsoDate) => compare(from, to) <= 0;

export const eventoParamsSchema = z
  .strictObject({
    atividade: text,
    eventoInicio: date,
    eventoFim: date,
    contarAte: optional(date),
    refPendentes: date,
    ambitoOrcamento: optional(text),
    indicadores: indicators,
    notas: notes,
    anexarJson: flag(true),
  })
  .refine(({ eventoInicio, eventoFim }) => ordered(eventoInicio, eventoFim), {
    message: 'O fim do evento não pode ser anterior ao início.',
    path: ['eventoFim'],
  })
  .transform((raw): EventoParams => ({
    atividade: raw.atividade,
    eventoInicio: raw.eventoInicio,
    eventoFim: raw.eventoFim,
    ...definedOnly({ contarAte: raw.contarAte }),
    refPendentes: raw.refPendentes,
    ambitoOrcamento: raw.ambitoOrcamento ?? raw.atividade,
    indicadores: raw.indicadores,
    ...definedOnly({ notas: raw.notas }),
    anexarJson: raw.anexarJson,
  }));

export const pegadaParamsSchema = z
  .strictObject({
    dataUltimoRelatorio: date,
    dataPassagem: date,
    direcaoCessante: text,
    direcaoEntrante: text,
    saldoExtrato: money,
    naoDebitados: z.array(uncleared).default([]),
    naoCreditados: z.array(uncleared).default([]),
    contagem: cashCount,
    moedasPequenas: optional(
      money.refine((cents) => cents >= 0, {
        message: 'O valor não pode ser negativo.',
      }),
    ),
    aberturaManual: manualOpening,
    notas: notes,
    anexarJson: flag(true),
  })
  .refine(
    ({ dataUltimoRelatorio, dataPassagem }) =>
      compare(dataUltimoRelatorio, dataPassagem) < 0,
    {
      message: 'A passagem tem de ser posterior ao último relatório.',
      path: ['dataPassagem'],
    },
  )
  .transform((raw): PegadaParams => ({
    dataUltimoRelatorio: raw.dataUltimoRelatorio,
    dataPassagem: raw.dataPassagem,
    direcaoCessante: raw.direcaoCessante,
    direcaoEntrante: raw.direcaoEntrante,
    saldoExtratoCents: raw.saldoExtrato,
    naoDebitados: raw.naoDebitados.map(({ descricao, valor }) => ({
      descricao,
      valorCents: valor,
    })),
    naoCreditados: raw.naoCreditados.map(({ descricao, valor }) => ({
      descricao,
      valorCents: valor,
    })),
    contagem: raw.contagem,
    ...definedOnly({
      moedasPequenasCents: raw.moedasPequenas,
      aberturaManual: raw.aberturaManual,
      notas: raw.notas,
    }),
    anexarJson: raw.anexarJson,
  }));

export const letivoParamsSchema = z
  .strictObject({
    inicio: date,
    fim: date,
    ambitoOrcamento: optional(text),
    aberturaManual: manualOpening,
    notas: notes,
    anexar: flag(true),
    anexarJson: flag(true),
  })
  .refine(({ inicio, fim }) => ordered(inicio, fim), {
    message: 'O fim do período não pode ser anterior ao início.',
    path: ['fim'],
  })
  .transform((raw): LetivoParams => ({
    inicio: raw.inicio,
    fim: raw.fim,
    ...definedOnly({
      ambitoOrcamento: raw.ambitoOrcamento,
      aberturaManual: raw.aberturaManual,
      notas: raw.notas,
    }),
    anexar: raw.anexar,
    anexarJson: raw.anexarJson,
  }));

export const fiscalParamsSchema = z
  .strictObject({
    ano: z.coerce.number().int().min(1900).max(9999),
    ambitoOrcamento: optional(text),
    parecerCF: notes,
    notas: notes,
    anexoMovimentos: flag(false),
    aberturaManual: manualOpening,
    anexarJson: flag(true),
  })
  .transform((raw): FiscalParams => ({
    ano: raw.ano,
    ambitoOrcamento: raw.ambitoOrcamento ?? String(raw.ano),
    ...definedOnly({
      parecerCF: raw.parecerCF,
      notas: raw.notas,
      aberturaManual: raw.aberturaManual,
    }),
    anexoMovimentos: raw.anexoMovimentos,
    anexarJson: raw.anexarJson,
  }));

export interface ParamsByTipo {
  readonly evento: EventoParams;
  readonly pegada: PegadaParams;
  readonly letivo: LetivoParams;
  readonly fiscal: FiscalParams;
}

export const paramsSchemas = {
  evento: eventoParamsSchema,
  pegada: pegadaParamsSchema,
  letivo: letivoParamsSchema,
  fiscal: fiscalParamsSchema,
} as const;
