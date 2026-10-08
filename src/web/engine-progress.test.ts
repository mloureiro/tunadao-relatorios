import { describe, expect, it } from 'vitest';
import { engineProgressLabel } from './engine-progress';

describe('engineProgressLabel()', () => {
  it.each([
    ['before any byte arrived', null, 'A preparar o motor de PDF…'],
    [
      'an unknown total',
      { loaded: 1000, total: null },
      'A preparar o motor de PDF…',
    ],
    [
      'a known total',
      { loaded: 14_162_589, total: 28_325_178 },
      'A preparar o motor de PDF… 50 %',
    ],
    [
      'more bytes than the total',
      { loaded: 30_000_000, total: 28_325_178 },
      'A preparar o motor de PDF… 100 %',
    ],
  ])('shows the percentage only for %s', (_name, progress, label) => {
    expect(engineProgressLabel(progress)).toBe(label);
  });
});
