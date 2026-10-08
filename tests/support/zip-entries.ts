import JSZip from 'jszip';

export async function zipEntries(
  bytes: Uint8Array,
): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(bytes);
  const entries: Record<string, string> = {};
  for (const name of Object.keys(zip.files).toSorted()) {
    if (!zip.files[name]?.dir) {
      entries[name] = (await zip.file(name)?.async('string')) ?? '';
    }
  }
  return entries;
}
