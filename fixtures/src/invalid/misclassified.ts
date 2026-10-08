import { invalidWorkbook, movimento } from './base.ts';

export const MISCLASSIFIED = invalidWorkbook([
  movimento({
    descricao: 'Bar do ensaio aberto',
    rubrica: 'Taxas e licenças',
    subRubrica: 'Bar',
    tipo: 'Saída',
  }),
  movimento({
    data: '2026-01-12',
    descricao: 'Aluguer de som',
    rubrica: 'Producao (som, luz, palco)',
    tipo: 'Saída',
    meio: 'Banco',
    valorCents: 18000,
  }),
  movimento({
    data: '2026-01-14',
    descricao: 'Devolução de caução',
    rubrica: 'Alimentação e alojamento',
    tipo: 'Saída',
    valorCents: -8900,
  }),
]);
