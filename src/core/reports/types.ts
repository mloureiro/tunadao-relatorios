import type { Cents } from '../dataset/types.ts';

export type ReportTipo = 'evento' | 'pegada' | 'letivo' | 'fiscal';

export interface Money {
  readonly cents: Cents;
  readonly text: string;
}

export interface KpiCard {
  readonly label: string;
  readonly value: string;
  readonly caption?: string;
}

export interface SummarySection {
  readonly kind: 'summary';
  readonly text: string;
}

export interface KpisSection {
  readonly kind: 'kpis';
  readonly cards: readonly KpiCard[];
}

export interface BridgeRow {
  readonly label: string;
  readonly value: Money;
  readonly emphasis?: boolean;
}

export interface BridgeSection {
  readonly kind: 'bridge';
  readonly title: string;
  readonly rows: readonly BridgeRow[];
}

export interface CompositionSegment {
  readonly label: string;
  readonly value: Money;
  readonly permille: number;
  readonly shareText: string;
}

export interface CompositionSection {
  readonly kind: 'composition';
  readonly title: string;
  readonly total: Money;
  readonly segments: readonly CompositionSegment[];
}

export interface PositionSegment {
  readonly label: string;
  readonly value: Money;
  readonly permille: number;
  readonly negative: boolean;
}

export interface PositionSection {
  readonly kind: 'position';
  readonly title: string;
  readonly segments: readonly PositionSegment[];
  readonly net: Money;
}

export interface BudgetRow {
  readonly label: string;
  readonly orcado: Money;
  readonly realizado: Money;
  readonly desvio: Money;
  readonly execucao: string;
}

export interface BudgetSection {
  readonly kind: 'budget';
  readonly title: string;
  readonly rows: readonly BudgetRow[];
  readonly total: BudgetRow;
}

export interface ActivityRow {
  readonly atividade: string;
  readonly recebido: Money;
  readonly pago: Money;
  readonly resultado: Money;
}

export interface ByActivitySection {
  readonly kind: 'byActivity';
  readonly title: string;
  readonly rows: readonly ActivityRow[];
  readonly total: Omit<ActivityRow, 'atividade'>;
}

export interface PendingRow {
  readonly entidade: string;
  readonly descricao: string;
  readonly atividade?: string;
  readonly registo: string;
  readonly valor: Money;
  readonly notas?: string;
}

export interface PendingSection {
  readonly kind: 'pending';
  readonly title: string;
  readonly refLabel: string;
  readonly receber: readonly PendingRow[];
  readonly pagar: readonly PendingRow[];
  readonly emptyReceber?: string;
  readonly emptyPagar?: string;
  readonly totals: { readonly receber: Money; readonly pagar: Money };
}

export interface InKindRow {
  readonly data?: string;
  readonly atividade: string;
  readonly tipo: string;
  readonly quantidade?: string;
  readonly emFalta?: string;
  readonly valor?: Money;
}

export interface InKindSection {
  readonly kind: 'inKind';
  readonly title: string;
  readonly rows: readonly InKindRow[];
  readonly total?: Money;
}

export interface IndicatorsSection {
  readonly kind: 'indicators';
  readonly title: string;
  readonly rows: readonly { readonly label: string; readonly value: string }[];
}

export interface ReconciliationSection {
  readonly kind: 'reconciliation';
  readonly title: string;
  readonly rows: readonly BridgeRow[];
  readonly difference: Money;
}

export interface CashCountRow {
  readonly label: string;
  readonly qty: string;
  readonly value: Money;
}

export interface CashCountSection {
  readonly kind: 'cashCount';
  readonly title: string;
  readonly rows: readonly CashCountRow[];
  readonly total: Money;
  readonly book: Money;
  readonly difference: Money;
}

export interface MovementRow {
  readonly data: string;
  readonly doc: string;
  readonly descricao: string;
  readonly atividade: string;
  readonly rubrica: string;
  readonly meio: string;
  readonly valor: Money;
  readonly entrada?: Money;
  readonly saida?: Money;
  readonly acumulado?: Money;
  readonly refund: boolean;
  readonly outsideResult: boolean;
}

export interface FooterLine {
  readonly label: string;
  readonly value: Money;
}

export interface MovementsSection {
  readonly kind: 'movements';
  readonly title: string;
  readonly columns: 'cashbook' | 'signed';
  readonly rows: readonly MovementRow[];
  readonly outside?: {
    readonly title: string;
    readonly rows: readonly MovementRow[];
    readonly subtotal: Money;
  };
  readonly footer: readonly FooterLine[];
}

export interface ComparisonRow {
  readonly label: string;
  readonly kind: 'saldo' | 'receita' | 'despesa' | 'total';
  readonly previous: string;
  readonly current: string;
  readonly variation: string;
}

export interface ComparisonBar {
  readonly label: string;
  readonly side: 'receita' | 'despesa';
  readonly previousText: string;
  readonly currentText: string;
  readonly previousPermille: number;
  readonly currentPermille: number;
}

export interface YearComparisonSection {
  readonly kind: 'yearComparison';
  readonly title: string;
  readonly status: 'ok' | 'sem-dados';
  readonly labels: readonly [string, string];
  readonly message?: string;
  readonly rows: readonly ComparisonRow[];
  readonly bars?: readonly ComparisonBar[];
}

export interface TextSection {
  readonly kind: 'text';
  readonly title: string;
  readonly paragraphs: readonly string[];
}

export interface DeclarationSection {
  readonly kind: 'declaration';
  readonly title: string;
  readonly paragraphs: readonly string[];
}

export type Section =
  | SummarySection
  | KpisSection
  | BridgeSection
  | CompositionSection
  | PositionSection
  | BudgetSection
  | ByActivitySection
  | PendingSection
  | InKindSection
  | IndicatorsSection
  | ReconciliationSection
  | CashCountSection
  | MovementsSection
  | YearComparisonSection
  | TextSection
  | DeclarationSection;

export interface Signature {
  readonly title: string;
  readonly name?: string;
}

export interface ReportJson {
  readonly schemaVersion: 1;
  readonly tipo: ReportTipo;
  readonly theme: {
    readonly navy: string;
    readonly light: string;
    readonly accentRed: string;
    readonly accentGold: string;
  };
  readonly header: {
    readonly org: string;
    readonly subtitle: string;
    readonly title: string;
    readonly periodLabel: string;
    readonly lead?: string;
  };
  readonly sections: readonly Section[];
  readonly signatures: readonly Signature[];
  readonly trace: {
    readonly generatedAt: string;
    readonly generatedAtLabel: string;
    readonly sources: readonly {
      readonly name: string;
      readonly sha256Short: string;
    }[];
    readonly generatorVersion: string;
    readonly attachReport: boolean;
  };
}
