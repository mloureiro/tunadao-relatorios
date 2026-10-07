import type { Cell } from '../../src/core/input/raw-table.ts';
import type { Sheet } from './workbook.ts';

export const MOVIMENTOS_HEADER = [
  'Data',
  'N.º doc',
  'Descrição',
  'Atividade',
  'Rubrica',
  'Sub-rubrica',
  'Tipo',
  'Meio',
  'Valor (€)',
  'Conta',
  'Valor com sinal (€)',
  'Conta para o resultado',
] as const;

export const LISTAS: Sheet = [
  [
    'Rubrica',
    'Tipo',
    'Conta para o resultado',
    null,
    'Sub-rubrica',
    'Rubrica',
    null,
    'Atividade',
    null,
    'Meio',
    'Conta',
  ],
  [
    'Bilheteira',
    'Entrada',
    'Sim',
    null,
    'Bilhetes',
    'Bilheteira',
    null,
    'Festival Alfa',
    null,
    'Caixa',
    'Caixa',
  ],
  [
    'Alimentação',
    'Saída',
    'Sim',
    null,
    'Outros',
    'Bilheteira',
    null,
    'Serenata',
    null,
    'Banco',
    'Banco',
  ],
  [
    'Transferências internas',
    null,
    'Não',
    null,
    'Outros',
    'Alimentação',
    null,
    null,
    null,
    'MB Way',
    'Banco',
  ],
];

export function movimento(
  overrides: Partial<Record<(typeof MOVIMENTOS_HEADER)[number], Cell>> = {},
): Cell[] {
  const base: Record<(typeof MOVIMENTOS_HEADER)[number], Cell> = {
    Data: 45930,
    'N.º doc': 'F1',
    Descrição: 'Bilhetes vendidos',
    Atividade: 'Festival Alfa',
    Rubrica: 'Bilheteira',
    'Sub-rubrica': 'Bilhetes',
    Tipo: 'Entrada',
    Meio: 'Caixa',
    'Valor (€)': 120.5,
    Conta: null,
    'Valor com sinal (€)': null,
    'Conta para o resultado': null,
  };
  return MOVIMENTOS_HEADER.map((name) =>
    name in overrides ? (overrides[name] ?? null) : base[name],
  );
}

export const XLSX_SHEETS: Readonly<Record<string, Sheet>> = {
  Instruções: [['Preencha os separadores seguintes.']],
  Movimentos: [
    [...MOVIMENTOS_HEADER],
    movimento(),
    movimento({
      Data: 45931,
      'N.º doc': null,
      Descrição: 'Jantar',
      Atividade: 'Serenata',
      Rubrica: 'Alimentação',
      'Sub-rubrica': null,
      Tipo: 'Saída',
      Meio: 'MB Way',
      'Valor (€)': 1234.56,
    }),
  ],
  Pendentes: [
    [
      'Tipo',
      'Entidade',
      'Descrição',
      'Atividade',
      'Valor (€)',
      'Data de registo',
      'Data de liquidação',
      'Notas',
    ],
    ['A receber', 'Câmara', 'Apoio', 'Festival Alfa', 300, 45935, null, null],
  ],
  Orçamento: [
    ['Âmbito', 'Tipo', 'Rubrica', 'Sub-rubrica', 'Orçado (€)'],
    ['Festival Alfa', 'Entrada', 'Bilheteira', 'Bilhetes', 500],
  ],
  Géneros: [
    [
      'Data',
      'Atividade',
      'Tipo',
      'Quantidade',
      'Em falta',
      'Valor estimado (€)',
    ],
    [null, 'Festival Alfa', 'Alojamento', '4 dias', 2, 80],
  ],
  Listas: LISTAS,
  Saldos: [
    ['Data', 'Conta', 'Saldo (€)', 'Fonte'],
    [45930, 'Caixa', 100, 'Contagem'],
  ],
};

export const CSV_FILES: Readonly<Record<string, string>> = {
  'movimentos.csv': [
    'Data;N.º doc;Descrição;Atividade;Rubrica;Sub-rubrica;Tipo;Meio;Valor (€);Conta;Valor com sinal (€);Conta para o resultado',
    '30/09/2025;F1;Bilhetes vendidos;Festival Alfa;Bilheteira;Bilhetes;Entrada;Caixa;120,50 €;;;',
    '01/10/2025;;Jantar;Serenata;Alimentação;;Saída;MB Way;1.234,56 €;;;',
  ].join('\r\n'),
  'pendentes.csv': [
    'Tipo;Entidade;Descrição;Atividade;Valor (€);Data de registo;Data de liquidação;Notas',
    'A receber;Câmara;Apoio;Festival Alfa;300,00 €;05/10/2025;;',
  ].join('\r\n'),
  'orcamento.csv': [
    'Âmbito;Tipo;Rubrica;Sub-rubrica;Orçado (€)',
    'Festival Alfa;Entrada;Bilheteira;Bilhetes;500,00 €',
  ].join('\r\n'),
  'generos.csv': [
    'Data;Atividade;Tipo;Quantidade;Em falta;Valor estimado (€)',
    ';Festival Alfa;Alojamento;4 dias;2;80,00 €',
  ].join('\r\n'),
  'listas.csv': [
    'Rubrica;Tipo;Conta para o resultado;;Sub-rubrica;Rubrica;;Atividade;;Meio;Conta',
    'Bilheteira;Entrada;Sim;;Bilhetes;Bilheteira;;Festival Alfa;;Caixa;Caixa',
    'Alimentação;Saída;Sim;;Outros;Bilheteira;;Serenata;;Banco;Banco',
    'Transferências internas;;Não;;Outros;Alimentação;;;;MB Way;Banco',
  ].join('\r\n'),
  'saldos.csv': [
    'Data;Conta;Saldo (€);Fonte',
    '30/09/2025;Caixa;100,00 €;Contagem',
  ].join('\r\n'),
};
