import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { trackForeignRequests } from './same-origin';

const ROOT = join(import.meta.dirname, '../..');
const VALID = join(ROOT, 'fixtures/generated/tesouraria.xlsx');

type Json = Record<string, unknown>;

async function readJson(path: string): Promise<Json> {
  return JSON.parse(await readFile(join(ROOT, path), 'utf8')) as Json;
}

async function openReports(page: Page, name: string): Promise<void> {
  await page.goto('./');
  await page.locator('input[type="file"]').setInputFiles(VALID);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByText(name, { exact: true }).click();
}

const form = (page: Page) => page.locator('form.report-form');

async function generate(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'Gerar PDF' });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(
    page.getByRole('heading', { name: 'Relatório gerado' }),
  ).toBeVisible({ timeout: 90_000 });
  await expect(
    page.getByRole('heading', { name: 'Relatório gerado' }),
  ).toBeFocused();
  const preview = page.getByTitle('Pré-visualização do relatório em PDF');
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute('src', /^blob:/);
}

async function downloadPdfText(page: Page, filename: string): Promise<string> {
  const pending = page.waitForEvent('download', {
    predicate: (download) => download.suggestedFilename() === filename,
  });
  await page.getByRole('button', { name: 'Descarregar PDF' }).click();
  const path = await (await pending).path();
  const bytes = await readFile(path);
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  return execFileSync('pdftotext', [path, '-'], { encoding: 'utf8' })
    .replaceAll(' ', ' ')
    .replaceAll(' ', ' ');
}

async function downloadJson(page: Page, filename: string): Promise<Json> {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descarregar dados (.json)' }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe(filename);
  return JSON.parse(await readFile(await download.path(), 'utf8')) as Json;
}

function withoutGenerationTime(report: Json): Json {
  const trace = { ...(report.trace as Json) };
  delete trace.generatedAt;
  delete trace.generatedAtLabel;
  return { ...report, trace };
}

