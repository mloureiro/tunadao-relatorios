import { formatMoney } from '@/core/format';
import type { FormApi } from './form-controls';
import {
  DENOMINATION_GRID,
  smallCoinsCents,
  cashCountTotals,
  denominationKey,
  setCount,
} from './report-form';

export function CashCount({ api }: { api: FormApi }) {
  const coins = api.form.fields.moedasPequenas ?? '';
  const coinsCents = smallCoinsCents(coins);
  const coinsId = `${api.idPrefix}-moedasPequenas`;
  const coinsError = api.error('moedasPequenas');
  const { rows, totalCents } = cashCountTotals(api.form.contagem, coins);
  return (
    <section
      class="list-block"
      aria-labelledby={`${api.idPrefix}-caixa-titulo`}
    >
      <h3 id={`${api.idPrefix}-caixa-titulo`}>Contagem de caixa</h3>
      <p class="field-hint">
        Indique quantas notas e moedas há de cada valor. Se não as contou uma a
        uma, indique o valor das moedas pequenas na última linha.
      </p>
      <div class="table-wrap">
        <table class="cash-grid">
          <caption class="visually-hidden">
            Quantidade de notas e moedas por valor
          </caption>
          <thead>
            <tr>
              <th scope="col">Valor</th>
              <th scope="col">Quantidade</th>
              <th scope="col" class="cell-number">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {DENOMINATION_GRID.map((cents, index) => {
              const key = denominationKey(cents);
              const id = `${api.idPrefix}-contagem-${key}`;
              const error = api.error(`contagem/${key}`);
              const subtotal = rows[index] ?? null;
              return (
                <tr key={cents}>
                  <th scope="row">
                    <label for={id}>{formatMoney(cents)}</label>
                  </th>
                  <td>
                    <input
                      id={id}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      class="count-input"
                      value={api.form.contagem[key] ?? ''}
                      aria-invalid={error === undefined ? undefined : true}
                      aria-describedby={
                        error === undefined ? undefined : `${id}-erro`
                      }
                      onInput={(event) => {
                        const value = event.currentTarget.value;
                        api.patch((form) => setCount(form, cents, value));
                      }}
                      onBlur={() => {
                        api.blur(`contagem/${key}`);
                      }}
                    />
                    {error !== undefined && (
                      <p id={`${id}-erro`} class="field-error">
                        {error}
                      </p>
                    )}
                  </td>
                  <td class="cell-number">
                    {subtotal === null ? '—' : formatMoney(subtotal)}
                  </td>
                </tr>
              );
            })}
            <tr>
              <th scope="row">
                <label for={coinsId}>Moedas pequenas (valor total)</label>
              </th>
              <td>
                <input
                  id={coinsId}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  class="count-input"
                  value={coins}
                  aria-invalid={coinsError === undefined ? undefined : true}
                  aria-describedby={
                    coinsError === undefined ? undefined : `${coinsId}-erro`
                  }
                  onInput={(event) => {
                    api.set('moedasPequenas', event.currentTarget.value);
                  }}
                  onBlur={() => {
                    api.blur('moedasPequenas');
                  }}
                />
                {coinsError !== undefined && (
                  <p id={`${coinsId}-erro`} class="field-error">
                    {coinsError}
                  </p>
                )}
              </td>
              <td class="cell-number">
                {coinsCents === null ? '—' : formatMoney(coinsCents)}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2}>
                Total contado
              </th>
              <td class="cell-number" data-testid="total-contado">
                {formatMoney(totalCents)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
