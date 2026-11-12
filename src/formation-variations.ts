import type {Point,Pose,Project} from './types.js';
import {assignByTravel} from './formation-tools.js';

/**
 * "Show me variations": alternative takes on one formation. Each variation keeps
 * the cast and visibility of the original and only moves or re-casts spots, so
 * applying one is an ordinary, undoable position edit.
 */
export interface Variation {id:string; label:string; hint:string; positions:Pose[]}

const round=(v:number)=>Math.round(v*100)/100;
const normalAngle=(a:number)=>((a%360)+360)%360;

/** Shifts, then if needed shrinks, the visible spots about their centre so they fit the stage with a margin. */
export function fitToStage(positions:Pose[],stage:{width:number;depth:number},margin=.3):Pose[]{
  const visible=positions.filter(p=>p.visible!==false);if(!visible.length)return positions;
  const halfW=Math.max(.1,stage.width/2-margin),halfD=Math.max(.1,stage.depth/2-margin);
  let x0=Math.min(...visible.map(p=>p.x)),x1=Math.max(...visible.map(p=>p.x)),z0=Math.min(...visible.map(p=>p.z)),z1=Math.max(...visible.map(p=>p.z));
  const scale=Math.min(1,(2*halfW)/Math.max(1e-6,x1-x0),(2*halfD)/Math.max(1e-6,z1-z0)),cx=(x0+x1)/2,cz=(z0+z1)/2;
  let out=positions.map(p=>p.visible===false?p:{...p,x:cx+(p.x-cx)*scale,z:cz+(p.z-cz)*scale});
  const shown=out.filter(p=>p.visible!==false);x0=Math.min(...shown.map(p=>p.x));x1=Math.max(...shown.map(p=>p.x));z0=Math.min(...shown.map(p=>p.z));z1=Math.max(...shown.map(p=>p.z));
  const sx=x0< -halfW?-halfW-x0:x1>halfW?halfW-x1:0,sz=z0< -halfD?-halfD-z0:z1>halfD?halfD-z1:0;
  out=out.map(p=>p.visible===false?p:{...p,x:round(p.x+sx),z:round(p.z+sz)});
  return out;
}

const signature=(positions:Pose[])=>positions.map(p=>`${p.performerId}:${round(p.x)},${round(p.z)},${Math.round(p.facing)}`).sort().join('|');

/**
 * Variations of a formation: mirrored, flipped, rotated, tighter, wider, recast
 * (groups swap spots, or left/right order reverses) and shortest travel from the
 * previous formation. Variations identical to the original (symmetric shapes) or
 * to an earlier variation are left out.
 */
export function formationVariations(project:Project,formationId:string):Variation[]{
  const index=project.formations.findIndex(f=>f.id===formationId),formation=project.formations[index];
  if(!formation)throw Error('Choose a formation.');
  const base=formation.positions,visible=base.filter(p=>p.visible!==false);if(visible.length<2)return [];
  const cx=visible.reduce((s,p)=>s+p.x,0)/visible.length,cz=visible.reduce((s,p)=>s+p.z,0)/visible.length;
  const map=(f:(p:Pose)=>Pose)=>fitToStage(base.map(p=>p.visible===false?p:f(p)),project.stage);
  const rotate=(degrees:number)=>{const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return map(p=>({...p,x:cx+(p.x-cx)*c-(p.z-cz)*s,z:cz+(p.x-cx)*s+(p.z-cz)*c}));};
  const scale=(k:number)=>map(p=>({...p,x:cx+(p.x-cx)*k,z:cz+(p.z-cz)*k}));
  const list:Variation[]=[
    {id:'mirror',label:'Mirror',hint:'Left and right swap sides.',positions:map(p=>({...p,x:2*cx-p.x,facing:normalAngle(-p.facing)}))},
    {id:'flip',label:'Flip front to back',hint:'The front line becomes the back line.',positions:map(p=>({...p,z:2*cz-p.z}))},
    {id:'rotate-90',label:'Quarter turn',hint:'The shape turns 90° on the floor.',positions:rotate(90)},
    {id:'rotate-180',label:'Half turn',hint:'The shape turns 180° on the floor.',positions:rotate(180)},
    {id:'tighter',label:'Tighter',hint:'20% closer together.',positions:scale(.8)},
    {id:'wider',label:'Wider',hint:'20% more space, kept on stage.',positions:scale(1.25)},
  ];
  // Recast: same spots, different people in them.
  const groups=new Map<string,Pose[]>(),performer=new Map(project.performers.map(p=>[p.id,p]));
  for(const p of visible){const g=performer.get(p.performerId)?.group||'';if(!groups.has(g))groups.set(g,[]);groups.get(g)!.push(p);}
  const sizes=[...groups.values()].map(g=>g.length);
  if(groups.size>=2&&sizes.every(n=>n===sizes[0])){
    const names=[...groups.keys()],spots=new Map<string,Point>();
    names.forEach((name,g)=>{const own=[...groups.get(name)!].sort((a,b)=>a.x-b.x||a.z-b.z),other=[...groups.get(names[(g+1)%names.length])!].sort((a,b)=>a.x-b.x||a.z-b.z);own.forEach((p,k)=>spots.set(p.performerId,{x:other[k].x,z:other[k].z}));});
    list.push({id:'swap-groups',label:'Swap groups',hint:`${names.slice(0,3).join(', ')}${names.length>3?'…':''} trade places.`,positions:base.map(p=>spots.has(p.performerId)?{...p,...spots.get(p.performerId)}:p)});
  }
  {
    const byX=[...visible].sort((a,b)=>a.x-b.x||a.z-b.z),reversed=[...byX].reverse(),spots=new Map(byX.map((p,k)=>[p.performerId,{x:reversed[k].x,z:reversed[k].z}]));
    list.push({id:'recast',label:'Reverse casting',hint:'The same shape with the left/right order of dancers reversed.',positions:base.map(p=>spots.has(p.performerId)?{...p,...spots.get(p.performerId)}:p)});
  }
  const previous=project.formations[index-1];
  if(previous){
    const origins=new Map(previous.positions.filter(p=>p.visible!==false).map(p=>[p.performerId,{x:p.x,z:p.z}]));
    list.push({id:'shortest-travel',label:'Shortest travel',hint:`Same shape; each dancer takes the spot nearest to where they are in “${previous.name}”.`,positions:assignByTravel(base,origins)});
  }
  const seen=new Set([signature(base)]);
  return list.filter(v=>{const key=signature(v.positions);if(seen.has(key))return false;seen.add(key);return true;});
}
