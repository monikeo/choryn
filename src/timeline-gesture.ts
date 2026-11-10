import {errorMessage} from './errors.js';
import {clone} from './engine.js';
import type {Project} from './types.js';
import {editTimeline,reorderFormation,timelineItem,timelineEditBounds,roundTime} from './timeline-model.js';
import {magneticTime,sequenceDropIndex,timelineFingerprint,timelineScrollVelocity,magneticTargets,timelineSnapExclusions,type MagneticTarget} from './timeline-tools.js';

type Magnet={key?:string;time:number;label:string};
/**
 * One press on the timeline: a clip edit (`move`, `start`/`end` trim or `reorder`) or, without a
 * kind, a ruler scrub. Positions are client pixels; times are seconds in the press-time `project`.
 */
export interface TimelineGesture {
 item:HTMLElement|null; kind?:string; id?:string; edge:string; project:Project; start:number; end?:number; base:number; exclude?:string; editable:boolean; playhead:number;
 bounds:{min:number;max:number}|null; fingerprint:string|null; pointerId:number; pointerType:string; slop:number; x:number; y:number; clientX:number; clientY:number; at:number;
 target:number|null; lastToken:number|undefined; moved:boolean; dirty:boolean; altKey:boolean;
 snapTargets?:MagneticTarget[]|null; snapMode?:string; magnet?:Magnet|null; hapticKey?:string; candidate?:Project|null; error?:string|null;
}
/** The timeline's side of a gesture: state it reads and the feedback and commits it receives. */
export interface TimelineGestureOptions {
 project:()=>Project; readOnly:()=>boolean; snap:()=>string; mode:()=>string; time:()=>number; pause:()=>void;
 select?:(kind:string,id:string)=>void; active?:(on:boolean)=>void; suppressClick?:()=>void; scrub?:(time:number)=>void;
 pointer?:(g:TimelineGesture)=>void; preview?:(g:TimelineGesture,result:{magnetic:Magnet|null;target:number|null})=>void; invalid?:(g:TimelineGesture,message:string)=>void;
 tap?:(g:TimelineGesture)=>void; commit?:(g:TimelineGesture)=>void; clear?:(g:TimelineGesture)=>void; cancel?:(g:Pick<TimelineGesture,'kind'|'id'>,message?:string)=>void;
}
/** Timeline height preview, commit and rollback. */
export interface TimelineResizerOptions {height:()=>number; limits:()=>{min:number;max:number}; start?:()=>void; preview:(height:number)=>void; commit:(height:number)=>void; rollback:()=>void; reset:()=>void}

