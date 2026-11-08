import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {silentWav,createNativePlayback} from '../src/native-playback.js';
import {prefersShareSheet,saveFile} from '../src/native-share.js';
import {createTapTempo,beatsBetween,createBeatCues,setBeatCueSettings,beatCueSettings} from '../src/tempo-tools.js';
import {bindMultiFingerTap,createPalmGuard} from '../src/input-gestures.js';
import {classifyFile,feedInput,bindFileDrop,consumeLaunchFiles} from '../src/file-drop.js';
import {beatAt} from '../src/engine.js';

const flush=()=>new Promise(r=>setTimeout(r,0));
const defineEvent=(type,props={})=>{const event=new Event(type,{cancelable:true});for(const [key,value] of Object.entries(props))Object.defineProperty(event,key,{value,configurable:true});return event;};

// ---- Wake lock and media controls ------------------------------------------

function device({wakeLock=true,mediaSession=true}={}){
 const doc=new EventTarget();doc.visibilityState='visible';
 const state={requests:0,releases:0,plays:0,pauses:0,actions:new Map(),metadata:null,position:null,playbackState:'none'};
 const sentinel=()=>{const s=new EventTarget();s.release=async()=>{state.releases++;s.dispatchEvent(new Event('release'));};return s;};
 const session={set playbackState(v){state.playbackState=v;},get playbackState(){return state.playbackState;},set metadata(v){state.metadata=v;},setActionHandler(action,fn){if(action==='skipad')throw Error('unsupported');state.actions.set(action,fn);},setPositionState(p){state.position=p;}};
 class Audio{constructor(src){this.src=src;}play(){state.plays++;return Promise.resolve();}pause(){state.pauses++;}setAttribute(){}}
 const environment={document:doc,navigator:{wakeLock:wakeLock?{request:async()=>{state.requests++;return sentinel();}}:undefined,mediaSession:mediaSession?session:undefined},MediaMetadata:class{constructor(v){Object.assign(this,v);}},Audio,Blob,URL:{createObjectURL:()=>'blob:silent',revokeObjectURL(){}}};
 return {environment,state,doc};
}

test('the media-controls bridge is a valid, at least five-second silent WAV',()=>{
 const view=new DataView(silentWav(6,8000)),text=(o,n)=>String.fromCharCode(...new Uint8Array(view.buffer,o,n));
 assert.equal(text(0,4),'RIFF');assert.equal(text(8,4),'WAVE');assert.equal(view.getUint16(22,true),1);assert.equal(view.getUint32(24,true),8000);
 assert.equal(view.getUint32(40,true)/8000,6);assert.ok(new Uint8Array(view.buffer,44).every(v=>v===128));
});

test('playback keeps the screen awake, releases it on pause and re-acquires after returning to the app',async()=>{
 const d=device(),native=createNativePlayback(d.environment);
 native.setPlaying(true);await flush();assert.equal(d.state.requests,1);assert.equal(native.awake,true);assert.equal(d.state.playbackState,'playing');
 native.setPlaying(true);await flush();assert.equal(d.state.requests,1,'one lock per run-through');
 d.doc.visibilityState='hidden';native.awake;// the browser releases locks when hidden
 d.doc.visibilityState='visible';d.doc.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(d.state.requests,1,'still holding the lock');
 native.setPlaying(false);await flush();assert.equal(d.state.releases,1);assert.equal(native.awake,false);assert.equal(d.state.playbackState,'paused');
 d.doc.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(d.state.requests,1,'paused playback never re-locks');
});

test('lock-screen metadata, position and media keys degrade quietly where unsupported',async()=>{
 const d=device(),native=createNativePlayback(d.environment);
 native.setMetadata({title:'Between the lines',artist:'Open diamond'});assert.equal(d.state.metadata.title,'Between the lines');assert.equal(d.state.metadata.album,'CHORYN Studio');
 native.setPosition(96,120,1);assert.deepEqual(d.state.position,{duration:96,position:96,playbackRate:1});
 native.setActions({play(){},pause(){},skipad(){}});assert.deepEqual([...d.state.actions.keys()],['play','pause']);
 native.prime(true);assert.equal(d.state.plays,1,'the bridge starts inside the Play gesture');native.prime(false);assert.equal(d.state.plays,1,'silent rehearsal needs no bridge');
 native.setPlaying(false);assert.equal(d.state.pauses,1);
 const bare=createNativePlayback({document:new EventTarget(),navigator:{}});
 assert.doesNotThrow(()=>{bare.setPlaying(true);bare.setMetadata({title:'x'});bare.setPosition(10,1);bare.setActions({play(){}});bare.prime(true);bare.setPlaying(false);});
});

