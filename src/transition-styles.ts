import type {Performer,Point,Pose,Project,Route} from './types.js';
import {clone,uid,transitionSettings} from './engine.js';

/**
 * Transition designer: path styles (explode, implode, spiral, peel-off, follow the
 * leader) and canon / ripple timing for the move into the next formation. The
 * result is ordinary routes (waypoints, delay, settle), so playback, analysis,
 * exports and undo treat a designed transition like any hand-made one.
 */
export type TransitionStyle='direct'|'explode'|'implode'|'spiral-cw'|'spiral-ccw'|'peel'|'follow';
export type CanonOrder='together'|'left-right'|'right-left'|'front-back'|'back-front'|'center-out'|'outside-in'|'number'|'group';
/** `canon`: equal moves, started (and finished) one after another. `land`: staggered starts, everyone arrives together. */
export type CanonTiming='canon'|'land';
export interface TransitionDesign {style:TransitionStyle; order:CanonOrder; timing:CanonTiming; /** Counts between one wave and the next. */ spread:number}

export const TRANSITION_STYLES:readonly {id:TransitionStyle;label:string;hint:string}[]=[
  {id:'direct',label:'Direct',hint:'Everyone takes the straight line.'},
  {id:'explode',label:'Explode',hint:'Burst outward from the centre, then land.'},
  {id:'implode',label:'Implode',hint:'Gather into a tight ring, then spread to the new spots.'},
  {id:'spiral-cw',label:'Spiral ↻',hint:'Sweep clockwise around the centre.'},
  {id:'spiral-ccw',label:'Spiral ↺',hint:'Sweep counter-clockwise around the centre.'},
  {id:'peel',label:'Peel-off',hint:'Curve away from the group, one after another.'},
  {id:'follow',label:'Follow the leader',hint:'Walk through the spots of the dancers ahead, like a snake.'},
];
export const CANON_ORDERS:readonly {id:CanonOrder;label:string}[]=[
  {id:'together',label:'Everyone together'},
  {id:'left-right',label:'Left to right (as the audience sees it)'},
  {id:'right-left',label:'Right to left (as the audience sees it)'},
  {id:'front-back',label:'Front to back'},
  {id:'back-front',label:'Back to front'},
  {id:'center-out',label:'Ripple out from the centre'},
  {id:'outside-in',label:'Ripple in from the outside'},
  {id:'number',label:'By performer number'},
  {id:'group',label:'Group by group'},
];
/** The order a style reads best with when the choreographer has not picked one. */
export function defaultOrder(style:TransitionStyle):CanonOrder{return style==='peel'||style==='follow'?'left-right':style==='explode'?'center-out':style==='implode'?'outside-in':'together';}

const round=(v:number)=>Math.round(v*100)/100,time=(v:number)=>Math.round(v*1000)/1000;
const centroid=(points:Point[])=>points.length?{x:points.reduce((s,p)=>s+p.x,0)/points.length,z:points.reduce((s,p)=>s+p.z,0)/points.length}:{x:0,z:0};

/**
 * Wave number of each performer (0 moves first). Positions closer than `tolerance`
 * along the ordering axis share a wave, so a column moves as one.
 */
export function canonRanks(positions:Pose[],order:CanonOrder,performers:Performer[],tolerance=.3):Map<string,number>{
  const ranks=new Map<string,number>();
  if(order==='together'){positions.forEach(p=>ranks.set(p.performerId,0));return ranks;}
  if(order==='number'||order==='group'){
    const people=new Map(performers.map((p,i)=>[p.id,{p,i}])),groups=[...new Set(performers.map(p=>p.group))];
    const key=(id:string)=>{const entry=people.get(id);if(!entry)return Infinity;return order==='number'?entry.p.number:groups.indexOf(entry.p.group);};
    const values=[...new Set(positions.map(p=>key(p.performerId)))].sort((a,b)=>a-b);
    positions.forEach(p=>ranks.set(p.performerId,values.indexOf(key(p.performerId))));return ranks;
  }
  const c=centroid(positions);
  const value=(p:Pose)=>order==='left-right'?p.x:order==='right-left'?-p.x:order==='front-back'?p.z:order==='back-front'?-p.z:order==='center-out'?Math.hypot(p.x-c.x,p.z-c.z):-Math.hypot(p.x-c.x,p.z-c.z);
  const sorted=[...positions].sort((a,b)=>value(a)-value(b));
  let rank=0,anchor=sorted.length?value(sorted[0]):0;
  for(const p of sorted){if(value(p)-anchor>tolerance){rank++;anchor=value(p);}ranks.set(p.performerId,rank);}
  return ranks;
}

