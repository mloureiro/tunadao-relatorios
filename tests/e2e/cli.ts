import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './pages';

export type Json = Record<string, unknown>;

const AGORA = '2026-10-07T12:00';

export function withoutGenerationTime(report: Json): Json {
  const trace = { ...(report.trace as Json) };
  delete trace.generatedAt;
  delete trace.generatedAtLabel;
  return { ...report, trace };
}

export function cliReportJson(workbook: string, sheet: string): Json {
  const folder = mkdtempSync(join(tmpdir(), 'gerar-'));
  try {
    execFileSync(
      join(ROOT, 'node_modules/.bin/tsx'),
      [
        join(ROOT, 'src/cli/gerar-relatorio.ts'),
        '--entrada',
        workbook,
        '--folha',
        sheet,
        '--saida',
        join(folder, 'relatorio.pdf'),
        '--json',
        join(folder, 'relatorio.json'),
        '--agora',
        AGORA,
      ],
      { cwd: ROOT, stdio: 'pipe' },
    );
    return JSON.parse(
      readFileSync(join(folder, 'relatorio.json'), 'utf8'),
    ) as Json;
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}
