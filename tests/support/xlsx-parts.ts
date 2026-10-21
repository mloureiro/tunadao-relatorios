import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

export async function readFileBytes(path: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(path));
}

export async function sheetXml(
  bytes: Uint8Array,
  sheetName: string,
): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const read = async (path: string) =>
    (await zip.file(path)?.async('string')) ?? '';
  const workbook = await read('xl/workbook.xml');
  const rels = await read('xl/_rels/workbook.xml.rels');
  const id = new RegExp(
    `<sheet [^>]*name="${sheetName}"[^>]*r:id="([^"]+)"`,
  ).exec(workbook)?.[1];
  const target =
    id === undefined
      ? undefined
      : new RegExp(`<Relationship [^>]*Id="${id}"[^>]*Target="([^"]+)"`).exec(
          rels,
        )?.[1];
  if (target === undefined) throw new Error(`No sheet ${sheetName}`);
  return read(`xl/${target.replace(/^\/?(xl\/)?/, '')}`);
}

export function withSheetsFrom(
  base: Uint8Array,
  extra: Uint8Array,
  options: { drop: (name: string) => boolean },
): Uint8Array {
  const workbook = XLSX.read(base, { type: 'array', sheetStubs: true });
  const added = XLSX.read(extra, { type: 'array', sheetStubs: true });
  workbook.SheetNames = workbook.SheetNames.filter(
    (name) => !options.drop(name),
  );
  workbook.Sheets = Object.fromEntries(
    Object.entries(workbook.Sheets).filter(([name]) => !options.drop(name)),
  );
  for (const name of added.SheetNames) {
    const sheet = added.Sheets[name];
    if (sheet !== undefined)
      XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  return new Uint8Array(
    XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer,
  );
}
