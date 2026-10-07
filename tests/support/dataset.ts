import type {
  Checkpoint,
  Conta,
  Dataset,
  Direcao,
  Lists,
  Movimento,
  Pendente,
} from '../../src/core/dataset/types.ts';

const FILE = 'teste.xlsx';

export const LISTS: Lists = {
  rubricas: [
    {
      rubrica: 'Bilheteira',
      tipo: 'Entrada',
      contaResultado: true,
      order: 0,
      src: { file: FILE, tab: 'Listas', row: 2 },
    },
    {
      rubrica: 'Licenças e SPA',
      tipo: 'Saída',
      contaResultado: true,
      order: 1,
      src: { file: FILE, tab: 'Listas', row: 3 },
    },
    {
      rubrica: 'Transferências internas',
      tipo: null,
      contaResultado: false,
      order: 2,
      src: { file: FILE, tab: 'Listas', row: 4 },
    },
    {
      rubrica: 'Saldo inicial',
      tipo: null,
      contaResultado: false,
      order: 3,
      src: { file: FILE, tab: 'Listas', row: 5 },
    },
  ],
  subRubricas: [
    {
      subRubrica: 'Bilhetes',
      rubrica: 'Bilheteira',
      order: 0,
      src: { file: FILE, tab: 'Listas', row: 2 },
    },
    {
      subRubrica: 'Outros',
      rubrica: 'Licenças e SPA',
      order: 1,
      src: { file: FILE, tab: 'Listas', row: 3 },
    },
  ],
  atividades: ['Festival Alfa', 'Serenata'],
  meios: [
    { meio: 'Caixa', conta: 'Caixa' },
    { meio: 'Banco', conta: 'Banco' },
  ],
};

export function emptyDataset(overrides: Partial<Dataset> = {}): Dataset {
  return {
    sources: [],
    lists: LISTS,
    movimentos: [],
    pendentes: [],
    orcamento: [],
    generos: [],
    saldos: [],
    ...overrides,
  };
}

interface MovimentoInput {
  readonly data: string;
  readonly cents: number;
  readonly tipo?: Direcao;
  readonly conta?: Conta;
  readonly row?: number;
  readonly rubrica?: string;
  readonly subRubrica?: string;
  readonly descricao?: string;
  readonly doc?: string | null;
  readonly atividade?: string;
}

let nextRow = 2;

export function mov(input: MovimentoInput): Movimento {
  const tipo = input.tipo ?? 'Entrada';
  const conta = input.conta ?? 'Caixa';
  const rubrica =
    input.rubrica ?? (tipo === 'Entrada' ? 'Bilheteira' : 'Licenças e SPA');
  const def = LISTS.rubricas.find((r) => r.rubrica === rubrica);
  return {
    data: input.data,
    doc: input.doc ?? null,
    descricao: input.descricao ?? 'Movimento',
    atividade: input.atividade ?? 'Festival Alfa',
    rubrica,
    subRubrica: input.subRubrica ?? rubrica,
    tipo,
    meio: conta,
    conta,
    valorCents: input.cents,
    signedCents: tipo === 'Entrada' ? input.cents : -input.cents,
    contaResultado: def?.contaResultado ?? true,
    src: { file: FILE, tab: 'Movimentos', row: input.row ?? nextRow++ },
  };
}

export function saldo(
  data: string,
  saldoCents: number,
  conta: Conta = 'Caixa',
  row: number = nextRow++,
): Checkpoint {
  return {
    data,
    conta,
    saldoCents,
    fonte: 'Contagem',
    src: { file: FILE, tab: 'Saldos', row },
  };
}

export function pendente(overrides: Partial<Pendente> = {}): Pendente {
  return {
    tipo: 'A receber',
    entidade: 'Câmara',
    descricao: 'Apoio',
    atividade: 'Festival Alfa',
    valorCents: 10000,
    dataRegisto: '2025-03-01',
    dataLiquidacao: null,
    notas: null,
    src: { file: FILE, tab: 'Pendentes', row: nextRow++ },
    ...overrides,
  };
}
