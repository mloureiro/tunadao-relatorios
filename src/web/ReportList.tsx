import { useEffect, useRef, useState } from 'preact/hooks';
import type { ReportInstance } from '@/core/sheets/instance';
import { ReportEntry } from './ReportEntry';
import { StarterLinks, TEMPLATE_URL } from './StarterLinks';

interface Props {
  readonly reports: readonly ReportInstance[];
  readonly focusOnMount: boolean;
  readonly announce: (message: string) => void;
}

export function ReportList({ reports, focusOnMount, announce }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);

  useEffect(() => {
    if (focusOnMount) heading.current?.focus();
  }, [focusOnMount]);

  return (
    <section class="reports" aria-labelledby="relatorios-titulo">
      <h2 id="relatorios-titulo" tabIndex={-1} ref={heading}>
        Relatórios neste ficheiro
      </h2>
      {reports.length === 0 ? (
        <div class="no-reports">
          <p>Este ficheiro ainda não tem folhas de relatório.</p>
          <p>
            Cada relatório é uma folha da Tesouraria. Acrescente as que
            precisar, preencha-as e carregue o ficheiro outra vez.
          </p>
          <StarterLinks />
          <p>
            <a
              class="link"
              href={TEMPLATE_URL}
              download="modelo-tesouraria.xlsx"
            >
              Descarregar modelo da tesouraria (.xlsx)
            </a>
          </p>
        </div>
      ) : (
        <ol class="entries">
          {reports.map((instance) => (
            <ReportEntry
              key={instance.sheet}
              instance={instance}
              previewing={previewing === instance.sheet}
              onPreview={(open) => {
                setPreviewing(open ? instance.sheet : null);
              }}
              announce={announce}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
