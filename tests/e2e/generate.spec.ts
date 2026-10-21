import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { dropWorkbook, entry, ROOT, VALID } from './pages';
import { trackForeignRequests } from './same-origin';

type Json = Record<string, unknown>;

async function example(name: string): Promise<Json> {
  return JSON.parse(
    await readFile(join(ROOT, 'examples', `${name}.json`), 'utf8'),
  ) as Json;
}

function withoutGenerationTime(report: Json): Json {
  const trace = { ...(report.trace as Json) };
  delete trace.generatedAt;
  delete trace.generatedAtLabel;
  return { ...report, trace };
}

const REPORTS = [
  {
    sheet: 'Pegada 2026',
    pdf: '2026-09-30 Pegada de direção.pdf',
    example: 'pegada-2026',
    control: '13.844,05 €',
    dates: ['30 de setembro de 2026', '31 de agosto de 2026'],
  },
  {
    sheet: 'Letivo 2025-26',
    pdf: '2026-08-31 Fim de ano letivo.pdf',
    example: 'letivo-2025-26',
    control: '27.792,70 €',
    dates: ['1 de janeiro de 2026', '31 de agosto de 2026'],
  },
  {
    sheet: 'CITADÃO 2026',
    pdf: '2026-06-15 Relatório de evento - 20º CITADÃO.pdf',
    example: 'evento-citadao',
    control: '20.225,20 €',
    dates: ['30 de abril de 2026', '3 de maio de 2026', '15 de junho de 2026'],
  },
  {
    sheet: 'Zumba 2026',
    pdf: '2026-03-14 Relatório de evento - Zumba na Caneca.pdf',
    example: 'evento-zumba',
    control: 'Zumba na Caneca',
    dates: ['14 de março de 2026', '18 de março de 2026'],
  },
  {
    sheet: 'Fiscal 2025',
    pdf: '2025-12-31 Fim de ano fiscal 2025.pdf',
    example: 'fiscal-2025',
    control: '6.231,55 €',
    dates: ['2025 (1 de janeiro a 31 de dezembro de 2025)'],
  },
] as const;

test.describe.configure({ timeout: 240_000 });

test('dropping the workbook lists five reports and each one downloads its PDF and data', async ({
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

  for (const { sheet, pdf, example: name, control } of REPORTS) {
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
    ).toEqual(withoutGenerationTime(await example(name)));
  }

  expect(foreign).toEqual([]);
});
