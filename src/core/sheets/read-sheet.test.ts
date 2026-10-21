import { describe, expect, it } from 'vitest';
import {
  config,
  gridOf,
  layoutRows,
  type TestCell,
} from '../../../tests/support/report-sheet.ts';
import type { Issue } from '../issues.ts';
import { REPORT_TIPOS } from './catalogue.ts';
import { readReportSheet } from './read-sheet.ts';
import type { DraftBlock, SheetDraft } from './types.ts';

type Rows = TestCell[][];

const read = (rows: Rows, options?: { date1904?: boolean }): SheetDraft =>
  readReportSheet(gridOf(rows, { name: 'Folha X', ...options }), { config });

const fiscal = (...rows: Rows): Rows => [
  ['Relatório', 'Fim de ano fiscal'],
  ['Versão do modelo', 1],
  ...rows,
];

const pegada = (...rows: Rows): Rows => [
  ['Relatório', 'Pegada de direção'],
  ...rows,
];

const codes = (issues: readonly Issue[]): string[] =>
  issues.map(({ code }) => code);

const blockOf = (draft: SheetDraft, key: string): DraftBlock => {
  const found = draft.blocks.find((block) => block.key === key);
  if (found === undefined) throw new Error(`No block ${key}`);
  return found;
};

const withoutMissing = (draft: SheetDraft): Issue[] =>
  draft.issues.filter(({ code }) => code !== 'field-missing');

describe('report type marker', () => {
  it.each([
    ['Pegada de direção', 'pegada'],
    ['passagem de direcao', 'pegada'],
    ['Relatório de evento', 'evento'],
    ['Evento', 'evento'],
    ['Fim de ano letivo', 'letivo'],
    ['Ano letivo', 'letivo'],
    ['Fim de ano fiscal', 'fiscal'],
    ['Contas do ano', 'fiscal'],
  ])('maps "%s" to %s', (text, tipo) => {
    const draft = read([['Relatório', text]]);

    expect(draft.tipo).toBe(tipo);
    expect(draft.typeCell).toBe('B1');
  });

  it('accepts the long label and a marker anywhere in the first ten rows', () => {
    const draft = read([
      ['Folha da direção'],
      [null],
      ['Tipo de relatório:', 'Fim de ano fiscal'],
    ]);

    expect(draft.tipo).toBe('fiscal');
    expect(draft.typeCell).toBe('B3');
  });

  it('does not look for the marker below row ten', () => {
    const rows: Rows = Array.from({ length: 10 }, () => [null]);
    rows.push(['Relatório', 'Fim de ano fiscal']);

    expect(read(rows).tipo).toBeNull();
  });

  it('reports an unknown type on the type cell and suggests the closest one', () => {
    const draft = read([['Relatório', 'Relatorio de evento 2']]);

    expect(draft.tipo).toBeNull();
    expect(draft.issues).toMatchObject([
      {
        code: 'report-type-unknown',
        severity: 'error',
        sheet: 'Folha X',
        cell: 'B1',
        suggestion: 'Quis dizer "Relatório de evento"?',
      },
    ]);
  });

  it('reports a blank type cell', () => {
    const draft = read([['Relatório', null]]);

    expect(draft.issues).toMatchObject([
      { code: 'report-type-unknown', cell: 'B1' },
    ]);
    expect(draft.issues[0]?.message).toContain('não indica o tipo');
  });

  it('reports a sheet without any marker on the sheet, not on a cell', () => {
    const draft = read([['Ano', 2025]]);

    expect(draft.issues).toHaveLength(1);
    expect(draft.issues[0]).toMatchObject({ code: 'report-type-unknown' });
    expect(draft.issues[0]).not.toHaveProperty('cell');
  });
});

