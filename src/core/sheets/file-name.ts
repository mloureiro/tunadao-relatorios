import type { IsoDate } from '../dates.ts';
import type { ReportTipo } from '../reports/index.ts';

const FORBIDDEN = /[/\\:*?"<>|]/g;
const CONTROL = /\p{Cc}/gu;
const EM_DASH_SEPARATOR = / — /g;

export function reportFileName(parts: {
  readonly title: string;
  readonly endDate?: IsoDate;
}): string {
  const { title, endDate } = parts;
  const base = (endDate === undefined ? title : `${endDate} ${title}`)
    .replace(EM_DASH_SEPARATOR, ' - ')
    .replace(CONTROL, ' ')
    .replace(FORBIDDEN, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  return base === '' ? 'relatorio' : base;
}

export function starterFileName(tipo: ReportTipo): string {
  return `folha-${tipo}.xlsx`;
}
