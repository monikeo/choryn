import {clone,clamp} from './engine.js';

export const roundTime=value=>Math.round(value*1000)/1000;
export function snappedTime(value,bpm,snap='beat'){
  const step=snap==='beat'?60/bpm:snap==='half-beat'?30/bpm:snap==='second'?1:.001;
  return roundTime(Math.round(value/step)*step);
}
// Return a complete candidate so a rejected gesture cannot partially mutate the score.
export function editTimeline(project,{kind,id,edge='move',value}){
  if(!Number.isFinite(value))throw Error('Enter a valid time.');
  const next=clone(project),forms=next.formations;
  if(kind==='formation'){
    const index=forms.findIndex(f=>f.id===id),f=forms[index];
    if(!f||index===0||f.status==='approved')throw Error('The opening time is fixed. Unlock approved formations before retiming.');
    f.time=roundTime(clamp(value,forms[index-1].time+.1,(forms[index+1]?.time??next.duration)-.1));
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
export function reorderFormation(project,id,targetIndex){
  const next=clone(project),source=next.formations.findIndex(f=>f.id===id);
  if(source<0||!Number.isInteger(targetIndex)||targetIndex<0||targetIndex>=next.formations.length)throw Error('Choose an existing sequence slot.');
  const affected=next.formations.slice(Math.min(source,targetIndex),Math.max(source,targetIndex)+1);
  if(affected.some(f=>f.status==='approved'))throw Error('Unlock the affected formations before reordering.');
  const times=next.formations.map(f=>f.time),[item]=next.formations.splice(source,1);
  next.formations.splice(targetIndex,0,item);next.formations.forEach((f,i)=>f.time=times[i]);
  const adjacent=new Set(next.formations.slice(0,-1).map((f,i)=>`${f.id}/${next.formations[i+1].id}`));
  next.routes=next.routes.filter(r=>adjacent.has(`${r.fromId}/${r.toId}`));
  return next;
}
