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
  await valid.getByRole('button', { name: 'Descarregar PDF' }).click();
  await expect(valid.getByText(/^PDF gerado:/)).toBeVisible({
    timeout: 90_000,
  });

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
