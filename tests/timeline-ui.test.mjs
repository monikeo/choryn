import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,clone} from '../src/engine.js';
import {setupTimeline,bindEditorTimeline,disposeTimeline,runTimelineCommand,timelineSelection} from '../src/timeline-ui.js';

class Element extends EventTarget{
 constructor(){super();this.dataset={};this.attributes=new Map();this.children=[];this.parts=new Map();this.classes=new Set();this.classList={contains:key=>this.classes.has(key),add:(...keys)=>keys.forEach(k=>this.classes.add(k)),remove:(...keys)=>keys.forEach(k=>this.classes.delete(k)),toggle:(key,on)=>{if(on??!this.classes.has(key))this.classes.add(key);else this.classes.delete(key);}};this.style={setProperty:(k,v)=>this.style[k]=v};this.textContent='';this.scrollLeft=0;this.scrollTop=0;this.clientHeight=240;this.clientWidth=960;}
 set innerHTML(html){this.html=html;this.parts.clear();this.buttons=[...html.matchAll(/<button[^>]*data-timeline-action="([^"]+)"[^>]*>/g)].map(match=>{const el=new Element();el.dataset.timelineAction=match[1];el.setAttribute('aria-label',match[1]);this.parts.set(`[data-timeline-action="${match[1]}"]`,el);return el;});}
 querySelector(selector){return this.parts.get(selector)||null;}
 querySelectorAll(){return [];}
 setAttribute(k,v){this.attributes.set(k,String(v));}
 getAttribute(k){return this.attributes.get(k);}
 removeAttribute(k){this.attributes.delete(k);}
 append(el){this.children.push(el);el.parent=this;}
 prepend(el){this.children.unshift(el);el.parent=this;}
 insertBefore(el,before){const i=this.children.indexOf(before);this.children.splice(i<0?this.children.length:i,0,el);el.parent=this;}
 insertAdjacentHTML(where,html){this.inserted=(this.inserted||'')+html;}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 focus(){this.focused=true;}
 setPointerCapture(id){this.captured=id;}
 hasPointerCapture(id){return this.captured===id;}
 releasePointerCapture(){this.captured=null;}
 getBoundingClientRect(){return {left:100,right:100+this.clientWidth,top:100,bottom:340,width:this.clientWidth,height:240};}
}
function globals(values){const prior=new Map(Object.keys(values).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const [k,v] of Object.entries(values))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});return ()=>{for(const [k,v] of prior)if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];};}
function fixture(){
 let project=createProject('UI'),at=0,replaces=0,renders=0,dialogHTML='';const document=new EventTarget(),window=new EventTarget(),body=new Element(),timeline=new Element(),area=new Element(),scroll=new Element(),ruler=new Element(),dialog=new Element();dialog.open=false;
 const forms=project.formations.map((f,i)=>{const el=new Element();el.style.left=f.time/project.duration*100+'%';el.style.width=((project.formations[i+1]?.time??project.duration)-f.time)/project.duration*100+'%';for(const name of ['sequence-index','sequence-duration','sequence-move-window']){const part=new Element();part.textContent=name==='sequence-index'?String(i+1).padStart(2,'0'):'16s';el.parts.set('.'+name,part);}return el;});
 area.querySelectorAll=selector=>selector==='.timeline-formation'||selector==='[data-timeline-id]'?forms:[];
 Object.defineProperty(area,'offsetWidth',{get:()=>scroll.clientWidth*(parseFloat(area.style.width)||100)/100});Object.defineProperty(area,'clientWidth',{get:()=>area.offsetWidth,set(){}});
 area.getBoundingClientRect=()=>({left:100-scroll.scrollLeft,right:100-scroll.scrollLeft+area.offsetWidth,top:100,bottom:340,width:area.offsetWidth,height:240});
 const map=new Map([['.timeline',timeline],['#timeline-tracks',area],['.timeline-scroll',scroll],['#time-ruler',ruler],['#dialog',dialog],['.timeline-body',new Element()]]);
 document.querySelector=selector=>map.get(selector)||null;document.querySelectorAll=selector=>selector==='[data-timeline-id]'?forms:selector==='.timeline-quick'?timeline.children.find(n=>n.className==='timeline-editbar')?.buttons||[]:[];document.createElement=()=>new Element();document.body=body;
 const restore=globals({document,window,innerWidth:1280,innerHeight:900,ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:()=>1,cancelAnimationFrame(){},addEventListener:window.addEventListener.bind(window),removeEventListener:window.removeEventListener.bind(window)});
 setupTimeline({project:()=>project,formation:()=>project.formations[0],time:()=>at,readOnly:()=>false,pause(){},render(){renders++;},replace(next){project=next;replaces++;},dialog(title,html){dialogHTML=html;},close(){},toast(){},seek:value=>at=value,selectFormation(){},setTimelineExpanded(){},details(){}});
 return {timeline,area,scroll,forms,ruler,document,window,project:()=>project,mutate:fn=>fn(project),get replaces(){return replaces;},get renders(){return renders;},get dialogHTML(){return dialogHTML;},setTime:value=>at=value,cleanup(){disposeTimeline();restore();}};
}

