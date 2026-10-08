import type { Issue, Severity } from '@/core/issues';

export type SeverityFilter = 'all' | Severity;

export interface IssueCounts {
  readonly errors: number;
  readonly warnings: number;
}

export function countIssues(issues: readonly Issue[]): IssueCounts {
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  return { errors, warnings: issues.length - errors };
}

export function sortIssues(issues: readonly Issue[]): Issue[] {
  return [
    ...issues.filter((issue) => issue.severity === 'error'),
    ...issues.filter((issue) => issue.severity === 'warning'),
  ];
}

export function filterIssues(
  issues: readonly Issue[],
  filter: SeverityFilter,
): Issue[] {
  return sortIssues(issues).filter(
    (issue) => filter === 'all' || issue.severity === filter,
  );
}

export function describeCounts({ errors, warnings }: IssueCounts): string {
  const errorText = errors === 1 ? '1 erro' : `${String(errors)} erros`;
  const warningText = warnings === 1 ? '1 aviso' : `${String(warnings)} avisos`;
  return `${errorText}, ${warningText}`;
}
