import type { ReportTipo } from '../reports/index.ts';
import { normaliseHeader } from '../text.ts';

export const SUPPORTED_LAYOUT_VERSION = 1;

export const MARKER_SCAN_ROWS = 10;
export const MAX_TEXT_CHARS = 5000;

export type FieldKind =
  'date' | 'money' | 'text' | 'year' | 'yesno' | 'activity' | 'budget';

export interface FieldSpec {
  readonly key: string;
  readonly label: string;
  readonly aliases: readonly string[];
  readonly kind: FieldKind;
  readonly required: boolean;
  readonly derivable: boolean;
  readonly hint?: string;
}

export type BlockKind =
  'pairs' | 'indicators' | 'cashCount' | 'text' | 'signatures';

export interface BlockSpec {
  readonly key: string;
  readonly title: string;
  readonly aliases: readonly string[];
  readonly kind: BlockKind;
  readonly hint?: string;
}

export interface ReportSpec {
  readonly tipo: ReportTipo;
  readonly label: string;
  readonly aliases: readonly string[];
  readonly fields: readonly FieldSpec[];
  readonly blocks: readonly BlockSpec[];
}

export const MARKER_LABELS = ['Relatório', 'Tipo de relatório'] as const;

export const VERSION_FIELD = {
  label: 'Versão do modelo',
  aliases: ['Versão'],
} as const;

export const PAIRS_HEADER = ['Descrição', 'Valor (€)'] as const;
export const INDICATORS_HEADER = ['Indicador', 'Valor'] as const;
export const CASH_COUNT_HEADER = [
  'Denominação (€)',
  'Quantidade',
  'Total (€)',
] as const;
export const SIGNATURES_HEADER = ['Cargo', 'Nome'] as const;

function field(
  key: string,
  label: string,
  kind: FieldKind,
  options: {
    aliases?: readonly string[];
    required?: boolean;
    derivable?: boolean;
    hint?: string;
  } = {},
): FieldSpec {
  const { aliases = [], required = false, derivable = false, hint } = options;
  return {
    key,
    label,
    aliases,
    kind,
    required,
    derivable,
    ...(hint === undefined ? {} : { hint }),
  };
}

function block(
  key: string,
  title: string,
  kind: BlockKind,
  options: { aliases?: readonly string[]; hint?: string } = {},
): BlockSpec {
  const { aliases = [], hint } = options;
  return {
    key,
    title,
    aliases,
    kind,
    ...(hint === undefined ? {} : { hint }),
  };
}

const notas = block('notas', 'Notas', 'text', {
  aliases: ['Notas / Comentários', 'Comentários'],
  hint: 'Um parágrafo por linha.',
});

const assinaturas = block('assinaturas', 'Assinaturas', 'signatures', {
  hint: 'Escreva o nome ao lado de cada cargo.',
});

