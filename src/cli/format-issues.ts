import type { Issue } from '../core/issues.ts';

const LABEL = { error: 'ERRO', warning: 'AVISO' } as const;

export function formatIssue(issue: Issue): string {
  const place = [issue.file, issue.tab]
    .filter((part) => part !== undefined)
    .join(' › ');
  const cell = [
    issue.row === undefined ? null : `linha ${String(issue.row)}`,
    issue.column === undefined ? null : `coluna ${issue.column}`,
  ]
    .filter((part) => part !== null)
    .join(', ');
  const where = [place, cell].filter((part) => part !== '').join(' ');
  const suggestion =
    issue.suggestion === undefined ? '' : ` (sugestão: ${issue.suggestion})`;
  return `${LABEL[issue.severity]} ${where === '' ? '' : `${where}: `}${issue.message}${suggestion}`;
}

export function sortedForPrinting(issues: readonly Issue[]): Issue[] {
  return [
    ...issues.filter((issue) => issue.severity === 'error'),
    ...issues.filter((issue) => issue.severity === 'warning'),
  ];
}
