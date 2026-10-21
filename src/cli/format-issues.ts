import { formatIssueLocation, type Issue } from '../core/issues.ts';

const LABEL = { error: 'ERRO', warning: 'AVISO' } as const;

export function formatIssue(issue: Issue): string {
  const suggestion =
    issue.suggestion === undefined ? '' : ` (sugestão: ${issue.suggestion})`;
  return `${LABEL[issue.severity]} ${formatIssueLocation(issue)}${suggestion}`;
}

export function sortedForPrinting(issues: readonly Issue[]): Issue[] {
  return [
    ...issues.filter((issue) => issue.severity === 'error'),
    ...issues.filter((issue) => issue.severity === 'warning'),
  ];
}
