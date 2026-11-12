import type {Project} from './types.js';
import {clone,transitionSettings} from './engine.js';
import {evaluateTransition} from './production-next-model.js';
import {spaceApart,planClearRoutes} from './formation-tools.js';

/**
 * The timeline's problems lane: spacing, stage-boundary, obstacle and speed issues
 * of every formation and transition, grouped so each formation shows at most one
 * marker per kind and phase, with a one-click fix where one exists.
 */
export type ProblemKind='spacing'|'boundary'|'obstacle'|'speed';
export interface Problem {id:string; kind:ProblemKind; phase:'hold'|'travel'; formationId:string; index:number; time:number; count:number; ids:string[]; message:string; fix:string|null}

const FIX_LABEL:Record<string,string>={'spacing/hold':'Fix spacing','boundary/hold':'Bring everyone on stage','spacing/travel':'Plan collision-free paths','speed/travel':'Give the move more time'};
const cache=new WeakMap<Project,{key:string;problems:Problem[]}>(),transitionCache=new Map<string,Problem[]>();

/** Problems of the whole performance; cached per project until its choreography changes. */
export function timelineProblems(project:Project,{steps=20}:{steps?:number}={}):Problem[]{
  const key=JSON.stringify([project.formations,project.routes,project.stage,project.safetyDistance,project.transitionDuration,project.easing,project.pathType,project.props,project.production?.zones,project.production?.stage?.outline,project.ensemble?.attendance]);
  const cached=cache.get(project);if(cached?.key===key)return cached.problems;
  const problems:Problem[]=[];
  // Each transition is checked once per content: after an edit only the moves into and out of the changed formation are re-checked.
  const shared=JSON.stringify([steps,project.stage,project.safetyDistance,project.transitionDuration,project.easing,project.pathType,project.props,project.production?.zones,project.production?.stage?.outline,project.ensemble?.attendance]);
  project.formations.forEach((f,index)=>{
    const to=project.formations[index+1],part=shared+JSON.stringify([f,to||null,to?(project.routes||[]).filter(r=>r.fromId===f.id&&r.toId===to.id):null]),known=transitionCache.get(part);
    if(known){transitionCache.delete(part);transitionCache.set(part,known);for(const g of known)problems.push({...g,index,ids:[...g.ids]});return;}
    const found:Problem[]=[];
    let analysis;try{analysis=evaluateTransition(project,index,{steps});}catch{transitionCache.set(part,found);return;}
    const start=to?Math.max(f.time,to.time-Math.max(transitionSettings(project,f).duration,...(project.routes||[]).filter(r=>r.fromId===f.id&&r.toId===to.id).map(r=>r.duration))):f.time;
    const groups=new Map<string,Problem>();
    for(const issue of analysis.issues){
      const kind=issue.type as ProblemKind;if(!['spacing','boundary','obstacle','speed'].includes(kind))continue;
      const phase=issue.time<=start+1e-6?'hold':'travel',id=`${f.id}/${kind}/${phase}`;
      const group=groups.get(id)||{id,kind,phase,formationId:f.id,index,time:phase==='hold'?f.time:issue.time,count:0,ids:[] as string[],message:'',fix:FIX_LABEL[`${kind}/${phase}`]||null};
      group.count++;group.time=phase==='hold'?f.time:Math.min(group.time,issue.time);for(const v of issue.ids)if(!group.ids.includes(v))group.ids.push(v);
      groups.set(id,group);
    }
    for(const g of groups.values()){
      const dancers=`${g.ids.length} ${g.ids.length===1?'dancer':'dancers'}`;
      const noun=g.kind==='spacing'?(g.phase==='hold'?`${g.count} ${g.count===1?'pair':'pairs'} too close`:`${g.count} near ${g.count===1?'miss':'misses'} in the move`):g.kind==='boundary'?`${dancers} off the usable stage`:g.kind==='obstacle'?`${dancers} near a prop or zone`:`${dancers} rushing (over 3 m/s)`;
      g.message=`${f.name}: ${noun}`;found.push(g);
    }
    transitionCache.set(part,found);if(transitionCache.size>400)transitionCache.delete(transitionCache.keys().next().value!);
    for(const g of found)problems.push({...g,ids:[...g.ids]});
  });
  problems.sort((a,b)=>a.time-b.time);
  cache.set(project,{key,problems});
  return problems;
}

/** Applies a problem's one-click fix; returns null when it has none or nothing changes. */
export function fixProblem(project:Project,problem:Problem):{project:Project;message:string}|null{
  const index=project.formations.findIndex(f=>f.id===problem.formationId),f=project.formations[index],to=project.formations[index+1];if(!f)return null;
  if(f.status==='approved')throw Error('Unlock this formation before fixing it.');
  if(problem.kind==='spacing'&&problem.phase==='hold'){
    const distance=project.safetyDistance||.55,result=spaceApart(f.positions,{distance,stage:project.stage});if(!result.moved.length)return null;
    const next=clone(project);next.formations[index].positions=result.positions;
    return {project:next,message:`${result.moved.length} performers moved to keep ${distance} m apart in “${f.name}”.${result.remaining?` ${result.remaining} still too close; the stage is too small for this shape.`:''}`};
  }
  if(problem.kind==='boundary'&&problem.phase==='hold'){
    const next=clone(project),halfW=project.stage.width/2-.3,halfD=project.stage.depth/2-.3;let moved=0;
    for(const p of next.formations[index].positions){const x=Math.max(-halfW,Math.min(halfW,p.x)),z=Math.max(-halfD,Math.min(halfD,p.z));if(x!==p.x||z!==p.z){p.x=Math.round(x*100)/100;p.z=Math.round(z*100)/100;moved++;}}
    return moved?{project:next,message:`${moved} ${moved===1?'performer':'performers'} brought back on stage in “${f.name}”.`}:null;
  }
  if(problem.kind==='spacing'&&problem.phase==='travel'&&to){
    const plan=planClearRoutes(project,f.id);
    return {project:plan.project,message:plan.after<plan.before-1e-9?`Collision-free paths planned into “${to.name}”: ${plan.adjusted} ${plan.adjusted===1?'path':'paths'} adjusted.`:`Paths into “${to.name}” are as clear as these two formations allow.`};
  }
  if(problem.kind==='speed'&&problem.phase==='travel'&&to){
    const gap=Math.min(60,to.time-f.time),settings=transitionSettings(project,f),current=Math.max(settings.duration,...project.routes.filter(r=>r.fromId===f.id&&r.toId===to.id).map(r=>r.duration));
    if(current>=gap-.01)throw Error(`The move already uses all ${gap.toFixed(1)} s before “${to.name}”. Give it more time on the timeline, or shorten the distance.`);
    const next=clone(project),source=next.formations[index];source.transition={...settings,duration:Math.round(gap*1000)/1000};
    for(const r of next.routes)if(r.fromId===f.id&&r.toId===to.id){const scale=gap/Math.max(.001,r.duration);r.duration=Math.round(gap*1000)/1000;r.delay=Math.round(r.delay*scale*1000)/1000;if(r.settle)r.settle=Math.round(r.settle*scale*1000)/1000;}
    return {project:next,message:`The move into “${to.name}” now uses the full ${gap.toFixed(1)} s.`};
  }
  return null;
}
