import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildExampleJson,
  buildExampleReports,
} from '../../scripts/lib/example-json.ts';
import type { ReportJson } from '../../src/core/reports/index.ts';
import { loadConfig } from '../../src/core/config/schema.ts';
import { buildReport } from '../../src/core/pipeline.ts';
import { letivoParamsSchema } from '../../src/core/reports/index.ts';
import config from '../../config/config.json';
import { loadGenerated } from '../support/generated.ts';
import {
  budgetOf,
  compositionOf,
  eur,
  kindsOf,
  movementsOf,
  sectionOf,
} from '../support/reports.ts';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

let reports: Map<string, ReportJson>;

const report = (name: string): ReportJson => {
  const found = reports.get(name);
  if (found === undefined) throw new Error(`No example ${name}`);
  return found;
};

beforeAll(async () => {
  reports = await buildExampleReports();
});

const textsOf = (
  rows: readonly { label: string; value: { text: string } }[],
): Record<string, string> =>
  Object.fromEntries(rows.map((row) => [row.label, row.value.text]));

describe('20º CITADÃO report', () => {
  it('prints the summary cards in whole euros', () => {
    const cards = Object.fromEntries(
      sectionOf(report('evento-citadao'), 'kpis').cards.map((c) => [
        c.label,
        c.value,
      ]),
    );

    expect(cards).toEqual({
      Recebido: eur('20.225 €'),
      Pago: eur('15.927 €'),
      Resultado: eur('4.298 €'),
      'Por receber': eur('250 €'),
      'Por pagar': eur('0 €'),
      'Resultado previsto': eur('4.548 €'),
      'Apoios em espécie': eur('2.930 €'),
    });
  });

  it('prints the composition totals and the budget totals to the cent', () => {
    const citadao = report('evento-citadao');

    expect(compositionOf(citadao, 'Composição do recebido').total.text).toBe(
      eur('20.225,20 €'),
    );
    expect(compositionOf(citadao, 'Composição do pago').total.text).toBe(
      eur('15.927,00 €'),
    );
    const receitas = budgetOf(citadao, 'Receitas: orçado e realizado');
    expect(receitas.total).toMatchObject({
      orcado: { text: eur('20.000,00 €') },
      realizado: { text: eur('20.225,20 €') },
      desvio: { text: eur('+225,20 €') },
      execucao: '101,1%',
    });
    expect(receitas.rows.find((r) => r.label === 'Bilheteira')).toMatchObject({
      orcado: { text: eur('3.500,00 €') },
      realizado: { text: eur('3.870,00 €') },
      execucao: '110,6%',
    });
    expect(
      budgetOf(citadao, 'Despesas: orçado e realizado').total,
    ).toMatchObject({
      orcado: { text: eur('15.535,00 €') },
      realizado: { text: eur('15.927,00 €') },
      desvio: { text: eur('+392,00 €') },
      execucao: '102,5%',
    });
  });

  it('carries the indicators, the pending line and the notes', () => {
    const citadao = report('evento-citadao');

    expect(sectionOf(citadao, 'indicators').rows).toHaveLength(5);
    expect(sectionOf(citadao, 'pending').totals.receber.text).toBe(
      eur('250,00 €'),
    );
    expect(sectionOf(citadao, 'text').title).toBe('Notas / Comentários');
  });
});

describe('Zumba na Caneca report', () => {
  const zumba = () => report('evento-zumba');

  it('counts 4 receipts and 6 payments and lists 10 cash book rows ending on the event result', () => {
    const cards = sectionOf(zumba(), 'kpis').cards;
    const book = movementsOf(zumba());

    expect(cards.slice(0, 2).map((card) => card.caption)).toEqual([
      '4 movimentos',
      '6 movimentos',
    ]);
    expect(book.rows).toHaveLength(10);
    expect(book.rows.at(-1)?.acumulado?.text).toBe(eur('1.480,10 €'));
    expect(book.outside).toBeUndefined();
  });

  it('labels the composition with sub-rubric names and the shares as whole percent', () => {
    const { segments, total } = compositionOf(
      zumba(),
      'Composição do recebido',
    );

    expect(total.text).toBe(eur('2.927,50 €'));
    expect(segments.map((s) => [s.label, s.value.text, s.shareText])).toEqual([
      ['Bar', eur('1.482,50 €'), '51%'],
      ['Inscrições', eur('1.235,00 €'), '42%'],
      ['Patrocínio do evento', eur('150,00 €'), '5%'],
      ['Donativos', eur('60,00 €'), '2%'],
    ]);
  });

  it('has no budget section for an event without budget lines', () => {
    expect(kindsOf(zumba())).not.toContain('budget');
  });
});

