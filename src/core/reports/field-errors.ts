import type { z } from 'zod';

export type FieldErrors = Readonly<Record<string, string>>;

export const REQUIRED_MESSAGE = 'Campo obrigatório.';

export function valueAt(
  source: unknown,
  path: readonly PropertyKey[],
): unknown {
  let current = source;
  for (const step of path) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<PropertyKey, unknown>)[step];
  }
  return current;
}

export function isBlank(value: unknown): boolean {
  return value === undefined || value === '';
}

export function fieldErrors(
  issues: readonly z.core.$ZodIssue[],
  raw: unknown,
): FieldErrors {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('/');
    errors[key] ??= isBlank(valueAt(raw, issue.path))
      ? REQUIRED_MESSAGE
      : issue.message;
  }
  return errors;
}
