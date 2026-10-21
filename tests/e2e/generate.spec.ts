import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { cliReportJson, withoutGenerationTime, type Json } from './cli';
import { dropWorkbook, entry, VALID } from './pages';
import { REPORTS } from './reports';
import { trackForeignRequests } from './same-origin';

test.describe.configure({ timeout: 300_000 });

test('dropping the workbook lists five reports and each one downloads its PDF and data, equal to the command line output', async ({
  page,
  context,
  baseURL,
}) => {
  const foreign = trackForeignRequests(context, baseURL);
  await page.goto('./');
  await dropWorkbook(page, VALID);

  await expect(
    page.locator('input:not([type="file"]), select, textarea'),
  ).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(5);
  for (const { sheet, dates } of REPORTS) {
    const card = entry(page, sheet);
    await expect(card.getByText(/^Pronto/)).toBeVisible();
    for (const date of dates) await expect(card).toContainText(date);
  }
  await expect(entry(page, 'Letivo 2025-26')).toContainText(
    'origem: dia seguinte ao relatório da folha "Fiscal 2025"',
  );

  for (const { sheet, pdf, control } of REPORTS) {
    const card = entry(page, sheet);

    const pdfDownload = page.waitForEvent('download');
    await card.getByRole('button', { name: 'Descarregar PDF' }).click();
    const download = await pdfDownload;
    expect(download.suggestedFilename().normalize('NFC')).toBe(pdf);
    const path = await download.path();
    expect((await readFile(path)).subarray(0, 5).toString('latin1')).toBe(
      '%PDF-',
    );
    const text = execFileSync('pdftotext', [path, '-'], { encoding: 'utf8' })
      .replaceAll(' ', ' ')
      .replaceAll(' ', ' ');
    expect(text).toContain(control);

    const jsonDownload = page.waitForEvent('download');
    await card.getByRole('link', { name: 'dados (.json)' }).click();
    const json = await jsonDownload;
    expect(json.suggestedFilename().normalize('NFC')).toBe(
      pdf.replace(/\.pdf$/, '.json'),
    );
    expect(
      withoutGenerationTime(
        JSON.parse(await readFile(await json.path(), 'utf8')) as Json,
      ),
    ).toEqual(withoutGenerationTime(cliReportJson(VALID, sheet)));
  }

  expect(foreign).toEqual([]);
});
