import { describe, expect, it } from 'vitest';
import { permille } from './percent.ts';

describe('permille()', () => {
  const table: [number, number, number | null][] = [
    [1106, 1000, 1106],
    [1, 3, 333],
    [2, 3, 667],
    [1, 8, 125],
    [1, 16, 63],
    [-1, 16, -63],
    [1, -16, -63],
    [-1, -16, 63],
    [0, 5, 0],
    [5, 0, null],
    [0, 0, null],
    [3, 2000, 2],
    [-3, 2000, -2],
    [1385000, 1000000, 1385],
  ];

  it.each(table)('%i / %i', (part, whole, expected) => {
    expect(permille(part, whole)).toBe(expected);
  });
});
