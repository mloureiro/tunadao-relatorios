import type { IsoDate } from '../dates.ts';
import type { Issue } from '../issues.ts';
import type { ReportJson, ReportTipo } from '../reports/index.ts';

export type ReportStatus =
  | 'por-preencher'
  | 'bloqueado-dados'
  | 'com-erros'
  | 'pronto-com-avisos'
  | 'pronto';

export interface DateLine {
  readonly label: string;
  readonly text: string;
  readonly derivedFrom?: string;
}

export interface KeyFigure {
  readonly label: string;
  readonly value: string;
}

export interface ReportInstance {
  readonly sheet: string;
  readonly tipo: ReportTipo | null;
  readonly status: ReportStatus;
  readonly issues: Issue[];
  readonly dates: DateLine[];
  readonly title: string;
  readonly fileStem: string;
  readonly report?: ReportJson;
  readonly keyFigures: KeyFigure[];
  readonly endDate?: IsoDate;
}

export interface StarterOffer {
  readonly tipo: 'pegada' | 'letivo';
  readonly fileName: string;
  readonly values: Readonly<Record<string, string>>;
}
