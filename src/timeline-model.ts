import type {Project} from './types.js';
import {clone,clamp,uid,sampleAuthoredPerformance} from './engine.js';
import {applyTimingRelations,applyReorderRelations,assertTrackUnlocked,assertRouteEdits,cleanLinks,rippleRemoveFormation} from './production-timing.js';
import {cleanEnsemble} from './ensemble-schema.js';

export const roundTime=value=>Math.round(value*1000)/1000;
const namedCopy=(name,suffix)=>name.slice(0,200-suffix.length)+suffix;
export function waveformWindow(audioDuration,performanceDuration){
  if(!Number.isFinite(audioDuration)||!Number.isFinite(performanceDuration)||audioDuration<=0||performanceDuration<=0)throw Error('Audio and performance lengths must be positive.');
  return {width:Math.min(1,audioDuration/performanceDuration)*100,viewBoxWidth:1360*Math.min(1,performanceDuration/audioDuration)};
}
export function snappedTime(value,bpm,snap='beat',offset=0){
  const step=snap==='beat'?60/bpm:snap==='half-beat'?30/bpm:snap==='second'?1:.001;
  const origin=snap==='beat'||snap==='half-beat'?offset:0;return roundTime(Math.round((value-origin)/step)*step+origin);
}
// Return a complete candidate so a rejected gesture cannot partially mutate the score.
export function editTimeline(project: Project,operation){const {kind,id,edge='move'}=operation;assertTrackUnlocked(project,kind,id);return applyTimingRelations(project,editTimelineBase(project,operation),{kind,id,edge,copy:false});}
// Share effective limits with pointer previews so a held trim at its boundary
// does not clone and redraw the same candidate on every animation frame.
export function timelineEditBounds(project: Project,{kind,id,edge='move'}){
 const item=timelineItem(project,kind,id);
 if(kind==='cue')return {min:0,max:project.duration};
 if(kind==='movement')return edge==='start'?{min:0,max:item.end-.1}:edge==='end'?{min:item.start+.1,max:project.duration}:{min:0,max:project.duration-(item.end-item.start)};
 const index=project.formations.indexOf(item),next=project.formations[index+1],ripple=project.production?.ripple;
 if(edge==='end'){
  if(next)return {min:item.time+.1,max:ripple?3600-project.duration+next.time:(project.formations[index+2]?.time??project.duration)-.1};
  const events=[...project.actions.map(a=>a.end),...project.cues.map(c=>c.time),...project.comments.map(c=>c.time),...project.props.flatMap(p=>[...(p.keyframes||[]),...(p.attachments||[])].map(f=>f.time)),...(project.checkpoints||[]).map(c=>c.time),...(project.ensemble?.traffic||[]).map(v=>v.end),project.referenceVideo?.start||0,...['lights','appearances','cameras'].flatMap(key=>(project.production?.[key]||[]).map(v=>v.time))];
  return {min:Math.max(1,item.time+.1,...events.filter(at=>!ripple||at<project.duration-.0001)),max:3600};
 }
 return index?{min:project.formations[index-1].time+.1,max:ripple?3600-project.duration+item.time:(next?.time??project.duration)-.1}:{min:0,max:0};
}
function editTimelineBase(project: Project,{kind,id,edge='move',value}){
  if(!Number.isFinite(value))throw Error('Enter a valid time.');
  const bounds=timelineEditBounds(project,{kind,id,edge});if(bounds.max<bounds.min)throw Error('This interval is too short to trim.');
  value=roundTime(clamp(value,bounds.min,bounds.max));
  const next=clone(project),forms=next.formations;
  if(kind==='formation'){
    const index=forms.findIndex(f=>f.id===id),f=forms[index];
    if(!f||f.status==='approved')throw Error('Unlock the formation before retiming.');
    if(edge==='end'){
      if(forms[index+1]){
        const target=forms[index+1];if(target.status==='approved')throw Error('Unlock the next formation before moving this shared boundary.');
        target.time=value;
      }else{
        next.duration=value;
      }
    }else{
      if(index===0)throw Error('The opening time stays at zero. Trim its right edge instead.');
      f.time=value;
    }
  }else if(kind==='cue'){
    const cue=next.cues.find(c=>c.id===id);if(!cue)throw Error('Cue no longer exists.');
    cue.time=roundTime(clamp(value,0,next.duration));next.cues.sort((a,b)=>a.time-b.time);
  }else if(kind==='movement'){
    const action=next.actions.find(a=>a.id===id);if(!action)throw Error('Movement no longer exists.');
    if(edge==='start')action.start=roundTime(clamp(value,0,action.end-.1));
    else if(edge==='end')action.end=roundTime(clamp(value,action.start+.1,next.duration));
    else {const length=action.end-action.start;action.start=roundTime(clamp(value,0,next.duration-length));action.end=roundTime(action.start+length);}
  }else throw Error('Unknown timeline track.');
  return next;
}

