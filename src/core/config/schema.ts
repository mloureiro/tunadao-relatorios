import { z } from 'zod';

const colour = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'cor hexadecimal #RRGGBB');
const signatureTitles = z.array(z.string().min(1)).min(1);
const level = z.enum(['rubrica', 'subRubrica']);

export const configSchema = z.strictObject({
  org: z.strictObject({
    name: z.string().min(1),
    subtitle: z.string().min(1),
  }),
  theme: z.strictObject({
    navy: colour,
    light: colour,
    accentRed: colour,
    accentGold: colour,
  }),
  signatures: z.strictObject({
    evento: signatureTitles,
    pegada: signatureTitles,
    letivo: signatureTitles,
    fiscal: signatureTitles,
  }),
  aggregation: z.strictObject({
    budgetPeriod: level,
    budgetEvent: level,
    compositionEvent: level,
    compositionPeriod: level,
    comparison: level,
    annex: level,
  }),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(json: unknown): Config {
  const parsed = configSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`config.json inválido:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
