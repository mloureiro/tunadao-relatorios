import { describe, expect, it } from 'vitest';
import { LISTS, mov } from '../../../tests/support/dataset.ts';
import { compositionSection } from './common.ts';

const movements = (centsBySegment: readonly number[]) =>
  centsBySegment.map((cents, i) =>
    mov({
      data: '2026-05-01',
      cents,
      rubrica: 'Bilheteira',
      subRubrica: `Segmento ${String(i + 1)}`,
    }),
  );

const build = (centsBySegment: readonly number[]) =>
  compositionSection(
    'Composição do recebido',
    'subRubrica',
    movements(centsBySegment),
    LISTS,
    'receita',
  );

describe('compositionSection()', () => {
  it('keeps every segment when there are at most eight', () => {
    const section = build([800, 700, 600, 500, 400, 300, 200, 100]);

    expect(section?.segments.map((segment) => segment.label)).toEqual(
      Array.from({ length: 8 }, (_, i) => `Segmento ${String(i + 1)}`),
    );
  });

  it('folds everything past the seventh segment into one "Restantes rubricas" segment', () => {
    const section = build([1000, 900, 800, 700, 600, 500, 400, 300, 200, 100]);

    const segments = section?.segments ?? [];
    const folded = segments.at(-1);

    expect(segments).toHaveLength(8);
    expect(folded?.label).toBe('Restantes rubricas');
    expect(folded?.value.cents).toBe(600);
    expect(folded?.permille).toBe(109);
    expect(folded?.shareText).toBe('11%');
    expect(section?.total.cents).toBe(5500);
  });
});
