import { TRANSFER_RUBRICA } from '../../src/core/dataset/domain.ts';
import type { Conta, IsoDate } from '../../src/core/dataset/types.ts';
import type { MovimentoSpec } from '../../scripts/lib/workbook-writer.ts';

export type Linha = Omit<MovimentoSpec, 'doc'>;

export function cents(euros: number): number {
  return Math.round(euros * 100);
}

export interface Atividade {
  entrada(
    data: IsoDate,
    descricao: string,
    rubrica: string,
    meio: string,
    valor: number,
    subRubrica?: string,
  ): Linha;
  saida(
    data: IsoDate,
    descricao: string,
    rubrica: string,
    meio: string,
    valor: number,
    subRubrica?: string,
  ): Linha;
  transferencia(
    data: IsoDate,
    descricao: string,
    de: Conta,
    para: Conta,
    valor: number,
  ): Linha[];
}

export function atividade(nome: string): Atividade {
  const linha = (
    tipo: Linha['tipo'],
    data: IsoDate,
    descricao: string,
    rubrica: string,
    meio: string,
    valor: number,
    subRubrica?: string,
  ): Linha => ({
    data,
    descricao,
    atividade: nome,
    rubrica,
    subRubrica: subRubrica ?? null,
    tipo,
    meio,
    valorCents: cents(valor),
  });

  return {
    entrada: (data, descricao, rubrica, meio, valor, subRubrica) =>
      linha('Entrada', data, descricao, rubrica, meio, valor, subRubrica),
    saida: (data, descricao, rubrica, meio, valor, subRubrica) =>
      linha('Saída', data, descricao, rubrica, meio, valor, subRubrica),
    transferencia: (data, descricao, de, para, valor) => [
      linha('Saída', data, `${descricao} (saída)`, TRANSFER_RUBRICA, de, valor),
      linha(
        'Entrada',
        data,
        `${descricao} (entrada)`,
        TRANSFER_RUBRICA,
        para,
        valor,
      ),
    ],
  };
}

function prefixoDoDocumento(linha: Linha): 'R' | 'P' | 'T' {
  if (linha.rubrica === TRANSFER_RUBRICA) return 'T';
  return linha.tipo === 'Entrada' ? 'R' : 'P';
}

function numero(valor: number): string {
  return String(valor).padStart(3, '0');
}

export function ordenarENumerar(linhas: readonly Linha[]): MovimentoSpec[] {
  const porData = linhas.toSorted((a, b) => a.data.localeCompare(b.data));
  const contadores = new Map<string, number>();
  let transferenciaAtual = '';

  return porData.map((linha) => {
    const prefixo = prefixoDoDocumento(linha);
    const ano = linha.data.slice(0, 4);
    const chave = `${ano}-${prefixo}`;

    if (prefixo === 'T' && linha.tipo === 'Entrada') {
      return { ...linha, doc: transferenciaAtual };
    }
    const seguinte = (contadores.get(chave) ?? 0) + 1;
    contadores.set(chave, seguinte);
    const doc = `${prefixo}-${numero(seguinte)}`;
    if (prefixo === 'T') transferenciaAtual = doc;
    return { ...linha, doc };
  });
}