describe('layout version', () => {
  it('defaults to 1 when the sheet has no version row', () => {
    const draft = read([
      ['Relatório', 'Fim de ano fiscal'],
      ['Ano', 2025],
    ]);

    expect(draft.version).toBe(1);
    expect(draft.issues).toEqual([]);
  });

  it.each([
    [1, 1],
    ['1', 1],
  ])('reads %j', (cell, version) => {
    expect(read(fiscal(['Ano', 2025]), undefined).version).toBe(1);
    const rows = fiscal(['Ano', 2025]);
    rows[1] = ['Versão do modelo', cell];

    expect(read(rows).version).toBe(version);
  });

  it('refuses a newer version on that sheet only, without reading it further', () => {
    const rows = fiscal(['Ano', 2025], ['Coisa nova', 'x']);
    rows[1] = ['Versão do modelo', 2];
    const draft = read(rows);

    expect(draft.version).toBe(2);
    expect(draft.fields).toEqual([]);
    expect(draft.issues).toMatchObject([
      {
        code: 'report-version-newer',
        severity: 'error',
        sheet: 'Folha X',
        cell: 'B2',
        field: 'Versão do modelo',
      },
    ]);
  });

  it.each([['abc'], [0], [1.5]])('rejects the version %j', (cell) => {
    const rows = fiscal(['Ano', 2025]);
    rows[1] = ['Versão do modelo', cell];

    expect(read(rows).issues).toMatchObject([
      { code: 'field-invalid', cell: 'B2', field: 'Versão do modelo' },
    ]);
  });

  it('accepts the alias Versão', () => {
    const rows = fiscal(['Ano', 2025]);
    rows[1] = ['Versão', 1];

    expect(read(rows).issues).toEqual([]);
  });
});

describe('field labels', () => {
  it.each([
    ['Ano'],
    ['ano'],
    ['  ANO  '],
    ['Ano:'],
    ['Ano *'],
    ['Ano?'],
    ['Ano (aaaa):'],
  ])('finds the field from the label "%s"', (label) => {
    const draft = read(fiscal([label, 2025]));

    expect(draft.fields).toMatchObject([
      { key: 'ano', cell: 'B3', value: 2025 },
    ]);
    expect(draft.issues).toEqual([]);
  });

  it.each([
    ['Incluir a lista de movimentos', 'anexoMovimentos'],
    ['Anexo de movimentos', 'anexoMovimentos'],
    ['Âmbito do orçamento', 'ambitoOrcamento'],
    ['Orçamento a usar', 'ambitoOrcamento'],
  ])('matches the label or alias "%s" silently', (label, key) => {
    const draft = read(fiscal(['Ano', 2025], [label, 'Sim']));

    expect(draft.fields.map((field) => field.key)).toContain(key);
    expect(draft.issues).toEqual([]);
  });

  it('keeps reading when rows are inserted above the fields', () => {
    const draft = read(fiscal([null], [null], ['Ano', 2025]));

    expect(draft.fields).toMatchObject([{ key: 'ano', cell: 'B5' }]);
  });

  it('warns about an unknown label and suggests the closest one', () => {
    const draft = read(fiscal(['Ano', 2025], ['Anoo', 2026]));

    expect(draft.issues).toMatchObject([
      {
        code: 'field-unknown',
        severity: 'warning',
        cell: 'A4',
        field: 'Anoo',
        suggestion: 'Quis dizer "Ano"?',
      },
    ]);
  });

  it('rejects the same field twice and names the first cell', () => {
    const draft = read(fiscal(['Ano', 2025], ['Ano', 2026]));

    expect(draft.fields).toMatchObject([{ key: 'ano', value: 2025 }]);
    expect(draft.issues).toMatchObject([
      { code: 'field-duplicate', severity: 'error', cell: 'A4' },
    ]);
    expect(draft.issues[0]?.message).toContain('B3');
  });

  it('asks for a required label that is absent, but not for a derivable one', () => {
    const missing = read(fiscal(['Orçamento a usar', '2025']));
    expect(missing.issues).toMatchObject([
      { code: 'field-missing', severity: 'error', field: 'Ano' },
    ]);
    expect(missing.issues[0]).not.toHaveProperty('cell');

    const derivable = read(pegada(['Data da passagem', 46000]));
    expect(
      derivable.issues
        .filter(({ code }) => code === 'field-missing')
        .map(({ field }) => field),
    ).not.toContain('Data do último relatório');
  });

  it('reads a blank value as blank without complaint', () => {
    const draft = read(fiscal(['Ano', 2025], ['Orçamento a usar', null]));

    expect(draft.fields.find((f) => f.key === 'ambitoOrcamento')).toMatchObject(
      { raw: null, value: null },
    );
    expect(draft.issues).toEqual([]);
  });
});

