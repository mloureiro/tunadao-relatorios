import { beforeAll, describe, expect, it } from 'vitest';
import {
  aggregate,
  annexFooter,
  budgetVsActual,
  byActivity,
  composition,
  eventFigures,
  inKind,
  inPeriod,
  pegadaFigures,
  pendingAt,
  periodFigures,
  previousPeriod,
} from '../../src/core/calc/index.ts';
import type { Dataset } from '../../src/core/dataset/types.ts';
import { loadGenerated } from '../support/generated.ts';
import { loadEventParams, loadPegadaParams } from '../support/params.ts';

let dataset: Dataset;

beforeAll(async () => {
  const loaded = await loadGenerated('tesouraria.xlsx');
  expect(loaded.issues).toEqual([]);
  dataset = loaded.dataset;
});

const rubricRows = (rows: { rubrica: string; netCents: number }[]) =>
  rows.map((row) => [row.rubrica, row.netCents]);

const RECEBIMENTOS_2025 = [
  ['Quotas', 126000],
  ['Donativos', 85000],
  ['Subsídios e apoios', 450000],
  ['Atuações e serenatas', 342000],
  ['Inscrições e bilheteira', 618000],
  ['Bar e merchandising', 594000],
  ['Patrocínios', 220000],
  ['Outros recebimentos', 9530],
];
const PAGAMENTOS_2025 = [
  ['Produção (som, luz, palco)', 635000],
  ['Alimentação e alojamento', 487000],
  ['Compras para o bar', 321560],
  ['Deslocações', 294000],
  ['Prémios e troféus', 78000],
  ['Instrumentos e manutenção', 112000],
  ['Merchandising e trajes', 145000],
  ['Comunicação e gráfica', 61000],
  ['Seguros e despesas bancárias', 41240],
  ['Taxas e licenças', 39500],
  ['Outros pagamentos', 16890],
];
const RECEBIMENTOS_2024 = [
  ['Quotas', 118000],
  ['Donativos', 62000],
  ['Subsídios e apoios', 400000],
  ['Atuações e serenatas', 298000],
  ['Inscrições e bilheteira', 571000],
  ['Bar e merchandising', 532000],
  ['Patrocínios', 185000],
  ['Outros recebimentos', 4000],
];
const PAGAMENTOS_2024 = [
  ['Produção (som, luz, palco)', 592000],
  ['Alimentação e alojamento', 441000],
  ['Compras para o bar', 296000],
  ['Deslocações', 261000],
  ['Prémios e troféus', 72000],
  ['Instrumentos e manutenção', 64000],
  ['Merchandising e trajes', 98000],
  ['Comunicação e gráfica', 54000],
  ['Seguros e despesas bancárias', 39810],
  ['Taxas e licenças', 36000],
  ['Outros pagamentos', 12235],
];

describe('fiscal 2025', () => {
  it('reproduces the year figures and balances', () => {
    const figures = periodFigures(dataset, '2025-01-01', '2025-12-31');

    expect(figures.issues).toEqual([]);
    expect(figures.recebidoCents).toBe(2444530);
    expect(figures.pagoCents).toBe(2231190);
    expect(figures.outrosCents).toBe(0);
    expect(figures.opening).toEqual({
      caixaCents: 18540,
      bancoCents: 391275,
      totalCents: 409815,
    });
    expect(figures.closing).toEqual({
      caixaCents: 24000,
      bancoCents: 599155,
      totalCents: 623155,
    });
  });

  it('reproduces every rubric row of the annual map, in Listas order', () => {
    const { rows, issues } = aggregate(
      inPeriod(dataset.movimentos, '2025-01-01', '2025-12-31'),
      dataset.lists,
      'rubrica',
    );

    expect(issues).toEqual([]);
    expect(rubricRows(rows.filter((row) => row.side === 'receita'))).toEqual(
      RECEBIMENTOS_2025,
    );
    expect(rubricRows(rows.filter((row) => row.side === 'despesa'))).toEqual(
      PAGAMENTOS_2025,
    );
  });

  it('reproduces the previous year, every rubric row included', () => {
    const previous = previousPeriod(dataset, '2025-01-01', '2025-12-31');

    expect(previous.status).toBe('ok');
    if (previous.status !== 'ok') return;
    expect(previous.issues).toEqual([]);
    expect([previous.start, previous.end]).toEqual([
      '2024-01-01',
      '2024-12-31',
    ]);
    expect(previous.recebidoCents).toBe(2170000);
    expect(previous.pagoCents).toBe(1966045);
    expect(previous.opening.totalCents).toBe(205860);
    expect(previous.closing.totalCents).toBe(409815);
    expect(
      rubricRows(previous.rows.filter((row) => row.side === 'receita')),
    ).toEqual(RECEBIMENTOS_2024);
    expect(
      rubricRows(previous.rows.filter((row) => row.side === 'despesa')),
    ).toEqual(PAGAMENTOS_2024);
  });

  it('closes the annex footer onto recebido and pago', () => {
    const footer = annexFooter(
      inPeriod(dataset.movimentos, '2025-01-01', '2025-12-31'),
      dataset.lists,
    );

    expect([footer.recebidoCents, footer.pagoCents]).toEqual([
      2444530, 2231190,
    ]);
  });

  it('lists the commitments open at 31/12/2025', () => {
    const pending = pendingAt(dataset, '2025-12-31');

    expect([pending.porReceberCents, pending.porPagarCents]).toEqual([
      100000, 45000,
    ]);
  });
});

