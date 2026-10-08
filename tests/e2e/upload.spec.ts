import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { trackForeignRequests } from './same-origin';

const GENERATED = join(import.meta.dirname, '../../fixtures/generated');
const VALID = join(GENERATED, 'tesouraria.xlsx');
const INVALID = join(GENERATED, 'invalid/misclassified.xlsx');
const TEMPLATE = join(
  import.meta.dirname,
  '../../public/modelo-tesouraria.xlsx',
);

const FOREIGN_CSV = [
  'Dia;Texto;Montante;Atividade;Rubrica;Tipo;Meio',
  '10/02/2024;Quotas 2024;880,00;Funcionamento;Quotas;Entrada;Banco',
].join('\n');

function fileInput(page: Page) {
  return page.locator('input[type="file"]');
}

async function csvSet(): Promise<string[]> {
  const folder = join(GENERATED, 'csv');
  return (await readdir(folder)).map((name) => join(folder, name));
}

test('the template downloads unchanged', async ({ page }) => {
  await page.goto('./');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Descarregar modelo (.xlsx)' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('modelo-tesouraria.xlsx');
  expect(await readFile(await download.path())).toEqual(
    await readFile(TEMPLATE),
  );
});

test('invalid data blocks Continuar, and a corrected file unblocks it', async ({
  page,
  context,
  baseURL,
}) => {
  const foreign = trackForeignRequests(context, baseURL);
  await page.goto('./');
  const next = page.getByRole('button', { name: 'Continuar' });
  await expect(next).toHaveCount(0);

  await fileInput(page).setInputFiles(INVALID);

  await expect(
    page.getByText('Há erros a corrigir', { exact: true }),
  ).toBeVisible();
  const table = page.getByRole('table', { name: /Problemas encontrados/ });
  const unknownRubrica = table.getByRole('row', {
    name: /Erro.*misclassified\.xlsx.*Movimentos.*não existe na lista Rubricas/,
  });
  await expect(unknownRubrica.first()).toBeVisible();
  await expect(
    table.getByRole('columnheader', { name: 'Sugestão' }),
  ).toBeVisible();
  await expect(next).toBeDisabled();

  await fileInput(page).setInputFiles(VALID);

  await expect(page.getByText('Dados válidos', { exact: true })).toBeVisible();
  await expect(
    page.getByText('0 erros, 0 avisos', { exact: true }),
  ).toBeVisible();
  await expect(next).toBeEnabled();
  await expect(table).toHaveCount(0);
  expect(foreign).toEqual([]);
});

test('the Typst engine starts loading when a file is chosen, not on page load', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { __workers: number }).__workers = 0;
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        (window as unknown as { __workers: number }).__workers += 1;
        super(url, options);
      }
    };
  });
  const workers = () =>
    page.evaluate(() => (window as unknown as { __workers: number }).__workers);

  await page.goto('./');
  await expect(
    page.getByRole('heading', { name: 'Dados da tesouraria' }),
  ).toBeVisible();
  expect(await workers()).toBe(0);

  await fileInput(page).setInputFiles(VALID);

  await expect.poll(workers).toBe(1);
});

test('a set of CSV files is validated together', async ({ page }) => {
  await page.goto('./');

  await fileInput(page).setInputFiles(await csvSet());

  await expect(page.getByText('Dados válidos', { exact: true })).toBeVisible();
  await expect(
    page.getByText('0 erros, 0 avisos', { exact: true }),
  ).toBeVisible();
});

test('a CSV with unknown columns is mapped once and remembered', async ({
  page,
}) => {
  const listas = {
    name: 'listas.csv',
    mimeType: 'text/csv',
    buffer: await readFile(join(GENERATED, 'csv/listas.csv')),
  };
  const foreign = {
    name: 'extrato.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(FOREIGN_CSV),
  };
  await page.goto('./');

  await fileInput(page).setInputFiles([foreign, listas]);

  await expect(
    page.getByRole('heading', { name: 'Associar as colunas' }),
  ).toBeVisible();
  const save = page.getByRole('button', { name: 'Guardar perfil' });
  await expect(save).toBeDisabled();
  await page.getByLabel(/^Data/).selectOption({ label: 'Dia' });
  await page.getByLabel(/^Descrição/).selectOption({ label: 'Texto' });
  await page.getByLabel(/^Valor \(€\)/).selectOption({ label: 'Montante' });
  await expect(
    page.getByRole('table', { name: /Primeiras linhas/ }).getByRole('cell', {
      name: 'Quotas 2024',
    }),
  ).toBeVisible();
  await save.click();

  await expect(page.getByText('Dados válidos', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Associar as colunas' }),
  ).toHaveCount(0);

  await page.getByRole('button', { name: 'Limpar' }).click();
  await fileInput(page).setInputFiles([foreign, listas]);

  await expect(page.getByText(/Aplicámos o perfil guardado/)).toBeVisible();
  await expect(page.getByText('Dados válidos', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Associar as colunas' }),
  ).toHaveCount(0);
});
