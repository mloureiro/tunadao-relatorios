import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { DATA_ERRORS, fileInput, ROOT, V1_WORKBOOK } from './pages';

const NOT_XLSX = /Este ficheiro não é uma folha \.xlsx/;

test('a PDF or a CSV is refused with one sentence and nothing is listed', async ({
  page,
}) => {
  await page.goto('./');

  await fileInput(page).setInputFiles({
    name: 'notas.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7'),
  });
  await expect(page.getByText(NOT_XLSX)).toBeVisible();

  await fileInput(page).setInputFiles({
    name: 'movimentos.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Data;Valor\n01/01/2026;5,00'),
  });
  await expect(page.getByText(NOT_XLSX)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Relatórios neste ficheiro' }),
  ).toHaveCount(0);
});

test('a workbook without report sheets is offered the four starter sheets', async ({
  page,
}) => {
  await page.goto('./');
  await fileInput(page).setInputFiles(V1_WORKBOOK);

  await expect(
    page.getByText('Este ficheiro ainda não tem folhas de relatório.'),
  ).toBeVisible();
  for (const name of [
    'Pegada de direção',
    'Relatório de evento',
    'Fim de ano letivo',
    'Fim de ano fiscal',
  ]) {
    await expect(page.getByRole('link', { name })).toBeVisible();
  }
});

test('data errors are listed by tab with the focus on their heading', async ({
  page,
}) => {
  await page.goto('./');
  await fileInput(page).setInputFiles(DATA_ERRORS);

  const heading = page.getByRole('heading', { name: '3 erros nos dados' });
  await expect(heading).toBeFocused();
  await expect(
    page.getByRole('heading', { level: 3, name: 'Movimentos' }),
  ).toBeVisible();
  await expect(page.getByText('linha 3, coluna Rubrica:')).toBeVisible();
});

test('the template downloads unchanged', async ({ page }) => {
  await page.goto('./');

  const pending = page.waitForEvent('download');
  await page
    .getByRole('link', { name: 'Descarregar modelo da tesouraria (.xlsx)' })
    .click();
  const download = await pending;

  expect(download.suggestedFilename()).toBe('modelo-tesouraria.xlsx');
  expect(await readFile(await download.path())).toEqual(
    await readFile(join(ROOT, 'public/modelo-tesouraria.xlsx')),
  );
});
