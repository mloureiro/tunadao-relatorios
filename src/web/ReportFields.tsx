import type { ReportTipo } from '@/core/reports';
import { CashCount } from './CashCount';
import {
  AreaField,
  CheckField,
  DateField,
  MoneyField,
  SelectField,
  TextField,
  type FormApi,
} from './form-controls';
import { IndicatorList, UnclearedList } from './RowLists';

interface Props {
  tipo: ReportTipo;
  api: FormApi;
  atividades: readonly string[];
  showManualOpening: boolean;
  extratoHint: string | undefined;
}

function ManualOpening({ api }: { api: FormApi }) {
  return (
    <section class="list-block manual-opening" aria-label="Saldo inicial">
      <h3>Saldo inicial declarado</h3>
      <p class="field-hint">
        Não há um saldo anterior a este período nos dados. Indique os saldos
        iniciais; o PDF vai mencionar que o saldo inicial foi declarado
        manualmente.
      </p>
      <div class="field-grid">
        <MoneyField
          api={api}
          name="aberturaManual/caixa"
          label="Saldo inicial em caixa (€)"
        />
        <MoneyField
          api={api}
          name="aberturaManual/banco"
          label="Saldo inicial em banco (€)"
        />
      </div>
    </section>
  );
}

function Extras({
  api,
  children,
}: {
  api: FormApi;
  children?: preact.ComponentChildren;
}) {
  return (
    <>
      <AreaField
        api={api}
        name="notas"
        label="Notas / Comentários"
        hint="Opcional. Aparece no relatório; cada linha é um parágrafo."
      />
      <div class="field-grid field-grid-checks">
        {children}
        <CheckField
          api={api}
          name="anexarJson"
          label="Anexar dados do relatório ao PDF"
        />
      </div>
    </>
  );
}

function Evento({ api, atividades }: Pick<Props, 'api' | 'atividades'>) {
  return (
    <>
      <div class="field-grid">
        <SelectField
          api={api}
          name="atividade"
          label="Atividade"
          options={atividades}
          placeholder="Escolha a atividade"
        />
        <TextField
          api={api}
          name="ambitoOrcamento"
          label="Âmbito do orçamento"
          hint="Por omissão, a própria atividade."
        />
        <DateField api={api} name="eventoInicio" label="Início do evento" />
        <DateField api={api} name="eventoFim" label="Fim do evento" />
        <DateField
          api={api}
          name="contarAte"
          label="Contar movimentos até (opcional)"
          hint="Sem data, contam todos os movimentos da atividade."
        />
        <DateField
          api={api}
          name="refPendentes"
          label="Data de referência dos pendentes"
        />
      </div>
      <IndicatorList api={api} />
      <Extras api={api} />
    </>
  );
}

function Pegada({
  api,
  showManualOpening,
  extratoHint,
}: Pick<Props, 'api' | 'showManualOpening' | 'extratoHint'>) {
  return (
    <>
      <div class="field-grid">
        <DateField
          api={api}
          name="dataUltimoRelatorio"
          label="Data do último relatório"
        />
        <DateField api={api} name="dataPassagem" label="Data da passagem" />
        <TextField api={api} name="direcaoCessante" label="Direção cessante" />
        <TextField api={api} name="direcaoEntrante" label="Direção entrante" />
        <MoneyField
          api={api}
          name="saldoExtrato"
          label="Saldo do extrato bancário (€)"
          {...(extratoHint === undefined ? {} : { hint: extratoHint })}
        />
      </div>
      {showManualOpening && <ManualOpening api={api} />}
      <UnclearedList
        api={api}
        name="naoDebitados"
        title="Pagamentos não debitados"
        hint="Cheques ou transferências emitidos que ainda não saíram do extrato."
        addLabel="Adicionar pagamento"
        empty="Sem pagamentos por debitar."
        noun="Pagamento"
      />
      <UnclearedList
        api={api}
        name="naoCreditados"
        title="Depósitos não creditados"
        hint="Valores entregues ao banco que ainda não aparecem no extrato."
        addLabel="Adicionar depósito"
        empty="Sem depósitos por creditar."
        noun="Depósito"
      />
      <CashCount api={api} />
      <Extras api={api} />
    </>
  );
}

function Letivo({
  api,
  showManualOpening,
}: Pick<Props, 'api' | 'showManualOpening'>) {
  return (
    <>
      <div class="field-grid">
        <DateField api={api} name="inicio" label="Início do período" />
        <DateField api={api} name="fim" label="Fim do período" />
        <TextField
          api={api}
          name="ambitoOrcamento"
          label="Âmbito do orçamento (opcional)"
          hint="Sem âmbito, a comparação com o orçamento fica de fora."
        />
      </div>
      {showManualOpening && <ManualOpening api={api} />}
      <Extras api={api}>
        <CheckField
          api={api}
          name="anexar"
          label="Incluir anexo de movimentos"
        />
      </Extras>
    </>
  );
}

function Fiscal({
  api,
  showManualOpening,
}: Pick<Props, 'api' | 'showManualOpening'>) {
  return (
    <>
      <div class="field-grid">
        <TextField
          api={api}
          name="ano"
          label="Ano fiscal"
          inputMode="numeric"
        />
        <TextField
          api={api}
          name="ambitoOrcamento"
          label="Âmbito do orçamento"
          hint="Por omissão, o ano."
        />
      </div>
      {showManualOpening && <ManualOpening api={api} />}
      <AreaField
        api={api}
        name="parecerCF"
        label="Parecer do Conselho Fiscal"
        hint="Opcional. Texto livre que o Conselho Fiscal fornece."
        rows={5}
      />
      <Extras api={api}>
        <CheckField
          api={api}
          name="anexoMovimentos"
          label="Incluir anexo de movimentos"
        />
      </Extras>
    </>
  );
}

export function ReportFields({
  tipo,
  api,
  atividades,
  showManualOpening,
  extratoHint,
}: Props) {
  switch (tipo) {
    case 'evento':
      return <Evento api={api} atividades={atividades} />;
    case 'pegada':
      return (
        <Pegada
          api={api}
          showManualOpening={showManualOpening}
          extratoHint={extratoHint}
        />
      );
    case 'letivo':
      return <Letivo api={api} showManualOpening={showManualOpening} />;
    case 'fiscal':
      return <Fiscal api={api} showManualOpening={showManualOpening} />;
  }
}
