import {clamp} from './engine.js';
export function boxSelection(positions,start,end,initial=new Set(),mode='replace'){
  const result=mode==='replace'?new Set():new Set(initial),minX=Math.min(start.x,end.x),maxX=Math.max(start.x,end.x),minZ=Math.min(start.z,end.z),maxZ=Math.max(start.z,end.z);
  for(const p of positions)if(p.visible!==false&&p.x>=minX&&p.x<=maxX&&p.z>=minZ&&p.z<=maxZ){if(mode==='subtract')result.delete(p.performerId);else result.add(p.performerId);}
  return result;
}
export function translateSelection(positions,ids,dx,dz,stage){
  const chosen=positions.filter(p=>ids.has(p.performerId));if(!chosen.length)return positions.map(p=>({...p}));
  dx=clamp(dx,Math.min(0,-stage.width/2+.2-Math.min(...chosen.map(p=>p.x))),Math.max(0,stage.width/2-.2-Math.max(...chosen.map(p=>p.x))));
  dz=clamp(dz,Math.min(0,-stage.depth/2+.2-Math.min(...chosen.map(p=>p.z))),Math.max(0,stage.depth/2-.2-Math.max(...chosen.map(p=>p.z))));
  return positions.map(p=>ids.has(p.performerId)?{...p,x:Math.round((p.x+dx)*100)/100,z:Math.round((p.z+dz)*100)/100}:{...p});
}