describe('pegada report', () => {
  it('prints the handover balances and the net position to the cent', () => {
    const pegada = report('pegada-2026');

    expect(sectionOf(pegada, 'summary').text).toBe(
      eur(
        'Valor entregue: 13.844,05 € (caixa 579,00 €, banco 13.265,05 €). Com os pendentes, a posição líquida é 13.964,05 €.',
      ),
    );

    expect(textsOf(sectionOf(pegada, 'bridge').rows)).toMatchObject({
      'Saldo inicial': eur('13.478,05 €'),
      '(+) Recebimentos': eur('720,00 €'),
      '(−) Pagamentos': eur('354,00 €'),
      'Saldo final': eur('13.844,05 €'),
      'Em caixa': eur('579,00 €'),
      'Em banco': eur('13.265,05 €'),
    });
    expect(sectionOf(pegada, 'position').net.text).toBe(eur('13.964,05 €'));
    expect(sectionOf(pegada, 'kpis').cards[0]?.value).toBe(eur('13.844 €'));
  });

  it('closes the reconciliation and the cash count with no difference', () => {
    const pegada = report('pegada-2026');

    expect(sectionOf(pegada, 'reconciliation').difference.text).toBe(
      eur('0,00 €'),
    );
    expect(sectionOf(pegada, 'cashCount')).toMatchObject({
      total: { text: eur('579,00 €') },
      difference: { text: eur('0,00 €') },
    });
  });

  it('closes the movement list onto the balance variation', () => {
    const movements = movementsOf(report('pegada-2026'));

    expect(movements.rows).toHaveLength(7);
    expect(movements.footer.at(-1)?.value.text).toBe(eur('366,00 €'));
  });
});

describe('letivo report', () => {
  const letivo = () => report('letivo-2025-26');

  it('prints the period bridge to the cent', () => {
    expect(textsOf(sectionOf(letivo(), 'bridge').rows)).toMatchObject({
      'Saldo inicial': eur('6.231,55 €'),
      '(+) Recebimentos': eur('27.792,70 €'),
      '(−) Pagamentos': eur('20.546,20 €'),
      'Saldo final': eur('13.478,05 €'),
    });
    expect(
      sectionOf(letivo(), 'kpis').cards.map((card) => card.caption),
    ).toEqual([
      undefined,
      '20 movimentos',
      '27 movimentos',
      expect.any(String),
    ]);
  });

  it('prints the result by activity with the negative result using the minus sign', () => {
    const { rows, total } = sectionOf(letivo(), 'byActivity');

    expect(rows.map((r) => [r.atividade, r.resultado.text])).toEqual([
      ['Funcionamento', eur('3.078,20 €')],
      ['Zumba na Caneca', eur('1.480,10 €')],
      ['20º CITADÃO', eur('4.298,20 €')],
      ['Festivais', eur('−1.610,00 €')],
    ]);
    expect(total.resultado.text).toBe(eur('7.246,50 €'));
  });

  it('ranks the largest receipt rubric first with its share', () => {
    const first = compositionOf(letivo(), 'Composição do recebido').segments[0];

    expect(first).toMatchObject({
      label: 'Bar e merchandising',
      value: { text: eur('8.437,70 €') },
      shareText: '30%',
    });
  });

  it('prints the commitments open at the end of the period and the in-kind total', () => {
    expect(sectionOf(letivo(), 'pending').totals).toEqual({
      receber: { cents: 37000, text: eur('370,00 €') },
      pagar: { cents: 6430, text: eur('64,30 €') },
    });
    expect(sectionOf(letivo(), 'inKind').total?.text).toBe(eur('2.930,00 €'));
  });

  it('compares with the same months of 2025', () => {
    const comparison = sectionOf(letivo(), 'yearComparison');

    expect(comparison.status).toBe('ok');
    expect(comparison.labels).toEqual([
      '01/01/2025 a 31/08/2025',
      '01/01/2026 a 31/08/2026',
    ]);
    expect(
      comparison.rows.find((row) => row.label === 'Total pago'),
    ).toMatchObject({
      previous: eur('20.230,60 €'),
      current: eur('20.546,20 €'),
    });
  });

  it('moves the transfer legs out of the result columns', () => {
    const movements = movementsOf(letivo());

    expect(movements.outside?.rows).toHaveLength(2);
    expect(movements.outside?.subtotal.text).toBe(eur('0,00 €'));
    expect(
      Object.fromEntries(movements.footer.map((l) => [l.label, l.value.text])),
    ).toMatchObject({
      'Entradas brutas': eur('27.792,70 €'),
      'Saídas brutas': eur('20.546,20 €'),
      'Variação no período': eur('7.246,50 €'),
    });
  });
});

