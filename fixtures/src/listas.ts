import type { Conta, Direcao } from '../../src/core/dataset/types.ts';

export interface RubricaSpec {
  readonly rubrica: string;
  readonly tipo: Direcao | null;
  readonly contaResultado: boolean;
}

export interface SubRubricaSpec {
  readonly subRubrica: string;
  readonly rubrica: string;
}

export interface MeioSpec {
  readonly meio: string;
  readonly conta: Conta;
}

export interface ListasSpec {
  readonly rubricas: readonly RubricaSpec[];
  readonly subRubricas: readonly SubRubricaSpec[];
  readonly atividades: readonly string[];
  readonly meios: readonly MeioSpec[];
}

function receita(rubrica: string): RubricaSpec {
  return { rubrica, tipo: 'Entrada', contaResultado: true };
}

function despesa(rubrica: string): RubricaSpec {
  return { rubrica, tipo: 'Saída', contaResultado: true };
}

function sub(rubrica: string, ...subRubricas: string[]): SubRubricaSpec[] {
  return subRubricas.map((subRubrica) => ({ subRubrica, rubrica }));
}

export const LISTAS: ListasSpec = {
  rubricas: [
    receita('Quotas'),
    receita('Donativos'),
    receita('Subsídios e apoios'),
    receita('Atuações e serenatas'),
    receita('Inscrições e bilheteira'),
    receita('Bar e merchandising'),
    receita('Patrocínios'),
    receita('Outros recebimentos'),
    despesa('Produção (som, luz, palco)'),
    despesa('Alimentação e alojamento'),
    despesa('Compras para o bar'),
    despesa('Deslocações'),
    despesa('Prémios e troféus'),
    despesa('Instrumentos e manutenção'),
    despesa('Merchandising e trajes'),
    despesa('Comunicação e gráfica'),
    despesa('Seguros e despesas bancárias'),
    despesa('Taxas e licenças'),
    despesa('Outros pagamentos'),
    { rubrica: 'Transferências internas', tipo: null, contaResultado: false },
  ],
  subRubricas: [
    ...sub(
      'Subsídios e apoios',
      'Apoio CMV',
      'Apoio UPV (via AE ESAV)',
      'Apoio Junta de Freguesia',
    ),
    ...sub(
      'Inscrições e bilheteira',
      'Inscrições de tunas',
      'Bilheteira',
      'Inscrições',
    ),
    ...sub('Bar e merchandising', 'Bar', 'Merchandising'),
    ...sub('Patrocínios', 'Patrocínio do evento'),
    ...sub('Outros recebimentos', 'Outros'),
    ...sub('Produção (som, luz, palco)', 'Som e luz', 'Palco e estruturas'),
    ...sub('Alimentação e alojamento', 'Refeições das tunas', 'Alojamento'),
    ...sub('Compras para o bar', 'Bebidas e consumíveis'),
    ...sub('Prémios e troféus', 'Prémios', 'Júri'),
    ...sub('Merchandising e trajes', 'T-shirts'),
    ...sub('Comunicação e gráfica', 'Cartazes e impressões'),
    ...sub('Seguros e despesas bancárias', 'Seguro', 'Despesas bancárias'),
    ...sub('Taxas e licenças', 'Licenças e SPA'),
    ...sub('Outros pagamentos', 'Diversos', 'Outros'),
  ],
  atividades: ['Funcionamento', 'Zumba na Caneca', '20º CITADÃO', 'Festivais'],
  meios: [
    { meio: 'Caixa', conta: 'Caixa' },
    { meio: 'Banco', conta: 'Banco' },
    { meio: 'MB Way', conta: 'Banco' },
    { meio: 'TPA', conta: 'Banco' },
  ],
};

export const FIXTURE_LISTAS: ListasSpec = {
  ...LISTAS,
  atividades: [
    'Funcionamento',
    'Zumba na Caneca 2024',
    'Zumba na Caneca 2025',
    'Zumba na Caneca',
    '18º CITADÃO',
    '19º CITADÃO',
    '20º CITADÃO',
    'Festivais',
  ],
};