describe('formulas in input cells', () => {
  it('uses the cached value and warns', () => {
    const draft = read(fiscal(['Ano', { f: 'B1+1', v: 2025 }]));

    expect(draft.fields[0]).toMatchObject({ value: 2025 });
    expect(draft.issues).toMatchObject([
      { code: 'formula-input', severity: 'warning', cell: 'B3' },
    ]);
  });

  it('refuses a formula without a cached value and reads no value', () => {
    const draft = read(fiscal(['Ano', { f: 'B1+1' }]));

    expect(draft.fields[0]).toMatchObject({ raw: null, value: null });
    expect(draft.issues).toMatchObject([
      { code: 'formula-no-value', severity: 'error', cell: 'B3', field: 'Ano' },
    ]);
  });
});

describe('date cells', () => {
  const letivo = (value: TestCell, date1904 = false) =>
    read(
      [
        ['Relatório', 'Fim de ano letivo'],
        ['Fim do período', value],
      ],
      { date1904 },
    );

  it('reads a date serial in the 1900 and 1904 systems', () => {
    expect(letivo(46188).fields[0]?.value).toBe('2026-06-15');
    expect(letivo(46188 - 1462, true).fields[0]?.value).toBe('2026-06-15');
  });

  it('keeps a date typed as text but warns', () => {
    const draft = letivo('15/06/2026');

    expect(draft.fields[0]?.value).toBe('2026-06-15');
    expect(codes(draft.issues)).toContain('date-as-text');
  });

  it('rejects an invalid date on its cell', () => {
    const draft = letivo('ontem');

    expect(draft.fields[0]?.value).toBeNull();
    expect(draft.issues).toMatchObject([
      { code: 'field-invalid', cell: 'B2', field: 'Fim do período' },
    ]);
  });
});

describe('pairs blocks', () => {
  const rows = pegada(
    ['Pagamentos emitidos ainda não debitados no extrato'],
    ['Descrição', 'Valor (€)'],
    ['Cheque 12', 50],
    [null, null],
    ['Fornecedor', '1.234,50 €'],
    [null, null],
    ['Depósitos ainda não creditados no extrato'],
    ['Descrição', 'Valor (€)'],
    ['Quotas', 10],
  );

  it('skips blank rows and ends the block at the next block title', () => {
    const draft = read(rows);

    expect(blockOf(draft, 'naoDebitados')).toMatchObject({
      kind: 'pairs',
      titleCell: 'A2',
      rows: [
        { first: { value: 'Cheque 12', cell: 'A4' }, second: { value: 50 } },
        { first: { value: 'Fornecedor' }, second: { value: '1.234,50 €' } },
      ],
    });
    expect(blockOf(draft, 'naoCreditados')).toMatchObject({
      rows: [{ first: { value: 'Quotas' } }],
    });
    expect(withoutMissing(draft)).toEqual([]);
  });

  it('ends the block at the next known field label too', () => {
    const draft = read(
      pegada(
        ['Pagamentos não debitados'],
        ['Descrição', 'Valor (€)'],
        ['Cheque 12', 50],
        ['Direção entrante', 'Direção 2026/27'],
      ),
    );

    expect(blockOf(draft, 'naoDebitados')).toMatchObject({
      rows: [{ first: { value: 'Cheque 12' } }],
    });
    expect(draft.fields.map((f) => f.key)).toEqual(['direcaoEntrante']);
  });

  it('flags a row with only one of the two cells filled', () => {
    const draft = read(
      pegada(
        ['Pagamentos não debitados'],
        ['Descrição', 'Valor (€)'],
        ['Texto solto', null],
        [null, 20],
      ),
    );

    expect(withoutMissing(draft)).toMatchObject([
      { code: 'field-empty', severity: 'error', cell: 'B4' },
      { code: 'field-empty', severity: 'error', cell: 'A5' },
    ]);
  });

  it('reads the rows even when the header row was deleted', () => {
    const draft = read(pegada(['Pagamentos não debitados'], ['Cheque 12', 50]));

    expect(blockOf(draft, 'naoDebitados')).toMatchObject({
      rows: [{ first: { value: 'Cheque 12' } }],
    });
  });
});

