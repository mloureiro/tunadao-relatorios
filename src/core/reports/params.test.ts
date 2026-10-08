import { describe, expect, it } from 'vitest';
import {
  eventoParamsSchema,
  fiscalParamsSchema,
  letivoParamsSchema,
  pegadaParamsSchema,
} from './params.ts';

const evento = {
  atividade: 'Festival Alfa',
  eventoInicio: '2026-04-30',
  eventoFim: '03/05/2026',
  refPendentes: '15/06/2026',
};

const pegada = {
  dataUltimoRelatorio: '2026-08-31',
  dataPassagem: '2026-09-30',
  direcaoCessante: 'Direção A',
  direcaoEntrante: 'Direção B',
  saldoExtrato: 13265.05,
};

describe('date and money parsing', () => {
  it('accepts aaaa-mm-dd and dd/mm/aaaa and normalises both to ISO', () => {
    const parsed = eventoParamsSchema.parse(evento);

    expect(parsed.eventoInicio).toBe('2026-04-30');
    expect(parsed.eventoFim).toBe('2026-05-03');
    expect(parsed.refPendentes).toBe('2026-06-15');
  });

  it('rejects a date that does not exist, with a pt-PT message', () => {
    const result = eventoParamsSchema.safeParse({
      ...evento,
      eventoFim: '31/02/2026',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Data inválida: "31/02/2026". Use aaaa-mm-dd ou dd/mm/aaaa.',
    );
  });

  it.each([
    [13265.05, 1326505],
    ['13.265,05 €', 1326505],
    ['13265,05', 1326505],
    [-12.3, -1230],
    ['(1.000,00)', -100000],
  ])('turns the money value %s into %i integer cents', (value, cents) => {
    expect(
      pegadaParamsSchema.parse({ ...pegada, saldoExtrato: value })
        .saldoExtratoCents,
    ).toBe(cents);
  });

  it('rejects a sub-cent amount at its own field instead of rounding it', () => {
    const result = pegadaParamsSchema.safeParse({
      ...pegada,
      saldoExtrato: '10,005',
    });

    expect(result.error?.issues[0]).toMatchObject({
      path: ['saldoExtrato'],
      message: 'O valor "10,005" tem mais de 2 casas decimais.',
    });
  });

  it('rejects money that is not a number', () => {
    const result = pegadaParamsSchema.safeParse({
      ...pegada,
      saldoExtrato: 'muito',
    });

    expect(result.error?.issues[0]?.message).toBe(
      'Valor monetário inválido: "muito".',
    );
  });
});

describe('evento defaults and rules', () => {
  it('defaults the budget scope to the activity and keeps the JSON attachment on', () => {
    const parsed = eventoParamsSchema.parse(evento);

    expect(parsed).toMatchObject({
      ambitoOrcamento: 'Festival Alfa',
      anexarJson: true,
      indicadores: [],
    });
    expect(parsed).not.toHaveProperty('contarAte');
    expect(parsed).not.toHaveProperty('notas');
  });

  it('treats blank optional fields as absent', () => {
    const parsed = eventoParamsSchema.parse({
      ...evento,
      contarAte: '',
      ambitoOrcamento: '',
      notas: '  \n ',
    });

    expect(parsed).not.toHaveProperty('contarAte');
    expect(parsed).not.toHaveProperty('notas');
    expect(parsed.ambitoOrcamento).toBe('Festival Alfa');
  });

  it('keeps free-text indicators, dropping blank rows and rejecting half-filled ones', () => {
    const parsed = eventoParamsSchema.parse({
      ...evento,
      indicadores: [
        { label: ' Bilhetes vendidos ', value: ' 645 ' },
        { label: '', value: '' },
      ],
    });

    expect(parsed.indicadores).toEqual([
      { label: 'Bilhetes vendidos', value: '645' },
    ]);
    expect(
      eventoParamsSchema.safeParse({
        ...evento,
        indicadores: [{ label: 'Bilhetes', value: '' }],
      }).success,
    ).toBe(false);
  });

  it('rejects an event that ends before it starts', () => {
    const result = eventoParamsSchema.safeParse({
      ...evento,
      eventoFim: '2026-04-29',
    });

    expect(result.error?.issues[0]?.path).toEqual(['eventoFim']);
  });

  it('rejects a parameter it does not know', () => {
    expect(
      eventoParamsSchema.safeParse({ ...evento, contarAt: '2026-06-15' })
        .success,
    ).toBe(false);
  });
});

describe('pegada rules', () => {
  it('maps the cash count denominations written in euros onto cents', () => {
    const parsed = pegadaParamsSchema.parse({
      ...pegada,
      contagem: { '50': 8, '0,50': 3, '0.2': 1 },
      moedasPequenas: 6,
    });

    expect(parsed.contagem).toEqual({ 5000: 8, 50: 3, 20: 1 });
    expect(parsed.moedasPequenasCents).toBe(600);
  });

  it('rejects an unknown or repeated denomination', () => {
    expect(
      pegadaParamsSchema.safeParse({ ...pegada, contagem: { '3': 1 } }).success,
    ).toBe(false);
    expect(
      pegadaParamsSchema.safeParse({
        ...pegada,
        contagem: { '0,5': 1, '0.50': 2 },
      }).success,
    ).toBe(false);
  });

  it('converts uncleared items to cents and requires a positive value', () => {
    const parsed = pegadaParamsSchema.parse({
      ...pegada,
      naoDebitados: [{ descricao: 'Cheque 12', valor: '45,50' }],
    });

    expect(parsed.naoDebitados).toEqual([
      { descricao: 'Cheque 12', valorCents: 4550 },
    ]);
    expect(
      pegadaParamsSchema.safeParse({
        ...pegada,
        naoCreditados: [{ descricao: 'Depósito', valor: 0 }],
      }).success,
    ).toBe(false);
  });

  it('converts the manual opening to cents per account and drops an empty one', () => {
    expect(
      pegadaParamsSchema.parse({
        ...pegada,
        aberturaManual: { caixa: 100, banco: '1.234,56' },
      }).aberturaManual,
    ).toEqual({ Caixa: 10000, Banco: 123456 });
    expect(
      pegadaParamsSchema.parse({ ...pegada, aberturaManual: {} }),
    ).not.toHaveProperty('aberturaManual');
  });

  it('requires the handover to come after the last report', () => {
    expect(
      pegadaParamsSchema.safeParse({
        ...pegada,
        dataPassagem: '2026-08-31',
      }).success,
    ).toBe(false);
  });
});

describe('letivo and fiscal rules', () => {
  it('defaults the movement annex on for letivo and off for fiscal', () => {
    expect(
      letivoParamsSchema.parse({ inicio: '2026-01-01', fim: '2026-08-31' }),
    ).toMatchObject({ anexar: true, anexarJson: true });
    expect(fiscalParamsSchema.parse({ ano: 2025 })).toMatchObject({
      anexoMovimentos: false,
      anexarJson: true,
    });
  });

  it('defaults the fiscal budget scope to the year, as text', () => {
    expect(fiscalParamsSchema.parse({ ano: 2025 }).ambitoOrcamento).toBe(
      '2025',
    );
    expect(
      fiscalParamsSchema.parse({ ano: 2025, ambitoOrcamento: 'Plano 2025' })
        .ambitoOrcamento,
    ).toBe('Plano 2025');
  });

  it('accepts the string forms a command line delivers', () => {
    expect(
      fiscalParamsSchema.parse({
        ano: '2025',
        anexoMovimentos: 'true',
        anexarJson: 'false',
      }),
    ).toMatchObject({ ano: 2025, anexoMovimentos: true, anexarJson: false });
  });

  it('leaves the letivo budget scope unset when not given', () => {
    expect(
      letivoParamsSchema.parse({ inicio: '2026-01-01', fim: '2026-08-31' }),
    ).not.toHaveProperty('ambitoOrcamento');
  });

  it('rejects a letivo period that ends before it starts', () => {
    expect(
      letivoParamsSchema.safeParse({ inicio: '2026-09-01', fim: '2026-08-31' })
        .success,
    ).toBe(false);
  });
});

describe('error messages', () => {
  const ENGLISH =
    /Invalid|expected|Unrecognized|Too small|Too big|Required|Input/;

  it.each([
    ['unknown key', eventoParamsSchema, { ...evento, extra: 1 }],
    ['missing field', eventoParamsSchema, { ...evento, atividade: undefined }],
    ['wrong type', eventoParamsSchema, { ...evento, atividade: 5 }],
    ['blank text', eventoParamsSchema, { ...evento, atividade: '  ' }],
    [
      'bad flag',
      letivoParamsSchema,
      { inicio: '2026-01-01', fim: '2026-08-31', anexar: 'sim' },
    ],
    ['fraction year', fiscalParamsSchema, { ano: 2025.5 }],
    ['text year', fiscalParamsSchema, { ano: 'abc' }],
    ['small year', fiscalParamsSchema, { ano: 1800 }],
    [
      'negative count',
      pegadaParamsSchema,
      { ...pegada, contagem: { '5': -1 } },
    ],
    [
      'fraction count',
      pegadaParamsSchema,
      { ...pegada, contagem: { '5': 2.5 } },
    ],
    ['bad list', pegadaParamsSchema, { ...pegada, naoDebitados: 'x' }],
    [
      'bad item',
      pegadaParamsSchema,
      { ...pegada, naoDebitados: [{ descricao: 1 }] },
    ],
    [
      'bad opening',
      pegadaParamsSchema,
      { ...pegada, aberturaManual: { caixa: 'x', extra: 1 } },
    ],
  ])('speaks pt-PT for %s', (_, schema, input) => {
    const result = schema.safeParse(input);

    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((issue) => issue.message) ?? [];
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) expect(message).not.toMatch(ENGLISH);
  });
});