test('actual timeline binding decorates clips, builds the adaptive ruler and zooms without rerendering the stage',()=>{
 const f=fixture();try{bindEditorTimeline();assert.equal(f.forms[1].dataset.timelineKind,'formation');assert.equal(f.forms[1].dataset.timelineId,f.project().formations[1].id);assert.match(f.forms[1].inserted,/data-reorder-grip/);assert.match(f.forms[1].inserted,/data-drag-time="start"/);assert.match(f.ruler.html,/left:/);
  runTimelineCommand('zoom-in');assert.equal(f.area.style.width,'150%');assert.equal(f.renders,0);assert.equal(f.replaces,0);assert.ok(f.scroll.scrollLeft>0);
  runTimelineCommand('zoom-fit');assert.equal(f.area.style.width,'100%');assert.equal(f.renders,0);
  bindEditorTimeline();assert.equal(f.replaces,0);
 }finally{f.cleanup();}
});

test('copy immediately enables project-local paste and the inspector exposes guarded editing tools',()=>{
 const f=fixture();try{bindEditorTimeline();const id=f.project().formations[1].id;runTimelineCommand('copy',{kind:'formation',id});runTimelineCommand('tools');assert.match(f.dialogHTML,/data-timeline-action="paste"[^>]*>/);assert.match(f.dialogHTML,/On touch, scroll clip bodies/);
  f.setTime(22);runTimelineCommand('paste');assert.equal(f.replaces,1);assert.equal(f.project().formations.length,7);assert.equal(timelineSelection().kind,'formation');
 }finally{f.cleanup();}
});

test('sequence move buttons preserve fixed slots and selection; deletion rejects an edited confirmation target',()=>{
 const f=fixture();try{const id=f.project().formations[1].id;runTimelineCommand('move-later',{kind:'formation',id});assert.equal(f.project().formations[2].id,id);assert.deepEqual(f.project().formations.map(v=>v.time),[0,16,32,48,64,80]);
  runTimelineCommand('delete',{kind:'formation',id});assert.equal(f.replaces,1);f.mutate(p=>p.formations[2].name='Edited after confirmation');assert.throws(()=>runTimelineCommand('confirm-remove'),/score changed/);assert.ok(f.project().formations.some(v=>v.id===id));
 }finally{f.cleanup();}
});

