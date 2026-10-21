import { describe, expect, it } from 'vitest';
import { isLisbonWallClock, parseCliArgs } from './args.ts';

const BASE = ['--entrada', 'dados.xlsx', '--folha', 'Pegada 2026'];

describe('parseCliArgs()', () => {
  it('reads a sheet run with every option', () => {
    const parsed = parseCliArgs([
      ...BASE,
      '--saida',
      'r.pdf',
      '--json',
      'r.json',
      '--agora',
      '2026-10-07T12:00',
    ]);

    expect(parsed).toEqual({
      kind: 'run',
      options: {
        entrada: 'dados.xlsx',
        folha: 'Pegada 2026',
        listar: false,
        saida: 'r.pdf',
        json: 'r.json',
        agora: '2026-10-07T12:00',
      },
    });
  });

  it('reads a listing run with no sheet', () => {
    expect(parseCliArgs(['--entrada', 'Dados.XLSX', '--listar'])).toEqual({
      kind: 'run',
      options: {
        entrada: 'Dados.XLSX',
        folha: null,
        listar: true,
        saida: null,
        json: null,
        agora: null,
      },
    });
  });

  it('answers --ajuda before checking the other arguments', () => {
    expect(parseCliArgs(['--ajuda'])).toEqual({ kind: 'help' });
  });

  it.each([
    ['no input file', ['--listar'], '--entrada'],
    ['two input files', [...BASE, '--entrada', 'outro.xlsx'], 'único ficheiro'],
    ['a csv input', ['--entrada', 'movimentos.csv', '--listar'], '.xlsx'],
    ['neither --folha nor --listar', ['--entrada', 'd.xlsx'], '--listar'],
    ['--folha with --listar', [...BASE, '--listar'], 'em conjunto'],
    [
      'the removed --tipo',
      [...BASE, '--tipo', 'fiscal'],
      '--tipo já não existe',
    ],
    [
      'the removed --params',
      [...BASE, '--params', 'p.json'],
      '--params já não existe',
    ],
    [
      'the removed --param',
      [...BASE, '--param', 'ano=2025'],
      '--param já não existe',
    ],
    ['an unknown option', [...BASE, '--rapido'], 'rapido'],
    ['an impossible date', [...BASE, '--agora', '2026-02-30T10:00'], '--agora'],
    [
      'seconds in --agora',
      [...BASE, '--agora', '2026-02-10T10:00:00'],
      '--agora',
    ],
  ])('rejects %s as a usage error', (_name, argv, mention) => {
    const parsed = parseCliArgs(argv);

    expect(parsed.kind).toBe('usage-error');
    expect(parsed.kind === 'usage-error' && parsed.message).toContain(mention);
  });
});

describe('isLisbonWallClock()', () => {
  it.each(['2026-10-07T12:00', '2024-02-29T00:00', '2026-12-31T23:59'])(
    'accepts %s',
    (value) => {
      expect(isLisbonWallClock(value)).toBe(true);
    },
  );

  it.each([
    '2026-10-07T24:00',
    '2026-10-07T12:60',
    '2026-13-01T10:00',
    '2026-10-07 12:00',
  ])('rejects %s', (value) => {
    expect(isLisbonWallClock(value)).toBe(false);
  });
});
