import type { ReportSheetSpec } from '../../scripts/lib/workbook-writer.ts';

export const RELATORIOS: readonly ReportSheetSpec[] = [
  {
    tipo: 'evento',
    name: 'CITADÃO 2026',
    values: {
      atividade: '20º CITADÃO',
      eventoInicio: '2026-04-30',
      eventoFim: '2026-05-03',
      contarAte: '2026-06-15',
      indicadores: [
        { label: 'Bilhetes vendidos', value: '645' },
        { label: 'Tunas participantes', value: '8' },
        {
          label: 'Custo de acolhimento por tuna (refeições + alojamento)',
          value: '615,00 €',
        },
        {
          label: 'Margem do bar (receita − compras)',
          value: '3.334,60 €',
        },
        { label: 'Peso dos apoios públicos no recebido', value: '22,2%' },
      ],
      notas:
        'Bilheteira e bar acima do orçado; patrocínios abaixo por falta de um protocolo. Para o próximo CITADÃO: fechar patrocínios até fevereiro e orçar alimentação com o preço por refeição já negociado.',
    },
  },
  {
    tipo: 'evento',
    name: 'Zumba 2026',
    values: {
      atividade: 'Zumba na Caneca',
      eventoInicio: '2026-03-14',
      eventoFim: '2026-03-14',
      refPendentes: '2026-03-18',
      indicadores: [
        { label: 'Inscrições', value: '247' },
        { label: 'Por participante', value: '5,99 €' },
      ],
      notas:
        'O resultado do evento reverte para o 20º CITADÃO. O numerário do evento (2.777,50 € recebidos, 248,00 € pagos em mão) foi depositado no banco a 16/03/2026.',
    },
  },
  {
    tipo: 'pegada',
    name: 'Pegada 2026',
    values: {
      dataPassagem: '2026-09-30',
      direcaoCessante: 'Direção 2025/26',
      direcaoEntrante: 'Direção 2026/27',
      saldoExtrato: 13265.05,
      moedasPequenas: 6,
      contagem: { '50': 8, '20': 5, '10': 3, '5': 5, '2': 6, '1': 6 },
      notas:
        'Valores, pendentes e acessos conferidos pelas duas direções e pelo Conselho Fiscal.',
      assinaturas: {
        'Direção cessante': 'Marta Figueiredo',
        'Direção entrante': 'Duarte Pinheiro',
        'Conselho Fiscal': 'Helena Quintela',
      },
    },
  },
  {
    tipo: 'letivo',
    name: 'Letivo 2025-26',
    values: {
      fim: '2026-08-31',
      anexar: true,
      notas:
        'Ano letivo marcado pelo 20º CITADÃO e pela Zumba na Caneca. As quotas em atraso foram regularizadas em setembro.',
    },
  },
  {
    tipo: 'fiscal',
    name: 'Fiscal 2025',
    values: {
      ano: 2025,
      ambitoOrcamento: '2025',
      anexoMovimentos: false,
      parecerCF:
        'O Conselho Fiscal verificou os mapas, os extratos bancários e os documentos de suporte e emite parecer favorável à aprovação das contas de 2025.',
      notas:
        'Resultado de caixa positivo, com o saldo bancário conferido com o extrato de 31/12/2025.',
    },
  },
];
