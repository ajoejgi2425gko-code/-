const CACHE_NAME = 'audio-memorization-pwa-v7';
const SHARE_CACHE = 'audio-memorization-share-v1';
const SHARE_DATA_URL = new URL('./__shared_data__', self.location.href).href;
const BASE_URL = new URL('./', self.location.href);
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './favicon.png'
].map(path => new URL(path, BASE_URL).href);
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
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method === 'POST' && requestUrl.origin === self.location.origin && requestUrl.pathname.endsWith('/share/')) {
    event.respondWith((async () => {
      const form = await event.request.formData();
      const value = {
        title: String(form.get('title') || ''),
        text: String(form.get('text') || ''),
        url: String(form.get('url') || '')
      };
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(SHARE_DATA_URL, new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json; charset=utf-8' } }));
      return Response.redirect(BASE_URL.href, 303);
    })());
    return;
  }
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // The share payload is stored in Cache Storage by the POST handler.
  // Serve it from that cache directly; a normal network fetch would return
  // GitHub Pages' 404 page and prevent the app from reading the saved payload.
  if (url.href === SHARE_DATA_URL) {
    event.respondWith((async () => {
      const cache = await caches.open(SHARE_CACHE);
      return (await cache.match(SHARE_DATA_URL)) || new Response('', { status: 404 });
    })());
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then(response => response ||
        (event.request.mode === 'navigate' ? caches.match(INDEX_URL) : undefined))
    )
  );
});
