import type {
  GeneroSpec,
  OrcamentoSpec,
  PendenteSpec,
  SaldoSpec,
  WorkbookSpec,
} from '../../scripts/lib/workbook-writer.ts';
import { cents, ordenarENumerar } from './linhas.ts';
import { FIXTURE_LISTAS } from './listas.ts';
import { MOVIMENTOS_2024 } from './movimentos-2024.ts';
import { MOVIMENTOS_2025 } from './movimentos-2025.ts';
import { MOVIMENTOS_2026 } from './movimentos-2026.ts';

function pendente(
  tipo: PendenteSpec['tipo'],
  entidade: string,
  descricao: string,
  atividade: string,
  valor: number,
  dataRegisto: string,
  dataLiquidacao: string | null,
  notas: string | null,
): PendenteSpec {
  return {
    tipo,
    entidade,
    descricao,
    atividade,
    valorCents: cents(valor),
    dataRegisto,
    dataLiquidacao,
    notas,
  };
}

function orcado(
  ambito: string,
  tipo: OrcamentoSpec['tipo'],
  rubrica: string,
  valor: number,
  subRubrica: string | null = null,
): OrcamentoSpec {
  return { ambito, tipo, rubrica, subRubrica, orcadoCents: cents(valor) };
}

function saldo(
  data: string,
  conta: SaldoSpec['conta'],
  valor: number,
  fonte: SaldoSpec['fonte'],
): SaldoSpec {
  return { data, conta, saldoCents: cents(valor), fonte };
}

function genero(tipo: string, quantidade: string, valor: number): GeneroSpec {
  return {
    data: '2026-04-30',
    atividade: '20º CITADÃO',
    tipo,
    quantidade,
    emFalta: null,
    valorEstimadoCents: cents(valor),
  };
}

const PENDENTES: readonly PendenteSpec[] = [
  pendente(
    'A receber',
    'Câmara Municipal',
    'Apoio ao 19º CITADÃO: 2.ª tranche (Protocolo 2025)',
    'Funcionamento',
    1000,
    '2025-04-15',
    '2026-01-12',
    null,
  ),
  pendente(
    'A pagar',
    'Fornecedor de som',
    'Saldo do Arraial 2025 (fatura FT 2025/311)',
    'Festivais',
    450,
    '2025-08-25',
    '2026-01-20',
    null,
  ),
  pendente(
    'A receber',
    'Patrocinador do 20º CITADÃO',
    'Protocolo de 750 €: pagos 500 €, faltam 250 €',
    '20º CITADÃO',
    250,
    '2026-04-02',
    '2026-09-18',
    null,
  ),
  pendente(
    'A receber',
    'Membros (6)',
    'Quotas 2026 em atraso (6 membros × 20 €)',
    'Funcionamento',
    120,
    '2026-05-31',
    '2026-09-08',
    'Lista de membros em anexo',
  ),
  pendente(
    'A pagar',
    'Membro da tuna',
    'Reembolso de cordas compradas em julho',
    'Funcionamento',
    64.3,
    '2026-07-15',
    '2026-09-26',
    'Talão anexo',
  ),
  pendente(
    'A receber',
    'Noivos (exemplo)',
    'Atuação em casamento de outubro: sinal por receber',
    'Funcionamento',
    300,
    '2026-09-21',
    null,
    'Confirmado por e-mail',
  ),
  pendente(
    'A pagar',
    'Gráfica (exemplo)',
    'Cartazes do Arraial de outono',
    'Festivais',
    180,
    '2026-09-24',
    null,
    'Fatura a emitir',
  ),
];

