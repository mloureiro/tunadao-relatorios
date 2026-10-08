import { describe, expect, it } from 'vitest';
import { loadDataset, type InputFile } from '@/core/pipeline';
import { prepareInputs, selectionProblem } from './load-files';
import { mappedFile, missingRequiredFields, suggestMapping } from './mapping';
import { unrecognisedCsv } from './mapping';
import { saveProfile, type ProfileStorage } from './profiles';

const encode = (name: string, text: string): InputFile => ({
  name,
  bytes: new TextEncoder().encode(text),
});

const foreign = encode(
  'banco.csv',
  [
    '',
    'Dia;Texto;Valor (€);Atividade;Rubrica;Tipo;Meio',
    '10/02/2024;Quotas;880,00;Funcionamento;Quotas;Entrada;Banco',
  ].join('\n'),
);

function memoryStorage(): ProfileStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('selectionProblem()', () => {
  it('accepts one file or several csv files, and rejects an xlsx mixed with others', () => {
    expect(selectionProblem(['a.xlsx'])).toBeNull();
    expect(selectionProblem(['a.csv', 'B.CSV'])).toBeNull();
    expect(selectionProblem(['a.xlsx', 'b.csv'])).not.toBeNull();
    expect(selectionProblem(['a.xlsx', 'b.xlsx'])).not.toBeNull();
  });
});

describe('prepareInputs()', () => {
  const table = unrecognisedCsv(foreign);

  it('holds back a csv with unknown headers until it is mapped', () => {
    const { ready, pending, autoMapped } = prepareInputs(
      [foreign],
      {},
      memoryStorage(),
    );

    expect(ready).toEqual([]);
    expect(pending.map((entry) => entry.name)).toEqual(['banco.csv']);
    expect(autoMapped).toEqual([]);
  });

  it('applies a saved profile without asking', () => {
    const storage = memoryStorage();
    saveProfile(storage, table?.header ?? [], { data: 0, descricao: 1 });

    const { ready, pending, autoMapped } = prepareInputs(
      [foreign],
      {},
      storage,
    );

    expect(pending).toEqual([]);
    expect(autoMapped.map((entry) => entry.name)).toEqual(['banco.csv']);
    expect(ready.map((file) => file.name)).toEqual(['banco.csv']);
  });

  it('passes recognised files straight through', () => {
    const movimentos = encode(
      'movimentos.csv',
      'Data;Descrição;Atividade;Rubrica;Tipo;Meio;Valor (€)\n',
    );

    expect(prepareInputs([movimentos], {}, null).ready).toEqual([movimentos]);
  });
});

describe('mapped csv', () => {
  const table = unrecognisedCsv(foreign);
  const mapping = {
    data: 0,
    descricao: 1,
    valor: 2,
    atividade: 3,
    rubrica: 4,
    tipo: 5,
    meio: 6,
  };

  it('suggests only the columns whose header already matches and flags every unmapped required field', () => {
    expect(suggestMapping(table?.header ?? [])).toEqual({
      valor: 2,
      atividade: 3,
      rubrica: 4,
      tipo: 5,
      meio: 6,
    });
    expect(missingRequiredFields({ data: 0 })).toContain('Valor (€)');
    expect(missingRequiredFields(mapping)).toEqual([]);
  });

  it('is read back as Movimentos and reports problems on the original rows', async () => {
    if (table === null) throw new Error('fixture must be unrecognised');
    const file = mappedFile('banco.csv', table, mapping);

    const { unresolved, issues } = await loadDataset([file]);

    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]?.src).toMatchObject({
      file: 'banco.csv',
      tab: 'Movimentos',
      row: 3,
    });
    expect(issues.some((issue) => issue.code === 'unrecognised-file')).toBe(
      false,
    );
  });
});
