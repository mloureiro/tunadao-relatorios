import { TAB_NAMES } from '@/core/input/columns';
import { formatDate, formatDateLong } from '@/core/format';
import { formatIssueLocation, type Issue } from '@/core/issues';
import { REPORT_SPECS } from '@/core/sheets/catalogue';
import type {
  ReportInstance,
  ReportStatus,
  StarterOffer,
} from '@/core/sheets/instance';
import type { DataSummary } from '@/core/summary';
import type { WorkbookResult } from '@/core/workbook';

export const NOT_A_WORKBOOK =
  'Este ficheiro não é uma folha .xlsx. Guarde a Tesouraria como .xlsx (Excel, LibreOffice ou Google Sheets → Transferir → .xlsx) e carregue-a outra vez.';

export const ONE_FILE_ONLY = 'Carregue um ficheiro de cada vez.';

export const UNREADABLE =
  'Não foi possível ler este ficheiro (pode estar protegido por palavra-passe ou danificado). Abra-o na folha de cálculo, grave como .xlsx e carregue outra vez.';

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

export function checkSelection(names: readonly string[]): string | null {
  if (names.length > 1) return ONE_FILE_ONLY;
  return names.every((name) => name.toLowerCase().endsWith('.xlsx'))
    ? null
    : NOT_A_WORKBOOK;
}

export function checkContents(bytes: Uint8Array): string | null {
  return ZIP_SIGNATURE.every((byte, position) => bytes[position] === byte)
    ? null
    : NOT_A_WORKBOOK;
}

export function isUnreadable(result: WorkbookResult): boolean {
  return result.load.issues.some(({ code }) => code === 'unreadable-file');
}

export function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

export const STATUS_LABEL: Readonly<Record<ReportStatus, string>> = {
  pronto: 'Pronto',
  'pronto-com-avisos': 'Pronto, com avisos',
  'com-erros': 'Com erros',
  'por-preencher': 'Por preencher',
  'bloqueado-dados': 'Bloqueado pelos dados',
};

const STATUS_NOTE: Readonly<Partial<Record<ReportStatus, string>>> = {
  'com-erros':
    'Corrija as células indicadas no ficheiro e carregue a versão corrigida.',
  'por-preencher':
    'Esta folha ainda não tem dados. Preencha-a no ficheiro e carregue-o outra vez.',
  'bloqueado-dados': 'Corrija primeiro os erros dos dados, indicados acima.',
};

export function isReady({ status }: ReportInstance): boolean {
  return status === 'pronto' || status === 'pronto-com-avisos';
}

export function statusNote({ status }: ReportInstance): string | null {
  return STATUS_NOTE[status] ?? null;
}

export interface IssueGroup {
  readonly title: string;
  readonly issues: readonly Issue[];
}

const FILE_GROUP = 'Ficheiro';
const GROUP_ORDER: readonly string[] = [
  FILE_GROUP,
  'Listas',
  'Saldos',
  ...TAB_NAMES.filter((tab) => tab !== 'Listas' && tab !== 'Saldos'),
];

const severityRank = ({ severity }: Issue): number =>
  severity === 'error' ? 0 : 1;

export function groupDataIssues(issues: readonly Issue[]): IssueGroup[] {
  const byTitle = new Map<string, Issue[]>();
  for (const issue of issues) {
    const title = issue.tab ?? FILE_GROUP;
    byTitle.set(title, [...(byTitle.get(title) ?? []), issue]);
  }
  return [...byTitle]
    .toSorted(([a], [b]) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b))
    .map(([title, group]) => ({
      title,
      issues: group.toSorted(
        (a, b) =>
          severityRank(a) - severityRank(b) || (a.row ?? 0) - (b.row ?? 0),
      ),
    }));
}

export function dataIssueWhere({ row, column }: Issue): string | null {
  const parts = [
    row === undefined ? null : `linha ${String(row)}`,
    column === undefined ? null : `coluna ${column}`,
  ].filter((part) => part !== null);
  return parts.length === 0 ? null : parts.join(', ');
}

export function countErrors(issues: readonly Issue[]): number {
  return issues.filter(({ severity }) => severity === 'error').length;
}

export interface SheetIssueParts {
  readonly lead: string;
  readonly cell: string | null;
  readonly body: string;
}

export function sheetIssueParts(issue: Issue): SheetIssueParts {
  const line = formatIssueLocation(issue);
  const { cell } = issue;
  if (issue.sheet === undefined || cell === undefined) {
    return { lead: '', cell: null, body: line };
  }
  const marker = `célula ${cell}`;
  const at = line.indexOf(marker);
  return {
    lead: line.slice(0, at + 'célula '.length),
    cell,
    body: line.slice(at + marker.length),
  };
}

export interface Fact {
  readonly label: string;
  readonly value: string;
}

export function summaryFacts(summary: DataSummary): Fact[] {
  const asOf = formatDate(summary.lastDate);
  return [
    {
      label: 'Período dos movimentos',
      value: `${formatDate(summary.firstDate)} a ${asOf}`,
    },
    { label: 'Movimentos', value: String(summary.movimentos) },
    { label: 'Atividades', value: String(summary.atividades) },
    ...(summary.caixa === null
      ? []
      : [{ label: `Caixa a ${asOf}`, value: summary.caixa.text }]),
    ...(summary.banco === null
      ? []
      : [{ label: `Banco a ${asOf}`, value: summary.banco.text }]),
  ];
}

export function loadedAnnouncement(result: WorkbookResult): string {
  const dataErrors = countErrors(result.load.issues);
  if (dataErrors > 0) {
    return `Ficheiro lido. ${plural(dataErrors, 'erro', 'erros')} nos dados a corrigir.`;
  }
  const count = result.reports.length;
  return count === 0
    ? 'Ficheiro lido. Ainda não tem folhas de relatório.'
    : `Ficheiro lido. ${plural(count, 'relatório', 'relatórios')} neste ficheiro.`;
}

export function clockLabel(lisbonIso: string): string {
  return lisbonIso.slice(11, 16);
}

export interface ZipSkip {
  readonly sheet: string;
  readonly reason: string;
}

export function skippedForZip(
  reports: readonly ReportInstance[],
  failed: readonly ReportInstance[],
): ZipSkip[] {
  const notReady = reports
    .filter((instance) => !isReady(instance))
    .map((instance) => ({
      sheet: instance.sheet,
      reason: STATUS_LABEL[instance.status].toLowerCase(),
    }));
  const broken = failed.map(({ sheet }) => ({
    sheet,
    reason: 'não foi possível gerar o PDF',
  }));
  return [...notReady, ...broken];
}

export function zipResultLine(
  included: number,
  skipped: readonly ZipSkip[],
): string {
  const done = `Zip descarregado com ${plural(included, 'relatório', 'relatórios')}.`;
  if (skipped.length === 0) return done;
  const names = skipped
    .map(({ sheet, reason }) => `"${sheet}" (${reason})`)
    .join(', ');
  return `${done} Não incluídos: ${names}.`;
}

export function nextSheetFacts(offer: StarterOffer): Fact[] {
  const { fields } = REPORT_SPECS[offer.tipo];
  return Object.entries(offer.values).flatMap(([key, value]) => {
    const field = fields.find((candidate) => candidate.key === key);
    if (field === undefined) return [];
    return [
      {
        label: field.label,
        value: field.kind === 'date' ? formatDateLong(value) : value,
      },
    ];
  });
}
