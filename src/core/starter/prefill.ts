import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { parseIso, type IsoDate } from '../dates.ts';
import type { ReportTipo } from '../reports/index.ts';
import { REPORT_SPECS } from '../sheets/catalogue.ts';
import { buildLayout } from '../sheets/layout.ts';

const SHEET_PATH = 'xl/worksheets/sheet1.xml';
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;
const ZIP_TIME = new Date(Date.UTC(2026, 0, 1));
const NO_CARGOS = {
  signatures: { evento: [], pegada: [], letivo: [], fiscal: [] },
};

const XML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

function escapeXml(text: string): string {
  return text.replace(/[&<>"]/g, (char) => XML_ESCAPES[char] ?? char);
}

function serialOf(iso: IsoDate): number {
  const { year, month, day } = parseIso(iso);
  return (Date.UTC(year, month - 1, day) - EXCEL_EPOCH_UTC) / DAY_MS;
}

function cellXml(address: string, style: string, kind: string, value: string) {
  const prefix = `<c r="${address}"${style}`;
  if (kind === 'date') return `${prefix}><v>${String(serialOf(value))}</v></c>`;
  if (kind === 'text' || kind === 'activity' || kind === 'budget') {
    return `${prefix} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  }
  throw new Error(`Cannot pre-fill a ${kind} field`);
}

function patchCell(
  xml: string,
  address: string,
  kind: string,
  value: string,
): string {
  const element = new RegExp(`<c r="${address}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
  const match = element.exec(xml);
  if (match === null) throw new Error(`Starter sheet has no cell ${address}`);
  const style = /\ss="\d+"/.exec(match[1] ?? '')?.[0] ?? '';
  return xml.replace(element, () => cellXml(address, style, kind, value));
}

export function prefillStarter(
  bytes: Uint8Array,
  tipo: ReportTipo,
  values: Readonly<Record<string, string>>,
): Uint8Array {
  const { valueCells } = buildLayout(tipo, NO_CARGOS);
  const files = unzipSync(bytes);
  const sheet = files[SHEET_PATH];
  if (sheet === undefined) throw new Error(`Starter has no ${SHEET_PATH}`);

  let xml = strFromU8(sheet);
  for (const [key, value] of Object.entries(values)) {
    const address = valueCells[key];
    const field = REPORT_SPECS[tipo].fields.find((f) => f.key === key);
    if (address === undefined || field === undefined) {
      throw new Error(`Unknown ${tipo} field ${key}`);
    }
    xml = patchCell(xml, address, field.kind, value);
  }
  return zipSync({ ...files, [SHEET_PATH]: strToU8(xml) }, { mtime: ZIP_TIME });
}