const keyFor=kind=>({formation:'formations',movement:'actions',cue:'cues'})[kind];
export function timelineItem(project: Project,kind,id){const key=keyFor(kind);const item=key&&project[key].find(item=>item.id===id);if(!item)throw Error('Select an existing timeline item.');return item;}
function pruneRoutes(project: Project){const pairs=new Set(project.formations.slice(0,-1).map((f,i)=>`${f.id}/${project.formations[i+1].id}`));project.routes=project.routes.filter(r=>pairs.has(`${r.fromId}/${r.toId}`));}
function freeFormationTime(project: Project,time){
  if(!Number.isFinite(time)||time<.1||time>project.duration-.1||project.formations.some(f=>Math.abs(f.time-time)<.0999))throw Error('Place the playhead at a free time, at least 0.1 seconds from another formation and the end.');
}
export function copyTimelineItem(project: Project,kind,id){return {projectId:project.id,kind,item:clone(timelineItem(project,kind,id))};}
export function pasteTimelineItem(project: Project,clipboard,time){
  assertTrackUnlocked(project,clipboard?.kind);
  if(!Number.isFinite(time))throw Error('Choose a valid paste time.');
  if(!clipboard||clipboard.projectId!==project.id)throw Error('Copy a clip from this project first.');
  const next=clone(project),kind=clipboard.kind,key=keyFor(kind),limit={formation:100,movement:300,cue:100}[kind];
  if(!key||next[key].length>=limit)throw Error(`This track supports up to ${limit||0} items.`);
  time=roundTime(time);const item=clone(clipboard.item);item.id=uid();
  if(kind==='formation'){freeFormationTime(next,time);const base=sampleAuthoredPerformance(project,time);item.positions=next.performers.map(person=>clone(item.positions.find(p=>p.performerId===person.id)||base.find(p=>p.performerId===person.id)));item.time=time;item.status='draft';item.name=namedCopy(item.name,' — copy');}
  if(kind==='movement'){const length=item.end-item.start;if(time<0||time+length>next.duration+.0001)throw Error('The copied movement does not fit here. Move the playhead earlier or extend the performance.');item.performerIds=item.performerIds.filter(id=>next.performers.some(p=>p.id===id));item.start=time;item.end=roundTime(time+length);item.name=namedCopy(item.name,' — copy');}
  if(kind==='cue'){if(time<0||time>next.duration)throw Error('Place this cue inside the performance.');item.time=time;item.label=namedCopy(item.label,' — copy');}
  next[key].push(item);if(kind!=='movement')next[key].sort((a,b)=>a.time-b.time);if(kind==='formation')pruneRoutes(next);
  assertRouteEdits(project,next);return {project:next,item,kind};
}
export function duplicateTimelineItem(project: Project,kind,id){
  const item=timelineItem(project,kind,id);let time;
  if(kind==='formation'){const index=project.formations.indexOf(item),end=project.formations[index+1]?.time??project.duration;time=roundTime((item.time+end)/2);}
  if(kind==='movement'){const length=item.end-item.start;time=item.end+length<=project.duration?item.end:item.start-length>=0?item.start-length:clamp(item.start+60/project.bpm,0,project.duration-length);}
  if(kind==='cue'){const step=Math.min(60/project.bpm,project.duration/2);for(let i=1;i<=project.cues.length+1&&time===undefined;i++)for(const direction of [1,-1]){const candidate=roundTime(item.time+direction*step*i);if(candidate>=0&&candidate<=project.duration&&!project.cues.some(c=>Math.abs(c.time-candidate)<.0005)){time=candidate;break;}}if(time===undefined){const bounds=[0,...project.cues.map(c=>c.time),project.duration].sort((a,b)=>a-b),gaps=bounds.slice(1).map((end,i)=>roundTime((bounds[i]+end)/2)).filter(at=>!project.cues.some(c=>Math.abs(c.time-at)<.0005));gaps.sort((a,b)=>Math.abs(a-item.time)-Math.abs(b-item.time));time=gaps[0];}if(time===undefined)throw Error('No free cue time. Extend the performance or remove a cue.');}
  return pasteTimelineItem(project,copyTimelineItem(project,kind,id),time);
}
export function splitTimelineItem(project: Project,kind,id,time){
  assertTrackUnlocked(project,kind,id);
  if(!Number.isFinite(time))throw Error('Choose a valid split time.');
  const original=timelineItem(project,kind,id),next=clone(project),key=keyFor(kind),source=next[key].find(item=>item.id===id);time=roundTime(time);
  if(kind==='cue')throw Error('A cue is a point in time and cannot be split.');
  if(next[key].length>=(kind==='formation'?100:300))throw Error('This track has reached its item limit.');
  const end=kind==='formation'?(project.formations[project.formations.indexOf(original)+1]?.time??project.duration):original.end,start=kind==='formation'?original.time:original.start;
  if(time-start<.0999||end-time<.0999)throw Error('Place the playhead inside the selected clip, at least 0.1 seconds from either edge.');
  const item=clone(source);item.id=uid();item.name=namedCopy(item.name,' · part 2');
  if(kind==='formation'){if(source.status==='approved')throw Error('Unlock this formation before splitting.');item.time=time;item.status='draft';item.positions=sampleAuthoredPerformance(project,time);next.formations.push(item);next.formations.sort((a,b)=>a.time-b.time);pruneRoutes(next);}
  else{source.end=time;item.start=time;next.actions.push(item);}
  assertRouteEdits(project,next);return {project:next,item,kind};
}
export function removeTimelineItem(project: Project,kind,id){
  assertTrackUnlocked(project,kind,id);
  const item=timelineItem(project,kind,id),next=clone(project),key=keyFor(kind);
  if(kind==='formation'){
    if(item.time===0)throw Error('Keep the opening formation at zero.');
    if(item.status==='approved')throw Error('Unlock this formation before deleting or cutting it.');
    next.routes=next.routes.filter(r=>r.fromId!==id&&r.toId!==id);
  }
  next[key]=next[key].filter(item=>item.id!==id);if(kind==='cue')next.cueLog=next.cueLog.filter(c=>c.cueId!==id);
  assertRouteEdits(project,next);cleanEnsemble(next);
  return kind==='formation'&&project.production?.ripple?rippleRemoveFormation(project,next,id):cleanLinks(next);
}
export function packMovementRows(actions){
  const ends=[],rows=new Map();for(const action of [...actions].sort((a,b)=>a.start-b.start||a.end-b.end)){
    let row=ends.findIndex(end=>end<=action.start);if(row<0)row=ends.length;ends[row]=action.end;rows.set(action.id,row);
  }return {rows,count:Math.max(1,ends.length)};
}
export function reorderFormation(project: Project,id,targetIndex){
  assertTrackUnlocked(project,'formation',id);
  const next=clone(project),source=next.formations.findIndex(f=>f.id===id);
  if(source<0||!Number.isInteger(targetIndex)||targetIndex<0||targetIndex>=next.formations.length)throw Error('Choose an existing sequence slot.');
  const affected=next.formations.slice(Math.min(source,targetIndex),Math.max(source,targetIndex)+1);
  if(affected.some(f=>f.status==='approved'))throw Error('Unlock the affected formations before reordering.');
  const times=next.formations.map(f=>f.time),[item]=next.formations.splice(source,1);
  next.formations.splice(targetIndex,0,item);next.formations.forEach((f,i)=>f.time=times[i]);
  const adjacent=new Set(next.formations.slice(0,-1).map((f,i)=>`${f.id}/${next.formations[i+1].id}`));
  next.routes=next.routes.filter(r=>adjacent.has(`${r.fromId}/${r.toId}`));
  assertRouteEdits(project,next);return applyReorderRelations(project,next,{copy:false});
}

export function setFormationTransition(project: Project,id,settings){
  assertTrackUnlocked(project,'formation',id);
  const next=clone(project),index=next.formations.findIndex(f=>f.id===id),f=next.formations[index],to=next.formations[index+1];
  if(!f||!to)throw Error('Select a formation with a following sequence. The final formation holds to the end.');
  if(f.status==='approved')throw Error('Unlock this formation before editing its movement.');
  if(settings===null){delete f.transition;return next;}
  if(!Number.isFinite(settings.duration)||settings.duration<.1||settings.duration>Math.min(60,to.time-f.time)||!['smooth','linear'].includes(settings.easing)||!['direct','curved'].includes(settings.pathType))throw Error('Choose a movement duration from 0.1 seconds up to the sequence interval (maximum 60 seconds).');
  f.transition={duration:roundTime(settings.duration),easing:settings.easing,pathType:settings.pathType};return next;
}
