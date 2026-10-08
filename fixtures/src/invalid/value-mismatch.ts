import { invalidWorkbook, movimento } from './base.ts';

export const VALUE_MISMATCH = invalidWorkbook([
  movimento({ descricao: 'Quotas em numerário' }),
  movimento({
    data: '2026-01-12',
    descricao: 'Compra de cordas',
    rubrica: 'Instrumentos e manutenção',
    tipo: 'Saída',
    valorCents: 3000,
    typedOver: { signedCents: 3000 },
  }),
  movimento({
    data: '2026-01-14',
    descricao: 'Donativo recebido no banco',
    rubrica: 'Donativos',
    meio: 'Banco',
    valorCents: 2000,
    typedOver: { conta: 'Caixa' },
  }),
]);
