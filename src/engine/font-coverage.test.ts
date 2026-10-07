import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultManifest } from './assets';

const NBSP = String.fromCodePoint(0xa0);
const OUTPUT_GLYPHS =
  'áàâãçéêíóôõúÁÀÂÃÇÉÊÍÓÔÕÚ€−º ª×·–' + ' !"#$%&\'()*+,-./0123456789:;<=>?@[]_';

function codepointsOf(font: Buffer): Set<number> {
  const tableCount = font.readUInt16BE(4);
  let cmapOffset = -1;
  for (let i = 0; i < tableCount; i++) {
    const record = 12 + i * 16;
    if (font.toString('latin1', record, record + 4) === 'cmap') {
      cmapOffset = font.readUInt32BE(record + 8);
    }
  }
  if (cmapOffset < 0) throw new Error('Font has no cmap table');

  const covered = new Set<number>();
  const subtableCount = font.readUInt16BE(cmapOffset + 2);
  for (let i = 0; i < subtableCount; i++) {
    const start = cmapOffset + font.readUInt32BE(cmapOffset + 4 + i * 8 + 4);
    const format = font.readUInt16BE(start);
    if (format === 4) {
      const segments = font.readUInt16BE(start + 6) / 2;
      const endCodes = start + 14;
      const startCodes = endCodes + segments * 2 + 2;
      const deltas = startCodes + segments * 2;
      const rangeOffsets = deltas + segments * 2;
      for (let s = 0; s < segments; s++) {
        const first = font.readUInt16BE(startCodes + s * 2);
        const last = font.readUInt16BE(endCodes + s * 2);
        for (let code = first; code <= last && code < 0xffff; code++) {
          const rangeOffset = font.readUInt16BE(rangeOffsets + s * 2);
          const glyph =
            rangeOffset === 0
              ? (code + font.readInt16BE(deltas + s * 2)) & 0xffff
              : font.readUInt16BE(
                  rangeOffsets + s * 2 + rangeOffset + (code - first) * 2,
                );
          if (glyph !== 0) covered.add(code);
        }
      }
    } else if (format === 12) {
      const groups = font.readUInt32BE(start + 12);
      for (let g = 0; g < groups; g++) {
        const group = start + 16 + g * 12;
        const first = font.readUInt32BE(group);
        const last = font.readUInt32BE(group + 4);
        for (let code = first; code <= last; code++) covered.add(code);
      }
    }
  }
  return covered;
}

describe('bundled fonts', () => {
  it.each(defaultManifest.fonts)(
    '%s covers every glyph the reports print',
    (path) => {
      const covered = codepointsOf(readFileSync(path));

      const missing = Array.from(OUTPUT_GLYPHS + NBSP)
        .map((char) => char.codePointAt(0) ?? 0)
        .filter((code) => !covered.has(code))
        .map((code) => `U+${code.toString(16).toUpperCase().padStart(4, '0')}`);

      expect(missing).toEqual([]);
    },
  );

  it('detects a glyph the font lacks', () => {
    const covered = codepointsOf(readFileSync(defaultManifest.fonts[0] ?? ''));

    expect(covered.has(0x1d11e)).toBe(false);
  });
});
