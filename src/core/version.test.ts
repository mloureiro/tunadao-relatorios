import { describe, expect, it } from 'vitest';
import { GENERATOR_VERSION } from './version';

describe('GENERATOR_VERSION', () => {
  it('is a semver string', () => {
    expect(GENERATOR_VERSION).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
  });
});
