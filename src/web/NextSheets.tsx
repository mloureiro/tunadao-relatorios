import { useEffect, useState } from 'preact/hooks';
import { starterFileName } from '@/core/sheets/file-name';
import type { StarterOffer } from '@/core/sheets/instance';
import { prefillStarter } from '@/core/starter/prefill';
import { nextSheetFacts } from './view-model';

const BASE = import.meta.env.BASE_URL;
const OFFER_LABEL: Readonly<Record<StarterOffer['tipo'], string>> = {
  pegada: 'Próxima pegada de direção',
  letivo: 'Próximo fim de ano letivo',
};
const FAILURE = 'Não foi possível preparar as folhas seguintes.';

interface Prepared {
  readonly offer: StarterOffer;
  readonly url: string;
}

async function prepare(offer: StarterOffer): Promise<Blob> {
  const response = await fetch(`${BASE}folhas/${starterFileName(offer.tipo)}`);
  if (!response.ok)
    throw new Error(`Starter ${offer.tipo}: ${String(response.status)}`);
  const bytes = prefillStarter(
    new Uint8Array(await response.arrayBuffer()),
    offer.tipo,
    offer.values,
  );
  return new Blob([bytes.slice().buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function NextSheets({
  offers,
}: {
  readonly offers: readonly StarterOffer[];
}) {
  const [prepared, setPrepared] = useState<readonly Prepared[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    const urls: string[] = [];
    Promise.all(
      offers.map(async (offer) => ({ offer, blob: await prepare(offer) })),
    ).then(
      (made) => {
        if (!current) return;
        setPrepared(
          made.map(({ offer, blob }) => {
            const url = URL.createObjectURL(blob);
            urls.push(url);
            return { offer, url };
          }),
        );
      },
      () => {
        if (current) setFailed(true);
      },
    );
    return () => {
      current = false;
      urls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [offers]);

  if (offers.length === 0) return null;

  return (
    <section class="next-sheets" aria-labelledby="proximas-titulo">
      <h2 id="proximas-titulo">Próximas folhas</h2>
      <p class="hint">
        Folhas já preenchidas com o que este ficheiro sabe. Acrescente-as à
        Tesouraria como qualquer outra folha, preencha o resto e carregue o
        ficheiro outra vez.
      </p>
      {failed && <p class="entry-failure">{FAILURE}</p>}
      <ul class="next-list">
        {prepared.map(({ offer, url }) => (
          <li key={offer.fileName}>
            <a class="link" href={url} download={offer.fileName}>
              {OFFER_LABEL[offer.tipo]}
            </a>
            <dl class="next-facts">
              {nextSheetFacts(offer).map(({ label, value }) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
