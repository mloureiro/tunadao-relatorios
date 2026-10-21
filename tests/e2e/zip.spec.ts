import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { expect, test } from '@playwright/test';
import { dropWorkbook, VALID } from './pages';
import { REPORTS } from './reports';
import { trackForeignRequests } from './same-origin';

test.describe.configure({ timeout: 300_000 });

test('"Descarregar todos (.zip)" delivers the five PDFs in one file under the page CSP', async ({
  page,
  context,
  baseURL,
}) => {
  const foreign = trackForeignRequests(context, baseURL);
  const cspViolations: string[] = [];
  page.on('console', (message) => {
    if (/Content.Security.Policy/i.test(message.text())) {
      cspViolations.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    cspViolations.push(error.message);
  });
  await page.goto('./');
  await dropWorkbook(page, VALID);

  const pending = page.waitForEvent('download', { timeout: 280_000 });
  await page.getByRole('button', { name: 'Descarregar todos (.zip)' }).click();
  const download = await pending;

  expect(download.suggestedFilename().normalize('NFC')).toBe('Relatórios.zip');
  const files = unzipSync(
    new Uint8Array(await readFile(await download.path())),
  );
  expect(
    Object.keys(files)
      .map((name) => name.normalize('NFC'))
      .toSorted(),
  ).toEqual(REPORTS.map(({ pdf }) => pdf).toSorted());
  for (const bytes of Object.values(files)) {
    expect(Buffer.from(bytes.subarray(0, 5)).toString('latin1')).toBe('%PDF-');
  }
  await expect(
    page.getByText('Zip descarregado com 5 relatórios.'),
  ).toBeVisible();
  expect(cspViolations).toEqual([]);
  expect(foreign).toEqual([]);
});
