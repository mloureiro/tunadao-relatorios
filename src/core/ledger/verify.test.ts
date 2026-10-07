import { describe, expect, it } from 'vitest';
import { emptyDataset, mov, saldo } from '../../../tests/support/dataset.ts';
import { formatMoney, formatMoneySigned } from '../format.ts';
import { dailyBalances, negativeBalanceIssues } from './daily.ts';
import { verifyCheckpoints, verifyFromManual } from './index.ts';

const movimentos = [
  mov({ data: '2025-02-01', cents: 2500 }),
  mov({ data: '2025-12-31', cents: 100, tipo: 'Saída' }),
];

describe('verifyCheckpoints()', () => {
  it('accepts a checkpoint equal to the previous one plus the movements in between', () => {
    const dataset = emptyDataset({
      movimentos,
      saldos: [saldo('2024-12-31', 10000), saldo('2025-12-31', 12400)],
    });

    expect(verifyCheckpoints(dataset)).toEqual([]);
  });

  it('reports expected, found and difference when a checkpoint is off by one cent', () => {
    const dataset = emptyDataset({
      movimentos,
      saldos: [
        saldo('2024-12-31', 10000),
        saldo('2025-12-31', 12401, 'Caixa', 9),
      ],
    });

    const [issue, ...rest] = verifyCheckpoints(dataset);

    expect(rest).toEqual([]);
    expect(issue).toMatchObject({
      severity: 'error',
      code: 'checkpoint-mismatch',
      tab: 'Saldos',
      row: 9,
      column: 'Saldo (€)',
    });
    expect(issue?.message).toContain(formatMoney(12401));
    expect(issue?.message).toContain(formatMoney(12400));
    expect(issue?.message).toContain(formatMoneySigned(1));
  });

  it('checks each account against its own checkpoints', () => {
    const dataset = emptyDataset({
      movimentos: [mov({ data: '2025-02-01', cents: 500, conta: 'Banco' })],
      saldos: [
        saldo('2024-12-31', 0, 'Caixa'),
        saldo('2025-12-31', 0, 'Caixa'),
        saldo('2024-12-31', 100, 'Banco'),
        saldo('2025-12-31', 600, 'Banco'),
      ],
    });

    expect(verifyCheckpoints(dataset)).toEqual([]);
  });

  it('reports two checkpoints of one day that disagree, once, without a cascading mismatch', () => {
    const dataset = emptyDataset({
      saldos: [
        saldo('2024-12-31', 10000),
        saldo('2025-12-31', 500),
        saldo('2025-12-31', 700),
      ],
    });

    expect(verifyCheckpoints(dataset).map((issue) => issue.code)).toEqual([
      'checkpoint-conflict',
    ]);
  });

  it('accepts two checkpoints of one day that agree', () => {
    const dataset = emptyDataset({
      saldos: [saldo('2025-12-31', 500), saldo('2025-12-31', 500)],
    });

    expect(verifyCheckpoints(dataset)).toEqual([]);
  });
});

describe('verifyFromManual()', () => {
  const dataset = emptyDataset({
    movimentos,
    saldos: [saldo('2025-12-31', 12400, 'Caixa', 7)],
  });

  it('accepts a manual opening that reaches the later checkpoint', () => {
    expect(verifyFromManual(dataset, '2025-01-01', { Caixa: 10000 })).toEqual(
      [],
    );
  });

  it('reports the first later checkpoint that disagrees with the manual opening', () => {
    const issues = verifyFromManual(dataset, '2025-01-01', { Caixa: 9000 });

    expect(issues).toMatchObject([
      { severity: 'error', code: 'manual-opening-mismatch', row: 7 },
    ]);
    expect(issues[0]?.message).toContain(formatMoney(12400));
    expect(issues[0]?.message).toContain(formatMoney(11400));
  });

  it('ignores accounts without a manual value', () => {
    expect(verifyFromManual(dataset, '2025-01-01', { Banco: 1 })).toEqual([]);
  });
});

describe('negative balances', () => {
  const dataset = emptyDataset({
    saldos: [saldo('2025-01-01', 1000)],
    movimentos: [
      mov({ data: '2025-01-05', cents: 1500, tipo: 'Saída' }),
      mov({ data: '2025-01-06', cents: 100, tipo: 'Saída' }),
      mov({ data: '2025-01-10', cents: 2000 }),
      mov({ data: '2025-01-12', cents: 3000, tipo: 'Saída' }),
      mov({ data: '2024-12-01', cents: 9999, tipo: 'Saída' }),
    ],
  });

  it('lists end-of-day balances for each day with activity from the first checkpoint on', () => {
    expect(dailyBalances(dataset, 'Caixa')).toEqual([
      { data: '2025-01-01', saldoCents: 1000 },
      { data: '2025-01-05', saldoCents: -500 },
      { data: '2025-01-06', saldoCents: -600 },
      { data: '2025-01-10', saldoCents: 1400 },
      { data: '2025-01-12', saldoCents: -1600 },
    ]);
    expect(dailyBalances(dataset, 'Banco')).toEqual([]);
  });

  it('warns once on the first day of each negative run', () => {
    const issues = negativeBalanceIssues(dataset);

    expect(issues.map((issue) => issue.severity)).toEqual([
      'warning',
      'warning',
    ]);
    expect(issues.map((issue) => issue.message)).toEqual([
      expect.stringContaining('05/01/2025'),
      expect.stringContaining('12/01/2025'),
    ]);
  });
});
