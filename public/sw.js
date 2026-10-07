const CACHE='dentatest-shell-v34';
const SHELL=['/','/index.html','/style.css','/app.js','/manifest.webmanifest','/dentatest-logo.svg','/dentatest-favicon.svg','/login.html'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.origin!==location.origin||url.pathname.startsWith('/api/'))return;
  event.respondWith((event.request.mode==='navigate'||url.pathname==='/'||url.pathname==='/index.html'||url.pathname==='/app.js'||url.pathname==='/style.css')?fetch(event.request,{cache:'no-store'}).then(response=>{const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(c=>c||caches.match('/'))):caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return response}).catch(()=>caches.match('/'))));
});