import { useState } from 'preact/hooks';
import type { ColumnMapping } from '@/core/input/csv';
import {
  MAPPING_FIELDS,
  mappedPreview,
  missingRequiredFields,
  suggestMapping,
  type MappingField,
} from './mapping';
import type { PendingMapping } from './load-files';

interface Props {
  pending: PendingMapping;
  onApply: (mapping: ColumnMapping, save: boolean) => void;
}

export function MappingPanel({ pending, onApply }: Props) {
  const { table, name } = pending;
  const [mapping, setMapping] = useState<ColumnMapping>(() =>
    suggestMapping(table.header),
  );
  const missing = missingRequiredFields(mapping);
  const preview = mappedPreview(table, mapping);

  function choose(field: MappingField, value: string) {
    const rest = Object.fromEntries(
      Object.entries(mapping).filter(([key]) => key !== field),
    );
    setMapping(value === '' ? rest : { ...rest, [field]: Number(value) });
  }

  return (
    <section class="mapping" aria-labelledby="mapeamento-titulo">
      <h2 id="mapeamento-titulo">Associar as colunas</h2>
      <p>
        O ficheiro <strong>{name}</strong> não tem as colunas do modelo.
        Indique, para cada campo dos Movimentos, qual é a coluna correspondente
        do seu ficheiro.
      </p>

      <div class="mapping-grid">
        {MAPPING_FIELDS.map(({ key, label, required }) => (
          <div class="mapping-row" key={key}>
            <label for={`campo-${key}`}>
              {label}
              {required && <span class="required"> (obrigatório)</span>}
            </label>
            <select
              id={`campo-${key}`}
              value={mapping[key] === undefined ? '' : String(mapping[key])}
              onChange={(event) => {
                choose(key, event.currentTarget.value);
              }}
            >
              <option value="">Não usar</option>
              {table.header.map((column, index) => (
                <option key={index} value={String(index)}>
                  {column === '' ? `Coluna ${String(index + 1)}` : column}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <h3>Pré-visualização das primeiras linhas</h3>
      {preview.header.length === 0 ? (
        <p class="empty">Escolha pelo menos uma coluna para ver o resultado.</p>
      ) : (
        <div class="table-wrap">
          <table class="issues preview">
            <caption class="visually-hidden">
              Primeiras linhas depois de associar as colunas
            </caption>
            <thead>
              <tr>
                {preview.header.map((column) => (
                  <th scope="col" key={column}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell === null ? '' : String(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {missing.length > 0 && (
        <p class="notice notice-error" role="status">
          Falta associar: {missing.join(', ')}.
        </p>
      )}

      <div class="actions">
        <button
          type="button"
          class="button"
          disabled={missing.length > 0}
          onClick={() => {
            onApply(mapping, true);
          }}
        >
          Guardar perfil
        </button>
        <button
          type="button"
          class="button button-secondary"
          disabled={missing.length > 0}
          onClick={() => {
            onApply(mapping, false);
          }}
        >
          Usar só desta vez
        </button>
      </div>
    </section>
  );
}
