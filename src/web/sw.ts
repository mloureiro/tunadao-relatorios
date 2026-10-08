declare const __PRECACHE_FILES__: readonly string[];
declare const __CACHE_VERSION__: string;

interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface FetchEvent extends ExtendableEvent {
  readonly request: Request;
  respondWith(response: Promise<Response>): void;
}

interface WorkerScope {
  readonly registration: { readonly scope: string };
  readonly clients: { claim(): Promise<void> };
  skipWaiting(): Promise<void>;
  addEventListener(
    type: 'install' | 'activate',
    listener: (event: ExtendableEvent) => void,
  ): void;
  addEventListener(type: 'fetch', listener: (event: FetchEvent) => void): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
}

const worker = self as unknown as WorkerScope;
const CACHE_PREFIX = 'tunadao-relatorios-';
const CACHE_NAME = `${CACHE_PREFIX}${__CACHE_VERSION__}`;
const scope = worker.registration.scope;
const indexUrl = new URL('index.html', scope).href;

async function precache(): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(
    __PRECACHE_FILES__.map((file) => new URL(file, scope).href),
  );
}

async function dropOldCaches(): Promise<void> {
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)),
  );
  await worker.clients.claim();
}

async function answer(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, {
    ignoreSearch: true,
    ignoreVary: true,
  });
  if (cached) return cached;

  const page =
    request.mode === 'navigate' ? await cache.match(indexUrl) : undefined;
  if (page) return page;

  return fetch(request);
}

worker.addEventListener('install', (event) => {
  event.waitUntil(precache());
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(dropOldCaches());
});

worker.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method === 'GET' && request.url.startsWith(scope)) {
    event.respondWith(answer(request));
  }
});

worker.addEventListener('message', (event) => {
  const message = event.data as { type?: unknown } | null;
  if (message?.type === 'skip-waiting') void worker.skipWaiting();
});
