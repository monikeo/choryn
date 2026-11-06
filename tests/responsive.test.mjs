import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash,webcrypto} from 'node:crypto';
import {shouldDismiss,bindSheetGesture} from '../src/sheet-gesture.js';
import {createPWAManager} from '../src/pwa.js';

const root=process.env.CHORYN_SOURCE_ROOT;

// ---- Phone bottom sheets ---------------------------------------------------

function sheet({phone=true,closeButton=true,scrollTop=0}={}){
 const listeners={},props=new Map(),classes=new Set();let closed=0,now=0;
 const header={closest:s=>s==='.modal-header'?header:null};
 const control={closest:s=>s.includes('button')?control:null};
 const dialog={open:true,scrollTop,offsetHeight:600,
  style:{transition:'',setProperty:(k,v)=>props.set(k,v),removeProperty:k=>props.delete(k)},
  classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},
  addEventListener:(type,fn)=>listeners[type]=fn,
  getBoundingClientRect:()=>({left:0,right:390,top:200,bottom:800}),
  querySelector:s=>closeButton&&s==='[data-action="close-dialog"]'?{click(){closed++;dialog.open=false;listeners.close?.();}}:null,
  setPointerCapture(){},releasePointerCapture(){},closest:()=>null};
 bindSheetGesture(dialog,{matchMedia:()=>({matches:phone}),performance:{now:()=>now}});
 const fire=(type,y,target=header)=>listeners[type]?.({pointerId:1,button:0,clientX:100,clientY:y,target});
 const drag=(from,to,ms,target=header)=>{fire('pointerdown',from,target);now+=ms;fire('pointermove',to,target);fire('pointerup',to,target);};
 return {props,classes,drag,header,control,get closed(){return closed;}};
}

test('sheet dismissal needs a deliberate pull or a quick flick',()=>{
 assert.equal(shouldDismiss(0,100,600),false);
 assert.equal(shouldDismiss(60,400,600),false,'slow short drag springs back');
 assert.equal(shouldDismiss(150,600,600),true,'past 140px');
 assert.equal(shouldDismiss(80,600,240),true,'past 30% of a short sheet');
 assert.equal(shouldDismiss(50,50,600),true,'flick');
 assert.equal(shouldDismiss(30,10,600),false,'a fast twitch is not a flick');
});

test('dragging a phone sheet header down presses its own close button',()=>{
 const s=sheet();s.drag(230,560,500);assert.equal(s.closed,1);assert.equal(s.props.size,0);
});

test('a short drag springs the sheet back instead of closing it',()=>{
 const s=sheet();s.drag(230,270,500);assert.equal(s.closed,0);assert.equal(s.props.get('--sheet-drag'),'0px');
});

test('sheet drags never start from controls, scrolled content, larger screens or sheets without a close button',()=>{
 for(const [options,target] of [[{},'control'],[{scrollTop:40},'header'],[{phone:false},'header'],[{closeButton:false},'header']]){
  const s=sheet(options);s.drag(230,700,300,s[target]);
  assert.equal(s.closed,0,JSON.stringify(options)+' '+target);assert.equal(s.props.size,0);
 }
});

// ---- Development server and offline worker ---------------------------------

function device(build){
 let registered=0;
 const registration={active:null,waiting:null,installing:null,addEventListener(){},async update(){}};
 const environment={isSecureContext:true,setTimeout,clearTimeout,MessageChannel:class{},location:{reload(){}},
  document:{visibilityState:'visible',addEventListener(){},querySelector:s=>s==='meta[name="choryn-build"]'?{getAttribute:()=>build}:null},
  window:{addEventListener(){}},matchMedia:()=>({matches:false,addEventListener(){}}),
  navigator:{onLine:true,userAgent:'',serviceWorker:{controller:null,addEventListener(){},async register(){registered++;return registration;}}}};
 return {environment,get registered(){return registered;}};
}

test('npm run dev never requests the production-only offline worker',async()=>{
 const d=device('development'),manager=createPWAManager(d.environment);await manager.setupPWA();
 assert.equal(d.registered,0);assert.equal(manager.pwaState().offlineStatus,'unsupported');assert.match(manager.pwaState().error,/production build/);
 const built=device('0123456789abcdef'),release=createPWAManager(built.environment);await release.setupPWA();
 assert.equal(built.registered,1);
});

test('the offline worker installs, repairs and serves without cloning responses',async()=>{
 const source=await readFile(new URL('../sw.js',import.meta.url),'utf8'),origin='https://studio.example';
 const shell=[...source.match(/const SHELL=(\[[\s\S]*?\]);/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
 const html=p=>['/','/index.html','/offline.html','/offline'].includes(p);
 const body=p=>html(p)?'<meta name="application-name" content="CHORYN"><meta name="choryn-build" content="__BUILD_VERSION__">':'asset '+p;
 const type=p=>p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':html(p)?'text/html':'application/octet-stream';
 const integrity=Object.fromEntries(shell.map(p=>[p,createHash('sha256').update(body(p)).digest('hex')]));
 // The cache stores bytes, so any clone() call can only come from the worker.
 const store=new Map(),events={};let offline=false;
 const key=k=>typeof k==='string'?k:new URL(k.url).pathname;
 const caches={async open(){return {async keys(){return [...store.keys()].map(k=>new Request(origin+k));},async match(k){const v=store.get(key(k));return v&&new Response(v.bytes.slice(0),{headers:v.headers});},async put(k,r){store.set(key(k),{bytes:await r.arrayBuffer(),headers:r.headers});}};},async keys(){return [];},async delete(){return true;}};
 class RelativeRequest extends Request{constructor(input,options){super(new URL(typeof input==='string'?input:input.url,origin),options);}}
 const fetch=async request=>{if(offline)throw Error('Offline');const path=new URL(request.url).pathname,response=new Response(body(path),{headers:{'content-type':type(path)}});Object.defineProperty(response,'url',{value:origin+path});return response;};
 const clone=Response.prototype.clone;
 Response.prototype.clone=function(){throw Error('The worker must not depend on Response.clone()');};
 try{
  vm.runInNewContext(source.replace('__SHELL_INTEGRITY__',JSON.stringify(integrity)),{self:{location:new URL(origin),addEventListener:(t,h)=>events[t]=h,clients:{claim:async()=>{},matchAll:async()=>[]},skipWaiting(){}},caches,URL,Request:RelativeRequest,Response,fetch,Set,Promise,crypto:webcrypto});
  let pending;events.install({waitUntil:p=>pending=p});await pending;
  assert.equal(store.size,shell.length);
  store.delete('/src/app.js');let served;
  events.fetch({request:new RelativeRequest('/src/app.js'),respondWith:p=>served=p});
  assert.equal(await (await served).text(),body('/src/app.js'));assert.ok(store.has('/src/app.js'),'a verified network asset is cached');
  offline=true;
  events.fetch({request:new RelativeRequest('/'),respondWith:p=>served=p});assert.match(await (await served).text(),/choryn-build/);
 }finally{Response.prototype.clone=clone;}
});

// ---- Stylesheet order --------------------------------------------------------

test('the responsive layer loads after every feature stylesheet',async()=>{
 const layout=await readFile(resolve(root,'app/layout.tsx'),'utf8');
 const sheets=[...layout.matchAll(/import '\.\.\/src\/([^']+\.css)';/g)].map(m=>m[1]);
 assert.ok(sheets.length>10);assert.equal(sheets.at(-1),'responsive.css');
});
