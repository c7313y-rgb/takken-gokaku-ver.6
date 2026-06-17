const CACHE = 'takken-normal-mobile-2026-v5';
const CORE = ['./','./index.html','./styles.css','./data.js','./app.js','./manifest.json','./assets/icon-192.png','./assets/icon-512.png','./assets/hero.svg','./assets/coach.svg'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(()=>self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put('./index.html',c));return r;}).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(event.request,c));}return r;})));
});
