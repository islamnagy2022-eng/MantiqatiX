const CACHE='mnty-web-v13';
const APP_SHELL=['./','./index.html','./styles.css','./app.js','./config.js','./brand.css','./brand.js','./home.css','./home.js','./manifest.webmanifest',
'./assets/activity/food.svg','./assets/activity/health.svg','./assets/activity/pharmacy.svg','./assets/activity/labs.svg','./assets/activity/medical.svg','./assets/activity/real-estate.svg','./assets/activity/auto.svg','./assets/activity/home.svg','./assets/activity/education.svg','./assets/activity/digital.svg','./assets/activity/fitness.svg','./assets/activity/travel.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET') return;
 const url=new URL(event.request.url);
 if(url.origin!==location.origin) return;
 if(event.request.mode==='navigate'){
   event.respondWith(fetch(event.request).then(response=>{
     const copy=response.clone(); caches.open(CACHE).then(c=>c.put('./index.html',copy)); return response;
   }).catch(()=>caches.match('./index.html')));
   return;
 }
 event.respondWith(fetch(event.request).then(response=>{
   if(response.ok){const copy=response.clone(); caches.open(CACHE).then(c=>c.put(event.request,copy));}
   return response;
 }).catch(()=>caches.match(event.request)));
});