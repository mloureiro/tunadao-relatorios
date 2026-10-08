import { readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { buildFixtureFiles } from '../../scripts/lib/fixture-files.ts';
import type { Dataset } from '../../src/core/dataset/types.ts';
import {
  GENERATED,
  loadGenerated,
  loadGeneratedCsvSet,
  readGenerated,
} from '../support/generated.ts';
import { zipEntries } from '../support/zip-entries.ts';

function withoutFileNames(dataset: Dataset) {
  return JSON.parse(
    JSON.stringify({ ...dataset, sources: [] }, (key, value: unknown) =>
      key === 'file' ? undefined : value,
    ),
  ) as unknown;
}

describe('generated fixtures', () => {
  it('load without errors or warnings from the workbook and from the CSV set', async () => {
    const workbook = await loadGenerated('tesouraria.xlsx');
    const csv = await loadGeneratedCsvSet();

    expect(workbook.issues).toEqual([]);
    expect(workbook.unresolved).toEqual([]);
    expect(csv.issues).toEqual([]);
    expect(csv.unresolved).toEqual([]);
    expect(workbook.dataset.movimentos.length).toBeGreaterThan(100);
  });

  it('give the same dataset whether read from the workbook or from the CSV set', async () => {
    const workbook = await loadGenerated('tesouraria.xlsx');
    const csv = await loadGeneratedCsvSet();

    expect(withoutFileNames(csv.dataset)).toEqual(
      withoutFileNames(workbook.dataset),
    );
  });

  it('are the files the build script generates from the sources', async () => {
    for (const [path, expected] of await buildFixtureFiles()) {
      const committed = (await readGenerated(path)).bytes;
      if (path.endsWith('.xlsx')) {
        expect(await zipEntries(committed), path).toEqual(
          await zipEntries(expected),
        );
      } else {
        expect(committed, path).toEqual(expected);
      }
    }
  });

  it('keeps the generated folder free of files the build does not produce', async () => {
    const listed = (await readdir(GENERATED, { recursive: true }))
      .filter((path) => /\.(xlsx|csv)$/.test(path))
      .toSorted();

    expect(listed).toEqual([...(await buildFixtureFiles()).keys()].toSorted());
  });
});
