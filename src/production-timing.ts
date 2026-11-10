import type {Production,Route,StageProp,TrackName} from './types.js';
import type {Project} from './types.js';
import {clone,validateProject} from './engine.js';
const track:Record<string,TrackName>={formation:'formations',movement:'movement',cue:'cues',prop:'props',light:'lighting',appearance:'appearance',camera:'camera'};
const round=(n:number)=>Math.round(n*1000)/1000;
/**
 * A timed record: formations, cues, keyframes and production events have a time; movement clips have a start and end.
 * The display fields are those of the record's own kind (a formation's name, a cue's label, an appearance's costume).
 */
export interface TimedRecord {id:string; time?:number; start?:number; end?:number; name?:string; label?:string; costume?:string}
/** One event on the timeline, keyed `kind/id` (prop keyframes: `prop/propId/id`). */
export interface TimedItem {key:string; kind:string; item:TimedRecord; parent?:StageProp; track:TrackName; time:number}
/** The edited event and how it changed: `move`, or for spans the `start` or `end` edge. */
export interface TimingEdit {kind:string; id:string; edge?:string; copy?:boolean; validate?:boolean}
export function timedItems(project: Project):TimedItem[]{
 const p:Partial<Production>=project.production||{},out:TimedItem[]=[];
 const add=(kind:string,item:TimedRecord,parent?:StageProp)=>out.push({key:kind+'/'+(parent?parent.id+'/':'')+item.id,kind,item,parent,track:track[kind],time:(kind==='movement'?item.start:item.time) as number});
 project.formations.forEach(v=>add('formation',v));project.actions.forEach(v=>add('movement',v));project.cues.forEach(v=>add('cue',v));project.props.forEach(prop=>(prop.keyframes||[]).forEach(v=>add('prop',v,prop)));
 (p.lights||[]).forEach(v=>add('light',v));(p.appearances||[]).forEach(v=>add('appearance',v));(p.cameras||[]).forEach(v=>add('camera',v));return out;
}
/** `kind` is an item kind (`formation`, `light`, …) or a track name (`props`, `lighting`, …). */
export function assertTrackUnlocked(project: Project,kind:string|undefined,id?:string){const key=(kind&&track[kind])||kind;if(project.production?.layers?.[key as TrackName]?.locked)throw Error('Unlock the '+key+' track before editing.');if(kind==='formation'&&project.formations.find(f=>f.id===id)?.status==='approved')throw Error('Unlock the formation first.');}
export function cleanLinks(project: Project){if(!project.production)return project;const existing=new Set(timedItems(project).map(v=>v.key));project.production.links=project.production.links.map(g=>({...g,items:g.items.filter(k=>existing.has(k))})).filter(g=>g.items.length>=2);return project;}
export function assertRouteEdits(before: Project,after: Project){
 const shape=(r:Route)=>JSON.stringify([r.fromId,r.toId,r.performerId,r.duration,r.delay,r.easing,r.curve||'linear',r.timingCurve||null,r.waypoints?.map(p=>[p.x,p.z])||[]]);
 const routes=new Map((after.routes||[]).map(r=>[r.id,r]));
 for(const route of before.routes||[])if(route.locked){const next=routes.get(route.id);if(!next||shape(route)!==shape(next))throw Error('Unlock the affected custom route before changing or removing it.');}
 if(before.production?.layers.movement.locked&&JSON.stringify(before.routes)!==JSON.stringify(after.routes))throw Error('Unlock the movement track before changing its custom routes.');
}
export function assertProductionLocks(before:Project,after:Project){
 assertRouteEdits(before,after);
 const p=before.production;if(!p)return;const values=(project: Project)=>({music:[project.music,project.audioName,project.bpm],formations:[project.formations,project.routes,project.duration,project.ensemble?.attendance,project.ensemble?.constraints],movement:project.actions,cues:project.cues,props:[project.props,project.stage,project.production?.stage,project.production?.zones],lighting:project.production?.lights,appearance:project.production?.appearances,camera:project.production?.cameras}),a=values(before),b=values(after);
 for(const key of Object.keys(a) as (keyof typeof a)[])if(p.layers[key]?.locked&&JSON.stringify(a[key])!==JSON.stringify(b[key]))throw Error('Unlock the '+key+' track before changing its contents.');
}
// Freshly owned candidates can be retimed in place; default callers copy before related writes.
export function applyTimingRelations(original:Project,candidate:Project,{kind,id,edge,copy=true,validate=true}:TimingEdit):Project{
 assertTrackUnlocked(original,kind,id);const production=original.production;if(!production||!production.ripple&&!production.links.length||kind==='movement'&&(edge==='start'||edge==='end'))return candidate;
 const next=copy?clone(candidate):candidate,before=timedItems(original),after=timedItems(next),beforeByKey=new Map(before.map(v=>[v.key,v])),afterByKey=new Map(after.map(v=>[v.key,v])),key=kind+'/'+id,source=before.find(v=>v.key===key),target=after.find(v=>v.key===key);if(!source||!target)return next;
 const shifts=new Map<string,number>(),endBoundary=kind==='formation'&&edge==='end';
 let anchor=source.time,delta=target.time-source.time,pivot=source.key;
 if(endBoundary){const index=original.formations.findIndex(f=>f.id===id),a=original.formations[index+1],b=next.formations[index+1];anchor=a?.time??original.duration;delta=(b?.time??next.duration)-anchor;pivot=a?'formation/'+a.id:'';}
 if(!delta)return next;
 if(production.ripple&&kind==='formation'){
  before.forEach(v=>{if(v.time>=anchor-.00001)shifts.set(v.key,delta);});
  next.duration=round(original.duration+delta);
  if(next.duration<1||next.duration>3600)throw Error('Ripple would put the performance outside 1–3600 seconds.');
  // Spanning movement clips grow or shrink with the edited interval.
  original.actions.filter(a=>a.start<anchor&&a.end>=anchor).forEach(a=>{assertTrackUnlocked(original,'movement',a.id);next.actions.find(v=>v.id===a.id)!.end=round(a.end+delta);});
  for(const field of ['comments','checkpoints'] as const)for(const item of next[field]||[])if(item.time>=anchor)item.time=round(item.time+delta);
  for(const prop of next.props)for(const item of prop.attachments||[])if(item.time>=anchor){assertTrackUnlocked(original,'prop',prop.id);if(prop.locked)throw Error('Unlock affected props before ripple editing.');item.time=round(item.time+delta);}
  if(next.referenceVideo&&next.referenceVideo.start>=anchor)next.referenceVideo.start=round(next.referenceVideo.start+delta);
  for(const reservation of next.ensemble?.traffic||[]){
   if(reservation.start>=anchor){reservation.start=round(reservation.start+delta);reservation.end=round(reservation.end+delta);}
   else if(reservation.end>=anchor)reservation.end=round(reservation.end+delta);
   if(reservation.start<0||reservation.end-reservation.start<.0999)throw Error('Ripple would make a backstage reservation too short. Shorten or remove that reservation first.');
  }
 }else shifts.set(pivot,delta);
 // A linked group follows any member displaced by this edit, exactly once.
 for(const group of production.links){if(group.items.some(k=>shifts.has(k)))group.items.forEach(k=>shifts.set(k,delta));}
 for(const [itemKey,shift] of shifts){const a=beforeByKey.get(itemKey),b=afterByKey.get(itemKey);if(!a||!b)continue;assertTrackUnlocked(original,a.kind,a.item.id);if(a.parent?.locked)throw Error('Unlock the linked prop before retiming.');if(a.kind==='formation'&&a.time===0)throw Error('A linked or ripple edit cannot move the opening from zero.');if(a.kind==='movement'){b.item.start=round(a.item.start!+shift);b.item.end=round(a.item.end!+shift);}else b.item.time=round(a.time+shift);}
 if(next.formations.some((f,i)=>i&&f.time-next.formations[i-1].time<.0999))throw Error('Linked timing would overlap sequence boundaries.');
 next.cues.sort((a,b)=>a.time-b.time);for(const k of ['lights','appearances','cameras'] as const)next.production[k].sort((a,b)=>a.time-b.time);
 return validate?validateProject(next):next;
}
export function shiftProductionItem(project: Project,key:string,time:number){
 if(!Number.isFinite(time))throw Error('Enter a valid time.');const next=clone(project),item=timedItems(next).find(v=>v.key===key);if(!item)throw Error('This event no longer exists.');assertTrackUnlocked(project,item.kind,item.item.id);if(item.parent?.locked)throw Error('Unlock this prop first.');if(item.kind==='movement'){const delta=time-item.item.start!;item.item.start=time;item.item.end!+=delta;}else item.item.time=time;
 return validateProject(applyTimingRelations(project,next,{kind:item.kind,id:key.slice(key.indexOf('/')+1),edge:'move',copy:false,validate:false}));
}
export function applyReorderRelations(original:Project,candidate:Project,{copy=true}={}):Project{
 if(!original.production?.links.length)return candidate;const next=copy?clone(candidate):candidate,before=timedItems(original),after=timedItems(next),beforeByKey=new Map(before.map(v=>[v.key,v])),afterByKey=new Map(after.map(v=>[v.key,v]));
 for(const group of original.production.links){const deltas=group.items.map(key=>{const a=beforeByKey.get(key),b=afterByKey.get(key);return a&&b?round(b.time-a.time):0;}).filter(Boolean);if(!deltas.length)continue;if(deltas.some(d=>d!==deltas[0]))throw Error('Linked events would move by different amounts. Unlink them before reordering.');const delta=deltas[0];for(const key of group.items){const a=beforeByKey.get(key),b=afterByKey.get(key);if(!a||!b)continue;assertTrackUnlocked(original,a.kind,a.item.id);if(a.parent?.locked)throw Error('Unlock the linked prop first.');if(a.kind==='formation'&&a.time===0)throw Error('A linked group cannot move the opening.');if(b.time===a.time){if(a.kind==='movement'){b.item.start=round(a.item.start!+delta);b.item.end=round(a.item.end!+delta);}else b.item.time=round(a.time+delta);}}}
 for(const key of ['lights','appearances','cameras'] as const)next.production[key].sort((a,b)=>a.time-b.time);next.cues.sort((a,b)=>a.time-b.time);return validateProject(next);
}
export function rippleRemoveFormation(original:Project,candidate:Project,id:string){
 const index=original.formations.findIndex(f=>f.id===id),start=original.formations[index].time,end=original.formations[index+1]?.time??original.duration,delta=end-start,next=clone(candidate),state=original.production;
 const section=(time:number)=>time<start?0:time<end?1:2;
 const existing=timedItems(original);
 for(const group of state.links){const parts=new Set(group.items.map(key=>existing.find(v=>v.key===key)).filter(v=>v!==undefined).map(v=>section(v.time)));if(parts.size>1)throw Error('Unlink groups spanning the deleted interval before ripple deletion.');}
 for(const event of existing)if(event.time>=start){assertTrackUnlocked(original,event.kind,event.item.id);if(event.parent?.locked)throw Error('Unlock affected props before ripple deletion.');}
 const shift=<T extends {time:number}>(values:T[],key:'time'='time'):T[]=>values.filter(v=>section(v[key])!==1).map(v=>({...v,[key]:v[key]>=end?round(v[key]-delta):v[key]}));
 next.duration=round(original.duration-delta);next.formations.forEach(f=>{if(f.time>=end)f.time=round(f.time-delta);});next.cues=shift(next.cues);next.comments=shift(next.comments);next.checkpoints=shift(next.checkpoints||[]);next.cueLog=next.cueLog.filter(v=>next.cues.some(c=>c.id===v.cueId));
 next.actions=original.actions.flatMap(a=>{if(a.end<=start)return [clone(a)];assertTrackUnlocked(original,'movement',a.id);if(a.start>=end)return [{...a,start:round(a.start-delta),end:round(a.end-delta)}];if(a.start>=start&&a.end<=end)return [];const value={...a,start:a.start<start?a.start:start,end:a.end>end?round(a.end-delta):start};return value.end-value.start>=.0999?[value]:[];});
 if(next.ensemble)next.ensemble.traffic=next.ensemble.traffic.flatMap(v=>{
  if(v.end<=start)return [v];if(v.start>=end)return [{...v,start:round(v.start-delta),end:round(v.end-delta)}];if(v.start>=start&&v.end<=end)return [];
  const value={...v,start:v.start<start?v.start:start,end:v.end>end?round(v.end-delta):start};return value.end-value.start>=.0999?[value]:[];
 });
 for(const prop of next.props){if(prop.attachments?.some(v=>v.time>=start)){assertTrackUnlocked(original,'props');if(prop.locked)throw Error('Unlock affected props before ripple deletion.');}prop.keyframes=shift(prop.keyframes||[]);prop.attachments=shift(prop.attachments||[]);}
 next.production.lights=shift(next.production.lights);next.production.appearances=shift(next.production.appearances);next.production.cameras=shift(next.production.cameras);
 if(next.referenceVideo&&next.referenceVideo.start>=start)next.referenceVideo.start=next.referenceVideo.start>=end?round(next.referenceVideo.start-delta):start;
 return validateProject(cleanLinks(next));
}
