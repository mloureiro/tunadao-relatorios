import type { Issue } from '@/core/issues';
import { sortIssues } from './validation';

const LABEL = { error: 'Erro', warning: 'Aviso' } as const;

export function ReportIssues({ issues }: { issues: readonly Issue[] }) {
  if (issues.length === 0) return null;
  return (
    <section class="report-issues" aria-labelledby="avisos-titulo">
      <h3 id="avisos-titulo">Avisos e erros deste relatório</h3>
      <ul>
        {sortIssues(issues).map((issue, index) => (
          <li key={index} class={`row-${issue.severity}`}>
            <span class={`severity severity-${issue.severity}`}>
              {LABEL[issue.severity]}
            </span>
            <span>
              {issue.message}
              {issue.suggestion !== undefined && ` ${issue.suggestion}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
