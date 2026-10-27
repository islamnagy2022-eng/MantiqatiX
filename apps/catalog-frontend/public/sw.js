const CACHE_NAME = 'mantiqatix-catalog-shell-v2';
const APP_SHELL = [
  '/MantiqatiX/catalog-app/',
  '/MantiqatiX/catalog-app/manifest.webmanifest',
  '/MantiqatiX/catalog-app/icons/mantiqatix.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('mantiqatix-catalog-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && (event.request.mode === 'navigate' || APP_SHELL.includes(new URL(event.request.url).pathname))) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? caches.match('/MantiqatiX/catalog-app/') : undefined))
  );
});
