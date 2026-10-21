import { useEffect, useRef } from 'preact/hooks';
import type { Issue } from '@/core/issues';
import {
  countErrors,
  dataIssueWhere,
  groupDataIssues,
  plural,
} from './view-model';

interface Props {
  readonly issues: readonly Issue[];
  readonly focusOnMount: boolean;
}

function IssueItem({ issue }: { readonly issue: Issue }) {
  const where = dataIssueWhere(issue);
  return (
    <li class="issue">
      <span class={`severity severity-${issue.severity}`}>
        {issue.severity === 'error' ? 'Erro' : 'Aviso'}
      </span>
      <span class="issue-text">
        {where !== null && <span class="where">{where}:</span>}
        {issue.message}
        {issue.suggestion !== undefined && (
          <span class="suggestion"> {issue.suggestion}</span>
        )}
      </span>
    </li>
  );
}

function Groups({ issues }: { readonly issues: readonly Issue[] }) {
  return (
    <div class="issue-groups">
      {groupDataIssues(issues).map(({ title, issues: group }) => (
        <section key={title} class="issue-group">
          <h3>{title}</h3>
          <ul class="issue-list">
            {group.map((issue, index) => (
              <IssueItem key={`${issue.code}-${String(index)}`} issue={issue} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function DataIssues({ issues, focusOnMount }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) heading.current?.focus();
  }, [focusOnMount]);

  const errors = countErrors(issues);
  if (errors === 0) {
    return (
      <details class="data-warnings">
        <summary>
          {plural(issues.length, 'aviso', 'avisos')} sobre os dados
        </summary>
        <Groups issues={issues} />
      </details>
    );
  }
  return (
    <section class="data-errors" aria-labelledby="erros-titulo">
      <h2 id="erros-titulo" tabIndex={-1} ref={heading}>
        {plural(errors, 'erro', 'erros')} nos dados
      </h2>
      <p>
        Corrija-os no ficheiro e carregue a versão corrigida. Enquanto houver
        erros, nenhum relatório pode ser gerado.
      </p>
      <Groups issues={issues} />
    </section>
  );
}
