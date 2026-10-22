import {clone} from './engine.js';
import {editTimeline,reorderFormation,timelineItem} from './timeline-model.js';
import {magneticTime,sequenceDropIndex,timelineFingerprint,timelineScrollVelocity} from './timeline-tools.js';

// Keep document changes out of pointer movement. A completed drag commits once.
export function bindTimelineGestures(area,scroll,options,environment=globalThis){
 let gesture=null,frame=0,lastFrame=0,disposed=false;
 const listeners=[];
 const listen=(node,type,fn)=>{node.addEventListener(type,fn);listeners.push(()=>node.removeEventListener(type,fn));};
 const schedule=()=>{if(!frame&&!disposed)frame=environment.requestAnimationFrame(tick);};
 const release=g=>{try{if(area.hasPointerCapture?.(g.pointerId))area.releasePointerCapture(g.pointerId);}catch{}};
 const clear=()=>{if(frame)environment.cancelAnimationFrame(frame);frame=0;lastFrame=0;};
 const timeAt=(x,g)=>{const rect=area.getBoundingClientRect();return (x-rect.left)/rect.width*g.project.duration;};
 const finish=(cancel=false,{silent=false}={})=>{
  const g=gesture;if(!g)return;
  if(!cancel&&g.dirty)preview(g);
  gesture=null;clear();release(g);options.active?.(false);options.clear?.(g);
  if(g.moved)options.suppressClick?.();
  if(cancel){if(!silent)options.cancel?.(g);return;}
  if(!g.moved){options.tap?.(g);return;}
  const rect=scroll.getBoundingClientRect(),outside=g.clientY<rect.top-48||g.clientY>rect.bottom+48||g.clientX<rect.left-80||g.clientX>rect.right+80;
  if(outside){options.cancel?.(g,'Dropped outside the timeline. The original score is unchanged.');return;}
  if(g.error){options.cancel?.(g,g.error);return;}
  if(!g.candidate){options.cancel?.(g);return;}
  if(g.fingerprint!==timelineFingerprint(options.project())){options.cancel?.(g,'The score changed during the drag. Please drag again.');return;}
  if(timelineFingerprint(g.candidate)===g.fingerprint){options.cancel?.(g);return;}
  options.commit?.(g);
 };
 const preview=g=>{
  g.dirty=false;const rect=area.getBoundingClientRect(),pixels=rect.width/g.project.duration;
  if(!g.kind){options.scrub?.(Math.max(0,Math.min(g.project.duration,timeAt(g.clientX,g))));return;}
  if(!g.moved)return;
  options.pointer?.(g);
  if(!g.editable){g.error=options.readOnly()?'Read-only snapshot':'Unlock this formation before editing its timing.';options.invalid?.(g,g.error);return;}
  const delta=timeAt(g.clientX,g)-g.at;
  const raw=g.base+delta;
  const target=g.edge==='reorder'?sequenceDropIndex(g.project,g.id,raw,g.target,pixels):null;
  const magnetic=g.edge==='reorder'?null:magneticTime(raw,g.project,{snap:g.altKey?'off':options.snap(),playhead:g.playhead,pixelsPerSecond:pixels,exclude:g.exclude});
  const token=target??magnetic.time;
  if(g.lastToken===token)return;
  g.lastToken=token;
  try{
   const candidate=g.edge==='reorder'?reorderFormation(g.project,g.id,target):editTimeline(g.project,{kind:g.kind,id:g.id,edge:g.edge,value:token});
   g.candidate=candidate;g.error=null;g.target=target;
   options.preview?.(g,{magnetic,target});
  }catch(error){g.candidate=null;g.error=error.message||'This edit is unavailable.';options.invalid?.(g,g.error);}
 };
 function tick(now){
  frame=0;const g=gesture;if(!g||disposed)return;
  if(g.moved){
   const rect=scroll.getBoundingClientRect(),inLane=g.clientY>=rect.top-48&&g.clientY<=rect.bottom+48,velocity=inLane?timelineScrollVelocity(g.clientX,rect):0;
   const dt=lastFrame?Math.max(0,Math.min(32,now-lastFrame))/1000:1/60;
   if(velocity){const before=scroll.scrollLeft;scroll.scrollLeft+=velocity*dt;if(scroll.scrollLeft!==before)g.dirty=true;}
   lastFrame=now;
   if(g.dirty)preview(g);
   if(velocity)schedule();
  }else if(g.dirty)preview(g);
 }
 listen(area,'pointerdown',event=>{
  if(event.button!==0||disposed||area.getBoundingClientRect().width<=0)return;
  if(gesture){if(event.pointerId!==gesture.pointerId&&event.pointerType==='touch')finish(true);return;}
  const item=event.target.closest('[data-timeline-kind]'),kind=item?.dataset.timelineKind,id=item?.dataset.timelineId,handle=event.target.closest('[data-drag-time]');
  if(event.target.closest('.prop-lane,.music-window'))return;
  // Clip bodies scroll natively on touch; their dedicated grip starts an edit.
  if(event.pointerType==='touch'&&item&&!event.target.closest('[data-reorder-grip],[data-drag-time]'))return;
  if(event.pointerType==='touch'&&!item&&!event.target.closest('.time-ruler'))return;
  const edge=handle?.dataset.dragTime||(kind==='formation'&&options.mode()==='reorder'?'reorder':'move');
  const p=options.project(),project=clone(p),value=kind?timelineItem(project,kind,id):null,index=kind==='formation'?project.formations.findIndex(f=>f.id===id):-1;
  const start=kind==='movement'?value.start:value?.time||0,end=kind==='formation'?(project.formations[index+1]?.time??project.duration):value?.end;
  const base=edge==='reorder'?(start+end)/2:edge==='end'?end:start;
  const editable=!options.readOnly()&&!(kind==='formation'&&(value.status==='approved'||index===0&&edge!=='end'&&edge!=='reorder'));
  const exclude=kind==='formation'&&edge==='end'?project.formations[index+1]?.id:id;
  gesture={item,kind,id,edge,project,start,end,base,exclude,editable,playhead:options.time(),fingerprint:timelineFingerprint(p),pointerId:event.pointerId,x:event.clientX,y:event.clientY,clientX:event.clientX,clientY:event.clientY,at:0,target:index,lastToken:undefined,moved:false,dirty:false,altKey:!!event.altKey};
  gesture.at=timeAt(event.clientX,gesture);options.pause();options.active?.(true);
  if(item){options.select?.(kind,id);event.preventDefault();}else{gesture.dirty=true;schedule();}
  try{area.setPointerCapture(event.pointerId);}catch{finish(true);}
 });
 listen(area,'pointermove',event=>{
  const g=gesture;if(!g||event.pointerId!==g.pointerId)return;
  g.clientX=event.clientX;g.clientY=event.clientY;g.altKey=!!event.altKey;
  if(Math.hypot(g.clientX-g.x,g.clientY-g.y)>5)g.moved=true;
  g.dirty=true;schedule();
 });
 listen(area,'pointerup',event=>{if(gesture?.pointerId!==event.pointerId)return;gesture.clientX=event.clientX;gesture.clientY=event.clientY;gesture.altKey=!!event.altKey;if(Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>5)gesture.moved=true;gesture.dirty=true;finish(false);});
 for(const type of ['pointercancel','lostpointercapture'])listen(area,type,event=>{if(gesture?.pointerId===event.pointerId)finish(true);});
 listen(area,'cancel-timeline-gesture',()=>finish(true));
 listen(environment,'blur',()=>finish(true));
 listen(environment.document,'visibilitychange',()=>{if(environment.document.hidden)finish(true);});
 listen(environment.document,'studio-recover',()=>finish(true));
 listen(environment.document,'keydown',event=>{if(event.key==='Escape'&&gesture){event.preventDefault();finish(true);}});
 return {cancel:()=>finish(true,{silent:true}),dispose(){finish(true,{silent:true});disposed=true;clear();listeners.forEach(remove=>remove());},get active(){return !!gesture;}};
}
