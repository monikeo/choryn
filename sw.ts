/// <reference lib="webworker" />
declare const __SHELL_PATHS__:string[];
declare const __SHELL_INTEGRITY__:Record<string,string>;
const worker=self as unknown as ServiceWorkerGlobalScope;
// Build injects the complete shell hash and per-asset SHA-256 checksums.
const CACHE='choryn-shell-__BUILD_VERSION__';
const SHELL=__SHELL_PATHS__;
const EXPECTED=__SHELL_INTEGRITY__;
const allowed=new Set(SHELL);
const HTML_PATHS=['/','/index.html','/offline.html','/offline'];
// `make` returns a new response for each caller. Verified bodies are read
// exactly once and replayed from memory, so caching and responding never
// depend on tee'd clones (which some runtimes cancel during collection).
type Checked={ok:boolean;make:()=>Response};
async function verify(response:Response,path:string):Promise<Checked>{
 const untouched={ok:false,make:()=>response};
 if(!response.ok||!response.url||!EXPECTED[path])return untouched;
 const finalURL=new URL(response.url);
 if(finalURL.origin!==worker.location.origin||response.redirected&&!(finalURL.pathname===({'/index.html':'/','/offline.html':'/offline'})[path]&&!finalURL.search))return untouched;
 const type=response.headers.get('content-type')||'',html=HTML_PATHS.includes(path);
 if(html&&!/text\/html/.test(type))return untouched;
 if(path.endsWith('.js')&&!/javascript/.test(type)||path.endsWith('.css')&&!/text\/css/.test(type))return untouched;
 const bytes=await response.arrayBuffer(),init={status:response.status,statusText:response.statusText,headers:response.headers};
 const make=()=>new Response(bytes.slice(0),init);
 // Hosting adds request-specific security scripts to HTML. Preserve those
 // responses unchanged and verify our build tag; keep exact hashes for assets.
 if(html){
  const text=await make().text(),version=CACHE.replace('choryn-shell-','');
  return {ok:text.includes('name="application-name" content="CHORYN"')&&text.includes(`name="choryn-build" content="${version}"`),make};
 }
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return {ok:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')===EXPECTED[path],make};
}
async function cachedPaths(cache:Cache){return new Set((await cache.keys()).map(request=>new URL(request.url,worker.location.origin).pathname));}
async function prepare(paths:string[]){
 const results=new Map<string,Response>();let cursor=0,failure;
 await Promise.all(Array.from({length:Math.min(6,paths.length)},async()=>{while(cursor<paths.length){const path=paths[cursor++];try{const checked=await verify(await fetch(new Request(path,{credentials:'same-origin',cache:'reload'})),path);if(!checked.ok)throw Error('The online application changed or requires sign-in. Check for updates while online.');results.set(path,checked.make());}catch(error){failure||=error;}}}));
 if(failure)throw failure;return results;
}
worker.addEventListener('install',event=>{event.waitUntil((async()=>{
 try{const responses=await prepare(SHELL),cache=await caches.open(CACHE);for(const [path,response] of responses)await cache.put(path,response);}
 catch(error){await caches.delete(CACHE);throw error;}
})());});
worker.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('choryn-shell-')&&key!==CACHE)await caches.delete(key);await worker.clients.claim();})());});
worker.addEventListener('message',event=>{
 const reply=(value:unknown)=>event.ports?.[0]?.postMessage(value);
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
 }catch(error){reply({ok:false,error:error instanceof Error&&error.message?error.message:'Offline preparation could not finish.'});}})());
});
worker.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==worker.location.origin||!allowed.has(url.pathname)||url.search)return;
 event.respondWith((async()=>{
  let cache;try{cache=await caches.open(CACHE);const cached=await cache.match(url.pathname);if(cached)return cached;}catch{}
  try{const checked=await verify(await fetch(event.request),url.pathname);if(checked.ok){try{await cache?.put(url.pathname,checked.make());}catch{}return checked.make();}
   if(event.request.mode==='navigate')return checked.make();
   return new Response('This app asset does not match the installed version. Reconnect and check for updates.',{status:503});
  }catch{return event.request.mode==='navigate'?(await cache?.match('/offline.html'))||new Response('Open CHORYN online once to prepare offline rehearsal.',{status:503}):new Response('Asset unavailable offline',{status:503});}
 })());
});
