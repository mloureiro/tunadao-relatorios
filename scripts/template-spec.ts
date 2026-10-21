import { LISTAS, type ListasSpec } from '../fixtures/src/listas.ts';
import {
  DERIVED_ROWS,
  type InstrucaoSpec,
  type ReportSheetSpec,
  type WorkbookSpec,
} from './lib/workbook-writer.ts';

export const TEMPLATE_VERSION = 2;

const TEMPLATE_LISTAS: ListasSpec = {
  ...LISTAS,
  atividades: [
    'Funcionamento',
    'Zumba na Caneca 2026',
    '20º CITADÃO',
    'Arraial de outono 2026',
  ],
};

export const MODEL_SHEETS: readonly ReportSheetSpec[] = [
  { tipo: 'pegada', name: 'Modelo Pegada' },
  { tipo: 'evento', name: 'Modelo Evento' },
  { tipo: 'letivo', name: 'Modelo Letivo' },
  { tipo: 'fiscal', name: 'Modelo Fiscal' },
];

const INSTRUCOES: readonly InstrucaoSpec[] = [
  {
    titulo: 'Modelo de tesouraria do TUNADÃO 1998',
    paragrafos: [
      'Este ficheiro guarda as contas da tuna. Depois de preenchido, carregue-o na página do gerador de relatórios: a página mostra um relatório por cada folha de relatório e descarrega-o em PDF. O ficheiro nunca sai do seu computador.',
      `Versão do modelo de tesouraria: ${String(TEMPLATE_VERSION)}`,
    ],
  },
  {
    titulo: 'Por onde começar',
    paragrafos: [
      '1. Listas: confirme as rubricas, as atividades, os meios de pagamento e os orçamentos. Acrescente no fim de cada coluna o que faltar. Um evento que se repete (o CITADÃO, a Zumba) tem uma atividade por edição, por exemplo "Zumba na Caneca 2027", porque o relatório do evento soma todos os movimentos da atividade.',
      '2. Saldos: a primeira linha de cada conta (Caixa e Banco) é o dinheiro que havia no fim do dia anterior ao primeiro movimento que vai registar. Use a Fonte "Declarado". Não registe saldos iniciais como movimentos.',
      '3. Movimentos: uma linha por cada recebimento e cada pagamento, na data em que o dinheiro entrou ou saiu. Escolha a rubrica, a sub-rubrica, a atividade e o meio nas listas.',
      '4. Pendentes: valores a receber e a pagar que ainda não foram liquidados.',
      '5. Orçamento e Géneros: só se for usar orçamentos ou apoios em espécie.',
      '6. Folhas de relatório: para cada relatório, copie a folha "Modelo" do tipo que precisa (botão direito no separador, Mover ou copiar, Criar uma cópia), dê-lhe um nome e preencha-a. Pode ter quantas folhas quiser no mesmo ficheiro: uma por relatório.',
      '7. Guarde o ficheiro como .xlsx e carregue-o na página do gerador.',
    ],
  },
  {
    titulo: 'Antes de gerar cada relatório',
    paragrafos: [
      'Pegada de direção: todos os movimentos até à data da passagem estão registados. O saldo do extrato bancário está escrito na folha. Os pagamentos e os depósitos que o banco ainda não mostra estão listados. A contagem de caixa tem a quantidade de cada nota e moeda. Os nomes das direções estão escritos.',
      'Relatório de evento: todos os movimentos do evento têm a atividade certa. A atividade está escolhida na folha. Se houver orçamento, está no separador Orçamento com o nome da atividade, ou escolhido em "Orçamento a usar".',
      'Fim de ano letivo: os movimentos do período estão registados. O fim do período está escrito. Se deixar o início em branco, usa-se o dia a seguir ao fim do relatório anterior deste ficheiro.',
      'Fim de ano fiscal: os movimentos de 1 de janeiro a 31 de dezembro estão registados. O ano está escrito. O parecer do Conselho Fiscal está escrito, se já o tiver.',
    ],
  },
  {
    titulo: 'Exemplo de três movimentos',
    paragrafos: [
      'A terceira linha é um reembolso: dinheiro que voltou de uma despesa. Regista-se como Entrada, com a rubrica dessa despesa, e abate à despesa.',
    ],
    tabela: [
      [
        'Data',
        'Descrição',
        'Atividade',
        'Rubrica',
        'Tipo',
        'Meio',
        'Valor (€)',
      ],
      [
        '05/02/2026',
        'Quotas de fevereiro',
        'Funcionamento',
        'Quotas',
        'Entrada',
        'Caixa',
        '120,00',
      ],
      [
        '06/02/2026',
        'Impressão de cartazes',
        'Zumba na Caneca 2026',
        'Comunicação e gráfica',
        'Saída',
        'Caixa',
        '48,00',
      ],
      [
        '20/02/2026',
        'Devolução de parte da caução',
        '20º CITADÃO',
        'Alimentação e alojamento',
        'Entrada',
        'Banco',
        '100,00',
      ],
    ],
  },
  {
    titulo: 'Conceitos',
    paragrafos: [
      'Receita e despesa, e movimentos que só mudam o saldo: cada rubrica diz, no separador Listas, se conta como receita ou despesa. Sim: o movimento entra no relatório. Não: só muda o dinheiro disponível, como acontece com as transferências internas.',
      'Transferência entre contas (por exemplo, depositar numerário no banco): registe duas linhas com a rubrica "Transferências internas", uma Saída na conta de origem e uma Entrada na conta de destino, com o mesmo valor e a mesma data.',
      'Valor: escreva sempre um número positivo. O sentido do movimento está na coluna Tipo (Entrada ou Saída).',
      'Sub-rubrica: é opcional. Quando a deixa em branco, o movimento fica na própria rubrica. A lista mostra só as sub-rubricas da rubrica escolhida, e a célula fica vermelha se a combinação não existir.',
      `Colunas cinzentas: no separador Movimentos, as colunas "(automático)" calculam-se sozinhas até à linha ${String(DERIVED_ROWS)}. Não escreva nelas.`,
      'Pontos de controlo (separador Saldos): cada linha diz quanto dinheiro devia haver numa conta no fim de um dia. A fonte indica de onde vem o valor: Extrato (extrato bancário), Contagem (contagem do dinheiro) ou Declarado (indicado sem comprovativo). O gerador confere cada saldo com os movimentos desde o saldo anterior e diz a diferença, se houver.',
    ],
  },
  {
    titulo: 'No Excel, no LibreOffice e no Google Sheets',
    paragrafos: [
      'Google Sheets: antes de preencher, escolha Ficheiro, Definições, Região: Portugal (basta uma vez), para as datas serem lidas como dia/mês/ano. Para descarregar, escolha Ficheiro, Transferir, Microsoft Excel (.xlsx).',
      'LibreOffice: guarde com Ficheiro, Guardar como, Excel 2007-365 (.xlsx). O formato .ods não é aceite.',
      'Folhas de relatório descarregadas à parte: no Excel, abra a folha e use Mover ou copiar para a pôr neste ficheiro. No LibreOffice, use Folha, Inserir folha a partir de ficheiro. No Google Sheets, use Ficheiro, Importar, Inserir novas folhas.',
      'Nas notas, cada linha é um parágrafo. Para mudar de linha dentro da mesma célula: no Excel, Alt+Enter; no LibreOffice e no Google Sheets, Ctrl+Enter.',
    ],
  },
];

export const TEMPLATE_SPEC: WorkbookSpec = {
  listas: TEMPLATE_LISTAS,
  movimentos: [],
  pendentes: [],
  orcamento: [],
  generos: [],
  saldos: [],
  instrucoes: INSTRUCOES,
  reportSheets: MODEL_SHEETS,
};
