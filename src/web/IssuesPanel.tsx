import { useState } from 'preact/hooks';
import type { Issue } from '@/core/issues';
import {
  countIssues,
  describeCounts,
  filterIssues,
  type SeverityFilter,
} from './validation';

interface Props {
  issues: readonly Issue[];
  valid: boolean;
  blockedByMapping: boolean;
  onContinue: () => void;
}

const SEVERITY_LABEL = { error: 'Erro', warning: 'Aviso' } as const;

export function IssuesPanel({
  issues,
  valid,
  blockedByMapping,
  onContinue,
}: Props) {
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const counts = countIssues(issues);
  const visible = filterIssues(issues, filter);
  const filters: { value: SeverityFilter; label: string }[] = [
    { value: 'all', label: `Todos (${String(issues.length)})` },
    { value: 'error', label: `Erros (${String(counts.errors)})` },
    { value: 'warning', label: `Avisos (${String(counts.warnings)})` },
  ];

  return (
    <section class="validation" aria-labelledby="validacao-titulo">
      <h2 id="validacao-titulo">Validação</h2>
      <div class="summary">
        {valid && <strong class="badge-ok">Dados válidos</strong>}
        {blockedByMapping && (
          <strong class="badge-wait">Falta associar as colunas</strong>
        )}
        {!valid && !blockedByMapping && (
          <strong class="badge-error">Há erros a corrigir</strong>
        )}
        {!(blockedByMapping && issues.length === 0) && (
          <span class="summary-counts">{describeCounts(counts)}</span>
        )}
      </div>

      {issues.length > 0 && (
        <>
          <div class="filters" role="group" aria-label="Mostrar">
            {filters.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                class="chip"
                aria-pressed={filter === value}
                onClick={() => {
                  setFilter(value);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p class="empty">Não há problemas deste tipo.</p>
          ) : (
            <div class="table-wrap">
              <table class="issues">
                <caption class="visually-hidden">
                  Problemas encontrados nos dados, primeiro os erros
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Gravidade</th>
                    <th scope="col">Ficheiro</th>
                    <th scope="col">Separador</th>
                    <th scope="col">Linha</th>
                    <th scope="col">Coluna</th>
                    <th scope="col">Problema</th>
                    <th scope="col">Sugestão</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((issue, index) => (
                    <tr key={index} class={`row-${issue.severity}`}>
                      <td>
                        <span class={`severity severity-${issue.severity}`}>
                          {SEVERITY_LABEL[issue.severity]}
                        </span>
                      </td>
                      <td class="cell-file">{issue.file ?? ''}</td>
                      <td>{issue.tab ?? ''}</td>
                      <td class="cell-number">{issue.row ?? ''}</td>
                      <td>{issue.column ?? ''}</td>
                      <td class="cell-message">{issue.message}</td>
                      <td class="cell-message">{issue.suggestion ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <div class="actions">
        <button
          type="button"
          class="button"
          disabled={!valid}
          onClick={onContinue}
        >
          Continuar
        </button>
        {!valid && (
          <span class="hint">
            {blockedByMapping
              ? 'Associe as colunas do ficheiro para continuar.'
              : 'Corrija os erros e carregue de novo o ficheiro para continuar.'}
          </span>
        )}
      </div>
    </section>
  );
}