// ---- Share sheet --------------------------------------------------------------

function shareDevice({touch=true,canShare=true,error=null}={}){
 const calls={shared:[],downloads:[],offers:[]};
 const environment={matchMedia:q=>({matches:touch&&q.includes('pointer: coarse')}),File,navigator:{canShare:()=>canShare,share:async data=>{calls.shared.push(data.files[0].name);if(error){const e=Error(error);e.name=error;throw e;}}}};
 const options={type:'application/x-choryn',download:(blob,name)=>calls.downloads.push(name),offer:file=>calls.offers.push(file.name)};
 return {environment,calls,options};
}

test('phones share files, desktops download, and an expired tap offers a fresh share button',async()=>{
 const blob=new Blob(['backup']);
 let d=shareDevice({touch:false});assert.equal(prefersShareSheet(d.environment),false);assert.equal(await saveFile(blob,'a.choryn',d.options,d.environment),'downloaded');assert.deepEqual(d.calls.shared,[]);
 d=shareDevice();assert.equal(await saveFile(blob,'a.choryn',d.options,d.environment),'shared');assert.deepEqual(d.calls.downloads,[]);
 d=shareDevice({error:'AbortError'});assert.equal(await saveFile(blob,'a.choryn',d.options,d.environment),'cancelled');assert.deepEqual(d.calls.downloads,[],'closing the sheet never forces a download');
 d=shareDevice({error:'NotAllowedError'});assert.equal(await saveFile(blob,'a.choryn',d.options,d.environment),'offered');assert.deepEqual(d.calls.offers,['a.choryn']);
 d=shareDevice({error:'DataError'});assert.equal(await saveFile(blob,'a.choryn',d.options,d.environment),'downloaded');
 d=shareDevice({canShare:false});assert.equal(await saveFile(blob,'clip.webm',d.options,d.environment),'downloaded');
});

// ---- Tempo and beat cues -------------------------------------------------------

test('tap tempo averages recent taps, restarts after a pause and clamps to the studio range',()=>{
 let now=0;const tapper=createTapTempo({now:()=>now});
 assert.equal(tapper.tap().bpm,null);for(let i=0;i<4;i++){now+=500;}
 now=0;tapper.reset();let result;for(let i=0;i<5;i++){result=tapper.tap();now+=500;}assert.equal(result.bpm,120);assert.equal(result.taps,5);
 now+=3000;assert.deepEqual(tapper.tap(),{bpm:null,taps:1},'a long pause starts a new count');
 now+=100;assert.equal(tapper.tap().bpm,300);now+=5000;tapper.tap();now+=1900;assert.equal(tapper.tap().bpm,32);
});

test('scheduled beats match the counter shown in the transport',()=>{
 const project={bpm:120,music:{beatOffset:.25}};
 const beats=beatsBetween(0,4.3,project.bpm,project.music.beatOffset);
 assert.deepEqual(beats.map(b=>b.time),[.25,.75,1.25,1.75,2.25,2.75,3.25,3.75,4.25]);
 assert.deepEqual(beats.filter(b=>b.downbeat).map(b=>b.time),[.25,4.25]);
 for(const beat of beats){const counter=beatAt(project,beat.time+1e-6);assert.equal(counter.beat,beat.index%8+1);}
 assert.deepEqual(beatsBetween(.25,.25,120,.25),[]);assert.deepEqual(beatsBetween(0,1,0),[]);
});

test('beat cues click ahead on the audio clock, accent the one and vibrate each count when enabled',()=>{
 const previous=beatCueSettings(),clicks=[],buzz=[];
 const node=()=>({connect(){},gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},frequency:{},start(at){clicks.push([+at.toFixed(3),this.frequency.value]);},stop(){}});
 const context={state:'running',currentTime:10,destination:{},createOscillator:node,createGain:node};
 const cues=createBeatCues({audioContext:()=>context,vibrate:ms=>buzz.push(ms),schedule:fn=>fn(),lookahead:.12});
 try{
  setBeatCueSettings({click:false,haptic:false});assert.deepEqual(cues.update({bpm:120},0),[]);
  setBeatCueSettings({click:true,accent:true,haptic:true});
  assert.equal(cues.update({bpm:120},0).length,1,'the beat at playback start');
  assert.equal(cues.update({bpm:120},.05).length,0,'no beat scheduled twice');
  assert.equal(cues.update({bpm:120},.45).length,1);
  assert.deepEqual(clicks,[[10,1760],[10.05,1175]]);assert.deepEqual(buzz,[28,12]);
  cues.reset();clicks.length=0;assert.equal(cues.update({bpm:120},1.9,2).length,1,'double speed looks twice as far ahead');assert.equal(clicks[0][0],10.05);
 }finally{setBeatCueSettings(previous);}
});

