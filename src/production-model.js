import {validateReference,validateCheckpoints} from './rehearsal-model.js';
import {validateAttachments,validatePropAnimation} from './prop-motion.js';
import {validateMusic} from './music-model.js';
import {localId as id} from './compat.js';
const finite = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
const text = (v, length = 200) => typeof v === 'string' && v.length <= length;
const safeId = v => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
const collection = (source, key, limit, validate) => {
  if (source[key] == null) return [];
  if (!Array.isArray(source[key]) || source[key].length > limit) throw new Error(`Invalid ${key} in project backup.`);
  const seen = new Set();
  return source[key].map(item => {
    if (!item || !safeId(item.id) || seen.has(item.id)) throw new Error(`Invalid ${key} identity.`);
    seen.add(item.id);
    return validate(item);
  });
};
const requireValue = (condition, label) => { if (!condition) throw new Error(`Invalid ${label} in project backup.`); };

export function validateExtras(source, base) {
  const performerIds = new Set(base.performers.map(p => p.id));
  const formationIds = new Set(base.formations.map(f => f.id));
  const props = collection(source, 'props', 100, p => {
    requireValue(text(p.name) && finite(p.x,-100,100) && finite(p.z,-100,100) && finite(p.width,.1,50) && finite(p.depth,.1,50) && finite(p.height,0,20), 'stage object');
    return {id:p.id,name:p.name,...validatePropAnimation(p,base.duration),attachments:validateAttachments(p,base),kind:['prop','platform','restricted'].includes(p.kind)?p.kind:'prop',color:/^#[\da-f]{6}$/i.test(p.color)?p.color:'#9c8fb4',locked:!!p.locked};
  });
  const routes = collection(source, 'routes', 10000, r => {
    const from=base.formations.find(f=>f.id===r.fromId),to=base.formations.find(f=>f.id===r.toId);
    requireValue(from && to && from.time<to.time && performerIds.has(r.performerId) && finite(r.delay,0,59) && finite(r.duration,.1,60) && r.delay<r.duration && Array.isArray(r.waypoints) && r.waypoints.length<=12 && r.waypoints.every(p=>finite(p.x,-100,100)&&finite(p.z,-100,100)), 'movement route');
    requireValue(!r.timingCurve||Array.isArray(r.timingCurve)&&r.timingCurve.length===4&&r.timingCurve.every(n=>finite(n,0,1))&&r.timingCurve[0]<=r.timingCurve[2]&&r.timingCurve[1]<=r.timingCurve[3],'motion timing curve');
    return {id:r.id,fromId:r.fromId,toId:r.toId,performerId:r.performerId,delay:r.delay,duration:r.duration,easing:r.easing==='linear'?'linear':'smooth',...(r.timingCurve?{timingCurve:[...r.timingCurve]}:{}),...(r.curve==='smooth'||r.curve==='linear'?{curve:r.curve}:{}),locked:!!r.locked,waypoints:r.waypoints.map(p=>({x:p.x,z:p.z}))};
  });
  requireValue(new Set(routes.map(r=>`${r.fromId}:${r.toId}:${r.performerId}`)).size===routes.length,'duplicate route');
  const actions = collection(source,'actions',300,a=>{
    requireValue(text(a.name)&&finite(a.start,0,base.duration)&&finite(a.end,0,base.duration)&&a.end>a.start&&Array.isArray(a.performerIds)&&a.performerIds.every(p=>performerIds.has(p))&&text(a.notes||'',5000),'choreography action');
    return {id:a.id,name:a.name,start:a.start,end:a.end,category:text(a.category)?a.category:'Movement',performerIds:[...new Set(a.performerIds)],notes:a.notes||'',status:['to-rehearse','learning','ready'].includes(a.status)?a.status:'to-rehearse',reference:safeReference(a.reference)};
  });
  const rehearsals = collection(source,'rehearsals',200,r=>{
    requireValue(text(r.name)&&text(r.location||'')&&text(r.start)&&Number.isFinite(Date.parse(r.start))&&finite(r.minutes,5,1440)&&text(r.notes||'',5000)&&Array.isArray(r.performerIds)&&r.performerIds.every(p=>performerIds.has(p)),'rehearsal');
    return {id:r.id,name:r.name,location:r.location||'',start:r.start,minutes:r.minutes,notes:r.notes||'',performerIds:[...new Set(r.performerIds)],status:['planned','complete','cancelled'].includes(r.status)?r.status:'planned'};
  });
  const comments = collection(source,'comments',300,c=>{
    requireValue(text(c.author,100)&&text(c.text,3000)&&finite(c.time,0,base.duration)&&finite(c.createdAt,0,1e14),'review note');
    return {id:c.id,author:c.author,text:c.text,time:c.time,createdAt:c.createdAt,resolved:!!c.resolved};
  });
  const cueIds=new Set(base.cues.map(c=>c.id));
  const cueLog=collection(source,'cueLog',1000,c=>{requireValue(cueIds.has(c.cueId)&&finite(c.at,0,1e14)&&finite(c.time,0,base.duration),'cue confirmation');return {id:c.id,cueId:c.cueId,at:c.at,time:c.time};});
  const referenceVideo=validateReference(source.referenceVideo);requireValue(!referenceVideo||referenceVideo.start<=base.duration,'reference video timeline offset');
  return {extensionVersion:4,referenceVideo,checkpoints:validateCheckpoints(source.checkpoints,base.duration),music:validateMusic(source.music,base.audioName),props,routes,actions,rehearsals,comments,cueLog,safetyDistance:finite(source.safetyDistance,.2,5)?source.safetyDistance:.55,favorite:!!source.favorite,archived:!!source.archived,eventDate:text(source.eventDate,30)?source.eventDate:'',venue:text(source.venue)?source.venue:''};
}
export function safeReference(value) {
  if (!value) return '';
  try { const u=new URL(value); return u.protocol==='https:' && !u.username && !u.password ? u.href.slice(0,2000) : ''; } catch { return ''; }
}
export function getRoute(project,fromId,toId,performerId){return (project.routes||[]).find(r=>r.fromId===fromId&&r.toId===toId&&r.performerId===performerId);}
const curveCache=new WeakMap();
export function routePoints(from,to,waypoints=[],curve='linear'){
 const raw=[from,...waypoints,to];if(curve!=='smooth'||!waypoints.length)return raw;
 const key=raw.map(p=>`${p.x},${p.z}`).join('/'),cached=curveCache.get(waypoints);if(cached?.key===key)return cached.points;
 const points=[{x:from.x,z:from.z}];for(let i=0;i<raw.length-1;i++){const a=raw[Math.max(0,i-1)],b=raw[i],c=raw[i+1],d=raw[Math.min(raw.length-1,i+2)];for(let j=1;j<=24;j++){const u=j/24,point={};for(const axis of ['x','z'])point[axis]=.5*((2*b[axis])+(-a[axis]+c[axis])*u+(2*a[axis]-5*b[axis]+4*c[axis]-d[axis])*u*u+(-a[axis]+3*b[axis]-3*c[axis]+d[axis])*u*u*u);points.push(point);}}
 curveCache.set(waypoints,{key,points});return points;
}
export function routePosition(from,to,t,waypoints,curve='linear'){
  const points=routePoints(from,to,waypoints,curve);
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.z-points[i].z));
  const total=lengths.reduce((a,b)=>a+b,0);
  if(total<1e-9)return {x:from.x,z:from.z};
  let distance=t*total;
  for(let i=0;i<lengths.length;i++){
    if(distance<=lengths[i]||i===lengths.length-1){const u=lengths[i]<1e-9?0:Math.max(0,Math.min(1,distance/lengths[i]));return {x:points[i].x+(points[i+1].x-points[i].x)*u,z:points[i].z+(points[i+1].z-points[i].z)*u};}
    distance-=lengths[i];
  }
}
export function routeDistance(from,to,route){
  const points=routePoints(from,to,route?.waypoints||[],route?.curve);
  return points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.z-points[i].z),0);
}
export function newStageObject(kind='prop'){return {id:id(),name:kind==='platform'?'Center riser':kind==='restricted'?'Keep clear':'Stage prop',kind,x:0,z:0,width:2,depth:1.2,height:kind==='platform'?.4:kind==='restricted'?0:1,color:kind==='restricted'?'#c86c79':'#9c8fb4',shape:'rectangle',rotation:0,keyframes:[],attachments:[],locked:false};}
export function csvCell(value){let s=String(value??'');if(/^[=+\-@\t\r\n]/.test(s)||/^\s+[=+\-@]/.test(s))s=`'${s}`;return `"${s.replaceAll('"','""')}"`;}
export function cueCSV(project){return [['Time (s)','Cue','Status'],...project.cues.map(c=>[c.time,c.label,'Planned'])].map(row=>row.map(csvCell).join(',')).join('\r\n');}
export function rehearsalICS(project,rehearsal){
  const fmt=date=>new Date(date).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const esc=s=>String(s||'').replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll(';','\\;').replaceAll(',','\\,').replaceAll('\r','');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//CHORYN//Studio//EN','BEGIN:VEVENT',`UID:${rehearsal.id}@choryn`,`DTSTAMP:${fmt(new Date())}`,`DTSTART:${fmt(rehearsal.start)}`,`DTEND:${fmt(Date.parse(rehearsal.start)+rehearsal.minutes*60000)}`,`SUMMARY:${esc(`${project.name} — ${rehearsal.name}`)}`,`LOCATION:${esc(rehearsal.location)}`,`DESCRIPTION:${esc(rehearsal.notes)}`,'END:VEVENT','END:VCALENDAR'];
  return lines.map(value=>{const pieces=[];let line='',bytes=0;for(const char of value){const size=new TextEncoder().encode(char).length;if(bytes+size>73){pieces.push(line);line=' ';bytes=1;}line+=char;bytes+=size;}pieces.push(line);return pieces.join('\r\n');}).join('\r\n')+'\r\n';
}
