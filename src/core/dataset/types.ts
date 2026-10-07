import type { IsoDate } from '../dates.ts';
import type { Cents } from '../money.ts';

export type { IsoDate } from '../dates.ts';
export type { Cents } from '../money.ts';

export type TabName =
  'Movimentos' | 'Pendentes' | 'Orçamento' | 'Géneros' | 'Listas' | 'Saldos';
export type Conta = 'Caixa' | 'Banco';
export type Direcao = 'Entrada' | 'Saída';
export type FonteSaldo = 'Extrato' | 'Contagem' | 'Declarado';

export interface SourceRef {
  readonly file: string;
  readonly tab: TabName;
  readonly row: number;
}

export interface RubricaDef {
  readonly rubrica: string;
  readonly tipo: Direcao | null;
  readonly contaResultado: boolean;
  readonly order: number;
  readonly src: SourceRef;
}

export interface SubRubricaDef {
  readonly subRubrica: string;
  readonly rubrica: string;
  readonly order: number;
  readonly src: SourceRef;
}

export interface MeioDef {
  readonly meio: string;
  readonly conta: Conta;
}

export interface Lists {
  readonly rubricas: readonly RubricaDef[];
  readonly subRubricas: readonly SubRubricaDef[];
  readonly atividades: readonly string[];
  readonly meios: readonly MeioDef[];
}

export interface Movimento {
  readonly data: IsoDate;
  readonly doc: string | null;
  readonly descricao: string;
  readonly atividade: string;
  readonly rubrica: string;
  readonly subRubrica: string;
  readonly tipo: Direcao;
  readonly meio: string;
  readonly conta: Conta;
  readonly valorCents: Cents;
  readonly signedCents: Cents;
  readonly contaResultado: boolean;
  readonly src: SourceRef;
}

export interface Pendente {
  readonly tipo: 'A receber' | 'A pagar';
  readonly entidade: string;
  readonly descricao: string;
  readonly atividade: string | null;
  readonly valorCents: Cents;
  readonly dataRegisto: IsoDate;
  readonly dataLiquidacao: IsoDate | null;
  readonly notas: string | null;
  readonly src: SourceRef;
}

export interface LinhaOrcamento {
  readonly ambito: string;
  readonly tipo: Direcao;
  readonly rubrica: string;
  readonly subRubrica: string;
  readonly orcadoCents: Cents;
  readonly src: SourceRef;
}

export interface Genero {
  readonly data: IsoDate | null;
  readonly atividade: string;
  readonly tipo: string;
  readonly quantidade: string | null;
  readonly emFalta: number | null;
  readonly valorEstimadoCents: Cents | null;
  readonly src: SourceRef;
}

export interface Checkpoint {
  readonly data: IsoDate;
  readonly conta: Conta;
  readonly saldoCents: Cents;
  readonly fonte: FonteSaldo;
  readonly src: SourceRef;
}

export interface DatasetSource {
  readonly name: string;
  readonly sha256: string;
}

export interface Dataset {
  readonly sources: readonly DatasetSource[];
  readonly lists: Lists;
  readonly movimentos: readonly Movimento[];
  readonly pendentes: readonly Pendente[];
  readonly orcamento: readonly LinhaOrcamento[];
  readonly generos: readonly Genero[];
  readonly saldos: readonly Checkpoint[];
}
