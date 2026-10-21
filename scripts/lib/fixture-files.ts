import {
  CHECKPOINT_MISMATCH,
  MISCLASSIFIED,
  MISSING_FIELDS,
  REPORT_SHEETS,
  VALUE_MISMATCH,
} from '../../fixtures/src/invalid/index.ts';
import { TESOURARIA } from '../../fixtures/src/tesouraria.ts';
import { writeWorkbook } from './workbook-writer.ts';

export async function buildFixtureFiles(): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  files.set(
    'tesouraria.xlsx',
    await writeWorkbook(TESOURARIA, TESOURARIA.movimentos.length + 1),
  );
  const invalid = {
    'value-mismatch': VALUE_MISMATCH,
    misclassified: MISCLASSIFIED,
    'missing-fields': MISSING_FIELDS,
    'checkpoint-mismatch': CHECKPOINT_MISMATCH,
    'report-sheets': REPORT_SHEETS,
  };
  for (const [name, spec] of Object.entries(invalid)) {
    files.set(
      `invalid/${name}.xlsx`,
      await writeWorkbook(spec, spec.movimentos.length + 1),
    );
  }
  return files;
}
