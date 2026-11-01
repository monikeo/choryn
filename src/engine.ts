import type {Pose} from './types.js';
import type {Project} from './types.js';
import {sampleProps} from './prop-motion.js';
import {localId,cloneData,lastIndex} from './compat.js';
import {validateExtras,getRoute,routePosition} from './production-model.js';
import {extraLayout} from './templates.js';
import {validateProduction,motionProgress} from './production-schema.js';
import {safetyIssues} from './production-next-model.js';
import {validateEnsemble,applyAttendance} from './ensemble-schema.js';
// Canonical coordinates are meters: x increases to audience-right, z upstage.
// Every renderer and export samples this model, never screen coordinates.
export const COLORS = ['#8465d6', '#3c9c96', '#d98970', '#c69d43'];
export const uid = localId;
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const clone = cloneData;
export const timecode = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export function generateLayout(type, performers, stage) {
  const n = performers.length;
  const w = stage.width * .68, d = stage.depth * .64;
  const extra=extraLayout(type,n);
  return performers.map((p, i) => {
    const t = n === 1 ? .5 : i / (n - 1);
    let x = 0, z = 0;
    if(n===1) return { performerId:p.id, x:0, z:0, facing:0, visible:true };
    if(extra)return {performerId:p.id,x:+(extra[i].x*w/2).toFixed(2),z:+(extra[i].z*d/2).toFixed(2),facing:0,visible:true};
    switch (type) {
      case 'circle': { const a = i / n * Math.PI * 2 - Math.PI / 2; x = Math.cos(a) * w / 2; z = Math.sin(a) * d / 2; break; }
      case 'diamond': { const a = i / n * 4; const segment = Math.floor(a); const u = a % 1; const v = [[0,d/2],[w/2,0],[0,-d/2],[-w/2,0],[0,d/2]]; x = v[segment][0] * (1-u) + v[segment+1][0] * u; z = v[segment][1] * (1-u) + v[segment+1][1] * u; break; }
      case 'v': x = (t - .5) * w; z = Math.abs(t - .5) * d - d/4; break;
      case 'line': x = (t - .5) * w; break;
      case 'arc': { const a = Math.PI * (.12 + t * .76); x = Math.cos(a) * w/2; z = Math.sin(a) * d - d*.65; break; }
      case 'diagonal': x = (t - .5) * w; z = (t - .5) * d; break;
      case 'columns': { const cols = Math.ceil(Math.sqrt(n)); const rows = Math.ceil(n / cols); x = ((i % cols) / Math.max(1,cols-1) - .5) * w; z = (Math.floor(i/cols) / Math.max(1,rows-1) - .5) * d; break; }
      default: { const cols = Math.ceil(n/3); x = ((i % cols) / Math.max(1,cols-1) - .5) * w + (Math.floor(i/cols)%2 ? 1 : -1)*Math.min(.35,stage.width*.04); z = (Math.floor(i/cols)-1)*d/2; }
    }
    return { performerId: p.id, x: +x.toFixed(2), z: +z.toFixed(2), facing: 0, visible: true };
  });
}
export function createProject(name = 'Between the lines', count = 12, mode = 'Contemporary dance') {
  const names = ['Sofia', 'Oliver', 'Amara', 'Noah', 'Isla', 'Leo', 'Maya', 'Ethan', 'Aria', 'Luca', 'Zoe', 'Kai'];
  const stage = { width: 16, depth: 10, grid: 1 };
  const performers = Array.from({length: count}, (_,i) => ({ id: uid(), name: names[i] || `Performer ${i+1}`, number: i+1, group: i < count/3 ? 'A' : i < count*2/3 ? 'B' : 'C', color: COLORS[Math.min(2,Math.floor(i/(count/3)))], role: i === 0 ? 'Lead' : 'Ensemble' }));
  const layouts = ['staggered','diamond','v','circle','columns','arc'];
  const labels = ['Opening breath','Open diamond','Find the light','Full circle','In unison','Final exhale'];
  return validateProject({ schemaVersion: 1, id: uid(), name, discipline: mode, description: 'Spring showcase · Main stage', updatedAt: Date.now(), stage, bpm:120, duration:96, transitionDuration:4, easing:'smooth', pathType:'direct', notes:'Let the opening breathe. Hold the diamond for eight counts before the next transition.\n\nFocus: soft entrances, clear lines, connected movement.', performers, formations: layouts.map((type,i) => ({id:uid(),name:labels[i],time:i*16,status:'draft',notes:i===1?'Open from the center. Keep your focus downstage.':'',positions:generateLayout(type,performers,stage)})), cues:[{id:uid(),time:0,label:'LX 01 · Warm wash'},{id:uid(),time:32,label:'LX 02 · Build'},{id:uid(),time:80,label:'LX 03 · Fade out'}], audioName:null,music:{mode:'silent'} });
}
export function interpolatePosition(project: Project,p,next,t,route?){
  const bend=project.pathType==='curved'?Math.sin(Math.PI*t)*.65:0;
  const angle=((next.facing-p.facing+540)%360)-180;
  const position=route?.waypoints?.length?routePosition(p,next,t,route.waypoints,route.curve):{x:p.x+(next.x-p.x)*t+bend,z:p.z+(next.z-p.z)*t};
  return {...p,...position,facing:p.facing+angle*t};
}
export function transitionSettings(project: Project,formation){return {duration:formation?.transition?.duration??project.transitionDuration,easing:formation?.transition?.easing??project.easing,pathType:formation?.transition?.pathType??project.pathType};}
export function samplePerformance(project: Project,time):Pose[]{return applyAttendance(project,time,sampleAuthoredPerformance(project,time));}
export function sampleAuthoredPerformance(project: Project, time):Pose[] {
  const forms = project.formations.every((f,i,all)=>!i||f.time>=all[i-1].time)?project.formations:[...project.formations].sort((a,b)=>a.time-b.time);
  let index = lastIndex(forms,f => f.time <= time);
  if (index < 0) index = 0;
  const from = forms[index], to = forms[index+1];
  if (!to) return clone(from.positions);
  const settings=transitionSettings(project,from),pathProject={...project,pathType:settings.pathType};
  const length = Math.min(settings.duration, to.time-from.time);
  const raw = clamp((time - (to.time-length))/length,0,1);
  const t = settings.easing === 'smooth' ? raw * raw * (3-2*raw) : raw;
  const destinations=new Map(to.positions.map(p=>[p.performerId,p]));
  const routes=new Map((project.routes||[]).filter(r=>r.fromId===from.id&&r.toId===to.id).map(r=>[r.performerId,r]));
  return from.positions.map(p => {
    const next = destinations.get(p.performerId) || p;
    const route=routes.get(p.performerId);
    if(!route)return interpolatePosition(pathProject,p,next,t);
    const window=Math.min(to.time-from.time,route.duration);
    const delay=Math.min(route.delay,Math.max(0,window-.001));
    const progress=clamp((time-(to.time-window+delay))/Math.max(.001,window-delay),0,1);
    const amount=route.timingCurve?motionProgress(progress,route.timingCurve):route.easing==='linear'?progress:progress*progress*(3-2*progress);
    return interpolatePosition(pathProject,p,next,amount,route);
  });
}
export function beatAt(project: Project,time) {
  const beat = Math.floor((time-(project.music?.beatOffset||0)) * project.bpm/60+1e-7);
  return { beat:((beat%8)+8)%8+1, phrase:Math.floor(beat/8)+1, total:beat+1 };
}
export function warnings(project: Project,positions: import("./types.js").Pose[],time=0) {
  const names=new Map(project.performers.map(p=>[p.id,p.name]));return safetyIssues(project,positions,time).map(v=>v.ids.map(id=>names.get(id)).join(' & ')+': '+(v.type==='boundary'?'outside stage or usable outline':v.message));
}
// Imports are untrusted; allowlist fields and bound geometry, counts and text.
export function validateProject(input): Project {
  const fail = () => { throw new Error('This is not a valid CHORYN v1 project backup.'); };
  const finite = (v,min,max) => typeof v==='number' && Number.isFinite(v) && v>=min && v<=max;
  const str = (v,max=200) => typeof v==='string' && v.length<=max;
  const safeId=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
  if(!input || input.schemaVersion!==1 || !str(input.id) || !str(input.name) || !input.name.trim() || !input.stage || !finite(input.stage.width,2,100) || !finite(input.stage.depth,2,100) || !finite(input.bpm,30,300) || !finite(input.duration,1,3600) || !finite(input.transitionDuration,.1,60) || !Array.isArray(input.performers) || input.performers.length<1 || input.performers.length>100 || !Array.isArray(input.formations) || input.formations.length<1 || input.formations.length>100) fail();
  if(!safeId(input.id))fail();
  const ids = new Set();
  const performers=input.performers.map((p,i)=>{if(!p || !safeId(p.id) || ids.has(p.id) || !str(p.name) || !/^#[\da-f]{6}$/i.test(p.color)) fail(); ids.add(p.id);return {id:p.id,name:p.name,number:i+1,group:str(p.group,40)&&p.group.trim()?p.group:'A',tags:Array.isArray(p.tags)?[...new Set(p.tags.filter(t=>str(t,30)&&t.trim()))].slice(0,12):[],color:p.color,role:str(p.role)?p.role:'Ensemble'};});
  const formIds=new Set();
  const formations=input.formations.map(f=>{
    if(!f || !safeId(f.id) || formIds.has(f.id) || !str(f.name) || !finite(f.time,0,input.duration-.1) || !Array.isArray(f.positions) || f.positions.length!==performers.length) fail();
    if(f.transition!=null&&(!finite(f.transition.duration,.1,60)||!['smooth','linear'].includes(f.transition.easing)||!['direct','curved'].includes(f.transition.pathType)))fail();
    formIds.add(f.id); const seen=new Set();
    const positions=f.positions.map(p=>{if(!p || !ids.has(p.performerId) || seen.has(p.performerId) || !finite(p.x,-100,100) || !finite(p.z,-100,100) || !finite(p.facing,-360,360)) fail();seen.add(p.performerId); return {performerId:p.performerId,x:p.x,z:p.z,facing:p.facing,visible:p.visible!==false};});
    return {id:f.id,name:f.name,time:f.time,status:f.status==='approved'?'approved':'draft',notes:str(f.notes,5000)?f.notes:'',positions,...(f.transition?{transition:{duration:f.transition.duration,easing:f.transition.easing,pathType:f.transition.pathType}}:{})};
  }).sort((a,b)=>a.time-b.time);
  if(formations[0].time!==0 || new Set(formations.map(f=>f.time)).size!==formations.length) fail();
  const cueIds=new Set();
  const cues=(Array.isArray(input.cues)?input.cues:[]).slice(0,100).filter(c=>c && str(c.label) && finite(c.time,0,input.duration)).map(c=>{const id=safeId(c.id)&&!cueIds.has(c.id)?c.id:uid();cueIds.add(id);return {id,label:c.label,time:c.time};});
  const base={schemaVersion:1,id:input.id,name:input.name,discipline:str(input.discipline)?input.discipline:'Dance',description:str(input.description)?input.description:'',updatedAt:finite(input.updatedAt,0,1e14)?input.updatedAt:Date.now(),stage:{width:input.stage.width,depth:input.stage.depth,grid:1},bpm:input.bpm,duration:input.duration,transitionDuration:input.transitionDuration,easing:input.easing==='linear'?'linear':'smooth',pathType:input.pathType==='curved'?'curved':'direct',notes:str(input.notes,10000)?input.notes:'',performers,formations,cues,audioName:str(input.audioName)?input.audioName:null};
  const production=validateProduction(input,base) as Project["production"];
  return {...base,...validateExtras(input,base),production,ensemble:validateEnsemble(input.ensemble,{...base,production})} as Project;
}