/** Waypoints for one performer's path from `p` to `q` in the given style. */
function styleWaypoints(style:TransitionStyle,p:Pose,q:Pose,context:{center:Point;ring:Map<string,Point>;chain:Pose[];chainIndex:number;inside:(v:Point)=>Point}):Point[]{
  const {center:c,inside}=context,dx=q.x-p.x,dz=q.z-p.z,length=Math.hypot(dx,dz);
  const unit=(x:number,z:number,fallback:number)=>{const l=Math.hypot(x,z);return l>.1?{x:x/l,z:z/l}:{x:Math.cos(fallback),z:Math.sin(fallback)};};
  const fallback=context.chainIndex*2.399963;
  if(style==='explode'){
    const u=unit(p.x-c.x,p.z-c.z,fallback),reach=Math.max(Math.hypot(p.x-c.x,p.z-c.z),Math.hypot(q.x-c.x,q.z-c.z))+Math.max(1,length*.35);
    return [inside({x:c.x+u.x*reach,z:c.z+u.z*reach})];
  }
  if(style==='implode'){const spot=context.ring.get(p.performerId);return spot?[inside(spot)]:[];}
  if(style==='spiral-cw'||style==='spiral-ccw'){
    const a0=Math.atan2(p.z-c.z,p.x-c.x),a1=Math.atan2(q.z-c.z,q.x-c.x),r0=Math.hypot(p.x-c.x,p.z-c.z),r1=Math.hypot(q.x-c.x,q.z-c.z);
    // Counter-clockwise is a positive angle (x right, z up the screen); force every sweep the same way.
    let delta=((a1-a0)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);if(style==='spiral-cw'&&delta>1e-6)delta-=Math.PI*2;
    if(Math.abs(delta)<.2&&Math.abs(r1-r0)<.3)return [];
    return [.25,.5,.75].map(t=>{const a=a0+delta*t,r=Math.max(.6,r0+(r1-r0)*t);return inside({x:c.x+Math.cos(a)*r,z:c.z+Math.sin(a)*r});});
  }
  if(style==='peel'){
    if(length<.3)return [];
    const mx=(p.x+q.x)/2,mz=(p.z+q.z)/2;let nx=-dz/length,nz=dx/length;if(nx*(mx-c.x)+nz*(mz-c.z)<0){nx=-nx;nz=-nz;}
    const bend=Math.min(1.6,Math.max(.6,length*.4));return [inside({x:mx+nx*bend,z:mz+nz*bend})];
  }
  if(style==='follow'){
    // Through the starting spots of up to three dancers ahead, nearest first.
    const ahead=context.chain.slice(Math.max(0,context.chainIndex-3),context.chainIndex).reverse();
    return ahead.map(v=>inside({x:v.x,z:v.z}));
  }
  return [];
}

/**
 * Designs the routes from `formationId` into the next formation. Returns the new
 * project and the timing actually used: a spread too long for the time available
 * is shortened so no one has less than a short, walkable move.
 */