const ORCAMENTO: readonly OrcamentoSpec[] = [
  orcado(
    '20º CITADÃO',
    'Entrada',
    'Inscrições e bilheteira',
    2400,
    'Inscrições de tunas',
  ),
  orcado(
    '20º CITADÃO',
    'Entrada',
    'Inscrições e bilheteira',
    3500,
    'Bilheteira',
  ),
  orcado('20º CITADÃO', 'Entrada', 'Bar e merchandising', 5800, 'Bar'),
  orcado('20º CITADÃO', 'Entrada', 'Bar e merchandising', 800, 'Merchandising'),
  orcado('20º CITADÃO', 'Entrada', 'Patrocínios', 3000),
  orcado('20º CITADÃO', 'Entrada', 'Subsídios e apoios', 2500, 'Apoio CMV'),
  orcado(
    '20º CITADÃO',
    'Entrada',
    'Subsídios e apoios',
    1500,
    'Apoio UPV (via AE ESAV)',
  ),
  orcado(
    '20º CITADÃO',
    'Entrada',
    'Subsídios e apoios',
    500,
    'Apoio Junta de Freguesia',
  ),
  orcado(
    '20º CITADÃO',
    'Saída',
    'Produção (som, luz, palco)',
    3600,
    'Som e luz',
  ),
  orcado(
    '20º CITADÃO',
    'Saída',
    'Produção (som, luz, palco)',
    1200,
    'Palco e estruturas',
  ),
  orcado(
    '20º CITADÃO',
    'Saída',
    'Alimentação e alojamento',
    3000,
    'Refeições das tunas',
  ),
  orcado(
    '20º CITADÃO',
    'Saída',
    'Alimentação e alojamento',
    1800,
    'Alojamento',
  ),
  orcado('20º CITADÃO', 'Saída', 'Compras para o bar', 2700),
  orcado('20º CITADÃO', 'Saída', 'Prémios e troféus', 900),
  orcado('20º CITADÃO', 'Saída', 'Prémios e troféus', 400, 'Júri'),
  orcado('20º CITADÃO', 'Saída', 'Comunicação e gráfica', 600),
  orcado('20º CITADÃO', 'Saída', 'Taxas e licenças', 300, 'Licenças e SPA'),
  orcado('20º CITADÃO', 'Saída', 'Seguros e despesas bancárias', 185, 'Seguro'),
  orcado('20º CITADÃO', 'Saída', 'Merchandising e trajes', 650, 'T-shirts'),
  orcado('20º CITADÃO', 'Saída', 'Outros pagamentos', 200, 'Diversos'),

  orcado('2025', 'Entrada', 'Quotas', 1200),
  orcado('2025', 'Entrada', 'Donativos', 800),
  orcado('2025', 'Entrada', 'Subsídios e apoios', 4500),
  orcado('2025', 'Entrada', 'Atuações e serenatas', 3600),
  orcado('2025', 'Entrada', 'Inscrições e bilheteira', 6000),
  orcado('2025', 'Entrada', 'Bar e merchandising', 5500),
  orcado('2025', 'Entrada', 'Patrocínios', 2500),
  orcado('2025', 'Entrada', 'Outros recebimentos', 100),
  orcado('2025', 'Saída', 'Produção (som, luz, palco)', 6200),
  orcado('2025', 'Saída', 'Alimentação e alojamento', 4600),
  orcado('2025', 'Saída', 'Compras para o bar', 3000),
  orcado('2025', 'Saída', 'Deslocações', 3000),
  orcado('2025', 'Saída', 'Prémios e troféus', 800),
  orcado('2025', 'Saída', 'Instrumentos e manutenção', 900),
  orcado('2025', 'Saída', 'Merchandising e trajes', 1300),
  orcado('2025', 'Saída', 'Comunicação e gráfica', 600),
  orcado('2025', 'Saída', 'Seguros e despesas bancárias', 420),
  orcado('2025', 'Saída', 'Taxas e licenças', 400),
  orcado('2025', 'Saída', 'Outros pagamentos', 150),
];

const GENEROS: readonly GeneroSpec[] = [
  genero('UPV: cedência da Aula Magna, CAFAC e Pala do CAFAC', '4 dias', 2400),
  genero('CMV: transporte das tunas (autocarro municipal)', '2 viagens', 380),
  genero('Ginásio parceiro: cadeiras e mesas', '150 un.', 150),
];

export const SALDOS: readonly SaldoSpec[] = [
  saldo('2023-12-31', 'Caixa', 150, 'Declarado'),
  saldo('2023-12-31', 'Banco', 1908.6, 'Declarado'),
  saldo('2024-12-31', 'Caixa', 185.4, 'Contagem'),
  saldo('2024-12-31', 'Banco', 3912.75, 'Extrato'),
  saldo('2025-12-31', 'Caixa', 240, 'Contagem'),
  saldo('2025-12-31', 'Banco', 5991.55, 'Extrato'),
  saldo('2026-08-31', 'Caixa', 258.3, 'Contagem'),
  saldo('2026-08-31', 'Banco', 13219.75, 'Extrato'),
  saldo('2026-09-30', 'Caixa', 579, 'Contagem'),
  saldo('2026-09-30', 'Banco', 13265.05, 'Extrato'),
];

export const TESOURARIA: WorkbookSpec = {
  listas: FIXTURE_LISTAS,
  movimentos: ordenarENumerar([
    ...MOVIMENTOS_2024,
    ...MOVIMENTOS_2025,
    ...MOVIMENTOS_2026,
  ]),
  pendentes: PENDENTES,
  orcamento: ORCAMENTO,
  generos: GENEROS,
  saldos: SALDOS,
  instrucoes: [
    {
      titulo: 'Tesouraria fictícia do TUNADÃO 1998',
      paragrafos: [
        'Dados inventados, encadeados de janeiro de 2024 a setembro de 2026, usados para testar o gerador de relatórios. Nenhuma linha é real.',
      ],
    },
  ],
};