describe('letivo 1/1 to 31/8/2026', () => {
  it('reproduces the period figures and counts', () => {
    const figures = periodFigures(dataset, '2026-01-01', '2026-08-31');

    expect(figures.issues).toEqual([]);
    expect(figures.opening.totalCents).toBe(623155);
    expect(figures.recebidoCents).toBe(2779270);
    expect(figures.pagoCents).toBe(2054620);
    expect(figures.closing).toEqual({
      caixaCents: 25830,
      bancoCents: 1321975,
      totalCents: 1347805,
    });
    expect(figures.counts).toEqual({ recebimentos: 20, pagamentos: 27 });
  });

  it('reproduces the result by activity', () => {
    const { rows, total } = byActivity(
      inPeriod(dataset.movimentos, '2026-01-01', '2026-08-31'),
      dataset.lists,
    );

    expect(
      rows.map((r) => [
        r.atividade,
        r.recebidoCents,
        r.pagoCents,
        r.resultadoCents,
      ]),
    ).toEqual([
      ['Funcionamento', 439000, 131180, 307820],
      ['Zumba na Caneca', 292750, 144740, 148010],
      ['20º CITADÃO', 2022520, 1592700, 429820],
      ['Festivais', 25000, 186000, -161000],
    ]);
    expect(total).toEqual({
      recebidoCents: 2779270,
      pagoCents: 2054620,
      resultadoCents: 724650,
    });
  });

  it('ranks the five largest sources of money with their shares', () => {
    const { rows } = aggregate(
      inPeriod(dataset.movimentos, '2026-01-01', '2026-08-31'),
      dataset.lists,
      'rubrica',
    );
    const receipts = rows
      .filter((row) => row.side === 'receita')
      .map((row) => ({ label: row.rubrica, cents: row.netCents }));

    const { totalCents, segments } = composition(receipts);

    expect(totalCents).toBe(2779270);
    expect(
      segments.slice(0, 5).map((s) => [s.label, s.cents, s.permille]),
    ).toEqual([
      ['Bar e merchandising', 843770, 304],
      ['Inscrições e bilheteira', 750500, 270],
      ['Subsídios e apoios', 550000, 198],
      ['Patrocínios', 265000, 95],
      ['Atuações e serenatas', 215000, 77],
    ]);
  });

  it('has comparison data for the same months of 2025', () => {
    const previous = previousPeriod(dataset, '2026-01-01', '2026-08-31');

    expect(previous.status).toBe('ok');
    if (previous.status !== 'ok') return;
    expect([previous.recebidoCents, previous.pagoCents]).toEqual([
      2170000, 2023060,
    ]);
  });

  it('lists the commitments open at 31/8/2026', () => {
    const pending = pendingAt(dataset, '2026-08-31');

    expect([pending.porReceberCents, pending.porPagarCents]).toEqual([
      37000, 6430,
    ]);
  });
});

const CITADAO_RECEITAS = [
  ['Inscrições de tunas', 240000, 240000, 1000],
  ['Bilheteira', 350000, 387000, 1106],
  ['Bar', 580000, 631520, 1089],
  ['Merchandising', 80000, 64000, 800],
  ['Patrocínios', 300000, 250000, 833],
  ['Apoio CMV', 250000, 250000, 1000],
  ['Apoio UPV (via AE ESAV)', 150000, 150000, 1000],
  ['Apoio Junta de Freguesia', 50000, 50000, 1000],
];
const CITADAO_DESPESAS = [
  ['Som e luz', 360000, 390000, 1083],
  ['Palco e estruturas', 120000, 115000, 958],
  ['Refeições das tunas', 300000, 328000, 1093],
  ['Alojamento', 180000, 164000, 911],
  ['Compras para o bar', 270000, 298060, 1104],
  ['Prémios e troféus', 90000, 86000, 956],
  ['Júri', 40000, 42000, 1050],
  ['Comunicação e gráfica', 60000, 51500, 858],
  ['Licenças e SPA', 30000, 31000, 1033],
  ['Seguro', 18500, 18500, 1000],
  ['T-shirts', 65000, 59000, 908],
  ['Diversos', 20000, 9640, 482],
];

