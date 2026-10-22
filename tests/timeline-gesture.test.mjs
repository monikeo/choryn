import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,clone,uid,validateProject} from '../src/engine.js';
import {bindTimelineGestures} from '../src/timeline-gesture.js';
import {sequenceDropIndex,timelineScrollVelocity,timelineCommandReason,magneticTime} from '../src/timeline-tools.js';

class Surface extends EventTarget{
 capture=null;
 setPointerCapture(id){this.capture=id;}
 hasPointerCapture(id){return this.capture===id;}
 releasePointerCapture(){this.capture=null;}
}
function emit(node,type,values={}){
 const event=new Event(type,{cancelable:true});Object.assign(event,{button:0,pointerId:1,pointerType:'mouse',clientX:270,clientY:130,...values});node.dispatchEvent(event);return event;
}
function fixture({kind='formation',edge,mode='reorder',snap='off',readOnly=false,width=960,viewport=960,index=1,performers=8,formations}={}){
 let project=createProject('Timeline',performers),frames=new Map(),frameId=0,now=0;
 if(formations)project.formations=Array.from({length:formations},(_,i)=>({...clone(project.formations[0]),id:uid(),time:i*project.duration/formations,status:'draft'}));
 project.actions=[{id:uid(),name:'Turn',start:10,end:20,performerIds:[],notes:''}];
 const events={previews:[],commits:[],cancels:[],scrubs:[],taps:[],selections:[],clears:0,pointers:0},area=new Surface(),scroll=new Surface(),environment=new Surface();environment.document=new Surface();
 let scrollLeft=0;Object.defineProperty(scroll,'scrollLeft',{get:()=>scrollLeft,set:n=>scrollLeft=Math.max(0,Math.min(width-viewport,n))});
 scroll.getBoundingClientRect=()=>({left:100,right:100+viewport,top:100,bottom:250,width:viewport,height:150});
 area.getBoundingClientRect=()=>({left:100-scroll.scrollLeft,right:100-scroll.scrollLeft+width,top:100,bottom:250,width,height:150});
 environment.requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId;};environment.cancelAnimationFrame=id=>frames.delete(id);
 const id=kind==='formation'?project.formations[index].id:kind==='movement'?project.actions[0].id:kind==='cue'?project.cues[0].id:null;
 const item=kind?{dataset:{timelineKind:kind,timelineId:id}}:null;
 const target={closest(selector){if(selector==='[data-timeline-kind]')return item;if(selector==='[data-drag-time]')return edge?{dataset:{dragTime:edge}}:null;if(selector==='[data-reorder-grip],[data-drag-time]')return item;if(selector==='.time-ruler')return item?null:{};return null;}};
 const options={project:()=>project,time:()=>0,mode:()=>mode,snap:()=>snap,readOnly:()=>readOnly,pause(){},active:value=>events.active=value,select:(...args)=>events.selections.push(args),pointer:()=>events.pointers++,preview:(g,detail)=>events.previews.push({project:g.candidate,detail}),invalid:(g,message)=>events.invalid=message,commit:g=>{events.commits.push(g.candidate);project=g.candidate;},cancel:(g,message)=>events.cancels.push(message),clear:()=>events.clears++,tap:g=>events.taps.push(g.id),scrub:t=>events.scrubs.push(t)};
 const controller=bindTimelineGestures(area,scroll,options,environment);
 // Event.target is read-only: supply the synthetic target through a subclass.
 const send=(type,values={})=>{const e=new Event(type,{cancelable:true});Object.defineProperty(e,'target',{value:values.target||target});Object.assign(e,{button:0,pointerId:1,pointerType:'mouse',clientX:270,clientY:130,...Object.fromEntries(Object.entries(values).filter(([key])=>key!=='target'))});area.dispatchEvent(e);return e;};
 return {area,scroll,environment,events,id,controller,send,project:()=>project,mutate:fn=>fn(project),frame(dt=16){now+=dt;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now));},get queued(){return frames.size;},bodyTarget:{closest:selector=>selector==='[data-timeline-kind]'?item:null}};
}

test('sequence destinations use original centers with a small hysteresis and support uneven slots',()=>{
 const p=createProject(),id=p.formations[1].id;
 assert.equal(sequenceDropIndex(p,id,24,1,10),1);
 assert.equal(sequenceDropIndex(p,id,40.2,1,10),1);
 assert.equal(sequenceDropIndex(p,id,40.4,1,10),2);
 assert.equal(sequenceDropIndex(p,id,39.8,2,10),2);
 assert.equal(sequenceDropIndex(p,id,39.6,2,10),1);
 assert.equal(sequenceDropIndex(p,id,-100,1,10),0);
 assert.equal(sequenceDropIndex(p,id,1000,1,10),5);
 p.formations.forEach((f,i)=>f.time=[0,2,60,70,80,90][i]);
 assert.equal(sequenceDropIndex(p,id,65.4,1,10),2);
});

