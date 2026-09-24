const CACHE = 'my-minute-shell-v37-delete-safe';
const ASSETS = ['./','./index.html','./flex-styles.css','./mvp.css','./core.js','./flex-core.js','./flex-app.js','./icon.svg','./manifest.webmanifest','./apple-touch-icon.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith('minute-shell-') || key.startsWith('my-minute-shell-')) && key !== CACHE).map(key => caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if(response.ok) { const clone=response.clone(); event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,clone))); }
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached || (event.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
