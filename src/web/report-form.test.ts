import { describe, expect, it } from 'vitest';
import type { Dataset } from '@/core/dataset/types';
import {
  cashCountTotals,
  emptyForm,
  extratoOn,
  plainEuros,
  setCount,
  setField,
  toRawParams,
  withDefaults,
} from './report-form';

const dataset = {
  saldos: [
    {
      data: '2026-09-30',
      conta: 'Banco',
      saldoCents: 1326505,
      fonte: 'Extrato',
      src: { file: 'x.xlsx', tab: 'Saldos', row: 2 },
    },
    {
      data: '2026-09-30',
      conta: 'Caixa',
      saldoCents: 57900,
      fonte: 'Contagem',
      src: { file: 'x.xlsx', tab: 'Saldos', row: 3 },
    },
  ],
} as unknown as Dataset;

describe('cashCountTotals()', () => {
  it('adds each denomination to the small-coins value as it is typed', () => {
    let form = emptyForm('pegada');
    form = setCount(form, 5000, '8');
    form = setCount(form, 200, '6');
    form = setCount(form, 1, '3');

    const { totalCents, rows } = cashCountTotals(form.contagem, '6');

    expect(totalCents).toBe(8 * 5000 + 6 * 200 + 3 + 600);
    expect(rows.filter((value) => value !== 0)).toEqual([40000, 1200, 3]);
  });

  it('shows no subtotal for a quantity that is not a whole number', () => {
    const form = setCount(emptyForm('pegada'), 5000, '1,5');

    const { rows, totalCents } = cashCountTotals(form.contagem, '');

    expect(rows).toContain(null);
    expect(totalCents).toBe(0);
  });
});

describe('toRawParams()', () => {
  it('keys the cash count by the euro value and drops blank quantities', () => {
    let form = emptyForm('pegada');
    form = setCount(form, 50, '4');
    form = setCount(form, 500, '');
    form = setCount(form, 1, ' 2 ');

    expect(toRawParams('pegada', form).contagem).toEqual({
      '0.5': '4',
      '0.01': '2',
    });
  });

  it('sends the manual opening only when one of the balances is filled', () => {
    const empty = emptyForm('letivo');
    const filled = setField(empty, 'aberturaManual/banco', '1908,60');

    expect(toRawParams('letivo', empty).aberturaManual).toBeUndefined();
    expect(toRawParams('letivo', filled).aberturaManual).toEqual({
      caixa: undefined,
      banco: '1908,60',
    });
  });

  it('passes list rows through unchanged so errors keep their row position', () => {
    const form = {
      ...emptyForm('evento'),
      indicadores: [
        { key: 1, label: 'Bilhetes', value: '' },
        { key: 7, label: '', value: '' },
      ],
    };

    expect(toRawParams('evento', form).indicadores).toEqual([
      { label: 'Bilhetes', value: '' },
      { label: '', value: '' },
    ]);
  });
});

describe('withDefaults()', () => {
  it('mirrors the activity into the budget scope until the scope is edited', () => {
    const typed = setField(emptyForm('evento'), 'atividade', '20º CITADÃO');

    expect(withDefaults('evento', typed, dataset).fields.ambitoOrcamento).toBe(
      '20º CITADÃO',
    );

    const edited = setField(typed, 'ambitoOrcamento', '2026');
    expect(withDefaults('evento', edited, dataset).fields.ambitoOrcamento).toBe(
      '2026',
    );
  });

  it('prefills the bank statement balance from the extract on the handover date', () => {
    const form = setField(emptyForm('pegada'), 'dataPassagem', '30/09/2026');

    expect(withDefaults('pegada', form, dataset).fields.saldoExtrato).toBe(
      '13265,05',
    );
  });

  it('keeps a statement balance the treasurer typed, even an empty one', () => {
    const form = setField(
      setField(emptyForm('pegada'), 'dataPassagem', '2026-09-30'),
      'saldoExtrato',
      '',
    );

    expect(withDefaults('pegada', form, dataset).fields.saldoExtrato).toBe('');
  });

  it('prefills nothing when the date has no bank extract', () => {
    expect(extratoOn(dataset, '2026-08-31')).toBeNull();
    expect(extratoOn(dataset, 'amanhã')).toBeNull();
  });
});

describe('plainEuros()', () => {
  it('writes cents with a decimal comma and no symbol', () => {
    expect(plainEuros(1326505)).toBe('13265,05');
    expect(plainEuros(5)).toBe('0,05');
    expect(plainEuros(-250)).toBe('-2,50');
  });
});
