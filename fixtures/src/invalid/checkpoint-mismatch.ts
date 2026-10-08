import { invalidWorkbook, movimento } from './base.ts';

export const CHECKPOINT_MISMATCH = invalidWorkbook(
  [movimento({ data: '2026-02-10', descricao: 'Quotas em numerário' })],
  [
    {
      data: '2026-01-31',
      conta: 'Caixa',
      saldoCents: 10000,
      fonte: 'Contagem',
    },
    {
      data: '2026-02-28',
      conta: 'Caixa',
      saldoCents: 20000,
      fonte: 'Contagem',
    },
  ],
);
