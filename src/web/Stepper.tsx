const STEPS = ['Dados', 'Relatório', 'PDF'] as const;

export function Stepper() {
  return (
    <ol class="stepper" aria-label="Passos">
      {STEPS.map((label, index) => (
        <li
          key={label}
          class={index === 0 ? 'step step-active' : 'step'}
          aria-current={index === 0 ? 'step' : undefined}
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
