import {clone,uid,validateProject,samplePerformance} from './engine.js';
import {coverageAt,coverageWindow} from './ensemble-schema.js';
import {inPolygon} from './production-next-model.js';
import {sampleProps} from './prop-motion.js';
const round=n=>Math.round(n*1000)/1000,dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const angle=n=>((n+540)%360)-180;
function editable(project,formation){if(!formation||formation.status==='approved'||project.production?.layers.formations.locked)throw Error('Unlock the affected formation and its track first.');}
export function assertEnsembleEdits(before,after){
 if(!before.ensemble||!after.ensemble)return;
 const changed=JSON.stringify(before.ensemble.attendance)!==JSON.stringify(after.ensemble.attendance);
 for(const f of before.formations.filter(f=>f.status==='approved')){
  if(changed){const affected=(project)=>project.ensemble.attendance.filter(e=>{const w=coverageWindow(project,e);return e.enabled&&w.valid&&f.time>=w.start&&f.time<w.end;});if(JSON.stringify(affected(before))!==JSON.stringify(affected(after)))throw Error('Unlock the approved formations before changing attendance.');}
  if(JSON.stringify(before.ensemble.constraints.filter(v=>v.formationId===f.id))!==JSON.stringify(after.ensemble.constraints.filter(v=>v.formationId===f.id)))throw Error('Unlock the approved formation before changing its live constraints.');
 }
}
// Minimum-cost perfect matching; O(n³), bounded to the 100-person cast.
export function minimumAssignment(cost){
 const n=cost.length;if(!n||cost.some(r=>r.length!==n||r.some(v=>!Number.isFinite(v)||v<0)))throw Error('Invalid cast assignment costs.');
 const u=Array(n+1).fill(0),v=Array(n+1).fill(0),p=Array(n+1).fill(0),way=Array(n+1).fill(0);
 for(let i=1;i<=n;i++){p[0]=i;let j0=0;const min=Array(n+1).fill(Infinity),used=Array(n+1).fill(false);do{used[j0]=true;const i0=p[j0];let delta=Infinity,j1=0;for(let j=1;j<=n;j++)if(!used[j]){const cur=cost[i0-1][j-1]-u[i0]-v[j];if(cur<min[j]){min[j]=cur;way[j]=j0;}if(min[j]<delta){delta=min[j];j1=j;}}for(let j=0;j<=n;j++)if(used[j]){u[p[j]]+=delta;v[j]-=delta;}else min[j]-=delta;j0=j1;}while(p[j0]!==0);do{const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0);}
 const result=Array(n);for(let j=1;j<=n;j++)result[p[j]-1]=j-1;return result;
}
export function smartCastAssignment(project,formationId,{ids=project.performers.map(p=>p.id),lockedIds=project.ensemble?.assignmentLocks||[],preserveGroups=true,preserveRoles=true,nextWeight=.5}={}){
 const index=project.formations.findIndex(f=>f.id===formationId),f=project.formations[index],before=project.formations[index-1],after=project.formations[index+1];editable(project,f);
 if(!before)throw Error('Choose a formation after the opening to optimize incoming travel.');if(!Number.isFinite(nextWeight)||nextWeight<0||nextWeight>1)throw Error('Use an outgoing-travel weight from 0 to 1.');
 const locked=new Set([...lockedIds,...(project.ensemble?.constraints||[]).filter(v=>v.formationId===formationId).flatMap(v=>v.members),...coverageAt(project,f.time).flatMap(v=>[v.absentId,v.coverId]).filter(Boolean)]);
 const chosen=new Set(ids),people=new Map(project.performers.map(p=>[p.id,p])),start=new Map(before.positions.map(p=>[p.performerId,p])),finish=new Map(after?.positions.map(p=>[p.performerId,p])||[]);
 const slots=f.positions.filter(p=>chosen.has(p.performerId)&&!locked.has(p.performerId)&&p.visible!==false&&start.get(p.performerId)?.visible!==false);
 if(slots.length<2)throw Error('Choose at least two visible, unlocked performers without live constraints or active attendance overrides.');
 const forbidden=1e12,cost=slots.map(person=>slots.map(slot=>{const a=people.get(person.performerId),b=people.get(slot.performerId);return preserveGroups&&a.group!==b.group||preserveRoles&&a.role!==b.role?forbidden:dist(start.get(a.id),slot)+(after&&finish.get(a.id)?.visible!==false?nextWeight*dist(slot,finish.get(a.id)):0);}));
 const assignment=minimumAssignment(cost),next=clone(project),target=next.formations[index],moves=[];
 let oldDistance=0,newDistance=0;slots.forEach((p,i)=>{const slot=slots[assignment[i]];if(cost[i][assignment[i]]>=forbidden)throw Error('No assignment satisfies the chosen restrictions.');oldDistance+=cost[i][i];newDistance+=cost[i][assignment[i]];if(slot.performerId!==p.performerId){moves.push({performerId:p.performerId,slotOwnerId:slot.performerId,from:{x:p.x,z:p.z},to:{x:slot.x,z:slot.z}});Object.assign(target.positions.find(v=>v.performerId===p.performerId),{...slot,performerId:p.performerId});}});
 const changed=new Set(moves.map(v=>v.performerId)),routes=next.routes.filter(r=>changed.has(r.performerId)&&(r.fromId===formationId||r.toId===formationId));
 if(routes.some(r=>r.locked)||routes.length&&project.production.layers.movement.locked)throw Error('Unlock adjacent custom routes and the movement track before reassigning their performers.');
 next.routes=next.routes.filter(r=>!routes.some(v=>v.id===r.id));
 return {project:validateProject(next),moves,beforeDistance:oldDistance,afterDistance:newDistance,removedRoutes:routes.length,weighted:!!after&&nextWeight>0};
}
export function constrainedPositions(project,formationId,positions,previous=positions){
 const rules=(project.ensemble?.constraints||[]).filter(c=>c.formationId===formationId);if(!rules.length)return positions;
 const points=new Map(positions.map(p=>[p.performerId,{...p}])),old=new Map(previous.map(p=>[p.performerId,p]));
 for(const rule of rules){const members=rule.members.map(id=>points.get(id));if(members.some(p=>!p))throw Error('A live constraint refers to a missing performer.');const changed=members.filter(p=>{const q=old.get(p.performerId);return !q||dist(p,q)>.00001||Math.abs(p.facing-q.facing)>.00001;}),driver=changed[0]||members[0],anchor=members.indexOf(driver);
  if(rule.type.startsWith('mirror')){const follower=members[anchor===0?1:0],axis=rule.type==='mirror-x'?'x':'z',other=axis==='x'?'z':'x';follower[axis]=2*rule.value-driver[axis];follower[other]=driver[other];follower.facing=angle(axis==='x'?-driver.facing:180-driver.facing);}
  else{const axis=rule.type==='space-x'?'x':'z',other=axis==='x'?'z':'x';members.forEach((p,i)=>{p[axis]=driver[axis]+(i-anchor)*rule.value;p[other]=driver[other];});}
  for(const p of members){p.x=round(p.x);p.z=round(p.z);if(Math.abs(p.x)>project.stage.width/2+.00001||Math.abs(p.z)>project.stage.depth/2+.00001||!inPolygon(p,project.production?.stage.outline))throw Error('The live constraint would place a performer outside the usable stage. Move the group inward or edit the constraint.');}
 }
 return positions.map(p=>points.get(p.performerId));
}
export function enforceConstraints(project,previous=project){
 if(!project.ensemble?.constraints.length)return project;const before=new Map(previous.formations.map(f=>[f.id,f]));
 for(const f of project.formations){const proposed=constrainedPositions(project,f.id,f.positions,before.get(f.id)?.positions||f.positions);if(proposed.some((p,i)=>dist(p,f.positions[i])>.00001||p.facing!==f.positions[i].facing)){editable(project,f);f.positions=proposed;}}
 return project;
}
export function addConstraint(project,formationId,type,members,value){
 const next=clone(project),f=next.formations.find(f=>f.id===formationId);editable(project,f);const axis=type.endsWith('x')?'x':'z';members=[...new Set(members)];if(type.startsWith('space'))members.sort((a,b)=>f.positions.find(p=>p.performerId===a)?.[axis]-f.positions.find(p=>p.performerId===b)?.[axis]);
 next.ensemble.constraints.push({id:uid(),formationId,type,members,value});validateProject(next);enforceConstraints(next,project);return validateProject(next);
}
export function addAttendance(project,{absentId,coverId=null,fromId,toId}){
 const next=clone(project),from=next.formations.findIndex(f=>f.id===fromId),to=next.formations.findIndex(f=>f.id===toId);if(from<0||to<from)throw Error('Choose an ordered formation range.');if(next.formations.slice(from,to+1).some(f=>f.status==='approved')||next.production.layers.formations.locked)throw Error('Unlock the affected formations and formation track before changing attendance.');
 next.ensemble.attendance.push({id:uid(),absentId,coverId,fromId,toId,enabled:true});return validateProject(next);
}
export function trafficReport(project){
 let omitted=0;const items=(project.ensemble?.traffic||[]).map(v=>({...v,manual:true})),zones=(project.production?.zones||[]).filter(z=>['wing','entrance'].includes(z.kind));
 for(let i=1;i<project.formations.length;i++){const f=project.formations[i],previous=project.formations[i-1],positions=samplePerformance(project,f.time),before=samplePerformance(project,Math.max(previous.time,f.time-.001)),old=new Map(before.map(p=>[p.performerId,p]));for(const p of positions){const q=old.get(p.performerId);if(!q||q.visible===p.visible)continue;const kind=p.visible===false?'exit':'entrance',point=kind==='exit'?q:p,zone=[...zones].sort((a,b)=>dist(point,a)-dist(point,b))[0];if(zone&&items.length>=600){omitted++;continue;}if(zone&&!items.some(v=>v.performerId===p.performerId&&v.kind===kind&&v.start<=f.time&&v.end>=f.time))items.push({id:'auto-'+f.id+'-'+p.performerId,performerId:p.performerId,zoneId:zone.id,kind,start:Math.max(0,f.time-1),end:Math.min(project.duration,f.time+1),manual:false});}}
 const issues=[];pairs:for(let i=0;i<items.length;i++)for(let j=0;j<i;j++){if(issues.length>=500)break pairs;const a=items[i],b=items[j];if(Math.max(a.start,b.start)>=Math.min(a.end,b.end))continue;if(a.performerId===b.performerId&&a.zoneId!==b.zoneId)issues.push({type:'person',items:[a.id,b.id],time:Math.max(a.start,b.start),message:'One performer is reserved in two backstage zones.'});else if(a.zoneId===b.zoneId&&a.performerId!==b.performerId)issues.push({type:a.kind===b.kind?'queue':'opposing',items:[a.id,b.id],time:Math.max(a.start,b.start),message:a.kind===b.kind?'Shared entrance/wing window: review queue spacing.':'Opposing entrance and exit traffic in the same window.'});}
 return {items:items.sort((a,b)=>a.start-b.start),issues,limited:issues.length===500,omitted,zones};
}
function segmentBox(eye,target,object){
 const a=(object.rotation||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),local=p=>{const x=p.x-object.x,z=p.z-object.z;return [x*c-z*s,p.y,x*s+z*c];},p=local(eye),q=local(target),mins=[-object.width/2,0,-object.depth/2],maxs=[object.width/2,object.height,object.depth/2];let lo=0,hi=1;
 for(let i=0;i<3;i++){const d=q[i]-p[i];if(Math.abs(d)<1e-9){if(p[i]<mins[i]||p[i]>maxs[i])return false;}else{let t=(mins[i]-p[i])/d,u=(maxs[i]-p[i])/d;if(t>u)[t,u]=[u,t];lo=Math.max(lo,t);hi=Math.min(hi,u);if(lo>hi)return false;}}
 return hi>.001&&lo<.999;
}
export function sightlineReport(project,time,seat=project.ensemble.seat){
 if(!Number.isFinite(time)||time<0||time>project.duration||!seat||![seat.x,seat.z,seat.height].every(Number.isFinite)||Math.abs(seat.x)>200||Math.abs(seat.z)>200||seat.height<.3||seat.height>10)throw Error('Choose a valid audience position, time and eye height.');if(Math.abs(seat.x)<=project.stage.width/2&&Math.abs(seat.z)<=project.stage.depth/2)throw Error('Place the audience viewpoint outside the stage.');
 const positions=samplePerformance(project,time).filter(p=>p.visible!==false),objects=[...sampleProps(project,time,positions),...project.production.zones.filter(z=>['riser','obstacle','restricted'].includes(z.kind))].filter(o=>o.height>.05),eye={x:seat.x,z:seat.z,y:seat.height};
 const performers=new Map(project.performers.map(p=>[p.id,p]));const reports=positions.map(p=>{const targets=[.65,1.15,1.5].map(y=>({x:p.x,z:p.z,y})),blockers=new Set();let blocked=0;for(const target of targets){const hit=[];for(const o of objects)if(segmentBox(eye,target,o))hit.push(o.name||'Stage object');for(const q of positions){if(q===p)continue;const dx=target.x-eye.x,dz=target.z-eye.z,t=((q.x-eye.x)*dx+(q.z-eye.z)*dz)/(dx*dx+dz*dz||1);if(t>.001&&t<.999&&Math.hypot(eye.x+dx*t-q.x,eye.z+dz*t-q.z)<.24&&eye.y+(target.y-eye.y)*t<1.62)hit.push(performers.get(q.performerId)?.name||'Performer');}if(hit.length)blocked++;hit.forEach(v=>blockers.add(v));}return {performerId:p.performerId,x:p.x,z:p.z,blocked,total:targets.length,blockers:[...blockers]};});
 return {time,seat:{...seat},performers:reports,clear:reports.filter(p=>p.blocked===0).length};
}