test('edge autoscroll is proportional, bounded, symmetric and quiet in the center',()=>{
 const rect={left:100,right:500,width:400};assert.equal(timelineScrollVelocity(300,rect),0);
 assert.equal(timelineScrollVelocity(100,rect),-900);assert.equal(timelineScrollVelocity(500,rect),900);
 assert.equal(timelineScrollVelocity(128,rect),-225);assert.equal(timelineScrollVelocity(472,rect),225);
 assert.equal(timelineScrollVelocity(Infinity,rect),0);
});

test('many pointer events coalesce into one preview and one commit, preserving the original until drop',()=>{
 const f=fixture(),before=clone(f.project());f.send('pointerdown');
 for(let i=0;i<120;i++)f.send('pointermove',{clientX:450+i/10});
 assert.equal(f.queued,1);assert.equal(f.events.previews.length,0);assert.deepEqual(f.project(),before);
 f.frame();assert.equal(f.events.previews.length,1);assert.deepEqual(f.project(),before);
 f.send('pointerup',{clientX:462});assert.equal(f.events.commits.length,1);assert.equal(f.project().formations[2].id,f.id);
 assert.deepEqual(f.project().formations.map(v=>v.time),before.formations.map(v=>v.time));assert.equal(validateProject(f.project()).formations.length,6);f.controller.dispose();
});

test('reorder stays put until its grabbed clip center crosses the next slot, independent of grab offset',()=>{
 const f=fixture();f.send('pointerdown',{clientX:410});f.send('pointermove',{clientX:420});f.frame();
 assert.equal(f.events.previews.at(-1).project.formations[1].id,f.id);
 f.send('pointerup',{clientX:420});assert.equal(f.events.commits.length,0);f.controller.dispose();
});

test('trimming keeps the original handle offset instead of jumping to pointer time',()=>{
 const f=fixture({edge:'end'});f.send('pointerdown',{clientX:405});f.send('pointermove',{clientX:415});f.frame();
 assert.equal(f.events.previews.at(-1).project.formations[2].time,33);
 f.send('pointerup',{clientX:415});assert.equal(f.project().formations[2].time,33);assert.equal(f.project().formations[1].time,16);f.controller.dispose();
});

test('movement drags preserve duration and Alt bypasses beat snapping without changing its setting',()=>{
 const f=fixture({kind:'movement',snap:'beat'});f.send('pointerdown',{clientX:210});f.send('pointermove',{clientX:222,altKey:true});f.frame();
 assert.equal(f.events.previews.at(-1).project.actions[0].start,11.2);assert.equal(f.events.previews.at(-1).project.actions[0].end,21.2);
 f.send('pointerup',{clientX:222,altKey:true});assert.equal(f.project().actions[0].start,11.2);f.controller.dispose();
});

test('pointerup flushes the last movement even when its animation frame has not run',()=>{
 const f=fixture({kind:'movement'});f.send('pointerdown',{clientX:210});f.send('pointermove',{clientX:220});f.send('pointerup',{clientX:240});
 assert.equal(f.events.commits.length,1);assert.equal(f.project().actions[0].start,13);assert.equal(f.queued,0);f.controller.dispose();
});

test('unrelated pointers cannot update or finish the active gesture',()=>{
 const f=fixture();f.send('pointerdown');f.send('pointermove',{pointerId:9,clientX:600});f.send('pointerup',{pointerId:9,clientX:600});f.frame();
 assert.equal(f.controller.active,true);assert.equal(f.events.previews.length,0);f.send('pointerup');assert.equal(f.events.commits.length,0);assert.equal(f.events.taps.length,1);f.controller.dispose();
});

test('touch clip bodies remain native scroll surfaces and a second touch cancels grip editing',()=>{
 const f=fixture();const event=f.send('pointerdown',{pointerType:'touch',target:f.bodyTarget});assert.equal(event.defaultPrevented,false);assert.equal(f.controller.active,false);
 f.send('pointerdown',{pointerType:'touch'});assert.equal(f.controller.active,true);
 f.send('pointermove',{pointerType:'touch',clientX:500});f.frame();f.send('pointerdown',{pointerType:'touch',pointerId:2});
 assert.equal(f.controller.active,false);assert.equal(f.events.commits.length,0);assert.equal(f.queued,0);f.controller.dispose();
});

test('cancel, lost capture, Escape, blur, hidden document, recovery and dispose preserve the score',()=>{
 for(const type of ['pointercancel','lostpointercapture','Escape','blur','hidden','studio-recover','dispose']){
  const f=fixture(),before=clone(f.project());f.send('pointerdown');f.send('pointermove',{clientX:500});f.frame();
  if(type==='Escape')emit(f.environment.document,'keydown',{key:'Escape'});else if(type==='blur')emit(f.environment,'blur');else if(type==='hidden'){f.environment.document.hidden=true;emit(f.environment.document,'visibilitychange');}else if(type==='studio-recover')emit(f.environment.document,type);else if(type==='dispose')f.controller.dispose();else f.send(type);
  assert.equal(f.controller.active,false,type);assert.deepEqual(f.project(),before,type);assert.equal(f.events.commits.length,0,type);assert.equal(f.queued,0,type);f.controller.dispose();
 }
});

