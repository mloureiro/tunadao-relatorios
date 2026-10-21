import type { Issue } from '../issues.ts';
import type { ReportTipo } from '../reports/index.ts';

export type RawValue = string | number | boolean | null;

export interface DraftValue {
  readonly cell: string;
  readonly raw: RawValue;
  readonly value: RawValue;
}

export interface DraftField extends DraftValue {
  readonly key: string;
  readonly label: string;
}

export interface DraftRow {
  readonly first: DraftValue;
  readonly second: DraftValue;
}

export interface DraftPairs {
  readonly kind: 'pairs' | 'indicators';
  readonly key: string;
  readonly title: string;
  readonly titleCell: string;
  readonly rows: readonly DraftRow[];
}

export interface DraftCount {
  readonly denominationCents: number;
  readonly denominationCell: string;
  readonly quantity: DraftValue;
}

export interface DraftCashCount {
  readonly kind: 'cashCount';
  readonly key: string;
  readonly title: string;
  readonly titleCell: string;
  readonly counts: readonly DraftCount[];
}

export interface DraftText {
  readonly kind: 'text';
  readonly key: string;
  readonly title: string;
  readonly titleCell: string;
  readonly paragraphs: readonly string[];
}

export interface DraftSignature {
  readonly cargo: string;
  readonly role: string | null;
  readonly name: string;
  readonly cell: string;
}

export interface DraftSignatures {
  readonly kind: 'signatures';
  readonly key: string;
  readonly title: string;
  readonly titleCell: string;
  readonly lines: readonly DraftSignature[];
}

export type DraftBlock =
  DraftPairs | DraftCashCount | DraftText | DraftSignatures;

export interface SheetDraft {
  readonly sheet: string;
  readonly tipo: ReportTipo | null;
  readonly typeCell: string | null;
  readonly version: number;
  readonly fields: readonly DraftField[];
  readonly blocks: readonly DraftBlock[];
  readonly porPreencher: boolean;
  readonly issues: readonly Issue[];
}
