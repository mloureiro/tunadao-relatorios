import { zipSync } from 'fflate';

export interface ZipPdf {
  readonly stem: string;
  readonly pdf: Uint8Array;
}

export const ZIP_FILE_NAME = 'Relatórios.zip';

export function zipEntryNames(stems: readonly string[]): string[] {
  const taken = new Set<string>();
  return stems.map((stem) => {
    let name = `${stem}.pdf`;
    for (let copy = 2; taken.has(name.toLowerCase()); copy += 1) {
      name = `${stem} (${String(copy)}).pdf`;
    }
    taken.add(name.toLowerCase());
    return name;
  });
}

export function zipPdfs(items: readonly ZipPdf[]): Uint8Array {
  const names = zipEntryNames(items.map(({ stem }) => stem));
  const files: Record<string, [Uint8Array, { level: 0 }]> = {};
  items.forEach(({ pdf }, index) => {
    files[names[index] ?? ''] = [pdf, { level: 0 }];
  });
  return zipSync(files);
}

export function reportZipFile(items: readonly ZipPdf[]): {
  readonly name: string;
  readonly blob: Blob;
} {
  return {
    name: ZIP_FILE_NAME,
    blob: new Blob([zipPdfs(items).slice().buffer], {
      type: 'application/zip',
    }),
  };
}
