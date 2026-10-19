const CACHE_NAME = 'ansho-loop-v2-identity-fix';
const SHARE_CACHE = 'ansho-loop-share-v1';
const BASE_URL = new URL('./', self.location.href);
const SHARE_DATA_URL = new URL('./__shared_data__', BASE_URL).href;
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png']
  .map(path => new URL(path, BASE_URL).href);
const INDEX_URL = new URL('./index.html', BASE_URL).href;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME && key !== SHARE_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Google Keep share requests: store the body in Cache Storage, then redirect to app root.
  if (request.method === 'POST' && url.pathname.endsWith('/share/')) {
    event.respondWith((async () => {
      const form = await request.formData();
      const data = {
        title: String(form.get('title') || ''),
        text: String(form.get('text') || ''),
        url: String(form.get('url') || '')
      };
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(SHARE_DATA_URL, new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }));
      return Response.redirect(BASE_URL.href, 303);
    })());
    return;
  }

  // Read the shared payload from Cache Storage, not from the GitHub Pages network.
  if (request.method === 'GET' && url.href === SHARE_DATA_URL) {
    event.respondWith((async () => {
      const cache = await caches.open(SHARE_CACHE);
      return (await cache.match(SHARE_DATA_URL)) || new Response('', { status: 404 });
    })());
    return;
  }

  if (request.method !== 'GET') return;
  event.respondWith(
    fetch(request).catch(() => caches.match(request).then(response => response ||
      (request.mode === 'navigate' ? caches.match(INDEX_URL) : undefined)))
  );
});
