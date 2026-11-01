import type {Pose,TransformOptions} from './types.js';
export function transformPositions(positions:Pose[],ids:Set<string>,options:TransformOptions={}){
  const chosen=positions.filter(p=>ids.has(p.performerId));if(!chosen.length)return positions.map(p=>({...p}));
  const center={x:chosen.reduce((s,p)=>s+p.x,0)/chosen.length,z:chosen.reduce((s,p)=>s+p.z,0)/chosen.length};
  const angle=(options.angle||0)*Math.PI/180,scale=options.scale??1;
  if(!Number.isFinite(scale)||scale<.1||scale>5||!Number.isFinite(angle))throw Error('Choose a valid rotation and scale.');
  const transformed=new Map(chosen.map(p=>{
    let x=(p.x-center.x)*(options.mirrorX?-1:1)*scale,z=(p.z-center.z)*(options.mirrorZ?-1:1)*scale;
    [x,z]=[x*Math.cos(angle)-z*Math.sin(angle),x*Math.sin(angle)+z*Math.cos(angle)];
    const result={...p,x:Math.round((x+center.x)*100)/100||0,z:Math.round((z+center.z)*100)/100||0};
    if(options.align==='horizontal')result.z=center.z;if(options.align==='vertical')result.x=center.x;
    return [p.performerId,result];
  }));
  if(options.distribute){const axis=options.distribute==='horizontal'?'x':'z',sorted=[...transformed.values()].sort((a,b)=>a[axis]-b[axis]);if(sorted.length>2){const min=sorted[0][axis],max=sorted[sorted.length-1][axis];sorted.forEach((p,i)=>p[axis]=Math.round((min+(max-min)*i/(sorted.length-1))*100)/100);}}
  if([...transformed.values()].some(p=>Math.abs(p.x)>100||Math.abs(p.z)>100))throw Error('The transformed positions exceed the 100 meter coordinate limit.');
  return positions.map(p=>transformed.get(p.performerId)||({...p}));
}
