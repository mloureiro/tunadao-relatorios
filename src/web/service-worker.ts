let markSettled: () => void = () => undefined;
const settled = new Promise<void>((resolve) => {
  markSettled = resolve;
});

export function serviceWorkerSettled(): Promise<void> {
  return settled;
}

export function registerServiceWorker(
  onUpdateReady: (apply: () => void) => void,
): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    markSettled();
    return;
  }
  if (navigator.serviceWorker.controller) markSettled();
  const container = navigator.serviceWorker;
  let applying = false;

  container.addEventListener('controllerchange', () => {
    if (applying) location.reload();
  });

  function offer(waiting: ServiceWorker): void {
    onUpdateReady(() => {
      applying = true;
      waiting.postMessage({ type: 'skip-waiting' });
    });
  }

  function settleOnActivation(registration: ServiceWorkerRegistration): void {
    const worker =
      registration.installing ?? registration.waiting ?? registration.active;
    if (worker?.state === 'activated' || worker === null) {
      markSettled();
      return;
    }
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated' || worker.state === 'redundant') {
        markSettled();
      }
    });
  }

  function watch(registration: ServiceWorkerRegistration): void {
    settleOnActivation(registration);
    if (registration.waiting && container.controller) {
      offer(registration.waiting);
    }
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && container.controller) {
          offer(installing);
        }
      });
    });
  }

  function register(): void {
    container
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then(watch)
      .catch((error: unknown) => {
        markSettled();
        console.error('Não foi possível ativar o modo offline:', error);
      });
  }

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
}