describe('20º CITADÃO', () => {
  it('reproduces the event figures cut at 15/06/2026', async () => {
    const event = eventFigures(
      dataset,
      await loadEventParams('evento-citadao'),
    );

    expect(event.issues).toEqual([]);
    expect(event.recebidoCents).toBe(2022520);
    expect(event.pagoCents).toBe(1592700);
    expect(event.resultadoCents).toBe(429820);
    expect(event.pending.porReceberCents).toBe(25000);
    expect(event.pending.porPagarCents).toBe(0);
    expect(event.resultadoPrevistoCents).toBe(454820);
    expect(event.inKindCents).toBe(293000);
    expect(event.span).toEqual({ start: '2026-02-20', end: '2026-06-15' });
  });

  it('reproduces the budget tables by sub-rubric with no level warning', async () => {
    const event = eventFigures(
      dataset,
      await loadEventParams('evento-citadao'),
    );

    const { tables, issues } = budgetVsActual(
      dataset,
      '20º CITADÃO',
      event.movements,
      'subRubrica',
    );

    expect(issues).toEqual([]);
    const rows = (side: 'receitas' | 'despesas') =>
      tables?.[side].rows.map((r) => [
        r.label,
        r.orcadoCents,
        r.realizadoCents,
        r.execucaoPermille,
      ]);
    expect(rows('receitas')).toHaveLength(CITADAO_RECEITAS.length);
    expect(rows('receitas')).toEqual(expect.arrayContaining(CITADAO_RECEITAS));
    expect(rows('despesas')).toHaveLength(CITADAO_DESPESAS.length);
    expect(rows('despesas')).toEqual(expect.arrayContaining(CITADAO_DESPESAS));
    expect(tables?.receitas.total).toEqual({
      orcadoCents: 2000000,
      realizadoCents: 2022520,
      desvioCents: 22520,
      execucaoPermille: 1011,
    });
    expect(tables?.despesas.total).toEqual({
      orcadoCents: 1553500,
      realizadoCents: 1592700,
      desvioCents: 39200,
      execucaoPermille: 1025,
    });
  });
});

describe('Zumba na Caneca', () => {
  it('reproduces the event figures with the transfer legs left out', async () => {
    const event = eventFigures(dataset, await loadEventParams('evento-zumba'));

    expect(event.recebidoCents).toBe(292750);
    expect(event.pagoCents).toBe(144740);
    expect(event.resultadoCents).toBe(148010);
    expect(event.counts).toEqual({ recebimentos: 4, pagamentos: 6 });
    expect(event.span).toEqual({ start: '2026-03-03', end: '2026-03-18' });
  });

  it('reproduces the cash book with its running accumulated result', async () => {
    const event = eventFigures(dataset, await loadEventParams('evento-zumba'));

    expect(event.cashBook.map((row) => row.acumuladoCents)).toEqual([
      -4800, -39000, -24000, -85240, 38260, 186510, 192510, 172510, 154510,
      148010,
    ]);
    expect(event.footer.entradasBrutasCents).toBe(292750);
    expect(event.footer.saidasBrutasCents).toBe(144740);
  });

  it('labels the composition with sub-rubric names', async () => {
    const event = eventFigures(dataset, await loadEventParams('evento-zumba'));
    const { rows } = aggregate(event.movements, dataset.lists, 'subRubrica');

    const { segments } = composition(
      rows
        .filter((row) => row.side === 'receita')
        .map((row) => ({
          label: row.subRubrica ?? row.rubrica,
          cents: row.netCents,
        })),
    );

    expect(segments.map((s) => [s.label, s.cents, s.permille])).toEqual([
      ['Bar', 148250, 506],
      ['Inscrições', 123500, 422],
      ['Patrocínio do evento', 15000, 51],
      ['Donativos', 6000, 20],
    ]);
  });
});

describe('pegada 31/08 to 30/09/2026', () => {
  it('reproduces the handover figures with a closed reconciliation and cash count', async () => {
    const pegada = pegadaFigures(dataset, await loadPegadaParams());

    expect(pegada.issues).toEqual([]);
    expect(pegada.period.opening.totalCents).toBe(1347805);
    expect(pegada.period.recebidoCents).toBe(72000);
    expect(pegada.period.pagoCents).toBe(35400);
    expect(pegada.period.closing).toEqual({
      caixaCents: 57900,
      bancoCents: 1326505,
      totalCents: 1384405,
    });
    expect(pegada.variacaoCents).toBe(36600);
    expect(pegada.position.netCents).toBe(1396405);
    expect(pegada.reconciliation.differenceCents).toBe(0);
    expect(pegada.cashCount.differenceCents).toBe(0);
    expect(pegada.movements).toHaveLength(7);
  });
});

describe('in-kind support', () => {
  it('counts the dated rows inside the letivo period and nothing in 2025', () => {
    expect(
      inKind(dataset, { start: '2026-01-01', end: '2026-08-31' }),
    ).toMatchObject({ totalCents: 293000, issues: [] });
    expect(
      inKind(dataset, { start: '2025-01-01', end: '2025-12-31' }).totalCents,
    ).toBe(0);
  });
});
