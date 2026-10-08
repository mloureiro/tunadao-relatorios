import { describe, expect, it } from 'vitest';
import { isLisbonWallClock, parseCliArgs } from './args.ts';

const BASE = ['--tipo', 'fiscal', '--entrada', 'dados.xlsx'];

describe('parseCliArgs()', () => {
  it('collects repeatable options and defaults the output name from the type', () => {
    const parsed = parseCliArgs([
      ...BASE,
      '--entrada',
      'extra.csv',
      '--param',
      'ano=2025',
      '--param',
      'notas=a=b',
      '--params',
      'p.json',
      '--json',
      'r.json',
      '--agora',
      '2026-10-07T12:00',
    ]);

    expect(parsed).toEqual({
      kind: 'run',
      options: {
        tipo: 'fiscal',
        entradas: ['dados.xlsx', 'extra.csv'],
        paramsFile: 'p.json',
        params: new Map([
          ['ano', '2025'],
          ['notas', 'a=b'],
        ]),
        saida: 'relatorio-fiscal.pdf',
        json: 'r.json',
        agora: '2026-10-07T12:00',
      },
    });
  });

  it('answers --ajuda before checking the other arguments', () => {
    expect(parseCliArgs(['--ajuda'])).toEqual({ kind: 'help' });
  });

  it.each([
    ['a missing type', ['--entrada', 'dados.xlsx'], '--tipo'],
    ['an unknown type', ['--tipo', 'anual', '--entrada', 'x'], 'anual'],
    ['no input file', ['--tipo', 'evento'], '--entrada'],
    ['a param without "="', [...BASE, '--param', 'ano'], 'chave=valor'],
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
