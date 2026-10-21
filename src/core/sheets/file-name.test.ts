import { describe, expect, it } from 'vitest';
import { reportFileName } from './file-name.ts';

describe('reportFileName()', () => {
  it.each([
    ['Pegada de direção', '2026-09-30', '2026-09-30 Pegada de direção'],
    [
      'Relatório de evento — 20º CITADÃO',
      '2026-06-15',
      '2026-06-15 Relatório de evento - 20º CITADÃO',
    ],
    ['Fim de ano letivo', '2026-08-31', '2026-08-31 Fim de ano letivo'],
    [
      'Fim de ano fiscal 2025',
      '2025-12-31',
      '2025-12-31 Fim de ano fiscal 2025',
    ],
  ])('names %j ending %s', (title, endDate, expected) => {
    expect(reportFileName({ title, endDate })).toBe(expected);
  });

  it('replaces the characters a file system forbids and tidies the ends', () => {
    expect(
      reportFileName({
        title: 'Relatório de evento — Gala: "A/B" <final>?*|\\ ...',
        endDate: '2026-06-15',
      }),
    ).toBe('2026-06-15 Relatório de evento - Gala- -A-B- -final-----');
  });

  it('leaves out the date when the report has none and never returns an empty name', () => {
    expect(reportFileName({ title: 'Folha 1' })).toBe('Folha 1');
    expect(reportFileName({ title: ' . ' })).toBe('relatorio');
  });
});