test('actual trim, split, duplicate and cut commands keep their edits atomic and require cut confirmation',()=>{
 const f=fixture();try{const p=f.project(),id=p.formations[1].id;f.setTime(24);runTimelineCommand('split',{kind:'formation',id});assert.equal(f.project().formations.length,7);assert.equal(f.project().formations[2].time,24);
  runTimelineCommand('duplicate',{kind:'formation',id});assert.equal(f.project().formations.length,8);const copy=f.project().formations.find(v=>v.time===20);assert.ok(copy);
  runTimelineCommand('trim-end',{kind:'formation',id});assert.match(f.dialogHTML,/timeline-trim-form/);assert.equal(f.project().formations.length,8);
  const before=clone(f.project());runTimelineCommand('cut',{kind:'formation',id:copy.id});assert.deepEqual(f.project(),before);runTimelineCommand('confirm-remove');assert.equal(f.project().formations.length,7);assert.ok(!f.project().formations.some(v=>v.id===copy.id));
 }finally{f.cleanup();}
});
test('zoom selected centers its interval without rerendering or changing either stage',()=>{const f=fixture();try{bindEditorTimeline();runTimelineCommand('zoom-selection',{kind:'formation',id:f.project().formations[1].id});assert.equal(f.area.style.width,'400%');assert.equal(f.scroll.scrollLeft,480);assert.equal(f.renders,0);assert.equal(f.replaces,0);runTimelineCommand('zoom-fit');}finally{f.cleanup();}});
test('rebinding the same timeline replaces controls and wheel listeners rather than multiplying them',()=>{const f=fixture();try{bindEditorTimeline();runTimelineCommand('zoom-fit');bindEditorTimeline();assert.equal(f.timeline.children.filter(n=>n.className==='timeline-editbar').length,1);assert.equal(f.timeline.children.filter(n=>n.className==='timeline-resizer').length,1);assert.equal(f.timeline.children.filter(n=>n.className==='timeline-feedback').length,1);const wheel=new Event('wheel',{cancelable:true});Object.assign(wheel,{deltaY:-100,deltaX:0,deltaMode:0,ctrlKey:true,clientX:580});f.area.dispatchEvent(wheel);assert.ok(Math.abs(parseFloat(f.area.style.width)-Math.exp(.2)*100)<.001);assert.equal(f.replaces,0);runTimelineCommand('zoom-fit');}finally{f.cleanup();}});
test('production-event focus bypasses core edit shortcuts while timeline zoom shortcuts stay local',()=>{const f=fixture();try{bindEditorTimeline();const foreign={matches:()=>false,closest:s=>s==='.timeline'?f.timeline:s==='[data-production="event"],[data-score="prop-frame"]'?{}:null};const send=(key,ctrlKey=false)=>{const event=new Event('keydown',{cancelable:true});Object.defineProperty(event,'target',{value:foreign});Object.assign(event,{key,ctrlKey});f.document.dispatchEvent(event);return event;};assert.equal(send('Delete').defaultPrevented,false);assert.equal(send('ArrowRight').defaultPrevented,false);assert.equal(send('d',true).defaultPrevented,false);assert.equal(f.replaces,0);assert.equal(send('+',true).defaultPrevented,true);assert.equal(f.area.style.width,'150%');assert.equal(f.renders,0);send('0',true);assert.equal(f.area.style.width,'100%');}finally{f.cleanup();}});
test('actual movement preview cannot move a formation that shares its imported ID',()=>{const f=fixture();try{const id=f.project().formations[1].id,action={id,name:'Turn',start:20,end:28,performerIds:[],notes:'',category:'Dance',status:'learning',reference:''};f.mutate(p=>p.actions=[action]);const movement=new Element(),lane=new Element(),label=new Element();movement.dataset.id=id;movement.style.left=20/96*100+'%';movement.style.width=8/96*100+'%';const oldNodes=f.area.querySelectorAll,oldQuery=f.document.querySelector;f.area.querySelectorAll=selector=>selector==='[data-timeline-id]'?[...f.forms,movement]:selector==='.movement-lane>button'?[movement]:oldNodes(selector);f.document.querySelector=selector=>selector==='.movement-lane'?lane:selector==='.track-name.movement-track'?label:oldQuery(selector);const frames=new Map();let frameId=0;globalThis.requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId;};globalThis.cancelAnimationFrame=id=>frames.delete(id);bindEditorTimeline();const original=f.forms[1].style.left,target={closest:selector=>selector==='[data-timeline-kind]'?movement:null},send=(type,x)=>{const event=new Event(type,{cancelable:true});Object.defineProperty(event,'target',{value:target});Object.assign(event,{button:0,pointerId:1,pointerType:'mouse',clientX:x,clientY:130});f.area.dispatchEvent(event);};send('pointerdown',300);send('pointermove',330);const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(16));assert.equal(f.forms[1].style.left,original);assert.equal(movement.style.left,23/96*100+'%');send('pointerup',330);assert.equal(f.project().actions[0].start,23);assert.equal(f.project().formations[1].time,16);assert.equal(f.replaces,1);}finally{f.cleanup();}});
