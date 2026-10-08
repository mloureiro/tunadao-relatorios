import { useEffect, useState } from 'preact/hooks';
import { registerServiceWorker } from './service-worker';

export function UpdateNotice() {
  const [apply, setApply] = useState<(() => void) | null>(null);

  useEffect(() => {
    registerServiceWorker((reload) => {
      setApply(() => reload);
    });
  }, []);

  if (apply === null) return null;
  return (
    <p class="notice notice-info" role="status">
      Nova versão disponível.{' '}
      <button type="button" class="button button-quiet" onClick={apply}>
        Recarregar
      </button>
    </p>
  );
}
