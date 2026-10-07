import type { Conta, TabName } from './dataset/types.ts';
import { formatDate, formatMoney, formatMoneySigned } from './format.ts';
import type { Cents } from './money.ts';

export type Severity = 'error' | 'warning';

export const ISSUE_SEVERITY = {
  'missing-column': 'error',
  'missing-tab': 'error',
  'required-empty': 'error',
  'invalid-date': 'error',
  'invalid-number': 'error',
  'invalid-enum': 'error',
  'sub-cent': 'warning',
  'ambiguous-date-order': 'warning',
  'non-positive-value': 'error',
  'unknown-rubrica': 'error',
  'unknown-atividade': 'error',
  'unknown-meio': 'error',
  'derived-mismatch': 'error',
  'duplicate-listas': 'error',
  'probable-duplicate': 'warning',
  'transfer-unbalanced': 'warning',
  'settled-before-registered': 'error',
  'checkpoint-conflict': 'error',
  'checkpoint-mismatch': 'error',
  'negative-balance': 'warning',
  'missing-opening-balance': 'error',
  'manual-opening-balance': 'warning',
  'manual-opening-mismatch': 'error',
  'negative-rubric-net': 'warning',
  'budget-level-mismatch': 'warning',
  'no-budget': 'warning',
  'no-previous-data': 'warning',
  'undated-generos': 'warning',
  'reconciliation-difference': 'warning',
  'cash-count-difference': 'warning',
} as const satisfies Record<string, Severity>;

export type IssueCode = keyof typeof ISSUE_SEVERITY;

export interface Issue {
  readonly severity: Severity;
  readonly code: IssueCode;
  readonly file?: string;
  readonly tab?: TabName;
  readonly row?: number;
  readonly column?: string;
  readonly message: string;
  readonly suggestion?: string;
}

export interface IssueLocation {
  readonly file?: string;
  readonly tab?: TabName;
  readonly row?: number;
  readonly column?: string;
}

export const issueMessages = {
  'missing-column': (column: string, tab: TabName) =>
    `Falta a coluna obrigatória "${column}" no separador ${tab}.`,
  'missing-tab': (tab: TabName) => `Falta o separador obrigatório ${tab}.`,
  'required-empty': (column: string) =>
    `O campo "${column}" é obrigatório e está vazio.`,
  'invalid-date': (value: string) =>
    `Data inválida: "${value}". Use o formato dd/mm/aaaa.`,
  'invalid-number': (value: string) => `Valor numérico inválido: "${value}".`,
  'invalid-enum': (value: string, accepted: readonly string[]) =>
    `Valor "${value}" não reconhecido. Valores aceites: ${accepted.join(', ')}.`,
  'sub-cent': (value: string) =>
    `O valor "${value}" tem mais de 2 casas decimais e foi arredondado ao cêntimo.`,
  'ambiguous-date-order': () =>
    'As datas desta coluna parecem estar na ordem mm/dd/aaaa. Confirme que usam dd/mm/aaaa.',
  'non-positive-value': (cents: Cents) =>
    `O valor ${formatMoney(cents)} tem de ser superior a zero. O sentido do movimento indica-se na coluna Tipo.`,
  'unknown-rubrica': (rubrica: string, subRubrica: string | null) =>
    subRubrica === null
      ? `A rubrica "${rubrica}" não existe na lista Rubricas.`
      : `A sub-rubrica "${subRubrica}" não existe na rubrica "${rubrica}" da lista Sub-rubricas.`,
  'unknown-atividade': (atividade: string) =>
    `A atividade "${atividade}" não existe na lista Atividades.`,
  'unknown-meio': (meio: string) =>
    `O meio "${meio}" não existe na lista Meios.`,
  'derived-mismatch': (column: string, supplied: string, expected: string) =>
    `A coluna "${column}" tem "${supplied}" mas o valor calculado é "${expected}".`,
  'duplicate-listas': (block: string, key: string) =>
    `A entrada "${key}" está repetida na lista ${block}.`,
  'probable-duplicate': (date: string, cents: Cents, otherRow: number) =>
    `Movimento provavelmente duplicado: mesma data (${formatDate(date)}), valor (${formatMoney(cents)}), tipo e descrição da linha ${String(otherRow)}.`,
  'transfer-unbalanced': (group: string, cents: Cents) =>
    `As transferências internas de ${group} não se anulam: diferença de ${formatMoneySigned(cents)}.`,
  'settled-before-registered': (settled: string, registered: string) =>
    `A data de liquidação (${formatDate(settled)}) é anterior à data de registo (${formatDate(registered)}).`,
  'checkpoint-conflict': (conta: Conta, date: string, a: Cents, b: Cents) =>
    `Dois saldos de ${conta} em ${formatDate(date)} discordam: ${formatMoney(a)} e ${formatMoney(b)}.`,
  'checkpoint-mismatch': (
    conta: Conta,
    date: string,
    declared: Cents,
    computed: Cents,
  ) =>
    `O saldo de ${conta} em ${formatDate(date)} é ${formatMoney(declared)} mas os movimentos dão ${formatMoney(computed)} (diferença ${formatMoneySigned(declared - computed)}).`,
  'negative-balance': (conta: Conta, date: string, cents: Cents) =>
    `O saldo de ${conta} fica negativo em ${formatDate(date)}: ${formatMoney(cents)}.`,
  'missing-opening-balance': (conta: Conta, date: string) =>
    `Não há saldo de ${conta} anterior a ${formatDate(date)} nem saldo inicial indicado.`,
  'manual-opening-balance': (conta: Conta, cents: Cents) =>
    `Foi usado o saldo inicial de ${conta} indicado manualmente: ${formatMoney(cents)}.`,
  'manual-opening-mismatch': (
    conta: Conta,
    date: string,
    declared: Cents,
    computed: Cents,
  ) =>
    `O saldo de ${conta} em ${formatDate(date)} é ${formatMoney(declared)} mas o saldo inicial manual e os movimentos dão ${formatMoney(computed)}.`,
  'negative-rubric-net': (rubrica: string, cents: Cents) =>
    `O total líquido da rubrica "${rubrica}" é negativo: ${formatMoney(cents)}.`,
  'budget-level-mismatch': (rubrica: string) =>
    `O orçamento e os movimentos da rubrica "${rubrica}" estão a níveis diferentes (rubrica e sub-rubrica).`,
  'no-budget': (ambito: string) =>
    `Não foram encontradas linhas de orçamento para "${ambito}". A secção foi omitida.`,
  'no-previous-data': () =>
    'O período de comparação não tem movimentos. A secção indica "sem dados".',
  'undated-generos': (count: number) =>
    `${String(count)} linha(s) de Géneros sem data foram excluídas do relatório.`,
  'reconciliation-difference': (cents: Cents) =>
    `A reconciliação bancária tem uma diferença de ${formatMoneySigned(cents)}.`,
  'cash-count-difference': (cents: Cents) =>
    `A contagem de caixa difere do saldo calculado em ${formatMoneySigned(cents)}.`,
} as const satisfies Record<IssueCode, (...args: never[]) => string>;

export function makeIssue(
  code: IssueCode,
  message: string,
  where: IssueLocation = {},
  suggestion?: string,
): Issue {
  return {
    severity: ISSUE_SEVERITY[code],
    code,
    ...where,
    message,
    ...(suggestion === undefined ? {} : { suggestion }),
  };
}
