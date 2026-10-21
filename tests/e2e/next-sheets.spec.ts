import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import { expect, test } from '@playwright/test';
import { dropWorkbook, VALID } from './pages';

async function valueOf(path: string, label: string): Promise<unknown> {
  const book = XLSX.read(await readFile(path), { type: 'buffer' });
  const sheet = book.Sheets[book.SheetNames[0] ?? ''];
  if (sheet === undefined) throw new Error('No sheet');
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  return rows.find((row) => row[0] === label)?.[1];
}

test('the next pegada and the next letivo download pre-filled from the latest reports', async ({
  page,
}) => {
  await page.goto('./');
  await dropWorkbook(page, VALID);

  const section = page.getByRole('region', { name: 'Próximas folhas' });
  await expect(section).toContainText('30 de setembro de 2026');

  const pegada = page.waitForEvent('download');
  await section
    .getByRole('link', { name: 'Próxima pegada de direção' })
    .click();
  const pegadaFile = await pegada;
  expect(pegadaFile.suggestedFilename()).toBe('folha-proxima-pegada.xlsx');
  const pegadaPath = await pegadaFile.path();
  expect(await valueOf(pegadaPath, 'Data do último relatório')).toBe(46295);
  expect(await valueOf(pegadaPath, 'Direção cessante')).toBe('Direção 2026/27');

  const letivo = page.waitForEvent('download');
  await section
    .getByRole('link', { name: 'Próximo fim de ano letivo' })
    .click();
  const letivoFile = await letivo;
  expect(letivoFile.suggestedFilename()).toBe('folha-proximo-letivo.xlsx');
  expect(await valueOf(await letivoFile.path(), 'Início do período')).toBe(
    46296,
  );
});
