import type ExcelJS from 'exceljs';

export interface Prompt {
  readonly title: string;
  readonly text: string;
}

export interface ValidationRule {
  readonly range: string;
  readonly source: string;
  readonly prompt: Prompt;
  readonly error: string;
  readonly stop?: boolean;
}

interface ValidatedSheet {
  readonly dataValidations: {
    add(range: string, validation: ExcelJS.DataValidation): void;
  };
}

function promptFields(prompt: Prompt) {
  return {
    showInputMessage: true,
    promptTitle: prompt.title,
    prompt: prompt.text,
  };
}

export function addListValidation(
  sheet: ExcelJS.Worksheet,
  rule: ValidationRule,
): void {
  // exceljs implements dataValidations at runtime but omits it from its typings
  (sheet as unknown as ValidatedSheet).dataValidations.add(rule.range, {
    type: 'list',
    allowBlank: true,
    formulae: [rule.source],
    showErrorMessage: true,
    errorStyle: rule.stop === false ? 'warning' : 'stop',
    errorTitle: 'Valor fora da lista',
    error: rule.error,
    ...promptFields(rule.prompt),
  });
}

export function addPromptOnly(
  sheet: ExcelJS.Worksheet,
  range: string,
  prompt: Prompt,
): void {
  // exceljs has no 'any' validation type, so an always-true custom rule carries the prompt
  (sheet as unknown as ValidatedSheet).dataValidations.add(range, {
    type: 'custom',
    allowBlank: true,
    formulae: ['TRUE'],
    ...promptFields(prompt),
  });
}

export function literalList(...values: string[]): string {
  return `"${values.join(',')}"`;
}