test('the metronome runs on its own timer and looks further ahead while the screen is hidden',()=>{
 const previous=beatCueSettings(),scheduled=[];let tick=null,cancelled=0,hidden=false,time=0;
 const context={state:'running',currentTime:0,destination:{},createOscillator:()=>({connect(){},frequency:{},start(at){scheduled.push(+at.toFixed(3));},stop(){}}),createGain:()=>({connect(){},gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}}})};
 const cues=createBeatCues({audioContext:()=>context,every:fn=>{tick=fn;return 1;},cancel:()=>{cancelled++;tick=null;},hidden:()=>hidden});
 try{
  setBeatCueSettings({click:true,haptic:false});
  cues.start(()=>({project:{bpm:120},time,rate:1}));assert.equal(cues.running,true);assert.deepEqual(scheduled,[0],'first beat immediately');
  cues.start(()=>({project:{bpm:120},time:99}));assert.ok(tick,'starting twice keeps one loop');
  time=.3;tick();assert.deepEqual(scheduled,[0],'nothing beyond the short lookahead');
  hidden=true;tick();assert.deepEqual(scheduled,[0,.2,.7,1.2],'hidden pages schedule ~1.5 s ahead (to 1.8 s) because timers slow down');
  cues.stop();assert.equal(cancelled,1);assert.equal(cues.running,false);
 }finally{cues.stop();setBeatCueSettings(previous);}
});

// ---- Multi-finger taps and palm rejection ----------------------------------------

function touchSurface(){const target=new EventTarget(),taps=[];let now=0,enabled=true;bindMultiFingerTap(target,{onTap:n=>taps.push(n),enabled:()=>enabled},{now:()=>now});
 const touch=(id,x=0,y=0)=>({identifier:id,clientX:x,clientY:y});
 const send=(type,touches,changed)=>target.dispatchEvent(defineEvent(type,{touches,changedTouches:changed}));
 return {taps,send,touch,advance:ms=>now+=ms,disable:()=>enabled=false};}

test('two-finger tap undoes and three-finger tap redoes, but pinches, holds and late fingers do not',()=>{
 const s=touchSurface(),{touch}=s;
 s.send('touchstart',[touch(1),touch(2,40)],[touch(1),touch(2,40)]);s.advance(120);s.send('touchend',[],[touch(1),touch(2,40)]);
 s.send('touchstart',[touch(1)],[touch(1)]);s.advance(40);s.send('touchstart',[touch(1),touch(2,30)],[touch(2,30)]);s.advance(40);s.send('touchstart',[touch(1),touch(2,30),touch(3,60)],[touch(3,60)]);s.advance(80);s.send('touchend',[touch(1)],[touch(2,30),touch(3,60)]);s.send('touchend',[],[touch(1)]);
 assert.deepEqual(s.taps,[2,3]);
 s.send('touchstart',[touch(1),touch(2,40)],[touch(1),touch(2,40)]);s.send('touchmove',[touch(1),touch(2,80)],[touch(2,80)]);s.send('touchend',[],[touch(1),touch(2,80)]);
 s.send('touchstart',[touch(1),touch(2,40)],[touch(1),touch(2,40)]);s.advance(600);s.send('touchend',[],[touch(1),touch(2,40)]);
 s.send('touchstart',[touch(1)],[touch(1)]);s.advance(300);s.send('touchstart',[touch(1),touch(2,40)],[touch(2,40)]);s.send('touchend',[],[touch(1),touch(2,40)]);
 s.send('touchstart',[touch(1)],[touch(1)]);s.send('touchend',[],[touch(1)]);
 s.disable();s.send('touchstart',[touch(1),touch(2,40)],[touch(1),touch(2,40)]);s.send('touchend',[],[touch(1),touch(2,40)]);
 assert.deepEqual(s.taps,[2,3],'pinch, hold, late finger, single tap and disabled targets are ignored');
});

