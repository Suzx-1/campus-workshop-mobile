const CACHE='campus-independent-77e04202dbac38fc',BASE=new URL('./',self.location.href),FILES=["","index.html","app.js","style.css","manifest.webmanifest","icon.svg","icon-192.png","icon-512.png","icon-maskable.png","device-store.js","device-ui.js","updates.js","updates.css","catalog.json","tools/49671506-9784-4543-922e-c10ccb89ce3d/index.html","tools/49671506-9784-4543-922e-c10ccb89ce3d/style.css","tools/49671506-9784-4543-922e-c10ccb89ce3d/simple.css","tools/49671506-9784-4543-922e-c10ccb89ce3d/icon.svg","tools/49671506-9784-4543-922e-c10ccb89ce3d/parking-simple.js","tools/49671506-9784-4543-922e-c10ccb89ce3d/precise-location.js"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(p=>new URL(p,BASE).href))).catch(async error=>{await caches.delete(CACHE);throw error;})));
self.addEventListener('message',event=>{if(event.data?.type==='APPLY_UPDATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
  const relative=url.pathname.slice(BASE.pathname.length);
  if(relative==='version.json'||relative==='sw.js')return;
  const asset=relative.endsWith('/')?relative+'index.html':relative;if(!FILES.includes(asset))return;
  // A running release uses its complete cache. Updates never mix new scripts into old pages.
  event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(new URL(asset,BASE).href,{ignoreSearch:true}))||fetch(event.request)));
});
