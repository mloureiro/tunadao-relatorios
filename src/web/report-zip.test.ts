import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { zipEntryNames, zipPdfs } from './report-zip';

const pdf = (text: string) => new TextEncoder().encode(`%PDF-${text}`);

describe('zipEntryNames()', () => {
  it('numbers repeated names from 2 and ignores letter case when comparing', () => {
    expect(
      zipEntryNames([
        '2026-09-30 Pegada de direção',
        '2026-09-30 pegada de direção',
        '2026-09-30 Pegada de direção',
        'Outro',
      ]),
    ).toEqual([
      '2026-09-30 Pegada de direção.pdf',
      '2026-09-30 pegada de direção (2).pdf',
      '2026-09-30 Pegada de direção (3).pdf',
      'Outro.pdf',
    ]);
  });

  it('skips a number that a real stem already uses', () => {
    expect(zipEntryNames(['A', 'A (2)', 'A'])).toEqual([
      'A.pdf',
      'A (2).pdf',
      'A (3).pdf',
    ]);
  });
});

describe('zipPdfs()', () => {
  it('stores every PDF byte for byte, uncompressed, under its accented name', () => {
    const bytes = zipPdfs([
      { stem: '2026-06-15 Relatório de evento - 20º CITADÃO', pdf: pdf('a') },
      { stem: '2026-09-30 Pegada de direção', pdf: pdf('b') },
    ]);

    const files = unzipSync(bytes);
    expect(Object.keys(files)).toEqual([
      '2026-06-15 Relatório de evento - 20º CITADÃO.pdf',
      '2026-09-30 Pegada de direção.pdf',
    ]);
    expect(
      strFromU8(files['2026-09-30 Pegada de direção.pdf'] ?? pdf('')),
    ).toBe('%PDF-b');
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    expect(view.getUint16(8, true)).toBe(0);
    expect(view.getUint16(6, true) & 0x800).toBe(0x800);
  });
});
