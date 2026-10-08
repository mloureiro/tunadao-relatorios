import {
  DENOMINATIONS_CENTS,
  pegadaFigures,
  type DenominationCents,
} from '../calc/index.ts';
import type { Config } from '../config/schema.ts';
import type { Cents, Dataset } from '../dataset/types.ts';
import { addDays, type IsoDate } from '../dates.ts';
import { formatDate, formatMoney } from '../format.ts';
import {
  bridgeSection,
  card,
  dedupeIssues,
  hasManualOpening,
  headerOf,
  money,
  pendingSection,
  periodLabel,
  present,
  signaturesOf,
  signedMovementsSection,
  textSection,
  themeOf,
  traceOf,
  type BuildContext,
  type BuildOutput,
} from './common.ts';
import type { PegadaParams } from './params.ts';
import type { BridgeRow, CashCountRow, Section } from './types.ts';

const NOTE_THRESHOLD_CENTS = 500;

function denominationLabel(cents: DenominationCents): string {
  return `${cents >= NOTE_THRESHOLD_CENTS ? 'Notas' : 'Moedas'} de ${formatMoney(cents)}`;
}

function reconciliationRows(
  params: PegadaParams,
  adjustedCents: Cents,
  bookBancoCents: Cents,
): BridgeRow[] {
  return [
    {
      label: 'Saldo segundo o extrato bancário',
      value: money(params.saldoExtratoCents),
    },
    ...params.naoDebitados.map((item) => ({
      label: `(−) Pagamento não debitado: ${item.descricao}`,
      value: money(item.valorCents),
    })),
    ...params.naoCreditados.map((item) => ({
      label: `(+) Depósito não creditado: ${item.descricao}`,
      value: money(item.valorCents),
    })),
    {
      label: 'Saldo bancário ajustado',
      value: money(adjustedCents),
      emphasis: true,
    },
    { label: 'Saldo de banco nos livros', value: money(bookBancoCents) },
  ];
}

function declarationParagraphs(
  params: PegadaParams,
  passagem: IsoDate,
): string[] {
  return [
    `Declaramos que, em ${formatDate(passagem)}, os saldos, os valores pendentes e a contagem de caixa indicados neste documento foram conferidos entre ${params.direcaoCessante} (direção cessante) e ${params.direcaoEntrante} (direção entrante).`,
    'O Conselho Fiscal acompanhou a conferência e subscreve esta declaração.',
  ];
}

export function buildPegada(
  dataset: Dataset,
  params: PegadaParams,
  config: Config,
  ctx: BuildContext,
): BuildOutput {
  const { lists } = dataset;
  const pegada = pegadaFigures(dataset, params);
  const { period } = pegada;

  const countedRows: CashCountRow[] = DENOMINATIONS_CENTS.flatMap(
    (denomination) => {
      const row = pegada.cashCount.rows.find(
        (candidate) => candidate.denominationCents === denomination,
      );
      return row === undefined || row.quantity === 0
        ? []
        : [
            {
              label: denominationLabel(denomination),
              qty: String(row.quantity),
              value: money(row.valueCents),
            },
          ];
    },
  );

  const sections: Section[] = [
    {
      kind: 'kpis',
      cards: [
        card('Saldo entregue', period.closing.totalCents),
        card('Caixa', period.closing.caixaCents),
        card('Banco', period.closing.bancoCents),
        card('Posição líquida', pegada.position.netCents),
      ],
    },
    {
      kind: 'position',
      title: 'Posição financeira na passagem',
      segments: pegada.position.segments.map((segment) => ({
        label: segment.label,
        value: money(segment.cents),
        permille: segment.permille,
        negative: segment.negative,
      })),
      net: money(pegada.position.netCents),
    },
    bridgeSection(period, hasManualOpening(pegada.issues)),
    ...present(
      signedMovementsSection(
        'Movimentos desde o último relatório',
        pegada.movements,
        lists,
        config.aggregation.annex,
        pegada.variacaoCents,
      ),
    ),
    {
      kind: 'reconciliation',
      title: 'Reconciliação bancária',
      rows: reconciliationRows(
        params,
        pegada.reconciliation.adjustedCents,
        pegada.reconciliation.bookBancoCents,
      ),
      difference: money(pegada.reconciliation.differenceCents),
    },
    {
      kind: 'cashCount',
      title: 'Contagem de caixa',
      rows: [
        ...countedRows,
        ...(pegada.cashCount.smallCoinsCents > 0
          ? [
              {
                label: 'Moedas pequenas',
                qty: '',
                value: money(pegada.cashCount.smallCoinsCents),
              },
            ]
          : []),
      ],
      total: money(pegada.cashCount.countedCents),
      book: money(pegada.cashCount.bookCaixaCents),
      difference: money(pegada.cashCount.differenceCents),
    },
    ...present(
      pendingSection(
        'Pendentes na passagem',
        params.dataPassagem,
        pegada.pending,
      ),
    ),
    ...present(textSection('Notas / Comentários', params.notas)),
    {
      kind: 'declaration',
      title: 'Declaração',
      paragraphs: declarationParagraphs(params, params.dataPassagem),
    },
  ];

  return {
    report: {
      schemaVersion: 1,
      tipo: 'pegada',
      theme: themeOf(config),
      header: headerOf(
        config,
        'Pegada de direção',
        periodLabel(
          addDays(params.dataUltimoRelatorio, 1),
          params.dataPassagem,
        ),
        `Passagem de ${params.direcaoCessante} para ${params.direcaoEntrante} em ${formatDate(params.dataPassagem)}`,
      ),
      sections,
      signatures: signaturesOf(config.signatures.pegada, [
        params.direcaoCessante,
        params.direcaoEntrante,
      ]),
      trace: traceOf(ctx, params.anexarJson),
    },
    issues: dedupeIssues(pegada.issues),
  };
}
