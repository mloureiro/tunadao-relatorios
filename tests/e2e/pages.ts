import { join } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';

export const ROOT = join(import.meta.dirname, '../..');
export const VALID = join(ROOT, 'fixtures/generated/tesouraria.xlsx');
export const SHEET_ERRORS = join(
  ROOT,
  'fixtures/generated/invalid/report-sheets.xlsx',
);
export const DATA_ERRORS = join(
  ROOT,
  'fixtures/generated/invalid/misclassified.xlsx',
);
export const V1_WORKBOOK = join(ROOT, 'fixtures/v1/tesouraria.xlsx');

export const fileInput = (page: Page): Locator =>
  page.locator('input[type="file"]');

export const entry = (page: Page, sheet: string): Locator =>
  page.getByRole('listitem').filter({ hasText: `folha ${sheet}` });

export async function dropWorkbook(page: Page, path: string): Promise<void> {
  await fileInput(page).setInputFiles(path);
  await expect(
    page.getByRole('heading', { name: 'Relatórios neste ficheiro' }),
  ).toBeVisible();
}
