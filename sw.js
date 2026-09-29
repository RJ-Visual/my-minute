const CACHE = 'my-minute-shell-v41-calendar-todos';
const ASSETS = ['./','./index.html','./flex-styles.css','./mvp.css','./core.js','./flex-core.js','./calendar-service.js','./flex-app.js','./icon.svg','./manifest.webmanifest','./apple-touch-icon.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith('minute-shell-') || key.startsWith('my-minute-shell-')) && key !== CACHE).map(key => caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if(response.ok) { const clone=response.clone(); event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,clone))); }
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached || (event.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{};}catch{}
  event.waitUntil(self.registration.showNotification(data.title||'My Minute',{body:data.body||'Your planned moment is coming up.',icon:'./icon-192.png',badge:'./icon-192.png',tag:data.tag||'my-minute',data:{url:'./index.html'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();const target=new URL('./index.html',self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const client=clients.find(c=>c.url.startsWith(self.registration.scope));if(client)return client.focus();return self.clients.openWindow(target);}));
});
