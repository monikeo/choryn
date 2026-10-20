import {snappedTime} from './timeline-model.js';
import {icon} from './icons.js';
export function magneticTime(value,project,{snap='beat',playhead=0,pixelsPerSecond=1}={}){
 const grid=snappedTime(value,project.bpm,snap,project.music?.beatOffset||0);if(snap==='off')return {time:grid,label:'Exact'};
 const targets=[...project.formations.map(f=>({time:f.time,label:f.name})),...(project.checkpoints||[]).map(c=>({time:c.time,label:c.label||'Checkpoint'})),...project.cues.map(c=>({time:c.time,label:c.label})),{time:playhead,label:'Playhead'},{time:project.duration,label:'Performance end'}];
 const nearest=targets.filter(t=>Math.abs(t.time-value)*pixelsPerSecond<=9).sort((a,b)=>Math.abs(a.time-value)-Math.abs(b.time-value))[0];return nearest||{time:grid,label:snap==='half-beat'?'Half beat':snap==='second'?'Second':'Beat'};
}
export function reorderImpact(before,after){const kept=new Set(after.routes.map(r=>r.id));return {removedRoutes:before.routes.filter(r=>!kept.has(r.id)),changed:before.formations.some((f,i)=>f.id!==after.formations[i]?.id)};}
export function timelineFingerprint(project){const {updatedAt,...authored}=project;return JSON.stringify(authored);}
export function timelineToolButtons(){const buttons=[['tools','dots','Clip tools',''],['duplicate','copy','Duplicate','Ctrl/⌘ D'],['split','split','Split at playhead','S'],['copy','copy','Copy','Ctrl/⌘ C'],['paste','paste','Paste at playhead','Ctrl/⌘ V'],['cut','cut','Cut (confirmation required)','Ctrl/⌘ X'],['trim-start','prev','Trim start',''],['trim-end','next','Trim end',''],['delete','trash','Delete (confirmation required)','Delete']];return buttons.map(([action,name,label,shortcut])=>`<button class="timeline-command ${action==='tools'?'':'timeline-quick'}" data-timeline-action="${action}" aria-label="${label}" title="${label}${shortcut?' · '+shortcut:''}">${icon(name)}</button>`).join('');}