describe('fiscal report', () => {
  const fiscal = () => report('fiscal-2025');

  it('prints the year bridge and the conferido row with the statement balance', () => {
    expect(textsOf(sectionOf(fiscal(), 'bridge').rows)).toMatchObject({
      'Saldo inicial': eur('4.098,15 €'),
      '(+) Recebimentos': eur('24.445,30 €'),
      '(−) Pagamentos': eur('22.311,90 €'),
      'Saldo final': eur('6.231,55 €'),
      'Saldo conferido com o extrato de 31/12/2025': eur('5.991,55 €'),
    });
  });

  it('compares with 2024 and draws the rubric bars', () => {
    const comparison = sectionOf(fiscal(), 'yearComparison');
    const row = (label: string) =>
      comparison.rows.find((candidate) => candidate.label === label);

    expect(comparison.labels).toEqual(['2024', '2025']);
    expect(row('Total recebido')).toMatchObject({
      previous: eur('21.700,00 €'),
      current: eur('24.445,30 €'),
      variation: eur('+2.745,30 €'),
    });
    expect(row('Total pago')).toMatchObject({
      previous: eur('19.660,45 €'),
      current: eur('22.311,90 €'),
    });
    expect(row('Saldo inicial')?.previous).toBe(eur('2.058,60 €'));
    expect(comparison.bars?.length).toBeGreaterThan(10);
  });

  it('lists the commitments open on 31/12 and the opinion, without the movement annex', () => {
    const pending = sectionOf(fiscal(), 'pending').totals;

    expect([pending.receber.text, pending.pagar.text]).toEqual([
      eur('1.000,00 €'),
      eur('450,00 €'),
    ]);
    expect(
      fiscal()
        .sections.filter((s) => s.kind === 'text')
        .map((s) => s.title),
    ).toEqual(['Parecer do Conselho Fiscal', 'Notas / Comentários']);
    expect(kindsOf(fiscal())).not.toContain('movements');
  });
});

describe('letivo without a previous year', () => {
  it('prints the comparison as sem dados and warns', async () => {
    const loaded = await loadGenerated('tesouraria.xlsx');

    const result = buildReport(
      'letivo',
      loaded,
      letivoParamsSchema.parse({ inicio: '2024-01-01', fim: '2024-08-31' }),
      {
        config: loadConfig(config),
        now: '2026-10-07T12:00:00',
        generatorVersion: '0.0.0',
      },
    );

    expect(result.status).toBe('report');
    if (result.status !== 'report') return;
    expect(sectionOf(result.report, 'yearComparison')).toMatchObject({
      status: 'sem-dados',
      rows: [],
    });
    expect(result.issues.map((issue) => issue.code)).toContain(
      'no-previous-data',
    );
  });
});

describe('every example', () => {
  const PERMILLE_KEY = /permille$/i;
  const NUMERIC_KEYS = new Set(['cents', 'schemaVersion']);

  function walk(
    value: unknown,
    path: string,
    visit: (key: string, value: unknown, path: string) => void,
  ): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        walk(item, `${path}[${String(index)}]`, visit);
      });
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, child] of Object.entries(value)) {
        visit(key, child, `${path}.${key}`);
        walk(child, `${path}.${key}`, visit);
      }
    }
  }

  it.each([
    'evento-citadao',
    'evento-zumba',
    'pegada-2026',
    'letivo-2025-26',
    'fiscal-2025',
  ])(
    '%s keeps every permille an integer in 0-1000 and numbers out of text slots',
    (name) => {
      walk(report(name), name, (key, value, path) => {
        if (PERMILLE_KEY.test(key)) {
          expect(Number.isInteger(value), path).toBe(true);
          expect(value as number, path).toBeGreaterThanOrEqual(0);
          expect(value as number, path).toBeLessThanOrEqual(1000);
        } else if (typeof value === 'number') {
          expect(NUMERIC_KEYS.has(key), path).toBe(true);
          expect(Number.isInteger(value), path).toBe(true);
        }
      });
    },
  );

  it('matches the committed example files', async () => {
    const directory = fileURLToPath(
      new URL('../../examples/', import.meta.url),
    );
    const expected = await buildExampleJson();

    expect(
      (await readdir(directory))
        .filter((file) => file.endsWith('.json'))
        .toSorted(),
    ).toEqual([...expected.keys()].toSorted());
    for (const [name, json] of expected) {
      expect(await readFile(`${directory}${name}`, 'utf8'), name).toBe(json);
    }
  });
});
