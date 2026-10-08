import { describe, expect, it } from 'vitest';
import { emptyDataset, mov, pendente } from '../../../tests/support/dataset.ts';
import { eventFigures } from './event.ts';

const dataset = emptyDataset({
  movimentos: [
    mov({ data: '2025-05-02', cents: 1000, tipo: 'Saída', row: 10 }),
    mov({ data: '2025-05-01', cents: 5000, row: 11 }),
    mov({
      data: '2025-05-01',
      cents: 800,
      tipo: 'Saída',
      rubrica: 'Transferências internas',
      row: 12,
    }),
    mov({ data: '2025-05-03', cents: 300, rubrica: 'Licenças e SPA', row: 13 }),
    mov({ data: '2025-09-01', cents: 777, row: 14 }),
    mov({ data: '2025-05-01', cents: 123, atividade: 'Serenata', row: 15 }),
  ],
  pendentes: [
    pendente({ valorCents: 400, dataRegisto: '2025-04-01' }),
    pendente({ tipo: 'A pagar', valorCents: 150, dataRegisto: '2025-04-01' }),
    pendente({
      valorCents: 9999,
      dataRegisto: '2025-04-01',
      atividade: 'Serenata',
    }),
  ],
});

describe('eventFigures()', () => {
  const figures = eventFigures(dataset, {
    atividade: 'Festival Alfa',
    contarAte: '2025-06-30',
    refPendentes: '2025-06-30',
  });

  it('counts only the activity result rows up to the cutoff', () => {
    expect(figures).toMatchObject({
      recebidoCents: 5000,
      pagoCents: 700,
      resultadoCents: 4300,
      counts: { recebimentos: 1, pagamentos: 2 },
      span: { start: '2025-05-01', end: '2025-05-03' },
    });
  });

  it('adds what is still pending to the result for the forecast', () => {
    expect(figures).toMatchObject({
      resultadoPrevistoCents: 4300 + 400 - 150,
    });
  });

  it('lists the cash book chronologically with a running result that ends on the result', () => {
    expect(
      figures.cashBook.map((r) => [
        r.movimento.src.row,
        r.entradaCents,
        r.saidaCents,
        r.refund,
        r.acumuladoCents,
      ]),
    ).toEqual([
      [11, 5000, null, false, 5000],
      [10, null, 1000, false, 4000],
      [13, 300, null, true, 4300],
    ]);
  });

  it('counts later movements of the activity when no cutoff is given', () => {
    const open = eventFigures(dataset, {
      atividade: 'Festival Alfa',
      refPendentes: '2025-06-30',
    });

    expect(open.recebidoCents).toBe(5777);
    expect(open.span).toEqual({ start: '2025-05-01', end: '2025-09-01' });
  });
});
