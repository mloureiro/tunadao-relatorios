import { describe, expect, it } from 'vitest';
import shipped from '../../../config/config.json';
import { loadConfig } from './schema.ts';

describe('loadConfig()', () => {
  it('loads the shipped config.json', () => {
    const config = loadConfig(shipped);

    expect(config.org.name).toBe('TUNADÃO 1998');
    expect(config.signatures.pegada).toHaveLength(3);
    expect(config.aggregation.annex).toBe('subRubrica');
  });

  it('rejects a missing signature list and names it', () => {
    const signatures = Object.fromEntries(
      Object.entries(shipped.signatures).filter(([key]) => key !== 'fiscal'),
    );

    expect(() => loadConfig({ ...shipped, signatures })).toThrow(
      /signatures.*fiscal/s,
    );
  });

  it('rejects an empty signature list', () => {
    const config = structuredClone(shipped);
    config.signatures.evento = [];

    expect(() => loadConfig(config)).toThrow(/evento/);
  });

  it('rejects a colour that is not #RRGGBB', () => {
    const config = structuredClone(shipped);
    config.theme.accentRed = 'red';

    expect(() => loadConfig(config)).toThrow(/accentRed/);
  });

  it('rejects an aggregation level that does not exist', () => {
    const config = {
      ...structuredClone(shipped),
      aggregation: { ...shipped.aggregation, annex: 'atividade' },
    };

    expect(() => loadConfig(config)).toThrow(/annex/);
  });

  it('rejects unknown keys so typos do not pass silently', () => {
    expect(() => loadConfig({ ...shipped, extra: 1 })).toThrow(/extra/);
  });

  it('rejects a non-object', () => {
    expect(() => loadConfig(null)).toThrow(/config\.json inválido/);
  });
});
