import { describe, expect, it } from 'vitest';
import { closest, normalise, normaliseHeader } from './text.ts';

describe('normalise()', () => {
  const table: [string, string][] = [
    ['Licenças', 'licencas'],
    ['  Conta   para o\tresultado ', 'conta para o resultado'],
    ['AÇÃO', 'acao'],
    ['Saída', 'saida'],
    ['', ''],
  ];

  it.each(table)('%j', (input, expected) => {
    expect(normalise(input)).toBe(expected);
  });
});

describe('normaliseHeader()', () => {
  const table: [string, string][] = [
    ['Valor (€)', 'valor'],
    ['Tipo (Entrada/Saída)', 'tipo'],
    ['Valor com sinal (€) (calculado)', 'valor com sinal'],
    ['Orçado (€)', 'orcado'],
    ['Data de registo', 'data de registo'],
    ['N.º doc', 'n.º doc'],
  ];

  it.each(table)('%j', (input, expected) => {
    expect(normaliseHeader(input)).toBe(expected);
  });
});

describe('closest()', () => {
  const rubricas = ['Quotas', 'Licenças e taxas', 'Material', 'Alimentação'];

  const table: [string, string | null][] = [
    ['Licencas e taxas', 'Licenças e taxas'],
    ['licenças e taxa', 'Licenças e taxas'],
    ['Alimentaçao', 'Alimentação'],
    ['Quota', 'Quotas'],
    ['Combustível', null],
    ['', null],
    ['   ', null],
  ];

  it.each(table)('%j', (candidate, expected) => {
    expect(closest(candidate, rubricas)).toBe(expected);
  });

  it('prefers the nearest entry and, on a tie, the first in list order', () => {
    expect(closest('Materal', ['Matéria', 'Material'])).toBe('Material');
    expect(closest('abcd', ['abcx', 'abcy'])).toBe('abcx');
  });

  it('returns null for an empty list', () => {
    expect(closest('Quotas', [])).toBeNull();
  });
});
