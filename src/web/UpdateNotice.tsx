import { useEffect, useState } from 'preact/hooks';
import { registerServiceWorker } from './service-worker';

export function UpdateNotice({
  announce,
}: {
  readonly announce: (message: string) => void;
}) {
  const [apply, setApply] = useState<(() => void) | null>(null);

  useEffect(() => {
    registerServiceWorker((reload) => {
      setApply(() => reload);
      announce('Nova versão disponível.');
    });
  }, [announce]);

  if (apply === null) return null;
  return (
    <p class="notice notice-info">
      Nova versão disponível.{' '}
      <button type="button" class="button button-quiet" onClick={apply}>
        Recarregar
      </button>
    </p>
  );
}
