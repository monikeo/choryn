const finite=(n,a,b)=>typeof n==='number'&&Number.isFinite(n)&&n>=a&&n<=b;
const id=v=>typeof v==='string'&&/^[-\w]{1,100}$/.test(v);
const check=(v,label)=>{if(!v)throw Error('Invalid '+label+' in ensemble tools.');};
export function coverageWindow(project,entry){
 const forms=project.formations,start=forms.findIndex(f=>f.id===entry.fromId),end=forms.findIndex(f=>f.id===entry.toId);
 return {start:forms[start]?.time??Infinity,end:forms[end+1]?.time??project.duration,valid:start>=0&&end>=start};
}
const coverageCache=new WeakMap(),noCoverage=Object.freeze([]),coverageFields=['id','absentId','coverId','fromId','toId','enabled'];
export function coverageAt(project,time){
 const entries=project.ensemble?.attendance;if(!entries?.length)return noCoverage;
 let cache=coverageCache.get(project);const forms=project.formations;
 const same=cache&&cache.duration===project.duration&&cache.forms.length===forms.length&&cache.entries.length===entries.length&&cache.forms.every((f,i)=>f.id===forms[i].id&&f.time===forms[i].time)&&cache.entries.every((e,i)=>coverageFields.every(k=>e[k]===entries[i][k]));
 if(!same){const indexes=new Map(forms.map((f,i)=>[f.id,i]));cache={duration:project.duration,forms:forms.map(f=>({id:f.id,time:f.time})),entries:entries.map(v=>({...v})),windows:entries.map(v=>{const a=indexes.get(v.fromId),b=indexes.get(v.toId);return {entry:v,start:forms[a]?.time??Infinity,end:forms[b+1]?.time??project.duration,valid:a!==undefined&&b>=a};}),time:NaN,active:[]};coverageCache.set(project,cache);}
 if(cache.time!==time){cache.time=time;cache.active=cache.windows.filter(w=>w.entry.enabled&&w.valid&&time>=w.start&&(time<w.end||w.end===project.duration&&time===w.end)).map(w=>w.entry);}
 return cache.active;
}
export function effectivePerformer(project,time,personId){const entries=coverageAt(project,time),entry=entries.find(v=>v.absentId===personId);return entry?entry.coverId:entries.some(v=>v.coverId===personId)?null:personId;}
export function performedRole(project,time,personId){const entries=coverageAt(project,time);return entries.some(v=>v.absentId===personId)?null:entries.find(v=>v.coverId===personId)?.absentId||personId;}
export function attendanceAffectsSelection(project,time,selected){const entries=coverageAt(project,time);if(!entries.length)return false;if(!selected.size)return true;const affected=new Set(entries.flatMap(v=>[v.absentId,v.coverId]).filter(Boolean));let formation=project.formations[0];for(const f of project.formations)if(f.time<=time)formation=f;for(const rule of project.ensemble.constraints)if(rule.formationId===formation.id&&rule.members.some(id=>affected.has(id)))rule.members.forEach(id=>affected.add(id));return [...selected].some(id=>affected.has(id));}
export function applyAttendance(project,time,positions){
 const entries=coverageAt(project,time);if(!entries.length)return positions;
 const originals=new Map(positions.map(p=>[p.performerId,p])),out=new Map(positions.map(p=>[p.performerId,{...p}]));
 for(const entry of entries){const role=originals.get(entry.absentId);if(!role)continue;out.get(entry.absentId).visible=false;if(entry.coverId)out.set(entry.coverId,{...role,performerId:entry.coverId});}
 return [...out.values()];
}
export function validateEnsemble(source,project){
 const input=source??{};check(input&&typeof input==='object'&&!Array.isArray(input),'ensemble data');
 const people=new Set(project.performers.map(p=>p.id)),forms=new Set(project.formations.map(f=>f.id)),zones=new Set((project.production?.zones||[]).filter(z=>['wing','entrance'].includes(z.kind)).map(z=>z.id));
 const list=(key,max,parse)=>{const values=input[key]??[];check(Array.isArray(values)&&values.length<=max,key);const seen=new Set();return values.map(v=>{check(v&&id(v.id)&&!seen.has(v.id),key+' identity');seen.add(v.id);return parse(v);});};
 const locks=input.assignmentLocks??[];check(Array.isArray(locks)&&locks.length<=100&&new Set(locks).size===locks.length&&locks.every(v=>people.has(v)),'assignment locks');
 const attendance=list('attendance',100,v=>{check(people.has(v.absentId)&&(v.coverId===null||people.has(v.coverId)&&v.coverId!==v.absentId)&&forms.has(v.fromId)&&forms.has(v.toId),'attendance');const entry={id:v.id,absentId:v.absentId,coverId:v.coverId,fromId:v.fromId,toId:v.toId,enabled:v.enabled!==false};check(coverageWindow(project,entry).valid,'attendance formation range');return entry;});
 for(let i=0;i<attendance.length;i++)for(let j=0;j<i;j++){const a=attendance[i],b=attendance[j],wa=coverageWindow(project,a),wb=coverageWindow(project,b);if(a.enabled&&b.enabled&&Math.max(wa.start,wb.start)<Math.min(wa.end,wb.end))check(![a.absentId,a.coverId].filter(Boolean).some(v=>[b.absentId,b.coverId].includes(v)),'overlapping attendance roles');}
 const occupied=new Set();
 const constraints=list('constraints',200,v=>{check(forms.has(v.formationId)&&['mirror-x','mirror-z','space-x','space-z'].includes(v.type)&&Array.isArray(v.members)&&v.members.length>=2&&v.members.length<=100&&new Set(v.members).size===v.members.length&&v.members.every(p=>people.has(p))&&finite(v.value,v.type.startsWith('space')?.1:-50,v.type.startsWith('space')?20:50),'live constraint');check(!v.type.startsWith('mirror')||v.members.length===2,'mirror pair');for(const p of v.members){const key=v.formationId+'/'+p;check(!occupied.has(key),'overlapping live constraints');occupied.add(key);}return {id:v.id,formationId:v.formationId,type:v.type,members:[...v.members],value:v.value};});
 const traffic=list('traffic',300,v=>{check(people.has(v.performerId)&&zones.has(v.zoneId)&&['entrance','exit'].includes(v.kind)&&finite(v.start,0,project.duration)&&finite(v.end,0,project.duration)&&v.end-v.start>=.0999,'backstage reservation');return {id:v.id,performerId:v.performerId,zoneId:v.zoneId,kind:v.kind,start:v.start,end:v.end};});
 const seat=input.seat??{x:0,z:-project.stage.depth/2-8,height:1.2};check(seat&&finite(seat.x,-200,200)&&finite(seat.z,-200,200)&&finite(seat.height,.3,10),'audience seat');
 return {assignmentLocks:[...locks],attendance,constraints,traffic,seat:{x:seat.x,z:seat.z,height:seat.height}};
}
export function cleanEnsemble(project){
 if(!project.ensemble)return project;const e=project.ensemble,people=new Set(project.performers.map(p=>p.id)),forms=new Set(project.formations.map(f=>f.id)),zones=new Set(project.production?.zones?.filter(z=>['wing','entrance'].includes(z.kind)).map(z=>z.id));
 e.assignmentLocks=e.assignmentLocks.filter(id=>people.has(id));e.attendance=e.attendance.filter(v=>people.has(v.absentId)&&forms.has(v.fromId)&&forms.has(v.toId)).map(v=>({...v,coverId:people.has(v.coverId)?v.coverId:null}));
 e.constraints=e.constraints.filter(v=>forms.has(v.formationId)&&v.members.every(id=>people.has(id)));e.traffic=e.traffic.filter(v=>people.has(v.performerId)&&zones.has(v.zoneId));return project;
}
