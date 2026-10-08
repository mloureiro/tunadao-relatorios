import type { FormApi } from './form-controls';
import {
  nextRowKey,
  type IndicatorRow,
  type ReportFormValues,
  type UnclearedRow,
} from './report-form';

interface RowInputProps {
  id: string;
  label: string;
  value: string;
  error: string | undefined;
  inputMode?: 'decimal';
  placeholder?: string;
  onInput: (value: string) => void;
  onBlur: () => void;
}

function RowInput({
  id,
  label,
  value,
  error,
  inputMode,
  placeholder,
  onInput,
  onBlur,
}: RowInputProps) {
  return (
    <div class="row-cell">
      <label for={id}>{label}</label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? undefined : `${id}-erro`}
        onInput={(event) => {
          onInput(event.currentTarget.value);
        }}
        onBlur={onBlur}
      />
      {error !== undefined && (
        <p id={`${id}-erro`} class="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

function RowShell({
  legend,
  error,
  errorId,
  onRemove,
  removeLabel,
  children,
}: {
  legend: string;
  error?: string | undefined;
  errorId: string;
  onRemove: () => void;
  removeLabel: string;
  children: preact.ComponentChildren;
}) {
  return (
    <li class="row-item">
      <fieldset aria-describedby={error === undefined ? undefined : errorId}>
        <legend class="visually-hidden">{legend}</legend>
        <div class="row-grid">{children}</div>
        {error !== undefined && (
          <p id={errorId} class="field-error">
            {error}
          </p>
        )}
      </fieldset>
      <button
        type="button"
        class="button button-quiet"
        aria-label={removeLabel}
        onClick={onRemove}
      >
        Remover
      </button>
    </li>
  );
}

type ListName = 'indicadores' | 'naoDebitados' | 'naoCreditados';

function without(
  form: ReportFormValues,
  name: ListName,
  key: number,
): ReportFormValues {
  const rows: readonly { readonly key: number }[] = form[name];
  return { ...form, [name]: rows.filter((row) => row.key !== key) };
}

interface ListFrameProps {
  title: string;
  hint?: string;
  addLabel: string;
  empty: string;
  isEmpty: boolean;
  onAdd: () => void;
  children: preact.ComponentChildren;
}

function ListFrame({
  title,
  hint,
  addLabel,
  empty,
  isEmpty,
  onAdd,
  children,
}: ListFrameProps) {
  return (
    <section class="list-block" aria-label={title}>
      <h3>{title}</h3>
      {hint !== undefined && <p class="field-hint">{hint}</p>}
      {isEmpty ? (
        <p class="hint">{empty}</p>
      ) : (
        <ul class="row-list">{children}</ul>
      )}
      <button type="button" class="button button-quiet" onClick={onAdd}>
        {addLabel}
      </button>
    </section>
  );
}

export function IndicatorList({ api }: { api: FormApi }) {
  const rows = api.form.indicadores;
  const update = (key: number, change: Partial<IndicatorRow>) => {
    api.patch((form) => ({
      ...form,
      indicadores: form.indicadores.map((row) =>
        row.key === key ? { ...row, ...change } : row,
      ),
    }));
  };
  return (
    <ListFrame
      title="Indicadores do evento"
      hint="Pares designação e valor que aparecem no relatório, por exemplo «Bilhetes vendidos» e «645»."
      addLabel="Adicionar indicador"
      empty="Sem indicadores."
      isEmpty={rows.length === 0}
      onAdd={() => {
        api.patch((form) => ({
          ...form,
          indicadores: [
            ...form.indicadores,
            { key: nextRowKey(form.indicadores), label: '', value: '' },
          ],
        }));
      }}
    >
      {rows.map((row, index) => {
        const id = `${api.idPrefix}-indicador-${String(row.key)}`;
        const number = String(index + 1);
        return (
          <RowShell
            key={row.key}
            legend={`Indicador ${number}`}
            error={api.error(`indicadores/${String(index)}`)}
            errorId={`${id}-erro`}
            removeLabel={`Remover indicador ${number}`}
            onRemove={() => {
              api.patch((form) => without(form, 'indicadores', row.key));
            }}
          >
            <RowInput
              id={`${id}-label`}
              label="Designação"
              value={row.label}
              error={undefined}
              onInput={(label) => {
                update(row.key, { label });
              }}
              onBlur={() => {
                api.blur(`indicadores/${String(index)}`);
              }}
            />
            <RowInput
              id={`${id}-value`}
              label="Valor"
              value={row.value}
              error={undefined}
              onInput={(value) => {
                update(row.key, { value });
              }}
              onBlur={() => {
                api.blur(`indicadores/${String(index)}`);
              }}
            />
          </RowShell>
        );
      })}
    </ListFrame>
  );
}

interface UnclearedListProps {
  api: FormApi;
  name: 'naoDebitados' | 'naoCreditados';
  title: string;
  hint: string;
  addLabel: string;
  empty: string;
  noun: string;
}

export function UnclearedList({
  api,
  name,
  title,
  hint,
  addLabel,
  empty,
  noun,
}: UnclearedListProps) {
  const rows = api.form[name];
  const update = (key: number, change: Partial<UnclearedRow>) => {
    api.patch((form) => ({
      ...form,
      [name]: form[name].map((row) =>
        row.key === key ? { ...row, ...change } : row,
      ),
    }));
  };
  return (
    <ListFrame
      title={title}
      hint={hint}
      addLabel={addLabel}
      empty={empty}
      isEmpty={rows.length === 0}
      onAdd={() => {
        api.patch((form) => ({
          ...form,
          [name]: [
            ...form[name],
            { key: nextRowKey(form[name]), descricao: '', valor: '' },
          ],
        }));
      }}
    >
      {rows.map((row, index) => {
        const id = `${api.idPrefix}-${name}-${String(row.key)}`;
        const path = `${name}/${String(index)}`;
        const number = String(index + 1);
        return (
          <RowShell
            key={row.key}
            legend={`${noun} ${number}`}
            errorId={`${id}-erro`}
            removeLabel={`Remover ${noun.toLowerCase()} ${number}`}
            onRemove={() => {
              api.patch((form) => without(form, name, row.key));
            }}
          >
            <RowInput
              id={`${id}-descricao`}
              label="Descrição"
              value={row.descricao}
              error={api.error(`${path}/descricao`)}
              onInput={(descricao) => {
                update(row.key, { descricao });
              }}
              onBlur={() => {
                api.blur(`${path}/descricao`);
              }}
            />
            <RowInput
              id={`${id}-valor`}
              label="Valor (€)"
              value={row.valor}
              error={api.error(`${path}/valor`)}
              inputMode="decimal"
              placeholder="0,00"
              onInput={(valor) => {
                update(row.key, { valor });
              }}
              onBlur={() => {
                api.blur(`${path}/valor`);
              }}
            />
          </RowShell>
        );
      })}
    </ListFrame>
  );
}
