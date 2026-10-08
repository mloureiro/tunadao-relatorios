import { invalidWorkbook, movimento } from './base.ts';

export const MISSING_FIELDS = invalidWorkbook([
  movimento({ descricao: 'Quotas sem atividade', atividade: null }),
  movimento({
    data: '2026-01-12',
    descricao: 'Compra sem meio de pagamento',
    rubrica: 'Outros pagamentos',
    tipo: 'Saída',
    meio: null,
    valorCents: 2350,
  }),
]);
