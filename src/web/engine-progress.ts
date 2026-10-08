import type { WasmProgress } from '@/engine/typst-web';

export function engineProgressLabel(progress: WasmProgress | null): string {
  if (progress?.total == null) {
    return 'A preparar o motor de PDF…';
  }
  const percent = Math.min(
    100,
    Math.floor((progress.loaded / progress.total) * 100),
  );
  return `A preparar o motor de PDF… ${String(percent)} %`;
}
