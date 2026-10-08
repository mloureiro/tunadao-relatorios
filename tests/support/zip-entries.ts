import JSZip from 'jszip';

export async function zipEntries(
  bytes: Uint8Array,
): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(bytes);
  const names = Object.keys(zip.files)
    .filter((name) => !zip.files[name]?.dir)
    .toSorted();
  return Object.fromEntries(
    await Promise.all(
      names.map(async (name) => [name, await zip.file(name)?.async('string')]),
    ),
  ) as Record<string, string>;
}