export const REPORT_SPECS = {
  pegada: {
    tipo: 'pegada',
    label: 'Pegada de direção',
    aliases: ['pegada', 'passagem de direção'],
    fields: [
      field('dataUltimoRelatorio', 'Data do último relatório', 'date', {
        aliases: ['Último relatório'],
        required: true,
        derivable: true,
        hint: 'Em branco: o fim do relatório anterior deste ficheiro.',
      }),
      field('dataPassagem', 'Data da passagem', 'date', { required: true }),
      field('direcaoCessante', 'Direção cessante', 'text', {
        required: true,
      }),
      field('direcaoEntrante', 'Direção entrante', 'text', {
        required: true,
      }),
      field(
        'saldoExtrato',
        'Saldo do extrato bancário na data da passagem (€)',
        'money',
        {
          aliases: ['Saldo do extrato bancário', 'Saldo do extrato'],
          required: true,
        },
      ),
      field(
        'moedasPequenas',
        'Moedas não contadas uma a uma (valor total, €)',
        'money',
        {
          aliases: ['Moedas pequenas'],
          hint: 'Moedas guardadas em saco ou rolo, sem contar uma a uma.',
        },
      ),
    ],
    blocks: [
      block(
        'naoDebitados',
        'Pagamentos emitidos ainda não debitados no extrato',
        'pairs',
        {
          aliases: ['Pagamentos não debitados'],
          hint: 'Cheques ou transferências feitos que o banco ainda não mostra.',
        },
      ),
      block(
        'naoCreditados',
        'Depósitos ainda não creditados no extrato',
        'pairs',
        {
          aliases: ['Depósitos não creditados'],
          hint: 'Depósitos feitos que o banco ainda não mostra.',
        },
      ),
      block('contagem', 'Contagem de caixa', 'cashCount'),
      notas,
      assinaturas,
    ],
  },
  evento: {
    tipo: 'evento',
    label: 'Relatório de evento',
    aliases: ['evento'],
    fields: [
      field('atividade', 'Atividade', 'activity', { required: true }),
      field('eventoInicio', 'Início do evento', 'date', {
        derivable: true,
        hint: 'Opcional. Se só um dos dois estiver preenchido, o evento é de um dia.',
      }),
      field('eventoFim', 'Fim do evento', 'date', { derivable: true }),
      field('contarAte', 'Contar movimentos até', 'date', {
        hint: 'Opcional. Os movimentos depois desta data não entram.',
      }),
      field('refPendentes', 'Pendentes à data de', 'date', {
        aliases: ['Data de referência dos pendentes'],
        required: true,
        derivable: true,
        hint: 'Em branco: a data de "Contar movimentos até" ou a do último movimento.',
      }),
      field('ambitoOrcamento', 'Orçamento a usar', 'budget', {
        aliases: ['Âmbito do orçamento', 'Orçamento'],
        hint: 'Em branco: o orçamento com o nome da atividade.',
      }),
    ],
    blocks: [
      block('indicadores', 'Indicadores', 'indicators'),
      notas,
      assinaturas,
    ],
  },
  letivo: {
    tipo: 'letivo',
    label: 'Fim de ano letivo',
    aliases: ['letivo', 'ano letivo'],
    fields: [
      field('inicio', 'Início do período', 'date', {
        aliases: ['Início'],
        required: true,
        derivable: true,
        hint: 'Em branco: o dia seguinte ao fim do relatório anterior deste ficheiro.',
      }),
      field('fim', 'Fim do período', 'date', {
        aliases: ['Fim'],
        required: true,
      }),
      field('ambitoOrcamento', 'Orçamento a usar', 'budget', {
        aliases: ['Âmbito do orçamento'],
        hint: 'Em branco: o relatório não tem secção de orçamento.',
      }),
      field('anexar', 'Incluir a lista de movimentos', 'yesno', {
        aliases: ['Anexar movimentos'],
        hint: 'Em branco: Sim.',
      }),
    ],
    blocks: [notas, assinaturas],
  },
  fiscal: {
    tipo: 'fiscal',
    label: 'Fim de ano fiscal',
    aliases: ['fiscal', 'ano fiscal', 'contas do ano'],
    fields: [
      field('ano', 'Ano', 'year', { required: true }),
      field('ambitoOrcamento', 'Orçamento a usar', 'budget', {
        aliases: ['Âmbito do orçamento'],
        hint: 'Em branco: o orçamento com o nome do ano.',
      }),
      field('anexoMovimentos', 'Incluir a lista de movimentos', 'yesno', {
        aliases: ['Anexo de movimentos'],
        hint: 'Em branco: Não.',
      }),
    ],
    blocks: [
      block('parecerCF', 'Parecer do Conselho Fiscal', 'text', {
        aliases: ['Parecer'],
      }),
      notas,
      assinaturas,
    ],
  },
} as const satisfies Record<ReportTipo, ReportSpec>;

export const REPORT_TIPOS: readonly ReportTipo[] = [
  'pegada',
  'evento',
  'letivo',
  'fiscal',
];

const TRAILING_MARKS = /[\s:*?]+$/;

export function labelKey(text: string): string {
  return normaliseHeader(text.replace(TRAILING_MARKS, '')).replace(
    TRAILING_MARKS,
    '',
  );
}

export function reportTypeFor(text: string): ReportTipo | null {
  const wanted = labelKey(text);
  return (
    REPORT_TIPOS.find((tipo) => {
      const spec: ReportSpec = REPORT_SPECS[tipo];
      return [spec.label, ...spec.aliases].some(
        (name) => labelKey(name) === wanted,
      );
    }) ?? null
  );
}
