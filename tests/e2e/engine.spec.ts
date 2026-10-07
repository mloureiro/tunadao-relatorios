import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { trackForeignRequests } from './same-origin';

test('the test button downloads a PDF composed in the browser without leaving the origin', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const foreign = trackForeignRequests(context, baseURL);
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });

  await page.goto('./');
  const button = page.getByRole('button', { name: 'Gerar PDF de teste' });
  await expect(button).toBeEnabled({ timeout: 90_000 });

  const downloadPromise = page.waitForEvent('download');
  await button.click();
  const download = await downloadPromise;

  const path = await download.path();
  const bytes = await readFile(path);
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(bytes.toString('latin1')).toContain('/EmbeddedFile');
  expect(foreign).toEqual([]);
  expect(problems).toEqual([]);
});
