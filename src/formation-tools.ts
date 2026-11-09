import type {Pose,Project,Route} from './types.js';
import {clone,uid,closePairs,transitionSettings,interpolatePosition} from './engine.js';
import {minimumAssignment} from './ensemble-model.js';

type Point={x:number;z:number};
const round=(v:number)=>Math.round(v*100)/100;
/** Smallest distance of two performers over one sample interval, given their offset at its start (x0, z0) and end (x1, z1). */
export function closestApproach(x0:number,z0:number,x1:number,z1:number){const dx=x1-x0,dz=z1-z0,length=dx*dx+dz*dz,s=length>1e-12?Math.max(0,Math.min(1,-(x0*dx+z0*dz)/length)):0;return Math.hypot(x0+dx*s,z0+dz*s);}

/**
 * Gives each performer the spot that keeps total travel shortest. With straight
 * paths, a minimum-total-distance assignment never has two paths crossing.
 * Performers without an origin keep their generated spot.
 */
export function assignByTravel(layout:Pose[],origins:Map<string,Point>):Pose[]{
  const movers=layout.filter(p=>origins.has(p.performerId));
  if(movers.length<2)return layout;
  const cost=movers.map(p=>{const o=origins.get(p.performerId);return movers.map(spot=>Math.hypot(spot.x-o.x,spot.z-o.z));});
  const pick=minimumAssignment(cost),spots=new Map(movers.map((p,i)=>[p.performerId,{x:movers[pick[i]].x,z:movers[pick[i]].z}]));
  return layout.map(p=>spots.has(p.performerId)?{...p,...spots.get(p.performerId)}:p);
}

/**
 * Pushes performers apart until every pair is at least `distance` apart, moving as
 * little as possible and staying inside the stage. Only `ids` move (all visible
 * performers when empty). Returns the new positions and who moved; `remaining`
 * counts pairs still too close (for example on a stage too small for the cast).
 */
export function spaceApart(positions:Pose[],{ids,distance,stage,margin=.25,iterations=300}:{ids?:Set<string>;distance:number;stage:{width:number;depth:number};margin?:number;iterations?:number}){
  if(!(distance>0))throw Error('Choose a positive spacing distance.');
  const points=positions.map(p=>({...p})),visible=points.filter(p=>p.visible!==false);
  const movable=new Set(ids?.size?[...ids]:visible.map(p=>p.performerId)),target=distance*1.02;
  const halfW=Math.max(0,stage.width/2-margin),halfD=Math.max(0,stage.depth/2-margin),clampPoint=(p:Pose)=>{p.x=Math.max(-halfW,Math.min(halfW,p.x));p.z=Math.max(-halfD,Math.min(halfD,p.z));};
  const moved=new Set<string>();
  for(let k=0;k<iterations;k++){
    let pushed=false;
    for(const [a,b,d] of closePairs(visible,target)){
      const p=visible[a],q=visible[b],mp=movable.has(p.performerId),mq=movable.has(q.performerId);if(!mp&&!mq)continue;
      // Coincident performers separate along a fixed, index-based direction (deterministic).
      let ux=q.x-p.x,uz=q.z-p.z;if(d<1e-6){const angle=(a+1)*2.399963+b;ux=Math.cos(angle);uz=Math.sin(angle);}
      const length=Math.hypot(ux,uz)||1,gap=target-d;ux/=length;uz/=length;
      if(mp&&mq){p.x-=ux*gap/2;p.z-=uz*gap/2;q.x+=ux*gap/2;q.z+=uz*gap/2;}else if(mp){p.x-=ux*gap;p.z-=uz*gap;}else{q.x+=ux*gap;q.z+=uz*gap;}
      if(mp){clampPoint(p);moved.add(p.performerId);}if(mq){clampPoint(q);moved.add(q.performerId);}pushed=true;
    }
    if(!pushed)break;
  }
  for(const p of visible)if(moved.has(p.performerId)){p.x=round(p.x);p.z=round(p.z);}
  const remaining=closePairs(visible,distance-1e-6).filter(([a,b])=>movable.has(visible[a].performerId)||movable.has(visible[b].performerId)).length;
  return {positions:points,moved:[...moved],remaining};
}

/**
 * Plans transition routes that keep performers apart while they travel.
 * Each performer can bend its path left or right and/or start a little later;
 * every option is sampled with the engine's own route interpolation, so what is
 * checked is exactly what plays back. Repeated passes let each performer react to
 * everyone else's current choice. Clearances fixed by the two formations
 * themselves (performers already close at the start or end) are not penalised.
 */