function expectLisbonWallClock(report: Json): void {
  const trace = report.trace as Json;
  expect(trace.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  expect(trace.generatedAtLabel).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
}

async function fillIndicators(
  page: Page,
  rows: { label: string; value: string }[],
): Promise<void> {
  for (const [index, { label, value }] of rows.entries()) {
    await page.getByRole('button', { name: 'Adicionar indicador' }).click();
    const row = page.getByRole('group', {
      name: `Indicador ${String(index + 1)}`,
    });
    await row.getByLabel('Designação').fill(label);
    await row.getByLabel('Valor').fill(value);
  }
}

test.describe.configure({ timeout: 150_000 });

test('the event report is generated from the form, matches the CLI example and carries the control figures', async ({
  page,
  context,
  baseURL,
}) => {
  const foreign = trackForeignRequests(context, baseURL);
  const params = await readJson('fixtures/params/evento-citadao.json');
  await openReports(page, 'Relatório de evento');

  await form(page)
    .getByLabel('Atividade', { exact: true })
    .selectOption(params.atividade as string);
  await expect(form(page).getByLabel('Âmbito do orçamento')).toHaveValue(
    params.atividade as string,
  );
  await form(page).getByLabel('Início do evento').fill('30/04/2026');
  await form(page).getByLabel('Fim do evento').fill('03/05/2026');
  await form(page).getByLabel('Contar movimentos até').fill('15/06/2026');
  await form(page)
    .getByLabel('Data de referência dos pendentes')
    .fill('2026-06-15');
  await fillIndicators(
    page,
    params.indicadores as { label: string; value: string }[],
  );
  await form(page)
    .getByLabel('Notas / Comentários')
    .fill(params.notas as string);
  await generate(page);

  const text = await downloadPdfText(
    page,
    'relatorio-evento-20o-citadao-2026-05-03.pdf',
  );
  expect(text).toContain('20.225,20 €');
  expect(text).toContain('Bilhetes vendidos');

  const report = await downloadJson(
    page,
    'relatorio-evento-20o-citadao-2026-05-03.json',
  );
  expectLisbonWallClock(report);
  expect(withoutGenerationTime(report)).toEqual(
    withoutGenerationTime(await readJson('examples/evento-citadao.json')),
  );
  expect(foreign).toEqual([]);
});

test('the handover report is generated from the form, matches the CLI example and carries the control figures', async ({
  page,
  context,
  baseURL,
}) => {
  const foreign = trackForeignRequests(context, baseURL);
  const params = await readJson('fixtures/params/pegada-2026.json');
  const counts = params.contagem as Record<string, number>;
  await openReports(page, 'Pegada de direção');

  await form(page).getByLabel('Data do último relatório').fill('31/08/2026');
  await form(page).getByLabel('Data da passagem').fill('30/09/2026');
  await expect(
    form(page).getByLabel('Saldo do extrato bancário (€)'),
  ).toHaveValue('13265,05');
  await form(page)
    .getByLabel('Direção cessante')
    .fill(params.direcaoCessante as string);
  await form(page)
    .getByLabel('Direção entrante')
    .fill(params.direcaoEntrante as string);
  for (const [euros, quantity] of Object.entries(counts)) {
    await page.locator(`#form-pegada-contagem-${euros}`).fill(String(quantity));
  }
  await form(page).getByLabel('Moedas pequenas (valor total)').fill('6,00');
  await expect(page.getByTestId('total-contado')).toHaveText(/579,00/);
  await form(page)
    .getByLabel('Notas / Comentários')
    .fill(params.notas as string);
  await generate(page);

  const text = await downloadPdfText(page, 'relatorio-pegada-2026-09-30.pdf');
  expect(text).toContain('13.844,05 €');

  const report = await downloadJson(page, 'relatorio-pegada-2026-09-30.json');
  expectLisbonWallClock(report);
  expect(withoutGenerationTime(report)).toEqual(
    withoutGenerationTime(await readJson('examples/pegada-2026.json')),
  );
  expect(foreign).toEqual([]);
});

test('the school-year report is generated from the form', async ({ page }) => {
  const params = await readJson('fixtures/params/letivo-2025-26.json');
  await openReports(page, 'Fim de ano letivo');

  await form(page).getByLabel('Início do período').fill('01/01/2026');
  await form(page).getByLabel('Fim do período').fill('31/08/2026');
  await form(page)
    .getByLabel('Notas / Comentários')
    .fill(params.notas as string);
  await generate(page);

  const text = await downloadPdfText(page, 'relatorio-letivo-2026-08-31.pdf');
  expect(text).toContain('27.792,70 €');
});

test('the fiscal-year report is generated from the form with the council opinion', async ({
  page,
}) => {
  const params = await readJson('fixtures/params/fiscal-2025.json');
  await openReports(page, 'Fim de ano fiscal');

  await form(page).getByLabel('Ano fiscal').fill('2025');
  await expect(form(page).getByLabel('Âmbito do orçamento')).toHaveValue(
    '2025',
  );
  await form(page)
    .getByLabel('Parecer do Conselho Fiscal')
    .fill(params.parecerCF as string);
  await generate(page);

  const text = await downloadPdfText(page, 'relatorio-fiscal-2025.pdf');
  expect(text).toContain('6.231,55 €');
  expect(text.replaceAll('\n', ' ')).toContain('emite parecer favorável');

  await page.getByRole('button', { name: 'Alterar parâmetros' }).click();
  await expect(page.getByRole('button', { name: 'Gerar PDF' })).toBeFocused();
});

test('a period without an opening balance cannot be generated until the balances are declared', async ({
  page,
}) => {
  await openReports(page, 'Fim de ano letivo');
  await form(page).getByLabel('Início do período').fill('01/01/2020');
  await form(page).getByLabel('Fim do período').fill('30/06/2020');
  const submit = page.getByRole('button', { name: 'Gerar PDF' });

  await expect(page.getByText(/Não há saldo de Caixa anterior/)).toBeVisible();
  await expect(submit).toBeDisabled();
  await expect(
    page.getByRole('heading', { name: 'Saldo inicial declarado' }),
  ).toBeVisible();

  await form(page).getByLabel('Saldo inicial em caixa (€)').fill('150,00');
  await form(page).getByLabel('Saldo inicial em banco (€)').fill('1908,60');

  await expect(
    page.getByText(/saldo inicial de Caixa indicado manualmente/),
  ).toBeVisible();
  await expect(submit).toBeEnabled();
  await generate(page);
  const text = await downloadPdfText(page, 'relatorio-letivo-2020-06-30.pdf');
  expect(text).toContain('declarado manualmente');
});

test('a field with a wrong value shows its error and keeps the PDF button off', async ({
  page,
}) => {
  await openReports(page, 'Fim de ano fiscal');
  const ano = form(page).getByLabel('Ano fiscal');

  await ano.fill('19');
  await ano.blur();

  await expect(ano).toHaveAccessibleDescription(/1900 ou posterior/);
  await expect(page.getByRole('button', { name: 'Gerar PDF' })).toBeDisabled();

  await ano.fill('2025');

  await expect(page.getByRole('button', { name: 'Gerar PDF' })).toBeEnabled();
});