// Keep document changes out of pointer movement. A completed drag commits once.
export function bindTimelineGestures(area:HTMLElement,scroll:HTMLElement,options:TimelineGestureOptions,environment=globalThis){
 let gesture:TimelineGesture|null=null,frame=0,lastFrame=0,disposed=false;
 const listeners:(()=>void)[]=[];
 const listen=<E extends Event>(node:EventTarget,type:string,fn:(event:E)=>void,capture=false)=>{node.addEventListener(type,fn as EventListener,capture);listeners.push(()=>node.removeEventListener(type,fn as EventListener,capture));};
 const schedule=()=>{if(!frame&&!disposed)frame=environment.requestAnimationFrame(tick);};
 const release=(g:TimelineGesture)=>{try{if(area.hasPointerCapture?.(g.pointerId))area.releasePointerCapture(g.pointerId);}catch{}};
 const clear=()=>{if(frame)environment.cancelAnimationFrame(frame);frame=0;lastFrame=0;};
 const timeAt=(x:number,g:{project:Project})=>{const rect=area.getBoundingClientRect();return (x-rect.left)/rect.width*g.project.duration;};
 const finish=(cancel=false,{silent=false}={})=>{
  const g=gesture;if(!g)return;
  if(!cancel&&g.dirty)preview(g);
  gesture=null;clear();release(g);options.active?.(false);options.clear?.(g);
  if(g.moved)options.suppressClick?.();
  if(cancel){if(!silent)options.cancel?.(g);return;}
  if(g.error){options.cancel?.(g,g.error);return;}
  if(!g.moved){options.tap?.(g);return;}
  const rect=scroll.getBoundingClientRect(),outside=g.clientY<rect.top-48||g.clientY>rect.bottom+48||g.clientX<rect.left-80||g.clientX>rect.right+80;
  if(outside){options.cancel?.(g,'Dropped outside the timeline. The original score is unchanged.');return;}
  if(g.error){options.cancel?.(g,g.error);return;}
  if(!g.candidate){options.cancel?.(g);return;}
  if(g.fingerprint!==timelineFingerprint(options.project())){options.cancel?.(g,'The score changed during the drag. Please drag again.');return;}
  if(timelineFingerprint(g.candidate)===g.fingerprint){options.cancel?.(g);return;}
  try{options.commit?.(g);}catch(error){options.cancel?.(g,errorMessage(error)||'The edit could not be saved. Try again.');}
 };
 const preview=(g:TimelineGesture)=>{
  g.dirty=false;const rect=area.getBoundingClientRect(),pixels=rect.width/g.project.duration;
  if(!g.kind){try{options.scrub?.(Math.max(0,Math.min(g.project.duration,timeAt(g.clientX,g))));g.error=null;}catch(error){g.error=errorMessage(error)||'This time could not be previewed.';options.invalid?.(g,g.error);}return;}
  if(!g.moved)return;
  options.pointer?.(g);
  if(!g.editable){g.error=options.readOnly()?'Read-only snapshot':'Unlock this formation before editing its timing.';options.invalid?.(g,g.error);return;}
  const delta=timeAt(g.clientX,g)-g.at;
  const raw=g.base+delta;
  const target=g.edge==='reorder'?sequenceDropIndex(g.project,g.id!,raw,g.target,pixels):null;
  const snap=g.altKey?'off':options.snap();if(g.snapMode!==snap){g.magnet=null;g.snapMode=snap;}const magnetic=g.edge==='reorder'?null:magneticTime(raw,g.project,{snap,playhead:g.playhead,pixelsPerSecond:pixels,targets:g.snapTargets,previous:g.magnet});g.magnet=magnetic?.key?magnetic:null;
  // A light haptic tick when a touch drag locks onto a beat, playhead or edge.
  if(g.pointerType==='touch'&&g.magnet&&g.magnet.key!==g.hapticKey){try{environment.navigator?.vibrate?.(6);}catch{}}g.hapticKey=g.magnet?.key;
  // Clip edits other than reorder have bounds and a magnetic time.
  const token=target??roundTime(Math.max(g.bounds!.min,Math.min(g.bounds!.max,magnetic!.time)));
  if(g.lastToken===token)return;
  g.lastToken=token;
  try{
   const candidate=g.edge==='reorder'?reorderFormation(g.project,g.id!,target!):editTimeline(g.project,{kind:g.kind,id:g.id!,edge:g.edge,value:token});
   g.candidate=candidate;g.error=null;g.target=target;
   options.preview?.(g,{magnetic,target});
  }catch(error){g.candidate=null;g.error=errorMessage(error)||'This edit is unavailable.';options.invalid?.(g,g.error);}
 };
 function tick(now:number){
  frame=0;const g=gesture;if(!g||disposed)return;
  if(g.moved){
   const rect=scroll.getBoundingClientRect(),inLane=g.clientY>=rect.top-48&&g.clientY<=rect.bottom+48,velocity=inLane?timelineScrollVelocity(g.clientX,rect):0;
   const dt=lastFrame?Math.max(0,Math.min(32,now-lastFrame))/1000:1/60;
   let scrolled=false;if(velocity){const before=scroll.scrollLeft;scroll.scrollLeft+=velocity*dt;scrolled=scroll.scrollLeft!==before;if(scrolled)g.dirty=true;}
   lastFrame=now;
   if(g.dirty)preview(g);
   if(velocity&&scrolled)schedule();
  }else if(g.dirty)preview(g);
 }
 listen(area,'pointerdown',(event:PointerEvent)=>{
  if(event.button!==0||disposed||area.getBoundingClientRect().width<=0)return;
  if(gesture){if(event.pointerId!==gesture.pointerId&&event.pointerType==='touch')finish(true);return;}
  const item=(event.target as Element).closest<HTMLElement>('[data-timeline-kind]'),kind=item?.dataset.timelineKind,id=item?.dataset.timelineId,handle=(event.target as Element).closest<HTMLElement>('[data-drag-time]');
  if((event.target as Element).closest('.prop-lane,.music-window'))return;
  // Clip bodies scroll natively on touch; their dedicated grip starts an edit.
  if(event.pointerType==='touch'&&item&&!(event.target as Element).closest('[data-reorder-grip],[data-drag-time]'))return;
  if(event.pointerType==='touch'&&!item&&!(event.target as Element).closest('.time-ruler'))return;
  const edge=handle?.dataset.dragTime||(kind==='formation'&&options.mode()==='reorder'?'reorder':'move');
  // A clip has a kind and id; timelineItem rejects one that no longer exists.
  const p=options.project();if(kind){try{timelineItem(p,kind,id!);}catch{options.cancel?.({kind,id},'This clip is no longer available. Select a current clip and try again.');return;}}const project=kind?clone(p):p,value=kind?timelineItem(project,kind,id!):null,index=kind==='formation'?project.formations.findIndex(f=>f.id===id):-1;
  const start=kind==='movement'?value!.start:value?.time||0,end=kind==='formation'?(project.formations[index+1]?.time??project.duration):value?.end;
  // Only clips with an end (formations, movement) offer reorder and end trims.
  const base=(edge==='reorder'?(start+end!)/2:edge==='end'?end:start) as number;
  const editable=!options.readOnly()&&!(kind==='formation'&&(value!.status==='approved'||index===0&&edge!=='end'&&edge!=='reorder'));
  const exclude=kind==='formation'&&edge==='end'?project.formations[index+1]?.id:id;
  // Fingers jitter more than a mouse: use platform-like slop before a press becomes a drag.
  const slop=event.pointerType==='touch'?8:event.pointerType==='pen'?6:5;
  gesture={item,kind,id,edge,project,start,end,base,exclude,editable,playhead:options.time(),bounds:kind&&edge!=='reorder'?timelineEditBounds(project,{kind,id:id!,edge}):null,fingerprint:kind?timelineFingerprint(p):null,pointerId:event.pointerId,pointerType:event.pointerType,slop,x:event.clientX,y:event.clientY,clientX:event.clientX,clientY:event.clientY,at:0,target:index,lastToken:undefined,moved:false,dirty:false,altKey:!!event.altKey};
  gesture.snapTargets=kind?magneticTargets(project,timelineSnapExclusions(project,kind==='formation'&&edge==='end'&&!exclude?'end':kind+'/'+exclude)):null;gesture.at=timeAt(event.clientX,gesture);options.pause();options.active?.(true);
  if(item){options.select?.(kind!,id!);event.preventDefault();}else{gesture.dirty=true;schedule();}
  try{area.setPointerCapture(event.pointerId);}catch{finish(true);}
 });
 listen(area,'pointermove',(event:PointerEvent)=>{
  const g=gesture;if(!g||event.pointerId!==g.pointerId)return;
  g.clientX=event.clientX;g.clientY=event.clientY;g.altKey=!!event.altKey;
  if(Math.abs(g.clientX-g.x)>g.slop)g.moved=true;
  g.dirty=true;schedule();
 });
 listen(area,'pointerup',(event:PointerEvent)=>{if(gesture?.pointerId!==event.pointerId)return;gesture.clientX=event.clientX;gesture.clientY=event.clientY;gesture.altKey=!!event.altKey;if(Math.abs(event.clientX-gesture.x)>gesture.slop)gesture.moved=true;gesture.dirty=true;finish(false);});
 for(const type of ['pointercancel','lostpointercapture'])listen(area,type,(event:PointerEvent)=>{if(gesture?.pointerId===event.pointerId)finish(true);});
 listen(area,'cancel-timeline-gesture',()=>finish(true));
 listen(environment,'blur',()=>finish(true));
 listen(environment,'resize',()=>finish(true));listen(environment.document,'fullscreenchange',()=>finish(true));
 listen(environment.document,'visibilitychange',()=>{if(environment.document.hidden)finish(true);});
 listen(environment.document,'studio-recover',()=>finish(true));
 listen(environment.document,'keydown',(event:KeyboardEvent)=>{if(event.key==='Escape'&&gesture){event.preventDefault();event.stopImmediatePropagation();finish(true);}},true);
 listen(scroll,'scroll',()=>{if(gesture){gesture.dirty=true;schedule();}});
 listen(environment.document,'pointerdown',(event:PointerEvent)=>{if(gesture&&event.pointerType==='touch'&&event.pointerId!==gesture.pointerId){finish(true);event.stopImmediatePropagation();}},true);
 return {cancel:()=>finish(true,{silent:true}),dispose(){finish(true,{silent:true});disposed=true;clear();listeners.forEach(remove=>remove());},get active(){return !!gesture;}};
}

