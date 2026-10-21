import type { ComponentChildren } from 'preact';

interface Props {
  readonly className: string;
  readonly onPick: (files: File[]) => void;
  readonly children: ComponentChildren;
}

export function FilePicker({ className, onPick, children }: Props) {
  return (
    <label class={className}>
      <input
        class="visually-hidden"
        type="file"
        accept=".xlsx"
        onChange={(event) => {
          onPick(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = '';
        }}
      />
      {children}
    </label>
  );
}