export function planClearRoutes(project:Project,formationId:string,{distance=project.safetyDistance||.55,steps=32,passes=4}:{distance?:number;steps?:number;passes?:number}={}){
  const index=project.formations.findIndex(f=>f.id===formationId),from=project.formations[index],to=project.formations[index+1];
  if(!from||!to)throw Error('Choose a formation with a following sequence.');
  const settings=transitionSettings(project,from),pathProject={...project,pathType:settings.pathType};
  const duration=Math.min(60,to.time-from.time,Math.max(settings.duration,2)),window=Math.min(to.time-from.time,duration),start=to.time-window;
  const destinations=new Map(to.positions.map(p=>[p.performerId,p]));
  const movers=from.positions.filter(p=>p.visible!==false&&destinations.get(p.performerId)&&destinations.get(p.performerId).visible!==false);
  const samples=steps+1,times=Array.from({length:samples},(_,k)=>start+window*k/steps);
  const route=(p:Pose,waypoints:Point[],delay:number):Route=>({id:'',fromId:from.id,toId:to.id,performerId:p.performerId,duration,delay,easing:'smooth',curve:'smooth',waypoints,locked:false});
  const trajectory=(p:Pose,r:Route)=>{
    const q=destinations.get(p.performerId),out=new Float64Array(samples*2),delay=Math.min(r.delay,Math.max(0,window-.001));
    for(let k=0;k<samples;k++){const progress=Math.max(0,Math.min(1,(times[k]-(start+delay))/Math.max(.001,window-delay))),amount=progress*progress*(3-2*progress),pos=interpolatePosition(pathProject,p,q,amount,r);out[2*k]=pos.x;out[2*k+1]=pos.z;}
    return out;
  };
  // Peak travel speed (m/s) of a sampled path. A later start compresses the move, so it runs faster.
  const peakSpeed=(t:Float64Array)=>{let top=0;for(let k=0;k+3<t.length;k+=2)top=Math.max(top,Math.hypot(t[k+2]-t[k],t[k+3]-t[k+1]));return top*steps/window;};
  const bounds=(t:Float64Array)=>{let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(let k=0;k<t.length;k+=2){x0=Math.min(x0,t[k]);x1=Math.max(x1,t[k]);z0=Math.min(z0,t[k+1]);z1=Math.max(z1,t[k+1]);}return [x0,x1,z0,z1];};
  // Options per performer: a perpendicular bend of the path midpoint and a start delay.
  const options=movers.map(p=>{
    const q=destinations.get(p.performerId),dx=q.x-p.x,dz=q.z-p.z,length=Math.hypot(dx,dz),list=[];
    const bends=length<.3?[0]:[0,.5,-.5,1,-1,1.6,-1.6].map(b=>Math.sign(b)*Math.min(Math.abs(b),length*.75)),delays=[0,.12,.24,.36].map(f=>f*window);
    for(const delay of delays)for(const bend of bends){
      const waypoints=bend?[{x:round((p.x+q.x)/2-dz/length*bend),z:round((p.z+q.z)/2+dx/length*bend)}]:[];
      // Paths are sampled on first use: most performers in a calm transition never need their alternatives.
      const r=route(p,waypoints,delay);let t:Float64Array|null=null,box:number[]|null=null;
      let top:number|null=null;
      list.push({route:r,deviation:Math.abs(bend)+delay/window*2,get trajectory(){return t||=trajectory(p,r);},get bounds(){return box||=bounds(this.trajectory);},get peak(){return top??=peakSpeed(this.trajectory);}});
    }
    return list;
  });
  const n=movers.length,choice=new Array(n).fill(0);
  // A pair only needs the clearance its two formations allow.
  const required=Array.from({length:n},(_,a)=>Array.from({length:n},(_,b)=>{if(a===b)return 0;const p=movers[a],q=movers[b],pa=destinations.get(p.performerId),qa=destinations.get(q.performerId);return Math.min(distance,Math.hypot(p.x-q.x,p.z-q.z),Math.hypot(pa.x-qa.x,pa.z-qa.z))-1e-3;}));
  // `limit` stops early once an option is already worse than the best found (branch and bound).
  const violation=(a:number,option,limit=Infinity)=>{
    let total=0;const [x0,x1,z0,z1]=option.bounds;
    for(let b=0;b<n;b++){
      if(b===a)continue;const other=options[b][choice[b]],[ox0,ox1,oz0,oz1]=other.bounds,need=required[a][b];
      if(need<=0||ox0-x1>need||x0-ox1>need||oz0-z1>need||z0-oz1>need)continue;
      // Closest approach within each sample interval, not just at the samples: fast crossings pass between them.
      const t=option.trajectory,u=other.trajectory;for(let k=0;k+3<t.length;k+=2){const gap=closestApproach(t[k]-u[k],t[k+1]-u[k+1],t[k+2]-u[k+2],t[k+3]-u[k+3]);if(gap<need)total+=need-gap;}
      if(total>limit)return total;
    }
    return total;
  };
  const totalViolation=()=>{let sum=0;for(let a=0;a<n;a++)sum+=violation(a,options[a][choice[a]]);return sum/2;};
  const before=totalViolation();
  // Longest journeys choose first; later passes revisit everyone against the others' choices.
  const order=movers.map((p,i)=>i).sort((a,b)=>{const pa=destinations.get(movers[a].performerId),pb=destinations.get(movers[b].performerId);return Math.hypot(pb.x-movers[b].x,pb.z-movers[b].z)-Math.hypot(pa.x-movers[a].x,pa.z-movers[a].z);});
  for(let pass=0;pass<passes;pass++){
    let changed=false;
    for(const a of order){
      let best=choice[a],bestViolation=violation(a,options[a][best]),bestDeviation=options[a][best].deviation;
      // A performer whose current path is already clear keeps it, unless a straighter clear path exists.
      if(bestViolation===0&&best===0)continue;
      // Never trade a near miss for a sprint: options faster than 3 m/s (or than the straight path needs) are out.
      const speedLimit=Math.max(3,options[a][0].peak*1.05);
      options[a].forEach((option,i)=>{if(i===best||bestViolation===0&&option.deviation>=bestDeviation||option.peak>speedLimit)return;const v=violation(a,option,bestViolation+1e-9);if(v<bestViolation-1e-9||Math.abs(v-bestViolation)<=1e-9&&option.deviation<bestDeviation){best=i;bestViolation=v;bestDeviation=option.deviation;}});
      if(best!==choice[a]){choice[a]=best;changed=true;}
    }
    if(!changed)break;
  }
  const next=clone(project);next.routes=(next.routes||[]).filter(r=>r.fromId!==from.id||r.toId!==to.id);
  movers.forEach((p,a)=>next.routes.push({...options[a][choice[a]].route,id:uid()}));
  return {project:next,before,after:totalViolation(),adjusted:choice.filter(i=>i!==0).length};
}
