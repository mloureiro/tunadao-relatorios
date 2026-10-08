import type { ComponentChildren } from 'preact';
import type { ReportFormValues } from './report-form';

export interface FormApi {
  readonly form: ReportFormValues;
  readonly idPrefix: string;
  set(key: string, value: string): void;
  blur(key: string): void;
  flag(key: string, value: boolean): void;
  patch(change: (form: ReportFormValues) => ReportFormValues): void;
  error(key: string): string | undefined;
}

interface ShellProps {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  wide?: boolean;
  children: (describedBy: string | undefined) => ComponentChildren;
}

function Shell({ id, label, hint, error, wide, children }: ShellProps) {
  const describedBy =
    [
      hint === undefined ? '' : `${id}-hint`,
      error === undefined ? '' : `${id}-erro`,
    ]
      .filter((part) => part !== '')
      .join(' ') || undefined;
  return (
    <div class={wide === true ? 'field field-wide' : 'field'}>
      <label for={id}>{label}</label>
      {children(describedBy)}
      {hint !== undefined && (
        <p id={`${id}-hint`} class="field-hint">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={`${id}-erro`} class="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

interface TextProps {
  api: FormApi;
  name: string;
  label: string;
  hint?: string;
  placeholder?: string;
  inputMode?: 'numeric' | 'decimal' | 'text';
}

export function TextField({
  api,
  name,
  label,
  hint,
  placeholder,
  inputMode = 'text',
}: TextProps) {
  const id = `${api.idPrefix}-${name}`;
  const error = api.error(name);
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          placeholder={placeholder}
          value={api.form.fields[name] ?? ''}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={describedBy}
          onInput={(event) => {
            api.set(name, event.currentTarget.value);
          }}
          onBlur={() => {
            api.blur(name);
          }}
        />
      )}
    </Shell>
  );
}

export function DateField(props: Omit<TextProps, 'inputMode' | 'placeholder'>) {
  return <TextField {...props} inputMode="numeric" placeholder="dd/mm/aaaa" />;
}

export function MoneyField(
  props: Omit<TextProps, 'inputMode' | 'placeholder'>,
) {
  return <TextField {...props} inputMode="decimal" placeholder="0,00" />;
}

interface AreaProps {
  api: FormApi;
  name: string;
  label: string;
  hint?: string;
  rows?: number;
}

export function AreaField({ api, name, label, hint, rows = 4 }: AreaProps) {
  const id = `${api.idPrefix}-${name}`;
  const error = api.error(name);
  return (
    <Shell id={id} label={label} hint={hint} error={error} wide>
      {(describedBy) => (
        <textarea
          id={id}
          rows={rows}
          value={api.form.fields[name] ?? ''}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={describedBy}
          onInput={(event) => {
            api.set(name, event.currentTarget.value);
          }}
          onBlur={() => {
            api.blur(name);
          }}
        />
      )}
    </Shell>
  );
}

interface SelectProps {
  api: FormApi;
  name: string;
  label: string;
  options: readonly string[];
  placeholder: string;
}

export function SelectField({
  api,
  name,
  label,
  options,
  placeholder,
}: SelectProps) {
  const id = `${api.idPrefix}-${name}`;
  const error = api.error(name);
  return (
    <Shell id={id} label={label} error={error}>
      {(describedBy) => (
        <select
          id={id}
          value={api.form.fields[name] ?? ''}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={describedBy}
          onChange={(event) => {
            api.set(name, event.currentTarget.value);
          }}
          onBlur={() => {
            api.blur(name);
          }}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}
    </Shell>
  );
}

interface CheckProps {
  api: FormApi;
  name: string;
  label: string;
}

export function CheckField({ api, name, label }: CheckProps) {
  const id = `${api.idPrefix}-${name}`;
  return (
    <div class="field field-check">
      <input
        id={id}
        type="checkbox"
        checked={api.form.flags[name] ?? false}
        onChange={(event) => {
          api.flag(name, event.currentTarget.checked);
        }}
      />
      <label for={id}>{label}</label>
    </div>
  );
}
