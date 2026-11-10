import {uid,clone} from './engine.js';
import type {Project,Unchecked} from './types.js';
export const SETLIST_KEY='choryn.setlists.v1';
export interface BreakEntry {id:string; type:'break'; name:string; duration:number}
export interface RoutineEntry {id:string; type:'routine'; name:string; projectId:string; start:number; end:number}
export type SetlistEntry=BreakEntry|RoutineEntry;
export interface Show {id:string; name:string; entries:SetlistEntry[]}
export interface SetlistCollection {version:1; shows:Show[]}
/** An entry with its running time and, for a routine, its project or why it cannot run. */
export type ResolvedEntry=SetlistEntry&{duration:number;project?:Project;reason?:string|null};
type ShowEntry=SetlistEntry&{duration:number;reason?:string|null};
interface ShowSession {showId:string; name:string; entries:ShowEntry[]; index:number; status:string; remaining?:number; deadline?:number}
/** What the show runner drives: the open project and its transport. */
export interface ShowAdapter {openProject:(projectId:string)=>unknown; seek:(time:number)=>void; play:()=>unknown; pause:()=>void; playing?:()=>boolean; changed?:(state:ReturnType<ReturnType<typeof createShowRunner>['state']>)=>void; finished?:()=>void; error?:(error:unknown)=>void}
type Timer=ReturnType<typeof setTimeout>;
const id=(v:unknown)=>typeof v==='string'&&/^[-\w]{1,100}$/.test(v),text=(v:unknown)=>typeof v==='string'&&v.trim()&&v.length<=200,finite=(n:unknown,a:number,b:number)=>typeof n==='number'&&Number.isFinite(n)&&n>=a&&n<=b;
export function validateSetlists(input:Unchecked):SetlistCollection{
 if(!input||input.version!==1||!Array.isArray(input.shows)||input.shows.length>30)throw Error('Invalid CHORYN setlist collection.');const ids=new Set();
 const shows=input.shows.map((show:Unchecked):Show=>{if(!show||!id(show.id)||ids.has(show.id)||!text(show.name)||!Array.isArray(show.entries)||show.entries.length>100)throw Error('Use up to 30 named shows with 100 entries each.');ids.add(show.id);const entries=new Set();return {id:show.id,name:show.name,entries:show.entries.map((v:Unchecked):SetlistEntry=>{if(!v||!id(v.id)||entries.has(v.id)||!text(v.name))throw Error('Invalid setlist entry.');entries.add(v.id);if(v.type==='break'&&finite(v.duration,1,3600))return {id:v.id,type:'break',name:v.name,duration:v.duration};if(v.type==='routine'&&id(v.projectId)&&finite(v.start,0,3600)&&finite(v.end,0,3600)&&v.end-v.start>=.0999)return {id:v.id,type:'routine',name:v.name,projectId:v.projectId,start:v.start,end:v.end};throw Error('Invalid routine range or intermission duration.');})};});return {version:1,shows};
}
export function readSetlists(storage:Pick<Storage,'getItem'>){const raw=storage.getItem(SETLIST_KEY)||'';if(raw.length>1000000)throw Error('Setlist storage exceeds its limit. Export a recovery copy.');return {raw,...validateSetlists(raw?JSON.parse(raw):{version:1,shows:[]})};}
export function writeSetlists(storage:Pick<Storage,'getItem'|'setItem'>,collection:Unchecked,expectedRaw:string){const valid=validateSetlists(collection),raw=JSON.stringify(valid);if(raw.length>1000000)throw Error('Setlists exceed 1 MB. Remove unused entries first.');if((storage.getItem(SETLIST_KEY)||'')!==expectedRaw)throw Error('Another tab changed the setlists. Reopen this panel before saving.');storage.setItem(SETLIST_KEY,raw);return {...valid,raw};}
export function resolveShow(show:Show,projects:Project[]){const scores=new Map(projects.map(p=>[p.id,p]));const entries=show.entries.map((v):ResolvedEntry=>{if(v.type==='break')return {...v,duration:v.duration};const p=scores.get(v.projectId),reason=!p?'Project is unavailable on this device.':v.end>p.duration?'Routine is shorter than this saved range.':null;return {...v,duration:v.end-v.start,project:p,reason};});return {entries,duration:entries.reduce((n,v)=>n+v.duration,0),issues:entries.filter(v=>v.reason)};}
export function createShowRunner(adapter:ShowAdapter,{now=()=>performance.now(),setTimer=setTimeout,clearTimer=clearTimeout}:{now?:()=>number;setTimer?:(callback:()=>void,ms:number)=>Timer;clearTimer?:(timer:Timer)=>void}={}){
 let session:ShowSession|null=null,generation=0,timer:Timer|null|undefined;
 const clear=()=>{if(timer)clearTimer(timer);timer=null;};
 const emit=()=>adapter.changed?.(state());
 const state=()=>session?{showId:session.showId,name:session.name,index:session.index,total:session.entries.length,entry:session.entries[session.index],status:session.status==='running'&&adapter.playing&&!adapter.playing()?'paused-routine':session.status,remaining:session.status==='break'?Math.max(0,(session.deadline!-now())/1000):session.remaining||0}:null;
 function stop(pause=true){generation++;clear();session=null;if(pause)adapter.pause();emit();}
 async function at(index:number){
  const token=++generation;clear();adapter.pause();if(!session)return;if(index>=session.entries.length){stop(false);adapter.finished?.();return;}
  session.index=index;const entry=session.entries[index];session.status='loading';emit();
  try{if(entry.type==='routine'){await adapter.openProject(entry.projectId);if(token!==generation||!session)return;adapter.seek(entry.start);session.status='running';await adapter.play();if(token===generation)emit();}
   else{session.status='break';session.remaining=entry.duration;session.deadline=now()+entry.duration*1000;timer=setTimer(()=>{if(token===generation)void next().catch(()=>{});},entry.duration*1000);emit();}}
  catch(error){if(token===generation){stop();adapter.error?.(error);}throw error;}
 }
 async function start(show:Show,projects:Project[]){const resolved=resolveShow(show,projects);if(!resolved.entries.length)throw Error('Add a routine or intermission first.');if(resolved.issues.length)throw Error(resolved.issues[0].name+': '+resolved.issues[0].reason);stop();session={showId:show.id,name:show.name,entries:resolved.entries.map(({project,...v})=>clone(v)),index:0,status:'loading'};await at(0);}
 const next=()=>session?at(session.index+1):Promise.resolve();
 function pause(){if(!session)return;if(session.status==='loading'){stop();return;}if(session.status==='break'){generation++;session.remaining=Math.max(0,(session.deadline!-now())/1000);session.status='paused-break';clear();}else adapter.pause();emit();}
 async function resume(){if(!session)return;if(session.status==='paused-break'){const token=++generation;session.status='break';session.deadline=now()+session.remaining!*1000;timer=setTimer(()=>{if(token===generation)void next().catch(()=>{});},session.remaining!*1000);emit();}else if(session.status==='running')await adapter.play();}
 const boundary=(time:number,projectId:string)=>{const s=state();return !!s&&s.status==='running'&&s.entry.type==='routine'&&s.entry.projectId===projectId&&time>=s.entry.end;};
 // Only routines run, so a running entry has a project and a range.
 return {start,next,pause,resume,stop,state,boundary,projectChanged(projectId:string,duration:number){if(session?.status==='running'){const entry=session.entries[session.index] as RoutineEntry;if(entry.projectId!==projectId)stop();else if(Number.isFinite(duration)&&entry.end>duration){stop();adapter.error?.(Error('The routine range changed. Review the setlist before restarting.'));}}}};
}
