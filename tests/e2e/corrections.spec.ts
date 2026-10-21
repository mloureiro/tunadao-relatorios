import { expect, test } from '@playwright/test';
import { dropWorkbook, entry, fileInput, SHEET_ERRORS, VALID } from './pages';

test.describe.configure({ timeout: 150_000 });

test('a sheet with errors cannot be generated until the corrected file replaces it', async ({
  page,
}) => {
  await page.goto('./');
  await dropWorkbook(page, SHEET_ERRORS);

  const broken = entry(page, 'Denominação errada');
  await expect(broken.getByText('Com erros')).toBeVisible();
  await expect(broken).toContainText('Folha "Denominação errada", célula A31');
  await expect(
    broken.getByRole('button', { name: 'Descarregar PDF' }),
  ).toBeDisabled();

  const valid = entry(page, 'Válida');
  const download = valid.getByRole('button', { name: 'Descarregar PDF' });
  await download.focus();
  await page.keyboard.press('Enter');
  await expect(valid.getByText(/^PDF gerado:/)).toBeVisible({
    timeout: 90_000,
  });
  await expect(download).toBeFocused();

  await fileInput(page).setInputFiles(VALID);

  await expect(entry(page, 'Denominação errada')).toHaveCount(0);
  await expect(page.getByText(/^PDF gerado:/)).toHaveCount(0);
  const corrected = entry(page, 'Pegada 2026');
  await expect(corrected.getByText('Pronto')).toBeVisible();
  const pending = page.waitForEvent('download');
  await corrected.getByRole('button', { name: 'Descarregar PDF' }).click();
  expect((await pending).suggestedFilename().normalize('NFC')).toBe(
    '2026-09-30 Pegada de direção.pdf',
  );
});

test('dropping a corrected file while the zip is being generated downloads nothing from the old file', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'One browser is enough for this timing.',
  );
  const downloads: string[] = [];
  page.on('download', (download) =>
    downloads.push(download.suggestedFilename()),
  );
  await context.route('**/*.wasm', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.continue();
  });
  await page.goto('./');
  await dropWorkbook(page, VALID);

  await page.getByRole('button', { name: 'Descarregar todos (.zip)' }).click();
  await expect(
    page.getByRole('button', { name: /^A gerar 1 de 5/ }),
  ).toBeVisible();
  await fileInput(page).setInputFiles(SHEET_ERRORS);
  await expect(entry(page, 'Denominação errada')).toBeVisible();

  await page.waitForTimeout(6000);
  expect(downloads).toEqual([]);
  await expect(page.getByText(/^Zip descarregado/)).toHaveCount(0);
});
