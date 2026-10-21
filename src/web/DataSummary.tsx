import type { DataSummary as Summary } from '@/core/summary';
import { summaryFacts } from './view-model';

export function DataSummary({ summary }: { readonly summary: Summary }) {
  return (
    <section class="summary" aria-labelledby="resumo-titulo">
      <h2 id="resumo-titulo">Resumo dos dados</h2>
      <dl class="facts">
        {summaryFacts(summary).map(({ label, value }) => (
          <div key={label} class="fact">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
