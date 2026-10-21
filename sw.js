// Build injects the complete shell hash and per-asset SHA-256 checksums.
const CACHE='choryn-shell-__BUILD_VERSION__';
const SHELL=['/src/branding.css','/icons/choryn-mark-light.svg','/icons/choryn-mark-dark.svg','/icons/choryn-app-mark-light.svg','/icons/choryn-app-mark-dark.svg','/icons/icon-dark-192.png','/icons/icon-maskable-512.png','/icons/favicon-32.png','/src/mp4-export.js','/src/mediabunny.js','/src/mediabunny.LICENSE.txt','/src/mediabunny.NOTICE.txt','/src/image-export-model.js','/src/image-exports.js','/src/image-exports.css','/src/zip.js','/src/analysis-model.js','/src/analysis-view.js','/src/command-model.js','/src/workbench.js','/src/workbench.css','/src/view-image.js','/src/timeline-tools.js','/','/index.html','/offline.html','/manifest.json','/favicon.svg','/icons/icon-192.png','/icons/icon-512.png','/icons/apple-touch-icon.png','/src/compat.css','/src/compat.js','/src/stage-view.js','/src/workspace.css','/src/prop-motion.js','/src/music-model.js','/src/curve-edit.js','/src/score-tools.js','/src/score.css','/src/adaptive.css','/src/playback-view.js','/src/playback-pacer.js','/src/rehearsal-model.js','/src/rehearsal-tools.js','/src/reference-store.js','/src/view-video.js','/src/rehearsal.css','/src/boot.js','/src/errors.js','/src/app.js','/src/engine.js','/src/icons.js','/src/styles.css','/src/native.css','/src/features.css','/src/features.js','/src/production-model.js','/src/backups.js','/src/revisions.js','/src/pwa.js','/src/stage3d.js','/src/stage2d.js','/src/exports.js','/src/editing.js','/src/colors.js','/src/power.css','/src/studio-power.js','/src/timeline-model.js','/src/video.js','/src/timeline-ui.js','/src/mouse-model.js','/src/templates.js','/favicon.ico','/apple-touch-icon.png','/src/pwa-ui.js','/src/pwa.css','/icons/apple-touch-icon-120.png','/icons/apple-touch-icon-152.png','/icons/apple-touch-icon-167.png','/icons/apple-touch-icon-180.png','/icons/favicon-16.png','/icons/favicon-48.png','/icons/icon-1024.png','/icons/icon-128.png','/icons/icon-256.png','/icons/icon-96.png','/icons/icon-maskable-192.png'];
const EXPECTED=__SHELL_INTEGRITY__;
const allowed=new Set(SHELL);
async function acceptable(response,path){
 if(!response.ok||!response.url||!EXPECTED[path])return false;
 const finalURL=new URL(response.url);
 if(finalURL.origin!==self.location.origin||response.redirected&&!(path==='/index.html'&&finalURL.pathname==='/'&&!finalURL.search))return false;
 const type=response.headers.get('content-type')||'';
 // Hosting adds request-specific security scripts to HTML. Preserve those
 // responses unchanged and verify our build tag; keep exact hashes for assets.
 if(['/','/index.html','/offline.html'].includes(path)){
  if(!/text\/html/.test(type))return false;
  const html=await response.clone().text(),version=CACHE.replace('choryn-shell-','');
  return html.includes('name="application-name" content="CHORYN"')&&html.includes(`name="choryn-build" content="${version}"`);
 }
 if(path.endsWith('.js')&&!/javascript/.test(type)||path.endsWith('.css')&&!/text\/css/.test(type))return false;
 const bytes=await response.clone().arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')===EXPECTED[path];
}
async function cachedPaths(cache){return new Set((await cache.keys()).map(request=>new URL(request.url,self.location.origin).pathname));}
async function prepare(paths){
 const results=new Map();let cursor=0,failure;
 await Promise.all(Array.from({length:Math.min(6,paths.length)},async()=>{while(cursor<paths.length){const path=paths[cursor++];try{const response=await fetch(new Request(path,{credentials:'same-origin',cache:'reload'}));if(!await acceptable(response,path))throw Error('The online application changed or requires sign-in. Check for updates while online.');results.set(path,response);}catch(error){failure||=error;}}}));
 if(failure)throw failure;return results;
}
self.addEventListener('install',event=>{event.waitUntil((async()=>{
 try{const responses=await prepare(SHELL),cache=await caches.open(CACHE);for(const [path,response] of responses)await cache.put(path,response);}
 catch(error){await caches.delete(CACHE);throw error;}
})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('choryn-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('message',event=>{
 const reply=value=>event.ports?.[0]?.postMessage(value);
 if(!['CACHE_STATUS','REPAIR_OFFLINE','ACTIVATE_UPDATE'].includes(event.data?.type))return;
 event.waitUntil((async()=>{try{
  if(event.data.type==='ACTIVATE_UPDATE'){
   const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
   const tabs=clients.filter(client=>{const url=new URL(client.url);return url.origin===self.location.origin&&['/','/index.html'].includes(url.pathname);});
   if(tabs.length>1){reply({ok:false,error:'Close other CHORYN tabs or windows, then try Save and update again.'});return;}
   await self.skipWaiting();reply({ok:true});return;
  }
  const cache=await caches.open(CACHE);let found=await cachedPaths(cache);
  if(event.data.type==='REPAIR_OFFLINE'){
   const missing=SHELL.filter(path=>!found.has(path));const responses=await prepare(missing);
   for(const [path,response] of responses)await cache.put(path,response);found=await cachedPaths(cache);
  }
  const count=SHELL.filter(path=>found.has(path)).length;reply({ok:true,version:CACHE.replace('choryn-shell-',''),cached:count,total:SHELL.length,complete:count===SHELL.length});
 }catch(error){reply({ok:false,error:error.message||'Offline preparation could not finish.'});}})());
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!allowed.has(url.pathname)||url.search)return;
 event.respondWith((async()=>{
  let cache;try{cache=await caches.open(CACHE);const cached=await cache.match(url.pathname);if(cached)return cached;}catch{}
  try{const response=await fetch(event.request);if(await acceptable(response,url.pathname)){try{await cache?.put(url.pathname,response.clone());}catch{}return response;}
   if(event.request.mode==='navigate')return response;
   return new Response('This app asset does not match the installed version. Reconnect and check for updates.',{status:503});
  }catch{return event.request.mode==='navigate'?(await cache?.match('/offline.html'))||new Response('Open CHORYN online once to prepare offline rehearsal.',{status:503}):new Response('Asset unavailable offline',{status:503});}
 })());
});
