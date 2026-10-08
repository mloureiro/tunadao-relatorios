import { describe, expect, it } from 'vitest';
import {
  PROFILES_KEY,
  clearProfile,
  findProfile,
  headerSignature,
  saveProfile,
  type ProfileStorage,
} from './profiles';

function fakeStorage(initial: Record<string, string> = {}): ProfileStorage & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const header = ['Dia', 'Texto', 'Montante (€)'];

describe('mapping profiles', () => {
  it('finds a saved profile by header signature, ignoring case, accents and units', () => {
    const storage = fakeStorage();
    saveProfile(storage, header, { data: 0, descricao: 1, valor: 2 });

    expect(findProfile(storage, ['dia', 'TEXTO', 'Montante'])).toEqual({
      data: 0,
      descricao: 1,
      valor: 2,
    });
  });

  it('does not match a different header list', () => {
    const storage = fakeStorage();
    saveProfile(storage, header, { data: 0 });

    expect(findProfile(storage, ['Dia', 'Texto'])).toBeNull();
  });

  it('keeps other profiles when one is cleared', () => {
    const storage = fakeStorage();
    saveProfile(storage, header, { data: 0 });
    saveProfile(storage, ['A', 'B'], { data: 1 });

    clearProfile(storage, header);

    expect(findProfile(storage, header)).toBeNull();
    expect(findProfile(storage, ['A', 'B'])).toEqual({ data: 1 });
  });

  it('ignores corrupt or malformed stored data', () => {
    expect(
      findProfile(fakeStorage({ [PROFILES_KEY]: '{not json' }), header),
    ).toBeNull();
    expect(
      findProfile(
        fakeStorage({
          [PROFILES_KEY]: JSON.stringify({
            [headerSignature(header)]: { data: 'x' },
          }),
        }),
        header,
      ),
    ).toBeNull();
  });

  it('degrades to no profiles when storage is unavailable or refuses writes', () => {
    expect(findProfile(null, header)).toBeNull();
    expect(saveProfile(null, header, { data: 0 })).toBe(false);
    const full: ProfileStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(saveProfile(full, header, { data: 0 })).toBe(false);
  });
});
