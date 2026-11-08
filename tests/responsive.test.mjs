import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash,webcrypto} from 'node:crypto';
import {shouldDismiss,bindSheetGesture} from '../src/sheet-gesture.js';
import {createPWAManager} from '../src/pwa.js';
import {looksLikeTrackpad,createWheelClassifier,setWheelPreference,wheelPreference,bindGesturePinch,bindTouchPinch,bindLongPress} from '../src/input-gestures.js';

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

// ---- Mouse, trackpad and touch input ---------------------------------------

test('wheel events are classified by device the way platforms report them',()=>{
 assert.equal(looksLikeTrackpad({deltaMode:0,deltaX:0,deltaY:100,wheelDeltaY:-120}),false,'Chromium/WebKit mouse notch');
 assert.equal(looksLikeTrackpad({deltaMode:1,deltaX:0,deltaY:3}),false,'Firefox line-mode mouse');
 assert.equal(looksLikeTrackpad({deltaMode:0,deltaX:0,deltaY:8,wheelDeltaY:-24}),true,'trackpad pixels');
 assert.equal(looksLikeTrackpad({deltaMode:0,deltaX:2,deltaY:9}),true,'two-axis movement');
 assert.equal(looksLikeTrackpad({deltaMode:0,deltaX:0,deltaY:2.5}),true,'fractional pixels without legacy deltas');
 assert.equal(looksLikeTrackpad({deltaMode:0,deltaX:0,deltaY:120}),false,'large integer steps without legacy deltas');
});

test('a wheel burst keeps its first classification, pinch always zooms and the preference overrides detection',()=>{
 let now=0;const pans=createWheelClassifier(()=>now);
 try{
  assert.equal(pans({deltaMode:0,deltaY:100,wheelDeltaY:-120}),false);
  now+=16;assert.equal(pans({deltaMode:0,deltaY:6,wheelDeltaY:-18}),false,'momentum within a mouse burst stays a zoom');
  now+=500;assert.equal(pans({deltaMode:0,deltaY:6,wheelDeltaY:-18}),true);
  now+=16;assert.equal(pans({deltaMode:0,deltaY:40,wheelDeltaY:-120}),true,'a fast swipe stays a pan');
  assert.equal(pans({deltaMode:0,deltaY:-4,ctrlKey:true}),false,'Ctrl/pinch zooms');
  assert.equal(setWheelPreference('mouse'),'mouse');now+=500;assert.equal(pans({deltaMode:0,deltaX:3,deltaY:6}),false);
  setWheelPreference('trackpad');now+=500;assert.equal(pans({deltaMode:1,deltaY:3}),true);
  assert.equal(setWheelPreference('nonsense'),'auto');assert.equal(wheelPreference(),'auto');
 }finally{setWheelPreference('auto');}
});

// Own properties shadow Event's read-only getters (target, clientX…).
const emit=(target,type,props={})=>{const event=new Event(type,{cancelable:true});for(const [key,value] of Object.entries(props))Object.defineProperty(event,key,{value,configurable:true});target.dispatchEvent(event);return event;};

test('Safari trackpad pinch reports incremental zoom factors around the pointer',()=>{
 const surface=new EventTarget(),factors=[];bindGesturePinch(surface,(factor,x,y)=>factors.push([+factor.toFixed(3),x,y]));
 assert.equal(emit(surface,'gesturestart',{scale:1}).defaultPrevented,true);
 emit(surface,'gesturechange',{scale:1.5,clientX:10,clientY:20});emit(surface,'gesturechange',{scale:1.2,clientX:12,clientY:20});emit(surface,'gestureend',{scale:1.2});
 emit(surface,'gesturechange',{scale:3});
 assert.deepEqual(factors,[[1.5,10,20],[.8,12,20]]);
});

test('two-finger touch pinch reports scale from the start of the pinch',()=>{
 const surface=new EventTarget(),changes=[];let started=0,ended=0;
 bindTouchPinch(surface,{start:()=>started++,change:(scale,center)=>changes.push([+scale.toFixed(2),center]),end:()=>ended++});
 const pair=(a,b)=>[{clientX:a,clientY:0},{clientX:b,clientY:0}];
 emit(surface,'touchstart',{touches:pair(100,200)});
 assert.equal(emit(surface,'touchmove',{touches:pair(50,250)}).defaultPrevented,true);
 emit(surface,'touchmove',{touches:[{clientX:60,clientY:0}]});emit(surface,'touchend',{touches:[{clientX:60,clientY:0}]});
 assert.deepEqual(changes,[[2,150]]);assert.equal(started,1);assert.equal(ended,1);
});

test('touch long-press opens clip tools once, never from grips, mouse input or a scroll',async()=>{
 const area=new EventTarget(),pressed=[];const clip={dataset:{id:'a'},closest:s=>s==='[data-timeline-kind]'?clip:null},grip={closest:s=>s==='[data-timeline-kind]'?clip:s.includes('data-reorder-grip')?grip:null};
 bindLongPress(area,{selector:'[data-timeline-kind]',ignore:'[data-reorder-grip],[data-drag-time]',onPress:target=>pressed.push(target),delay:20});
 const down=(target,pointerType='touch',id=1)=>emit(area,'pointerdown',{target,pointerType,pointerId:id,clientX:10,clientY:10});
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 down(clip);await wait(40);assert.deepEqual(pressed,[clip]);
 assert.equal(emit(area,'contextmenu',{}).defaultPrevented,true,'Android’s native long-press menu is not opened a second time');
 down(clip,'mouse',2);await wait(40);down(grip,'touch',3);await wait(40);assert.equal(pressed.length,1);
 down(clip,'touch',4);emit(area,'pointermove',{pointerId:4,clientX:40,clientY:10});await wait(40);assert.equal(pressed.length,1,'moving past the slop is a scroll');
});

// ---- Stylesheet order --------------------------------------------------------

// A parser-blocking <head> script runs before any body content exists, so the
// first paint already uses the right theme (Next.js may place its stylesheet
// links ahead of it; the script then simply waits for them).
test('the built page applies the saved or system theme before first paint',async()=>{
 const html=await readFile(resolve(root,'dist/index.html'),'utf8');
 const script=html.indexOf("localStorage.getItem('choryn.theme')"),head=html.indexOf('</head>'),body=html.indexOf('<body');
 assert.ok(script>0,'theme bootstrap is inlined');assert.ok(script<head&&script<body,'it runs inside <head>, before the body exists');
 assert.match(html,/prefers-color-scheme: dark/);
});

test('the responsive layer loads after every feature stylesheet',async()=>{
 const layout=await readFile(resolve(root,'app/layout.tsx'),'utf8');
 const sheets=[...layout.matchAll(/import '\.\.\/src\/([^']+\.css)';/g)].map(m=>m[1]);
 assert.ok(sheets.length>10);assert.equal(sheets.at(-1),'responsive.css');
});
