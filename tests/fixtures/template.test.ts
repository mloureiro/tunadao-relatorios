import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { writeWorkbook } from '../../scripts/lib/workbook-writer.ts';
import { TEMPLATE_SPEC } from '../../scripts/template-spec.ts';
import { loadDataset } from '../../src/core/pipeline.ts';

const COMMITTED = fileURLToPath(
  new URL('../../public/modelo-tesouraria.xlsx', import.meta.url),
);

async function loadCommitted() {
  const bytes = new Uint8Array(await readFile(COMMITTED));
  return loadDataset([{ name: 'modelo-tesouraria.xlsx', bytes }]);
}

describe('modelo-tesouraria.xlsx', () => {
  it('loads with no errors or warnings and carries the example rows', async () => {
    const { dataset, issues, unresolved } = await loadCommitted();

    expect(issues).toEqual([]);
    expect(unresolved).toEqual([]);
    expect(dataset.movimentos).toHaveLength(TEMPLATE_SPEC.movimentos.length);
    expect(dataset.pendentes).toHaveLength(TEMPLATE_SPEC.pendentes.length);
    expect(dataset.orcamento).toHaveLength(TEMPLATE_SPEC.orcamento.length);
    expect(dataset.generos).toHaveLength(TEMPLATE_SPEC.generos.length);
    expect(dataset.saldos).toHaveLength(TEMPLATE_SPEC.saldos.length);
    expect(dataset.lists.rubricas).toHaveLength(
      TEMPLATE_SPEC.listas.rubricas.length,
    );
    expect(dataset.lists.subRubricas).toHaveLength(
      TEMPLATE_SPEC.listas.subRubricas.length,
    );
  });

  it('matches what the build script generates from the spec', async () => {
    const rebuilt = await loadDataset([
      {
        name: 'modelo-tesouraria.xlsx',
        bytes: await writeWorkbook(TEMPLATE_SPEC),
      },
    ]);
    const committed = await loadCommitted();

    expect({ ...rebuilt.dataset, sources: [] }).toEqual({
      ...committed.dataset,
      sources: [],
    });
  });

  it('restricts the dropdown columns to their lists with the stop error style', async () => {
    const zip = await JSZip.loadAsync(await readFile(COMMITTED));
    const sheetXml = (file: string) => zip.file(file)?.async('string');
    const dropdowns = async (file: string) =>
      [
        ...((await sheetXml(file)) ?? '').matchAll(
          /<dataValidation [^>]*errorStyle="stop"[^>]*sqref="([A-Z]+)2:\1(\d+)"[^>]*><formula1>([^<]*)<\/formula1>/g,
        ),
      ].map(([, column, lastRow, source]) => [column, lastRow, source]);

    expect(await dropdowns('xl/worksheets/sheet2.xml')).toEqual([
      ['D', '1048576', 'Listas!$H$2:$H$1048576'],
      ['E', '1048576', 'Listas!$A$2:$A$1048576'],
      ['F', '1048576', 'Listas!$E$2:$E$1048576'],
      ['G', '1048576', '&quot;Entrada,Saída&quot;'],
      ['H', '1048576', 'Listas!$J$2:$J$1048576'],
    ]);
    expect(await dropdowns('xl/worksheets/sheet6.xml')).toEqual([
      ['B', '1048576', '&quot;Caixa,Banco&quot;'],
      ['D', '1048576', '&quot;Extrato,Contagem,Declarado&quot;'],
    ]);
  });
});
