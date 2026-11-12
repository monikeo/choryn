import type {Project} from './types.js';

/**
 * Plain-language labels for the visual undo history: what changed between two
 * saved states of a project, and which formation to show as the step's picture.
 */
export interface ChangeSummary {label:string; formationId:string|null}

const same=(a:unknown,b:unknown)=>a===b||JSON.stringify(a)===JSON.stringify(b);
const quote=(name:string)=>`“${name.length>28?name.slice(0,27)+'…':name}”`;
const plural=(n:number,one:string,many=one+'s')=>`${n} ${n===1?one:many}`;

export function describeChange(before:Project,after:Project):ChangeSummary{
  const byId=new Map(before.formations.map(f=>[f.id,f]));
  if(after.performers.length>before.performers.length)return {label:`Added ${plural(after.performers.length-before.performers.length,'performer')}`,formationId:null};
  if(after.performers.length<before.performers.length)return {label:`Removed ${plural(before.performers.length-after.performers.length,'performer')}`,formationId:null};
  if(after.formations.length>before.formations.length){const added=after.formations.find(f=>!byId.has(f.id));return {label:`Added formation ${quote(added?.name||'')}`,formationId:added?.id||null};}
  if(after.formations.length<before.formations.length){const kept=new Set(after.formations.map(f=>f.id)),gone=before.formations.find(f=>!kept.has(f.id));return {label:`Removed formation ${quote(gone?.name||'')}`,formationId:null};}
  if(after.formations.some((f,i)=>before.formations[i]?.id!==f.id))return {label:'Reordered formations',formationId:null};
  const moved:{id:string;name:string;count:number}[]=[];
  for(const f of after.formations){
    const old=byId.get(f.id)!;
    if(old.name!==f.name)return {label:`Renamed ${quote(old.name)} to ${quote(f.name)}`,formationId:f.id};
    if(old.time!==f.time)return {label:`Retimed ${quote(f.name)}`,formationId:f.id};
    if(old.status!==f.status)return {label:`${f.status==='approved'?'Approved':'Unlocked'} ${quote(f.name)}`,formationId:f.id};
    const previous=new Map(old.positions.map(p=>[p.performerId,p]));
    const count=f.positions.filter(p=>{const q=previous.get(p.performerId);return !q||q.x!==p.x||q.z!==p.z||q.facing!==p.facing||q.visible!==p.visible;}).length;
    if(count)moved.push({id:f.id,name:f.name,count});
  }
  if(moved.length===1)return {label:`Moved ${plural(moved[0].count,'performer')} in ${quote(moved[0].name)}`,formationId:moved[0].id};
  if(moved.length>1)return {label:`Changed ${plural(moved.length,'formation')}`,formationId:moved[0].id};
  if(!same(before.routes,after.routes)){const r=after.routes.find(r=>!before.routes.some(o=>same(o,r)))||before.routes.find(r=>!after.routes.some(o=>same(o,r))),to=after.formations.find(f=>f.id===r?.toId);return {label:to?`Changed paths into ${quote(to.name)}`:'Changed movement paths',formationId:r?.fromId||null};}
  if(after.formations.some(f=>!same(f.transition,byId.get(f.id)?.transition))){const f=after.formations.find(f=>!same(f.transition,byId.get(f.id)?.transition))!;return {label:`Changed the transition after ${quote(f.name)}`,formationId:f.id};}
  if(after.formations.some(f=>!same(f.highlights,byId.get(f.id)?.highlights)))return {label:'Changed highlights',formationId:after.formations.find(f=>!same(f.highlights,byId.get(f.id)?.highlights))!.id};
  if(after.formations.some(f=>f.notes!==byId.get(f.id)?.notes))return {label:'Edited formation notes',formationId:after.formations.find(f=>f.notes!==byId.get(f.id)?.notes)!.id};
  if(before.bpm!==after.bpm)return {label:`Tempo ${before.bpm} → ${after.bpm} BPM`,formationId:null};
  if(!same(before.music,after.music))return {label:'Changed music sync',formationId:null};
  if(!same(before.stage,after.stage))return {label:`Stage ${after.stage.width} × ${after.stage.depth} m`,formationId:null};
  if(!same(before.performers,after.performers))return {label:'Edited the cast',formationId:null};
  if(!same(before.cues,after.cues))return {label:after.cues.length>before.cues.length?`Added ${plural(after.cues.length-before.cues.length,'cue')}`:after.cues.length<before.cues.length?'Removed cues':'Edited cues',formationId:null};
  if(!same(before.actions,after.actions))return {label:'Edited movement phrases',formationId:null};
  if(!same(before.props,after.props))return {label:'Edited props',formationId:null};
  if(!same(before.production,after.production))return {label:'Edited production design',formationId:null};
  if(!same(before.ensemble,after.ensemble))return {label:'Edited cast & show settings',formationId:null};
  if(before.name!==after.name)return {label:`Renamed project to ${quote(after.name)}`,formationId:null};
  if(before.duration!==after.duration)return {label:'Changed performance length',formationId:null};
  return {label:'Edited project details',formationId:null};
}
