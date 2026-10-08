const STEPS = ['Dados', 'Relatório', 'PDF'] as const;

export function Stepper({ current }: { current: number }) {
  return (
    <ol class="stepper" aria-label="Passos">
      {STEPS.map((label, index) => (
        <li
          key={label}
          class={index === current ? 'step step-active' : 'step'}
          aria-current={index === current ? 'step' : undefined}
        >
          <span class="step-number" aria-hidden="true">
            {index + 1}
          </span>
          {label}
        </li>
      ))}
    </ol>
  );
}
