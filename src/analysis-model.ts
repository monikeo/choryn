import type {Project} from './types.js';
import {samplePerformance,transitionSettings} from './engine.js';
import {ghostInterval} from './rehearsal-model.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function compareFormations(project: Project,currentId,referenceId,selected=new Set()){
 const current=project.formations.find(f=>f.id===currentId),reference=project.formations.find(f=>f.id===referenceId);
 if(!current||!reference)throw Error('Choose two existing formations.');
 const before=new Map(reference.positions.map(p=>[p.performerId,p]));
 return current.positions.filter(p=>!selected.size||selected.has(p.performerId)).map(p=>{const q=before.get(p.performerId);return {performerId:p.performerId,from:q,to:p,distance:q?distance(p,q):0,facing:q?Math.abs(((p.facing-q.facing+540)%360)-180):0,visibilityChanged:!!q&&(p.visible!==false)!==(q.visible!==false)};});
}
export function heatColor(amount){const t=Math.max(0,Math.min(1,amount));return t<.5?`#${[64,170,140].map((v,i)=>Math.round(v+([235,185,65][i]-v)*t*2).toString(16).padStart(2,'0')).join('')}`:`#${[235,185,65].map((v,i)=>Math.round(v+([214,70,95][i]-v)*(t-.5)*2).toString(16).padStart(2,'0')).join('')}`;}
export function transitionAnalysis(project: Project,time,{heat='off',comparisonId='',threshold=project.safetyDistance||.55,focusSelected=false}={},selection=new Set()){
 const index=ghostInterval(project,time),from=project.formations[index],to=project.formations[index+1],selected=focusSelected?selection:new Set(),comparison=comparisonId&&comparisonId!==from.id&&project.formations.some(f=>f.id===comparisonId)?compareFormations(project,from.id,comparisonId,selected):[];
 const result={comparison,paths:[],cells:[],summary:'',fromId:from.id,toId:to?.id||null,minSpacing:null,sampleCount:0};
 if(!['travel','spacing'].includes(heat)||!to){result.summary=comparison.length?`Comparison · ${comparison.length} performers · max ${Math.max(...comparison.map(p=>p.distance)).toFixed(2)} m displacement`:heat!=='off'?'No outgoing transition':'';return result;}
 threshold=Math.max(.2,Math.min(5,Number(threshold)||.55));
 const routes=(project.routes||[]).filter(r=>r.fromId===from.id&&r.toId===to.id),duration=Math.min(to.time-from.time,Math.max(transitionSettings(project,from).duration,...routes.map(r=>r.duration))),start=to.time-duration,steps=32,tracks=new Map(),cells=new Map(),nx=Math.min(24,Math.max(4,Math.ceil(project.stage.width))),nz=Math.min(24,Math.max(4,Math.ceil(project.stage.depth))),cw=project.stage.width/nx,cd=project.stage.depth/nz;
 let min=Infinity;
 for(let i=0;i<=steps;i++){
  const positions=samplePerformance(project,start+duration*i/steps).filter(p=>p.visible!==false);result.sampleCount++;
  if(heat==='travel')for(const p of positions){if(selected.size&&!selected.has(p.performerId))continue;if(!tracks.has(p.performerId))tracks.set(p.performerId,[]);tracks.get(p.performerId).push({x:p.x,z:p.z});}
  if(heat==='spacing'){
   // Sweep and prune on x: a pair farther apart in x than both the threshold and the
   // closest gap so far cannot add a cell or lower the minimum, so the scan stops there.
   const order=positions.map((_,n)=>n).sort((m,n)=>positions[m].x-positions[n].x),close:[number,number,number][]=[];
   for(let s=0;s<order.length;s++)for(let t=s+1;t<order.length;t++){
    if(positions[order[t]].x-positions[order[s]].x>=Math.max(threshold,min))break;
    const a=Math.min(order[s],order[t]),b=Math.max(order[s],order[t]),p=positions[a],q=positions[b];if(selected.size&&!selected.has(p.performerId)&&!selected.has(q.performerId))continue;const gap=distance(p,q);min=Math.min(min,gap);if(gap<threshold)close.push([a,b,gap]);
   }
   // Same pair order as a nested loop, so cells are created in the same order.
   for(const [a,b,gap] of close.sort((u,v)=>u[0]-v[0]||u[1]-v[1])){const p=positions[a],q=positions[b];
   for(const point of [p,q,{x:(p.x+q.x)/2,z:(p.z+q.z)/2}]){const x=Math.max(0,Math.min(nx-1,Math.floor((point.x+project.stage.width/2)/cw))),z=Math.max(0,Math.min(nz-1,Math.floor((point.z+project.stage.depth/2)/cd))),key=x+'/'+z,intensity=1-gap/threshold;if(!cells.has(key))cells.set(key,{x:-project.stage.width/2+(x+.5)*cw,z:-project.stage.depth/2+(z+.5)*cd,width:cw,depth:cd,intensity});else cells.get(key).intensity=Math.max(cells.get(key).intensity,intensity);}
  }}
 }
 if(heat==='travel'){result.paths=[...tracks].map(([performerId,points])=>({performerId,points,distance:points.slice(1).reduce((sum,p,i)=>sum+distance(p,points[i]),0)}));const max=Math.max(.001,...result.paths.map(p=>p.distance));result.paths.forEach(p=>p.color=heatColor(p.distance/max));result.summary=`Travel · ${from.name} → ${to.name} · longest ${max<.01?'0.00':max.toFixed(2)} m`;}
 else{result.minSpacing=Number.isFinite(min)?min:null;result.cells=[...cells.values()].map(c=>({...c,color:heatColor(c.intensity)}));result.summary=`Spacing · ${threshold.toFixed(2)} m threshold · ${Number.isFinite(min)?min.toFixed(2)+' m minimum':'no visible pairs'} · 33 samples`;}
 return result;
}
