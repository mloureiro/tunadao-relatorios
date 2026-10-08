import type { IsoDate } from '@/core/dataset/types';

export function slug(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function eventoStem(atividade: string, fim: IsoDate): string {
  return `relatorio-evento-${slug(atividade)}-${fim}`;
}

export function pegadaStem(passagem: IsoDate): string {
  return `relatorio-pegada-${passagem}`;
}

export function letivoStem(fim: IsoDate): string {
  return `relatorio-letivo-${fim}`;
}

export function fiscalStem(ano: number): string {
  return `relatorio-fiscal-${String(ano)}`;
}