describe('indicators block', () => {
  it('formats a numeric value and keeps typed text', () => {
    const draft = read([
      ['Relatório', 'Relatório de evento'],
      ['Indicadores'],
      ['Indicador', 'Valor'],
      ['Bilhetes vendidos', 1645],
      ['Margem', 3334.6],
      ['Peso dos apoios', '22,2%'],
    ]);

    expect(blockOf(draft, 'indicadores')).toMatchObject({
      rows: [
        { second: { value: '1.645' } },
        { second: { value: '3.334,60' } },
        { second: { value: '22,2%' } },
      ],
    });
  });
});

describe('cash count block', () => {
  const count = (...lines: Rows) =>
    read(
      pegada(
        ['Contagem de caixa'],
        ['Denominação (€)', 'Quantidade', 'Total (€)'],
        ...lines,
      ),
    );

  it('reads quantities by denomination and omits blank ones', () => {
    const draft = count(
      [50, 8, { f: 'A5*B5' }],
      [0.5, null, { f: 'A6*B6' }],
      ['0,05', '4'],
      [0.01, 0],
    );

    expect(blockOf(draft, 'contagem')).toMatchObject({
      counts: [
        { denominationCents: 5000, quantity: { value: 8, cell: 'B4' } },
        { denominationCents: 50, quantity: { value: null } },
        { denominationCents: 5, quantity: { value: 4 } },
        { denominationCents: 1, quantity: { value: 0 } },
      ],
    });
    expect(withoutMissing(draft)).toEqual([]);
  });

  it('rejects an unknown denomination on its cell', () => {
    const draft = count([3, 2]);

    expect(withoutMissing(draft)).toMatchObject([
      { code: 'field-invalid', cell: 'A4', field: 'Contagem de caixa' },
    ]);
    expect(withoutMissing(draft)[0]?.message).toContain('"3"');
  });

  it('rejects a repeated denomination', () => {
    const draft = count([20, 1], ['20,00', 2]);

    expect(withoutMissing(draft)).toMatchObject([
      { code: 'field-invalid', cell: 'A5' },
    ]);
    expect(withoutMissing(draft)[0]?.message).toContain('repetida');
  });

  it.each([[-1], [1.5], ['muitas']])(
    'rejects the quantity %j on its cell',
    (quantity) => {
      expect(withoutMissing(count([20, quantity]))).toMatchObject([
        { code: 'field-invalid', cell: 'B4' },
      ]);
    },
  );

  it('asks for the denomination when only a quantity is given', () => {
    expect(withoutMissing(count([null, 3]))).toMatchObject([
      { code: 'field-empty', cell: 'A4' },
    ]);
  });
});