// Timeline height is a view preference; cancellation restores its original layout.
export function bindTimelineResizer(handle:HTMLElement,options:TimelineResizerOptions,environment=globalThis){
 let drag:{id:number;y:number;clientY:number;height:number;value:number}|null|undefined,frame=0;const listeners:(()=>void)[]=[];
 const listen=<E extends Event>(node:EventTarget,type:string,fn:(event:E)=>void,capture=false)=>{node.addEventListener(type,fn as EventListener,capture);listeners.push(()=>node.removeEventListener(type,fn as EventListener,capture));};
 const limit=(value:number)=>{const {min,max}=options.limits();return Math.max(min,Math.min(max,value));};
 const preview=()=>{if(drag){drag.value=limit(drag.height+drag.y-drag.clientY);options.preview(drag.value);}};
 const finish=(cancel:boolean)=>{if(!drag)return;if(frame)environment.cancelAnimationFrame(frame);frame=0;if(!cancel)preview();const current=drag;drag=null;try{if(handle.hasPointerCapture?.(current.id))handle.releasePointerCapture(current.id);}catch{}if(cancel||Math.abs(current.value-current.height)<.5)options.rollback();else options.commit(current.value);};
 listen(handle,'pointerdown',(event:PointerEvent)=>{if(event.button!==0)return;if(drag){finish(true);return;}event.preventDefault();options.start?.();drag={id:event.pointerId,y:event.clientY,clientY:event.clientY,height:options.height(),value:options.height()};try{handle.setPointerCapture(event.pointerId);}catch{finish(true);}});
 listen(handle,'pointermove',(event:PointerEvent)=>{if(drag?.id!==event.pointerId)return;drag.clientY=event.clientY;if(!frame)frame=environment.requestAnimationFrame(()=>{frame=0;preview();});});
 listen(handle,'pointerup',(event:PointerEvent)=>{if(drag?.id!==event.pointerId)return;drag.clientY=event.clientY;finish(false);});
 for(const type of ['pointercancel','lostpointercapture'])listen(handle,type,(event:PointerEvent)=>{if(drag?.id===event.pointerId)finish(true);});
 listen(handle,'dblclick',()=>{finish(true);options.reset();});
 listen(handle,'keydown',(event:KeyboardEvent)=>{if(!['ArrowUp','ArrowDown','PageUp','PageDown','Home'].includes(event.key))return;event.preventDefault();event.stopPropagation();finish(true);if(event.key==='Home')options.reset();else options.commit(limit(options.height()+(['ArrowUp','PageUp'].includes(event.key)?1:-1)*(event.key.startsWith('Page')?90:30)));});
 for(const type of ['blur','resize'])listen(environment,type,()=>finish(true));
 for(const type of ['studio-recover','fullscreenchange','timeline-teardown'])listen(environment.document,type,()=>finish(true));
 listen(environment.document,'pointerdown',(event:PointerEvent)=>{if(drag&&event.pointerType==='touch'&&event.pointerId!==drag.id){finish(true);event.stopImmediatePropagation();}},true);
 listen(environment.document,'visibilitychange',()=>{if(environment.document.hidden)finish(true);});
 listen(environment.document,'keydown',(event:KeyboardEvent)=>{if(event.key==='Escape'&&drag){event.preventDefault();event.stopImmediatePropagation();finish(true);}},true);
 return {cancel:()=>finish(true),dispose(){finish(true);listeners.forEach(remove=>remove());},get active(){return !!drag;}};
}
