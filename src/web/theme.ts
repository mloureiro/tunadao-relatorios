import type { Config } from '@/core/config/schema';

export function applyTheme(
  theme: Config['theme'],
  root: HTMLElement = document.documentElement,
): void {
  const tokens = {
    '--ink': theme.navy,
    '--paper': theme.light,
    '--margin': theme.accentRed,
    '--ok': theme.positive,
    '--rule': theme.neutral,
  };
  for (const [name, value] of Object.entries(tokens)) {
    root.style.setProperty(name, value);
  }
}
