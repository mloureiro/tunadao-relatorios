import { describe, expect, it } from 'vitest';
import { formatDateTime } from '@/core/format';
import { lisbonDateTime } from './lisbon-time';

describe('lisbonDateTime()', () => {
  it('is one hour ahead of UTC during summer time', () => {
    const local = lisbonDateTime(new Date('2026-07-15T11:30:00Z'));

    expect(local).toBe('2026-07-15T12:30:00');
    expect(formatDateTime(local)).toBe('15/07/2026 12:30');
  });

  it('equals UTC during winter time', () => {
    expect(lisbonDateTime(new Date('2026-01-15T11:30:00Z'))).toBe(
      '2026-01-15T11:30:00',
    );
  });

  it('rolls into the next Lisbon day when UTC is still the day before', () => {
    expect(lisbonDateTime(new Date('2026-07-15T23:30:00Z'))).toBe(
      '2026-07-16T00:30:00',
    );
  });
});
