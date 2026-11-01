/// <reference lib="webworker" />
declare const __SHELL_PATHS__:string[];
declare const __SHELL_INTEGRITY__:Record<string,string>;
const worker=self as unknown as ServiceWorkerGlobalScope;
// Build injects the complete shell hash and per-asset SHA-256 checksums.
const CACHE='choryn-shell-__BUILD_VERSION__';
const SHELL=__SHELL_PATHS__;
const EXPECTED=__SHELL_INTEGRITY__;
const allowed=new Set(SHELL);
async function acceptable(response,path){
 if(!response.ok||!response.url||!EXPECTED[path])return false;
 const finalURL=new URL(response.url);
 if(finalURL.origin!==worker.location.origin||response.redirected&&!(finalURL.pathname===({'/index.html':'/','/offline.html':'/offline'})[path]&&!finalURL.search))return false;
 const type=response.headers.get('content-type')||'';
 // Hosting adds request-specific security scripts to HTML. Preserve those
 // responses unchanged and verify our build tag; keep exact hashes for assets.
 if(['/','/index.html','/offline.html','/offline'].includes(path)){
  if(!/text\/html/.test(type))return false;
  const html=await response.clone().text(),version=CACHE.replace('choryn-shell-','');
  return html.includes('name="application-name" content="CHORYN"')&&html.includes(`name="choryn-build" content="${version}"`);
 }
 if(path.endsWith('.js')&&!/javascript/.test(type)||path.endsWith('.css')&&!/text\/css/.test(type))return false;
 const bytes=await response.clone().arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')===EXPECTED[path];
}
async function cachedPaths(cache){return new Set((await cache.keys()).map(request=>new URL(request.url,worker.location.origin).pathname));}
async function prepare(paths){
 const results=new Map();let cursor=0,failure;
 await Promise.all(Array.from({length:Math.min(6,paths.length)},async()=>{while(cursor<paths.length){const path=paths[cursor++];try{const response=await fetch(new Request(path,{credentials:'same-origin',cache:'reload'}));if(!await acceptable(response,path))throw Error('The online application changed or requires sign-in. Check for updates while online.');results.set(path,response);}catch(error){failure||=error;}}}));
 if(failure)throw failure;return results;
}
worker.addEventListener('install',event=>{event.waitUntil((async()=>{
 try{const responses=await prepare(SHELL),cache=await caches.open(CACHE);for(const [path,response] of responses)await cache.put(path,response);}
 catch(error){await caches.delete(CACHE);throw error;}
})());});
worker.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('choryn-shell-')&&key!==CACHE)await caches.delete(key);await worker.clients.claim();})());});
worker.addEventListener('message',event=>{
 const reply=value=>event.ports?.[0]?.postMessage(value);
 if(!['CACHE_STATUS','REPAIR_OFFLINE','ACTIVATE_UPDATE'].includes(event.data?.type))return;
 event.waitUntil((async()=>{try{
  if(event.data.type==='ACTIVATE_UPDATE'){
   const clients=await worker.clients.matchAll({type:'window',includeUncontrolled:true});
   const tabs=clients.filter(client=>{const url=new URL(client.url);return url.origin===worker.location.origin&&['/','/index.html'].includes(url.pathname);});
   if(tabs.length>1){reply({ok:false,error:'Close other CHORYN tabs or windows, then try Save and update again.'});return;}
   await worker.skipWaiting();reply({ok:true});return;
  }
  const cache=await caches.open(CACHE);let found=await cachedPaths(cache);
  if(event.data.type==='REPAIR_OFFLINE'){
   const missing=SHELL.filter(path=>!found.has(path));const responses=await prepare(missing);
   for(const [path,response] of responses)await cache.put(path,response);found=await cachedPaths(cache);
  }
  const count=SHELL.filter(path=>found.has(path)).length;reply({ok:true,version:CACHE.replace('choryn-shell-',''),cached:count,total:SHELL.length,complete:count===SHELL.length});
 }catch(error){reply({ok:false,error:error.message||'Offline preparation could not finish.'});}})());
});
worker.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==worker.location.origin||!allowed.has(url.pathname)||url.search)return;
 event.respondWith((async()=>{
  let cache;try{cache=await caches.open(CACHE);const cached=await cache.match(url.pathname);if(cached)return cached;}catch{}
  try{const response=await fetch(event.request);if(await acceptable(response,url.pathname)){try{await cache?.put(url.pathname,response.clone());}catch{}return response;}
   if(event.request.mode==='navigate')return response;
   return new Response('This app asset does not match the installed version. Reconnect and check for updates.',{status:503});
  }catch{return event.request.mode==='navigate'?(await cache?.match('/offline.html'))||new Response('Open CHORYN online once to prepare offline rehearsal.',{status:503}):new Response('Asset unavailable offline',{status:503});}
 })());
});
