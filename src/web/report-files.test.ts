import { describe, expect, it } from 'vitest';
import {
  eventoStem,
  fiscalStem,
  letivoStem,
  pegadaStem,
  slug,
} from './report-files';

describe('report file names', () => {
  it('keeps the event name readable without accents or symbols', () => {
    expect(eventoStem('20º CITADÃO', '2026-05-03')).toBe(
      'relatorio-evento-20o-citadao-2026-05-03',
    );
  });

  it('collapses runs of punctuation and trims the ends', () => {
    expect(slug('  Zumba na Caneca! (2ª edição) ')).toBe(
      'zumba-na-caneca-2a-edicao',
    );
  });

  it('names the other reports by their closing date or year', () => {
    expect(pegadaStem('2026-09-30')).toBe('relatorio-pegada-2026-09-30');
    expect(letivoStem('2026-08-31')).toBe('relatorio-letivo-2026-08-31');
    expect(fiscalStem(2025)).toBe('relatorio-fiscal-2025');
  });
});
