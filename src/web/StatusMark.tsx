import type { ReportStatus } from '@/core/sheets/instance';

export function StatusMark({ status }: { readonly status: ReportStatus }) {
  const common = {
    class: 'status-mark',
    width: 18,
    height: 18,
    viewBox: '0 0 18 18',
    'aria-hidden': true,
    focusable: 'false',
  } as const;
  switch (status) {
    case 'pronto':
      return (
        <svg {...common}>
          <circle cx="9" cy="9" r="8" fill="currentColor" />
          <path
            d="M5 9.4l2.7 2.7L13 6.6"
            fill="none"
            stroke="#fff"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      );
    case 'pronto-com-avisos':
      return (
        <svg {...common}>
          <circle cx="9" cy="9" r="8" fill="currentColor" />
          <path
            d="M9 4.8v5.2M9 12.4v.8"
            stroke="#fff"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      );
    case 'com-erros':
      return (
        <svg {...common}>
          <circle cx="9" cy="9" r="8" fill="currentColor" />
          <path
            d="M6 6l6 6M12 6l-6 6"
            stroke="#fff"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      );
    case 'bloqueado-dados':
      return (
        <svg {...common}>
          <rect
            x="3.5"
            y="8"
            width="11"
            height="8"
            rx="1.5"
            fill="currentColor"
          />
          <path
            d="M6 8V6a3 3 0 016 0v2"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          />
        </svg>
      );
    case 'por-preencher':
      return (
        <svg {...common}>
          <circle
            cx="9"
            cy="9"
            r="7"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-dasharray="3 3"
          />
        </svg>
      );
  }
}
