import { describe, expect, it } from 'vitest';
import { encodeCsv } from '../../../tests/support/workbook.ts';
import { CSV_FILES } from '../../../tests/support/sample.ts';
import { applyMapping, detectDelimiter, readCsv } from './csv.ts';

const TEXT = 'Rubrica;Valor (€)\r\nAlimentação;1.234,56 €\r\n';

describe('readCsv() encoding', () => {
  it.each(['utf-8-bom', 'utf-8', 'windows-1252'] as const)(
    'decodes %s to the same cells',
    (encoding) => {
      const table = readCsv('a.csv', encodeCsv(TEXT, encoding));

      expect(table.header).toEqual(['Rubrica', 'Valor (€)']);
      expect(table.rows[0]).toEqual(['Alimentação', '1.234,56 €']);
    },
  );

  it('does not leave the byte-order mark in the first header', () => {
    const table = readCsv('a.csv', encodeCsv(TEXT, 'utf-8-bom'));

    expect(table.header[0]).toBe('Rubrica');
  });
});

describe('detectDelimiter()', () => {
  it.each([
    ['semicolon', 'a;b;c', ';'],
    ['comma', 'a,b,c', ','],
    ['tab', 'a\tb\tc', '\t'],
    ['quoted delimiter ignored', '"Valor, em euros";b;c', ';'],
    ['most frequent wins', 'a;b,c,d', ','],
    ['no delimiter', 'abc', ','],
    ['first non-empty line', '\n\na;b', ';'],
  ])('%s', (_name, text, expected) => {
    expect(detectDelimiter(text)).toBe(expected);
  });
});

describe('readCsv() tab assignment', () => {
  it.each([
    ['movimentos.csv', 'Movimentos'],
    ['pendentes.csv', 'Pendentes'],
    ['orcamento.csv', 'Orçamento'],
    ['generos.csv', 'Géneros'],
    ['listas.csv', 'Listas'],
    ['saldos.csv', 'Saldos'],
  ] as const)('%s is recognised by its header signature', (file, tab) => {
    const text = CSV_FILES[file] ?? '';

    expect(readCsv('nome-qualquer.csv', encodeCsv(text, 'utf-8')).tab).toBe(
      tab,
    );
  });

  it('assigns no tab when the required columns are not all present', () => {
    const table = readCsv('x.csv', encodeCsv('Data;Valor\n1;2', 'utf-8'));

    expect(table.tab).toBeNull();
  });

  it('does not file a Pendentes CSV with a misspelt required header under another tab', () => {
    const table = readCsv(
      'x.csv',
      encodeCsv(
        'Tipo;Entidad;Descrição;Atividade;Valor (€);Data de registo\nA pagar;Bar;Jantar;Geral;5,00;01/01/2025',
        'utf-8',
      ),
    );

    expect(table.tab).toBeNull();
  });

  it('still assigns a valid file that carries an extra unknown column', () => {
    const table = readCsv(
      'x.csv',
      encodeCsv(
        'Tipo;Entidade;Descrição;Valor (€);Data de registo;Observações\nA pagar;Bar;Jantar;5,00;01/01/2025;x',
        'utf-8',
      ),
    );

    expect(table.tab).toBe('Pendentes');
  });

  it('numbers rows from the header line, skipping leading blank lines', () => {
    const table = readCsv(
      'x.csv',
      encodeCsv(
        '\n\nData;Conta;Saldo;Fonte\n01/01/2025;Caixa;1;Extrato',
        'utf-8',
      ),
    );

    expect(table).toMatchObject({ tab: 'Saldos', firstDataRow: 4 });
    expect(table.rows).toEqual([['01/01/2025', 'Caixa', '1', 'Extrato']]);
  });
});

describe('applyMapping()', () => {
  const table = readCsv(
    'livre.csv',
    encodeCsv('Quando;Quanto;O quê\n01/01/2025;5,00;Rifa', 'utf-8'),
  );

  it('rebuilds the table as Movimentos with the mapped columns under their canonical headers', () => {
    const mapped = applyMapping(table, { data: 0, valor: 1, descricao: 2 });

    expect(mapped.tab).toBe('Movimentos');
    expect(mapped.header).toEqual(['Data', 'Descrição', 'Valor (€)']);
    expect(mapped.rows).toEqual([['01/01/2025', 'Rifa', '5,00']]);
  });
});