export function designTransition(project:Project,formationId:string,design:TransitionDesign){
  const index=project.formations.findIndex(f=>f.id===formationId),from=project.formations[index],to=project.formations[index+1];
  if(!from||!to)throw Error('Choose a formation with a following formation.');
  if(from.status==='approved'||(project.routes||[]).some(r=>r.fromId===from.id&&r.toId===to.id&&r.locked))throw Error('Unlock this formation and its routes first.');
  if(!TRANSITION_STYLES.some(s=>s.id===design.style)||!CANON_ORDERS.some(o=>o.id===design.order))throw Error('Choose a transition style and order.');
  if(!Number.isFinite(design.spread)||design.spread<0||design.spread>32)throw Error('Use a spread from 0 to 32 counts.');
  const destinations=new Map(to.positions.map(p=>[p.performerId,p]));
  const movers=from.positions.filter(p=>p.visible!==false&&destinations.get(p.performerId)?.visible!==false&&destinations.has(p.performerId));
  if(!movers.length)throw Error('No one travels in this transition.');
  const order=design.style==='follow'&&design.order==='together'?'left-right':design.order;
  const ranks=canonRanks(movers,order,project.performers),waves=Math.max(0,...ranks.values())+1;
  const gap=to.time-from.time,settings=transitionSettings(project,from),base=Math.min(gap,60,Math.max(.5,settings.duration));
  let step=order==='together'?0:design.spread*60/project.bpm;
  const window=Math.min(gap,60,base+(waves-1)*step),minimumMove=Math.min(base,Math.max(.6,window*.3));
  if(waves>1&&window-(waves-1)*step<minimumMove)step=Math.max(0,(window-minimumMove)/(waves-1));
  // Style geometry.
  const halfW=project.stage.width/2-.2,halfD=project.stage.depth/2-.2,inside=(v:Point)=>({x:round(Math.max(-halfW,Math.min(halfW,v.x))),z:round(Math.max(-halfD,Math.min(halfD,v.z)))});
  const center=centroid([...movers,...movers.map(p=>destinations.get(p.performerId)!)]);
  const ring=new Map<string,Point>();
  if(design.style==='implode'){
    const radius=Math.max(.7,(project.safetyDistance||.55)*1.15*movers.length/(Math.PI*2)),sorted=[...movers].sort((a,b)=>Math.atan2(a.z-center.z,a.x-center.x)-Math.atan2(b.z-center.z,b.x-center.x));
    const start=sorted.length?Math.atan2(sorted[0].z-center.z,sorted[0].x-center.x):0;
    sorted.forEach((p,k)=>{const a=start+Math.PI*2*k/sorted.length;ring.set(p.performerId,{x:center.x+Math.cos(a)*radius,z:center.z+Math.sin(a)*radius});});
  }
  const chain=[...movers].sort((a,b)=>ranks.get(a.performerId)!-ranks.get(b.performerId)!||a.x-b.x||a.z-b.z);
  const next=clone(project);next.routes=(next.routes||[]).filter(r=>r.fromId!==from.id||r.toId!==to.id);
  for(const p of chain){
    const q=destinations.get(p.performerId)!,rank=ranks.get(p.performerId)!,waypoints=styleWaypoints(design.style,p,q,{center,ring,chain,chainIndex:chain.indexOf(p),inside}).slice(0,12);
    const delay=time(rank*step),settle=design.timing==='canon'?time((waves-1-rank)*step):0;
    const route:Route={id:uid(),fromId:from.id,toId:to.id,performerId:p.performerId,duration:time(window),delay,easing:'smooth',curve:'smooth',waypoints,locked:false};
    if(settle>0)route.settle=settle;
    next.routes.push(route);
  }
  return {project:next,window:time(window),step:time(step),waves,movers:movers.length,shortened:order!=='together'&&step<design.spread*60/project.bpm-1e-6};
}

/** The routes currently used by a transition, summarised for the designer's starting values. */
export function currentDesign(project:Project,formationId:string):TransitionDesign{
  const index=project.formations.findIndex(f=>f.id===formationId),to=project.formations[index+1];
  const routes=to?(project.routes||[]).filter(r=>r.fromId===formationId&&r.toId===to.id):[];
  const delays=[...new Set(routes.map(r=>r.delay))].sort((a,b)=>a-b),step=delays.length>1?delays[1]-delays[0]:0;
  return {style:'direct',order:'together',timing:step>0&&!routes.some(r=>(r.settle||0)>0)?'land':'canon',spread:step>0?Math.round(step*project.bpm/60*2)/2:1};
}
