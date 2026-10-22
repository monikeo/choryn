import {clone,clamp,uid,samplePerformance} from './engine.js';
import {applyTimingRelations,applyReorderRelations,assertTrackUnlocked,cleanLinks,rippleRemoveFormation} from './production-timing.js';

export const roundTime=value=>Math.round(value*1000)/1000;
export function waveformWindow(audioDuration,performanceDuration){
  if(!Number.isFinite(audioDuration)||!Number.isFinite(performanceDuration)||audioDuration<=0||performanceDuration<=0)throw Error('Audio and performance lengths must be positive.');
  return {width:Math.min(1,audioDuration/performanceDuration)*100,viewBoxWidth:1360*Math.min(1,performanceDuration/audioDuration)};
}
export function snappedTime(value,bpm,snap='beat',offset=0){
  const step=snap==='beat'?60/bpm:snap==='half-beat'?30/bpm:snap==='second'?1:.001;
  const origin=snap==='beat'||snap==='half-beat'?offset:0;return roundTime(Math.round((value-origin)/step)*step+origin);
}
// Return a complete candidate so a rejected gesture cannot partially mutate the score.
export function editTimeline(project,operation){const {kind,id,edge='move'}=operation;assertTrackUnlocked(project,kind,id);return applyTimingRelations(project,editTimelineBase(project,operation),{kind,id,edge});}
function editTimelineBase(project,{kind,id,edge='move',value}){
  if(!Number.isFinite(value))throw Error('Enter a valid time.');
  const next=clone(project),forms=next.formations;
  if(kind==='formation'){
    const index=forms.findIndex(f=>f.id===id),f=forms[index];
    if(!f||f.status==='approved')throw Error('Unlock the formation before retiming.');
    if(edge==='end'){
      if(forms[index+1]){
        const target=forms[index+1];if(target.status==='approved')throw Error('Unlock the next formation before moving this shared boundary.');
        const min=f.time+.1,max=project.production?.ripple?Math.min(3600,next.duration+value-target.time):(forms[index+2]?.time??next.duration)-.1;if(max<min)throw Error('This interval is too short to trim.');
        target.time=roundTime(clamp(value,min,max));
      }else{
        const events=[...next.actions.map(a=>a.end),...next.cues.map(c=>c.time),...next.comments.map(c=>c.time),...next.props.flatMap(p=>[...(p.keyframes||[]),...(p.attachments||[])].map(f=>f.time)),...(next.checkpoints||[]).map(c=>c.time),next.referenceVideo?.start||0,...['lights','appearances','cameras'].flatMap(key=>(next.production?.[key]||[]).map(v=>v.time))],minimum=Math.max(1,f.time+.1,...events.filter(at=>!project.production?.ripple||at<project.duration-.0001));
        next.duration=roundTime(clamp(value,minimum,3600));
      }
    }else{
      if(index===0)throw Error('The opening time stays at zero. Trim its right edge instead.');
      const min=forms[index-1].time+.1,max=project.production?.ripple?3600:(forms[index+1]?.time??next.duration)-.1;if(max<min)throw Error('This interval is too short to retime.');
      f.time=roundTime(clamp(value,min,max));
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
export function timelineItem(project,kind,id){const key=keyFor(kind);const item=key&&project[key].find(item=>item.id===id);if(!item)throw Error('Select an existing timeline item.');return item;}
function pruneRoutes(project){const pairs=new Set(project.formations.slice(0,-1).map((f,i)=>`${f.id}/${project.formations[i+1].id}`));project.routes=project.routes.filter(r=>pairs.has(`${r.fromId}/${r.toId}`));}
function freeFormationTime(project,time){
  if(!Number.isFinite(time)||time<.1||time>project.duration-.1||project.formations.some(f=>Math.abs(f.time-time)<.0999))throw Error('Place the playhead at a free time, at least 0.1 seconds from another formation and the end.');
}
export function copyTimelineItem(project,kind,id){return {projectId:project.id,kind,item:clone(timelineItem(project,kind,id))};}
export function pasteTimelineItem(project,clipboard,time){
  assertTrackUnlocked(project,clipboard?.kind);
  if(!Number.isFinite(time))throw Error('Choose a valid paste time.');
  if(!clipboard||clipboard.projectId!==project.id)throw Error('Copy a clip from this project first.');
  const next=clone(project),kind=clipboard.kind,key=keyFor(kind),limit={formation:100,movement:300,cue:100}[kind];
  if(!key||next[key].length>=limit)throw Error(`This track supports up to ${limit||0} items.`);
  time=roundTime(time);const item=clone(clipboard.item);item.id=uid();
  if(kind==='formation'){freeFormationTime(next,time);const base=samplePerformance(project,time);item.positions=next.performers.map(person=>clone(item.positions.find(p=>p.performerId===person.id)||base.find(p=>p.performerId===person.id)));item.time=time;item.status='draft';item.name=`${item.name} — copy`.slice(0,200);}
  if(kind==='movement'){const length=item.end-item.start;if(time<0||time+length>next.duration+.0001)throw Error('The copied movement does not fit here. Move the playhead earlier or extend the performance.');item.performerIds=item.performerIds.filter(id=>next.performers.some(p=>p.id===id));item.start=time;item.end=roundTime(time+length);item.name=`${item.name} — copy`.slice(0,200);}
  if(kind==='cue'){if(time<0||time>next.duration)throw Error('Place this cue inside the performance.');item.time=time;item.label=`${item.label} — copy`.slice(0,200);}
  next[key].push(item);if(kind!=='movement')next[key].sort((a,b)=>a.time-b.time);if(kind==='formation')pruneRoutes(next);
  return {project:next,item,kind};
}
export function duplicateTimelineItem(project,kind,id){
  const item=timelineItem(project,kind,id);let time;
  if(kind==='formation'){const index=project.formations.indexOf(item),end=project.formations[index+1]?.time??project.duration;time=roundTime((item.time+end)/2);}
  if(kind==='movement'){const length=item.end-item.start;time=item.end+length<=project.duration?item.end:item.start-length;}
  if(kind==='cue')time=Math.min(project.duration,item.time+60/project.bpm);
  return pasteTimelineItem(project,copyTimelineItem(project,kind,id),time);
}
export function splitTimelineItem(project,kind,id,time){
  assertTrackUnlocked(project,kind,id);
  if(!Number.isFinite(time))throw Error('Choose a valid split time.');
  const original=timelineItem(project,kind,id),next=clone(project),key=keyFor(kind),source=next[key].find(item=>item.id===id);time=roundTime(time);
  if(kind==='cue')throw Error('A cue is a point in time and cannot be split.');
  if(next[key].length>=(kind==='formation'?100:300))throw Error('This track has reached its item limit.');
  const end=kind==='formation'?(project.formations[project.formations.indexOf(original)+1]?.time??project.duration):original.end,start=kind==='formation'?original.time:original.start;
  if(time<start+.1||time>end-.1)throw Error('Place the playhead inside the selected clip, at least 0.1 seconds from either edge.');
  const item=clone(source);item.id=uid();item.name=`${item.name} · part 2`.slice(0,200);
  if(kind==='formation'){if(source.status==='approved')throw Error('Unlock this formation before splitting.');item.time=time;item.status='draft';item.positions=samplePerformance(project,time);next.formations.push(item);next.formations.sort((a,b)=>a.time-b.time);pruneRoutes(next);}
  else{source.end=time;item.start=time;next.actions.push(item);}
  return {project:next,item,kind};
}
export function removeTimelineItem(project,kind,id){
  assertTrackUnlocked(project,kind,id);
  const item=timelineItem(project,kind,id),next=clone(project),key=keyFor(kind);
  if(kind==='formation'){
    if(item.time===0)throw Error('Keep the opening formation at zero.');
    if(item.status==='approved')throw Error('Unlock this formation before deleting or cutting it.');
    next.routes=next.routes.filter(r=>r.fromId!==id&&r.toId!==id);
  }
  next[key]=next[key].filter(item=>item.id!==id);if(kind==='cue')next.cueLog=next.cueLog.filter(c=>c.cueId!==id);
  return kind==='formation'&&project.production?.ripple?rippleRemoveFormation(project,next,id):cleanLinks(next);
}
export function packMovementRows(actions){
  const ends=[],rows=new Map();for(const action of [...actions].sort((a,b)=>a.start-b.start||a.end-b.end)){
    let row=ends.findIndex(end=>end<=action.start);if(row<0)row=ends.length;ends[row]=action.end;rows.set(action.id,row);
  }return {rows,count:Math.max(1,ends.length)};
}
export function reorderFormation(project,id,targetIndex){
  assertTrackUnlocked(project,'formation',id);
  const next=clone(project),source=next.formations.findIndex(f=>f.id===id);
  if(source<0||!Number.isInteger(targetIndex)||targetIndex<0||targetIndex>=next.formations.length)throw Error('Choose an existing sequence slot.');
  const affected=next.formations.slice(Math.min(source,targetIndex),Math.max(source,targetIndex)+1);
  if(affected.some(f=>f.status==='approved'))throw Error('Unlock the affected formations before reordering.');
  const times=next.formations.map(f=>f.time),[item]=next.formations.splice(source,1);
  next.formations.splice(targetIndex,0,item);next.formations.forEach((f,i)=>f.time=times[i]);
  const adjacent=new Set(next.formations.slice(0,-1).map((f,i)=>`${f.id}/${next.formations[i+1].id}`));
  next.routes=next.routes.filter(r=>adjacent.has(`${r.fromId}/${r.toId}`));
  return applyReorderRelations(project,next);
}

export function setFormationTransition(project,id,settings){
  assertTrackUnlocked(project,'formation',id);
  const next=clone(project),index=next.formations.findIndex(f=>f.id===id),f=next.formations[index],to=next.formations[index+1];
  if(!f||!to)throw Error('Select a formation with a following sequence. The final formation holds to the end.');
  if(f.status==='approved')throw Error('Unlock this formation before editing its movement.');
  if(settings===null){delete f.transition;return next;}
  if(!Number.isFinite(settings.duration)||settings.duration<.1||settings.duration>Math.min(60,to.time-f.time)||!['smooth','linear'].includes(settings.easing)||!['direct','curved'].includes(settings.pathType))throw Error('Choose a movement duration from 0.1 seconds up to the sequence interval (maximum 60 seconds).');
  f.transition={duration:roundTime(settings.duration),easing:settings.easing,pathType:settings.pathType};return next;
}