test('palm rejection ignores touches while a stylus is down or hovering, then releases them',()=>{
 let now=0;const palm=createPalmGuard({now:()=>now,grace:600}),touch={pointerType:'touch'};
 assert.equal(palm.rejects(touch),false);
 palm.note({pointerType:'pen',type:'pointerdown'});now+=5000;assert.equal(palm.rejects(touch),true,'while the pen is down');assert.equal(palm.rejects({pointerType:'pen'}),false);
 palm.note({pointerType:'pen',type:'pointerup'});now+=300;assert.equal(palm.rejects(touch),true,'shortly after lifting');
 now+=400;assert.equal(palm.rejects(touch),false);
 palm.note({pointerType:'pen',type:'pointermove'});assert.equal(palm.rejects(touch),true,'while hovering');assert.equal(palm.rejects({pointerType:'mouse'}),false);
});

// ---- File drop and file launching ----------------------------------------------

test('dropped and launched files are routed to music or backup import',async()=>{
 assert.equal(classifyFile({name:'song.MP3',type:''}),'audio');assert.equal(classifyFile({name:'take.m4a',type:'audio/mp4'}),'audio');
 assert.equal(classifyFile({name:'show.choryn',type:''}),'backup');assert.equal(classifyFile({name:'backup.json',type:'application/json'}),'backup');
 assert.equal(classifyFile({name:'floor.png',type:'image/png'}),null);
 const input=new EventTarget();let changes=0;input.addEventListener('change',()=>changes++);
 class DataTransfer{constructor(){this.items={add:file=>this.files=[file]};}}
 assert.equal(feedInput(input,new File(['x'],'song.mp3'),{DataTransfer}),true);assert.equal(input.files[0].name,'song.mp3');assert.equal(changes,1);
 assert.equal(feedInput(input,new File(['x'],'song.mp3'),{}),false);assert.equal(feedInput(null,new File(['x'],'a'),{DataTransfer}),false);
 const launched=[];let consumer;assert.equal(consumeLaunchFiles(files=>launched.push(...files.map(f=>f.name)),{launchQueue:{setConsumer:fn=>consumer=fn}}),true);
 await consumer({files:[{getFile:async()=>new File(['x'],'show.choryn')},{getFile:async()=>{throw Error('denied');}}]});assert.deepEqual(launched,['show.choryn']);
 assert.equal(consumeLaunchFiles(()=>{},{}),false);
});

test('the drop target accepts files, ignores in-app drags and clears its overlay',()=>{
 const target=new EventTarget(),accepted=[],appended=[];const host={append:node=>appended.push(node)};
 const previous=globalThis.document;globalThis.document={createElement:()=>({setAttribute(){},remove(){appended.splice(0);},set innerHTML(v){this.html=v;}})};
 try{
  bindFileDrop({target,host,accept:files=>accepted.push(...files.map(f=>f.name))});
  const files={types:['Files'],files:[new File(['x'],'song.wav')],dropEffect:'none'},rows={types:['text/plain'],files:[]};
  const enter=defineEvent('dragenter',{dataTransfer:files});target.dispatchEvent(enter);assert.equal(enter.defaultPrevented,true);assert.equal(appended.length,1);
  const over=defineEvent('dragover',{dataTransfer:files});target.dispatchEvent(over);assert.equal(over.defaultPrevented,true);assert.equal(files.dropEffect,'copy');
  const sequence=defineEvent('dragover',{dataTransfer:rows});target.dispatchEvent(sequence);assert.equal(sequence.defaultPrevented,false,'sequence-row drags keep their own handling');
  target.dispatchEvent(defineEvent('drop',{dataTransfer:files}));assert.deepEqual(accepted,['song.wav']);assert.equal(appended.length,0);
  target.dispatchEvent(defineEvent('dragenter',{dataTransfer:files}));target.dispatchEvent(defineEvent('dragleave',{dataTransfer:files,relatedTarget:null}));assert.equal(appended.length,0,'leaving the window hides the overlay');
 }finally{globalThis.document=previous;}
});

test('installed CHORYN registers .choryn files with the operating system',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../manifest.json',import.meta.url),'utf8'));
 const handler=manifest.file_handlers?.[0];assert.ok(handler);assert.equal(handler.action,'/');assert.deepEqual(handler.accept['application/x-choryn'],['.choryn']);
});
