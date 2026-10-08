import type { ReportTipo } from '@/core/reports';

interface Choice {
  readonly tipo: ReportTipo;
  readonly title: string;
  readonly description: string;
}

export const REPORT_CHOICES: readonly Choice[] = [
  {
    tipo: 'evento',
    title: 'Relatório de evento',
    description:
      'Receitas, despesas e resultado de uma atividade, com orçamento e pendentes.',
  },
  {
    tipo: 'pegada',
    title: 'Pegada de direção',
    description:
      'Passagem entre direções, com o saldo conferido com o extrato e a contagem de caixa.',
  },
  {
    tipo: 'letivo',
    title: 'Fim de ano letivo',
    description:
      'Um período à escolha, com a comparação ao mesmo período do ano anterior.',
  },
  {
    tipo: 'fiscal',
    title: 'Fim de ano fiscal',
    description:
      'As contas de 1 de janeiro a 31 de dezembro, para o Conselho Fiscal.',
  },
];

interface Props {
  selected: ReportTipo | null;
  onSelect: (tipo: ReportTipo) => void;
}

export function ReportPicker({ selected, onSelect }: Props) {
  return (
    <fieldset class="picker">
      <legend>Que relatório quer gerar?</legend>
      <div class="picker-grid">
        {REPORT_CHOICES.map(({ tipo, title, description }) => (
          <label
            key={tipo}
            class={selected === tipo ? 'type-card type-card-on' : 'type-card'}
          >
            <input
              class="visually-hidden"
              type="radio"
              name="tipo-relatorio"
              value={tipo}
              checked={selected === tipo}
              onChange={() => {
                onSelect(tipo);
              }}
            />
            <span class="type-title">{title}</span>
            <span class="type-description">{description}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