test('changed scores and off-timeline drops cannot commit a stale preview',()=>{
 for(const changed of [false,true]){const f=fixture();f.send('pointerdown');f.send('pointermove',{clientX:500});f.frame();if(changed)f.mutate(p=>p.name='New edit');f.send('pointerup',{clientX:500,clientY:changed?130:350});assert.equal(f.events.commits.length,0);assert.match(f.events.cancels.at(-1),changed?/changed/:/outside/);f.controller.dispose();}
});

test('approval failures discard the preview and recover when dragging to a valid slot',()=>{
 const f=fixture();f.mutate(p=>p.formations[2].status='approved');f.send('pointerdown');f.send('pointermove',{clientX:500});f.frame();assert.match(f.events.invalid,/Unlock/);
 f.send('pointermove',{clientX:270});f.frame();f.send('pointerup');assert.equal(f.events.commits.length,0);f.controller.dispose();
 const locked=fixture({readOnly:true});locked.send('pointerdown');locked.send('pointermove',{clientX:500});locked.frame();locked.send('pointerup',{clientX:500});assert.equal(locked.events.commits.length,0);assert.match(locked.events.invalid,/Read-only/);locked.controller.dispose();
});

test('autoscroll continues with a stationary pointer and updates the candidate using the scrolled content',()=>{
 const f=fixture({kind:'movement',width:1920,viewport:600});f.send('pointerdown',{clientX:320});f.send('pointermove',{clientX:690});f.frame();const first=f.events.previews.at(-1).project.actions[0].start;
 for(let i=0;i<10;i++)f.frame();assert.ok(f.scroll.scrollLeft>0);assert.ok(f.events.previews.at(-1).project.actions[0].start>first);f.controller.dispose();assert.equal(f.queued,0);
});

test('ruler dragging scrubs without authoring a clip and tap selection does not mutate the project',()=>{
 const f=fixture({kind:null});f.send('pointerdown',{clientX:340});f.frame();assert.equal(f.events.scrubs.at(-1),24);f.send('pointerup',{clientX:340});assert.equal(f.events.commits.length,0);f.controller.dispose();
 const c=fixture();c.send('pointerdown');c.send('pointerup');assert.deepEqual(c.events.taps,[c.id]);assert.equal(c.events.commits.length,0);c.controller.dispose();
});

test('snapping can target movement boundaries and excludes the boundary being dragged',()=>{
 const p=createProject();p.actions=[{id:'move',name:'Turn',start:13.13,end:17.17}];assert.equal(magneticTime(13.12,p,{pixelsPerSecond:100}).time,13.13);
 assert.notEqual(magneticTime(13.12,p,{pixelsPerSecond:100,exclude:'move'}).time,13.13);
});

test('command availability protects shared approved boundaries, point cues, opening and read-only projects',()=>{
 const p=createProject(),selected={kind:'formation',id:p.formations[0].id};p.formations[1].status='approved';
 assert.match(timelineCommandReason(p,selected,'trim-end',0),/next formation/);assert.match(timelineCommandReason(p,selected,'delete',0),/opening/);
 assert.match(timelineCommandReason(p,selected,'move-later',0),/adjacent/);assert.match(timelineCommandReason(p,{kind:'cue',id:p.cues[0].id},'split',20),/point/);
 assert.equal(timelineCommandReason(p,selected,'copy',0,{readOnly:true}),'');assert.match(timelineCommandReason(p,selected,'split',0,{readOnly:true}),/Read-only/);
 assert.match(timelineCommandReason(p,selected,'paste',0),/Copy/);assert.equal(timelineCommandReason(p,selected,'paste',0,{clipboard:{projectId:p.id}}),'');
});

test('a maximum-size score coalesces a burst of 1000 events without authoring during the preview',()=>{
 const f=fixture({performers:100,formations:100}),before=clone(f.project());f.send('pointerdown');
 for(let i=0;i<1000;i++)f.send('pointermove',{clientX:400+i/10});assert.equal(f.queued,1);f.frame();assert.equal(f.events.previews.length,1);assert.deepEqual(f.project(),before);
 f.send('pointerup',{clientX:500});assert.equal(f.events.commits.length,1);assert.equal(validateProject(f.project()).formations.length,100);f.controller.dispose();
});

test('cue movement preserves its pointer offset and movement trimming cannot invert an interval',()=>{
 const f=fixture({kind:'cue'}),original=f.project().cues[0].time;f.send('pointerdown');f.send('pointermove',{clientX:278});f.send('pointerup',{clientX:278});assert.equal(f.project().cues.find(c=>c.id===f.id).time,original+.8);f.controller.dispose();
 const m=fixture({kind:'movement',edge:'start'});m.send('pointerdown',{clientX:210});m.send('pointermove',{clientX:500});m.send('pointerup',{clientX:500});assert.equal(m.project().actions[0].start,19.9);assert.equal(m.project().actions[0].end,20);m.controller.dispose();
});
