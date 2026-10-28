// Service worker do Meu Cantinho — deixa o app abrir offline e instalável.
// Para forçar todo mundo a baixar tudo de novo, mude o número da versão abaixo.
const VERSION = 'v1';
const CACHE = 'meu-cantinho-' + VERSION;
const FONTS = 'meu-cantinho-fontes';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(()=>{})))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req, cacheName, timeoutMs){
  return new Promise(resolve => {
    let settled = false;
    const fallback = () => caches.match(req, { ignoreSearch:true }).then(r => r || caches.match('./index.html'));
    const timer = setTimeout(() => { if(!settled) fallback().then(r => { if(r && !settled){ settled = true; resolve(r); } }); }, timeoutMs);
    fetch(req).then(res => {
      if(res && res.ok){ const copy = res.clone(); caches.open(cacheName).then(c => c.put(req, copy)); }
      if(!settled){ settled = true; clearTimeout(timer); resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      if(!settled) fallback().then(r => { settled = true; resolve(r || Response.error()); });
    });
  });
}

function staleWhileRevalidate(req, cacheName){
  return caches.open(cacheName).then(cache =>
    cache.match(req).then(hit => {
      const net = fetch(req).then(res => { if(res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })
  );
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if(url.origin === self.location.origin){
    if(req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')){
      e.respondWith(networkFirst(req, CACHE, 3500));
    } else {
      e.respondWith(staleWhileRevalidate(req, CACHE));
    }
  } else if(url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'){
    e.respondWith(staleWhileRevalidate(req, FONTS));
  }
  // o resto (APIs de clima, rádios, etc.) passa direto, sem mexer
});