describe('text blocks', () => {
  const notes = (...lines: Rows) =>
    read(fiscal(['Ano', 2025], ['Notas'], ...lines));

  it('makes one paragraph per row and splits in-cell line breaks', () => {
    const draft = notes(
      ['Primeiro'],
      [null],
      ['Segundo\nTerceiro\r\n\r\nQuarto'],
    );

    expect(blockOf(draft, 'notas')).toMatchObject({
      kind: 'text',
      titleCell: 'A4',
      paragraphs: ['Primeiro', 'Segundo', 'Terceiro', 'Quarto'],
    });
  });

  it('takes the first non-blank cell among columns A to C', () => {
    const draft = notes([null, null, 'Só na coluna C'], [null, 'Na B', 'Na C']);

    expect(blockOf(draft, 'notas')).toMatchObject({
      paragraphs: ['Só na coluna C', 'Na B'],
    });
  });

  it('warns above 5 000 characters on the title cell and keeps the text', () => {
    const draft = notes(['x'.repeat(4000)], ['y'.repeat(1001)]);

    expect(draft.issues).toMatchObject([
      { code: 'text-too-long', severity: 'warning', cell: 'A4' },
    ]);
    expect(blockOf(draft, 'notas')).toMatchObject({
      paragraphs: ['x'.repeat(4000), 'y'.repeat(1001)],
    });
  });

  it('does not warn at exactly 5 000 characters', () => {
    expect(notes(['x'.repeat(5000)]).issues).toEqual([]);
  });

  it('reads the Parecer block of the fiscal report apart from Notas', () => {
    const draft = read(
      fiscal(['Ano', 2025], ['Parecer'], ['Favorável'], ['Notas'], ['Nota']),
    );

    expect(draft.blocks.map((block) => block.key)).toEqual([
      'parecerCF',
      'notas',
    ]);
    expect(blockOf(draft, 'parecerCF')).toMatchObject({
      paragraphs: ['Favorável'],
    });
  });
});

describe('signature block', () => {
  const signatures = (...lines: Rows) =>
    read(pegada(['Assinaturas'], ['Cargo', 'Nome'], ...lines));

  it('matches cargos to the configured roles and skips lines with no name', () => {
    const draft = signatures(
      ['Direção cessante', 'Ana Silva'],
      ['Direção entrante', null],
      ['conselho fiscal', ' Rui Costa '],
    );

    expect(blockOf(draft, 'assinaturas')).toMatchObject({
      lines: [
        { role: 'Direção cessante', name: 'Ana Silva', cell: 'B4' },
        { role: 'Conselho Fiscal', name: 'Rui Costa', cell: 'B6' },
      ],
    });
    expect(withoutMissing(draft)).toEqual([]);
  });

  it('warns about a cargo that is not configured for this type', () => {
    const draft = signatures(
      ['Conselho Fisca', 'Rui Costa'],
      ['Tesoureira', 'Eva'],
    );

    expect(withoutMissing(draft)).toMatchObject([
      {
        code: 'signature-role-unknown',
        severity: 'warning',
        cell: 'A4',
        suggestion: 'Quis dizer "Conselho Fiscal"?',
      },
      { code: 'signature-role-unknown', cell: 'A5' },
    ]);
    expect(blockOf(draft, 'assinaturas')).toMatchObject({
      lines: [{ role: null }, { role: null }],
    });
  });

  it('is not ended by a cargo that shares its name with a field label', () => {
    const draft = signatures(
      ['Direção cessante', 'Ana'],
      ['Direção entrante', 'Rui'],
    );

    expect(draft.fields).toEqual([]);
    expect(blockOf(draft, 'assinaturas')).toMatchObject({
      lines: [{ name: 'Ana' }, { name: 'Rui' }],
    });
  });
});

describe('sheets still to be filled', () => {
  it.each(REPORT_TIPOS)(
    'lists the untouched %s starter as por preencher with no issues',
    (tipo) => {
      const draft = read(layoutRows(tipo));

      expect(draft.tipo).toBe(tipo);
      expect(draft.porPreencher).toBe(true);
      expect(draft.issues).toEqual([]);
    },
  );

  it('stops being por preencher as soon as one input has a value', () => {
    const rows = layoutRows('fiscal');
    const anoRow = rows.find((row) => row[0] === 'Ano');
    if (anoRow === undefined) throw new Error('Ano row missing');
    anoRow[1] = 2025;

    const draft = read(rows);

    expect(draft.porPreencher).toBe(false);
    expect(draft.fields.find((f) => f.key === 'ano')?.value).toBe(2025);
  });
});
