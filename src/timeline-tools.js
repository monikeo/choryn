import {snappedTime} from './timeline-model.js';
import {icon} from './icons.js';
export function magneticTime(value,project,{snap='beat',playhead=0,pixelsPerSecond=1,exclude}={}){
 const grid=snappedTime(value,project.bpm,snap,project.music?.beatOffset||0);if(snap==='off')return {time:grid,label:'Exact'};
 const targets=[...project.formations.filter(f=>f.id!==exclude).map(f=>({time:f.time,label:f.name})),...project.actions.filter(a=>a.id!==exclude).flatMap(a=>[{time:a.start,label:a.name+' start'},{time:a.end,label:a.name+' end'}]),...(project.checkpoints||[]).map(c=>({time:c.time,label:c.label||'Checkpoint'})),...project.cues.filter(c=>c.id!==exclude).map(c=>({time:c.time,label:c.label})),{time:playhead,label:'Playhead'},{time:project.duration,label:'Performance end'}];
 for(const key of ['lights','appearances','cameras'])for(const item of project.production?.[key]||[])if(item.id!==exclude)targets.push({time:item.time,label:item.name||item.costume||'Camera key'});
 for(const prop of project.props||[])for(const frame of prop.keyframes||[])if(frame.id!==exclude)targets.push({time:frame.time,label:prop.name+' pose'});
 const nearest=targets.filter(t=>Math.abs(t.time-value)*pixelsPerSecond<=9).sort((a,b)=>Math.abs(a.time-value)-Math.abs(b.time-value))[0];return nearest||{time:grid,label:snap==='half-beat'?'Half beat':snap==='second'?'Second':'Beat'};
}
export function reorderImpact(before,after){const kept=new Set(after.routes.map(r=>r.id));return {removedRoutes:before.routes.filter(r=>!kept.has(r.id)),changed:before.formations.some((f,i)=>f.id!==after.formations[i]?.id)};}
export function timelineFingerprint(project){const {updatedAt,...authored}=project;return JSON.stringify(authored);}
export function timelineToolButtons(){
 const primary=[['duplicate','copy','Duplicate','Ctrl/⌘ D'],['split','split','Split at playhead','S'],['delete','trash','Delete (confirmation required)','Delete']];
 const secondary=[['tools','settings','Clip inspector',''],['copy','copy','Copy','Ctrl/⌘ C'],['paste','paste','Paste at playhead','Ctrl/⌘ V'],['cut','cut','Cut (confirmation required)','Ctrl/⌘ X'],['trim-start','prev','Trim start',''],['trim-end','next','Trim end',''],['move-earlier','prev','Move sequence earlier','Alt ←'],['move-later','next','Move sequence later','Alt →'],['delete','trash','Delete (confirmation required)','Delete']];
 const button=([action,name,label,shortcut],text=false)=>`<button type="button" class="timeline-command timeline-quick" data-timeline-action="${action}" aria-label="${label}" title="${label}${shortcut?' · '+shortcut:''}">${icon(name)}${text?`<span>${label}</span>${shortcut?`<kbd>${shortcut}</kbd>`:''}`:''}</button>`;
 return primary.map(item=>button(item)).join('')+`<details class="timeline-more"><summary aria-label="More timeline tools" title="More timeline tools">${icon('dots')}</summary><div class="timeline-menu" role="group" aria-label="More timeline tools">${secondary.map(item=>button(item,true)).join('')}<hr><button type="button" data-power="sequence">${icon('layers')}<span>Formation sequence</span></button><button type="button" data-images="timeline">${icon('camera')}<span>Preview timeline images</span></button><button type="button" data-power="loop-range">${icon('loop')}<span>Rehearsal loop</span></button></div></details>`;
}

// Compare against the original slots, never the moving DOM rectangles.
export function sequenceDropIndex(project,id,center,previous,pixelsPerSecond=1){
 const source=project.formations.findIndex(f=>f.id===id);if(source<0)throw Error('Choose an existing sequence.');
 const centers=project.formations.map((f,i)=>(f.time+(project.formations[i+1]?.time??project.duration))/2).filter((_,i)=>i!==source);
 let target=Number.isInteger(previous)?Math.max(0,Math.min(centers.length,previous)):source;
 const margin=3/Math.max(.001,pixelsPerSecond);
 while(target<centers.length&&center>centers[target]+margin)target++;
 while(target>0&&center<centers[target-1]-margin)target--;
 return target;
}

export function timelineScrollVelocity(x,rect){
 if(!Number.isFinite(x)||rect.width<=0)return 0;
 const edge=Math.min(56,rect.width/4),left=(rect.left+edge-x)/edge,right=(x-(rect.right-edge))/edge;
 const intensity=Math.max(-1,Math.min(1,right>0?right:left>0?-left:0));
 return Math.sign(intensity)*900*intensity*intensity;
}

export function timelineCommandReason(project,selection,command,time,{readOnly=false,clipboard}={}){
 if(['tools','copy','details'].includes(command))return '';
 if(readOnly)return 'Read-only snapshot';
 const locked=project.production?.layers?.[{formation:'formations',movement:'movement',cue:'cues'}[command==='paste'?clipboard?.kind:selection.kind]]?.locked;if(locked)return 'Unlock the selected track first';
 if(command==='paste')return clipboard?.projectId===project.id?'':'Copy a clip in this project first';
 const kind=selection.kind,item=project[{formation:'formations',movement:'actions',cue:'cues'}[kind]]?.find(v=>v.id===selection.id);if(!item)return 'Select a timeline clip';
 const index=kind==='formation'?project.formations.indexOf(item):-1,start=kind==='movement'?item.start:item.time,end=kind==='formation'?(project.formations[index+1]?.time??project.duration):item.end;
 if(['move-earlier','move-later'].includes(command)){
  if(kind!=='formation')return 'Choose a formation sequence';
  const next=project.formations[index+(command==='move-earlier'?-1:1)];
  if(!next)return command==='move-earlier'?'Already the first sequence':'Already the last sequence';
  if(next.status==='approved')return 'Unlock the adjacent formation first';
 }
 if(['split','trim-start','trim-end'].includes(command)&&kind==='cue')return 'Cues are point events';
 if(['split','delete','cut','trim-start','trim-end','move-earlier','move-later'].includes(command)&&kind==='formation'&&item.status==='approved')return 'Unlock the approved formation first';
 if(['delete','cut','trim-start'].includes(command)&&kind==='formation'&&index===0)return 'Keep the opening formation';
 if(command==='trim-end'&&kind==='formation'&&project.formations[index+1]?.status==='approved')return 'Unlock the next formation before moving this shared boundary';
 if(command==='split'&&(time<start+.1||time>end-.1))return 'Place the playhead inside this clip, at least 0.1 seconds from either edge';
 return '';
}
