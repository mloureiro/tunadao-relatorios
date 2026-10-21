import { describe, expect, it } from 'vitest';
import { TEMPLATE_SPEC } from '../template-spec.ts';
import { writeWorkbook, type WorkbookSpec } from './workbook-writer.ts';

const withListas = (listas: Partial<WorkbookSpec['listas']>): WorkbookSpec => ({
  ...TEMPLATE_SPEC,
  listas: { ...TEMPLATE_SPEC.listas, ...listas },
});

describe('writeWorkbook()', () => {
  it('refuses sub-rubricas of one rubrica that another rubrica interrupts', async () => {
    const spec = withListas({
      subRubricas: [
        { subRubrica: 'Bar', rubrica: 'Bar e merchandising' },
        { subRubrica: 'Bilheteira', rubrica: 'Inscrições e bilheteira' },
        { subRubrica: 'Merchandising', rubrica: 'Bar e merchandising' },
      ],
    });

    await expect(writeWorkbook(spec, 1)).rejects.toThrow(/keep them together/);
  });

  it('refuses a text longer than a spreadsheet cell takes', async () => {
    const spec: WorkbookSpec = {
      ...TEMPLATE_SPEC,
      reportSheets: [
        {
          tipo: 'fiscal',
          name: 'Fiscal',
          values: { ano: 2025, parecerCF: 'x'.repeat(32_768) },
        },
      ],
    };

    await expect(writeWorkbook(spec, 1)).rejects.toThrow(/at most 32767/);
  });

  it('refuses more paragraphs than the layout leaves rows for', async () => {
    const spec: WorkbookSpec = {
      ...TEMPLATE_SPEC,
      reportSheets: [
        {
          tipo: 'fiscal',
          name: 'Fiscal',
          values: {
            notas: Array.from({ length: 6 }, () => 'linha').join('\n'),
          },
        },
      ],
    };

    await expect(writeWorkbook(spec, 1)).rejects.toThrow(/do not fit/);
  });

  it('refuses a value the report type has no field for', async () => {
    const spec: WorkbookSpec = {
      ...TEMPLATE_SPEC,
      reportSheets: [
        { tipo: 'fiscal', name: 'Fiscal', values: { atividade: 'X' } },
      ],
    };

    await expect(writeWorkbook(spec, 1)).rejects.toThrow(
      /Unknown fiscal values: atividade/,
    );
  });
});
