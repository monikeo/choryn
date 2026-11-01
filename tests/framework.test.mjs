import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';

const root=process.env.CHORYN_SOURCE_ROOT;
assert.ok(root,'Run this suite through npm test.');
const dist=resolve(root,'dist'),worker=await readFile(resolve(dist,'sw.js'),'utf8');
const shell=JSON.parse(worker.match(/const SHELL=(\[[\s\S]*?\]);/)[1]);
const integrity=JSON.parse(worker.match(/const EXPECTED=([^;]+);/)[1]);
const local=path=>resolve(dist,path==='/'?'index.html':path==='/offline'?'offline.html':'.'+path);
const walk=async dir=>(await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(resolve(dir,e.name)):[resolve(dir,e.name)]))).flat();

test('the production entry is Next.js output with CHORYN metadata, hydration and install icons',async()=>{
 const html=await readFile(resolve(dist,'index.html'),'utf8');
 assert.match(html,/_next\/static\/chunks\/app\/page-/);
 assert.match(html,/self\.__next_f/);
 assert.match(html,/id="app"/);assert.match(html,/id="dialog"/);
 assert.match(html,/name="application-name" content="CHORYN"/);
 assert.match(html,/name="choryn-build" content="[a-f0-9]{16}"/);
 assert.match(html,/<link[^>]*rel="manifest"[^>]*crossorigin="use-credentials"/);
 for(const size of [120,152,167,180])assert.ok(html.includes('/icons/apple-touch-icon-'+size+'.png'));
 assert.doesNotMatch(html,/src="\/src\/boot\.js"/);
});

test('the generated offline manifest hashes runtime assets and lazy chunks without unused error routes',async()=>{
 for(const file of await walk(dist)){
  const path='/'+relative(dist,file).split(sep).join('/');if(path==='/sw.js')continue;
  if(/^\/(?:404|_not-found)(?:[/.]|$)/.test(path)){assert.equal(shell.includes(path),false);continue;}
  assert.ok(shell.includes(path),'Not cached: '+path);
  assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),integrity[path],path);
 }
 const scripts=shell.filter(p=>p.startsWith('/_next/')&&p.endsWith('.js'));
 const bodies=await Promise.all(scripts.map(p=>readFile(local(p),'utf8')));
 assert.ok(bodies.some(s=>s.includes('3D stage preview')),'3D lazy chunk missing');
 assert.ok(bodies.some(s=>s.includes('MP4 encoding returned an empty file')),'MP4 lazy chunk missing');
 assert.ok(bodies.some(s=>s.includes('mediabunny')),'Pinned media library chunk missing');
});

test('the actual Next.js worker installs its complete build and serves root and lazy bundles offline',async()=>{
 const origin='https://choryn.example',events={},stores=new Map(),clones=[];let offline=false;
 const originalClone=Response.prototype.clone;
 Response.prototype.clone=function(){const copy=originalClone.call(this);clones.push(copy);return copy;};
 try{
  const caches={async open(key){if(!stores.has(key))stores.set(key,new Map());const entries=stores.get(key);return {async keys(){return [...entries.keys()].map(p=>new Request(origin+p));},async match(p){return entries.get(typeof p==='string'?p:new URL(p.url).pathname)?.clone();},async put(p,response){entries.set(typeof p==='string'?p:new URL(p.url).pathname,response.clone());}};},async keys(){return [...stores.keys()];},async delete(key){return stores.delete(key);}};
  class RelativeRequest extends Request{constructor(input,options){super(new URL(typeof input==='string'?input:input.url,origin),options);}}
  const fetch=async request=>{assert.equal(offline,false,'Attempted network while offline');const url=new URL(request.url);if(/^\/(?:404|_not-found)(?:[/.]|$)/.test(url.pathname))return new Response('Canonical error route',{status:307,headers:{location:origin+'/_not-found'}});const type=url.pathname.endsWith('.js')?'application/javascript':url.pathname.endsWith('.css')?'text/css':['/','/index.html','/offline.html','/offline'].includes(url.pathname)?'text/html':'application/octet-stream',response=new Response(await readFile(local(url.pathname)),{headers:{'content-type':type}});Object.defineProperty(response,'url',{value:url.href});return response;};
  vm.runInNewContext(worker,{self:{location:new URL(origin),addEventListener:(type,handler)=>events[type]=handler,clients:{claim:async()=>{},matchAll:async()=>[{url:origin+'/'}]},skipWaiting(){}},caches,Request:RelativeRequest,Response,URL,crypto:webcrypto,fetch,Set,Promise});
  let installing;events.install({waitUntil:p=>installing=p});await installing;
  assert.equal([...stores.values()][0].size,shell.length);offline=true;
  for(const path of ['/',...shell.filter(p=>p.startsWith('/_next/')&&p.endsWith('.js'))]){let response;events.fetch({request:new RelativeRequest(path),respondWith:p=>response=p});assert.equal((await response).status,200,path);}
 }finally{Response.prototype.clone=originalClone;}
});

test('application modules are TypeScript and third-party media retains its matching declarations and notices',async()=>{
 const names=await readdir(resolve(root,'src'));
 assert.deepEqual(names.filter(n=>n.endsWith('.js')),['mediabunny.js']);
 for(const name of ['app','engine','stage2d','stage3d','ensemble-model','video','view-video'])assert.ok(names.includes(name+'.ts'));
 for(const name of ['mediabunny.d.ts','mediabunny.LICENSE.txt','mediabunny.NOTICE.txt'])assert.ok(names.includes(name));
 const config=JSON.parse(await readFile(resolve(root,'tsconfig.json'),'utf8'));
 assert.equal(config.compilerOptions.allowJs,false);
 const next=await readFile(resolve(root,'next.config.ts'),'utf8');assert.match(next,/output: 'export'/);assert.doesNotMatch(next,/ignoreBuildErrors/);
});
