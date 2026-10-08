import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/core/config/schema.ts';
import type { LoadResult } from '../../src/core/pipeline.ts';
import { paramsSchemas } from '../../src/core/reports/index.ts';
import {
  emptyForm,
  setCount,
  setField,
  toRawParams,
  type ReportFormValues,
} from '../../src/web/report-form.ts';
import { evaluateForm } from '../../src/web/report-run.ts';
import { loadGenerated } from '../support/generated.ts';

const config = loadConfig(
  JSON.parse(await readFile('config/config.json', 'utf8')),
);
const NOW = '2026-07-15T12:30:00';

let loaded: LoadResult;

beforeAll(async () => {
  loaded = await loadGenerated('tesouraria.xlsx');
});

interface EventoFixture {
  indicadores: { label: string; value: string }[];
  [key: string]: unknown;
}

interface PegadaFixture {
  contagem: Record<string, number>;
  [key: string]: unknown;
}

const fixture = async <T>(name: string): Promise<T> =>
  JSON.parse(await readFile(`fixtures/params/${name}.json`, 'utf8')) as T;

function fill(
  form: ReportFormValues,
  values: Record<string, unknown>,
): ReportFormValues {
  return Object.entries(values).reduce(
    (current, [key, value]) =>
      typeof value === 'string' ? setField(current, key, value) : current,
    form,
  );
}

describe('form values to report params', () => {
  it('maps the event form to the same params as the fixture file', async () => {
    const params = await fixture<EventoFixture>('evento-citadao');
    const form = {
      ...fill(emptyForm('evento'), params),
      indicadores: params.indicadores.map((row, key) => ({ key, ...row })),
    };

    expect(paramsSchemas.evento.parse(toRawParams('evento', form))).toEqual(
      paramsSchemas.evento.parse(params),
    );
  });

  it('maps the handover form, with its cash grid and euro text, to the fixture params', async () => {
    const params = await fixture<PegadaFixture>('pegada-2026');
    let form = fill(emptyForm('pegada'), params);
    form = setField(form, 'saldoExtrato', '13265,05');
    form = setField(form, 'moedasPequenas', '6,00');
    for (const [euros, quantity] of Object.entries(params.contagem)) {
      form = setCount(form, Math.round(Number(euros) * 100), String(quantity));
    }

    expect(paramsSchemas.pegada.parse(toRawParams('pegada', form))).toEqual(
      paramsSchemas.pegada.parse(params),
    );
  });
});

describe('evaluateForm()', () => {
  it('reports field errors, with a required message for a blank field', () => {
    const form = setField(emptyForm('letivo'), 'fim', 'ontem');

    const result = evaluateForm('letivo', form, loaded, config, NOW);

    expect(result).toEqual({
      status: 'invalid',
      errors: {
        inicio: 'Campo obrigatório.',
        fim: 'Data inválida: "ontem". Use aaaa-mm-dd ou dd/mm/aaaa.',
      },
    });
  });

  it('blocks a period with no opening balance until the balances are declared', () => {
    const period = fill(emptyForm('letivo'), {
      inicio: '01/01/2020',
      fim: '30/06/2020',
    });

    const blocked = evaluateForm('letivo', period, loaded, config, NOW);
    expect(blocked.status).toBe('blocked');
    expect(
      blocked.status === 'blocked' &&
        blocked.issues.some(({ code }) => code === 'missing-opening-balance'),
    ).toBe(true);

    const declared = fill(period, {
      'aberturaManual/caixa': '150,00',
      'aberturaManual/banco': '1908,60',
    });
    const result = evaluateForm('letivo', declared, loaded, config, NOW);

    expect(result.status).toBe('report');
    expect(
      result.status === 'report' &&
        result.issues.some(({ code }) => code === 'manual-opening-balance'),
    ).toBe(true);
  });
});
