// Build replaces this marker with a hash of the complete application shell.
const CACHE='choryn-shell-__BUILD_VERSION__';
const SHELL=['/','/index.html','/offline.html','/manifest.json','/favicon.svg','/icons/icon-192.png','/icons/icon-512.png','/icons/apple-touch-icon.png','/src/compat.css','/src/compat.js','/src/stage-view.js','/src/workspace.css','/src/prop-motion.js','/src/music-model.js','/src/curve-edit.js','/src/score-tools.js','/src/score.css','/src/adaptive.css','/src/playback-view.js','/src/playback-pacer.js','/src/boot.js','/src/errors.js','/src/app.js','/src/engine.js','/src/icons.js','/src/styles.css','/src/native.css','/src/features.css','/src/features.js','/src/production-model.js','/src/backups.js','/src/revisions.js','/src/pwa.js','/src/stage3d.js','/src/stage2d.js','/src/exports.js','/src/editing.js','/src/colors.js','/src/power.css','/src/studio-power.js','/src/timeline-model.js','/src/video.js','/src/timeline-ui.js','/src/mouse-model.js','/src/templates.js'];
const allowed=new Set(SHELL);
async function acceptable(response,path){
  if(!response.ok||response.redirected||new URL(response.url).origin!==self.location.origin)return false;
  const type=response.headers.get('content-type')||'';
  if(path.endsWith('.js')&&!/javascript/.test(type))return false;
  if(path.endsWith('.css')&&!/text\/css/.test(type))return false;
  if(path==='/'||path==='/index.html')return (await response.clone().text()).includes('name="application-name" content="CHORYN"');
  return true;
}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{const cache=await caches.open(CACHE);await Promise.all(SHELL.map(async path=>{const response=await fetch(new Request(path,{credentials:'same-origin',cache:'reload'}));if(!await acceptable(response,path))throw Error('Uncacheable application shell');await cache.put(path,response);}));})());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('choryn-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());
});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!allowed.has(url.pathname)||url.search)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    // A versioned shell stays coherent until the user accepts an update.
    const cached=await cache.match(url.pathname);
    if(cached)return cached;
    try{const response=await fetch(event.request);if(await acceptable(response,url.pathname))await cache.put(url.pathname,response.clone());return response;}
    catch{return event.request.mode==='navigate'?(await cache.match('/offline.html'))||new Response('Open CHORYN online once to prepare offline rehearsal.',{status:503}):new Response('Asset unavailable offline',{status:503});}
  })());
});
