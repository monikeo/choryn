import type {Cue,Ghost,Pose,ReferenceVideo,RehearsalAids,Unchecked,ViewSnapshot} from './types.js';
import type {Project} from './types.js';
import {samplePerformance,transitionSettings} from './engine.js';
import {viewVector} from './stage-view.js';
import {formatCount} from './music-model.js';
import {directedView} from './production-next-model.js';
export function validateReference(value:Unchecked):ReferenceVideo|null{
 if(value==null)return null;const n=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 if(!/^[-\w]{1,100}$/.test(value.id)||typeof value.name!=='string'||value.name.length>200||!n(value.duration,.01,14400)||!n(value.trimStart,0,value.duration)||!n(value.trimEnd,0,value.duration)||value.trimEnd<=value.trimStart||!n(value.start,0,3600)||!n(value.fps,1,120))throw Error('Invalid reference video settings.');
 return {id:value.id,name:value.name,duration:value.duration,trimStart:value.trimStart,trimEnd:value.trimEnd,start:value.start,fps:value.fps,visible:value.visible!==false};
}
export function referenceTime(config:Pick<ReferenceVideo,'start'|'trimStart'|'trimEnd'>,time:number){const elapsed=time-config.start;return {source:Math.max(config.trimStart,Math.min(config.trimEnd,config.trimStart+elapsed)),active:elapsed>=0&&elapsed<config.trimEnd-config.trimStart};}
export function stepFrame(time:number,direction:number,fps:number,duration:number){if(!Number.isFinite(fps)||fps<1||fps>120)throw Error('Choose a frame rate from 1 to 120.');return Math.max(0,Math.min(duration,Math.round((time+direction/fps)*1e6)/1e6));}
export function validateCheckpoints(input:Unchecked,duration:number):Cue[]{if(input==null)return [];if(!Array.isArray(input)||input.length>100)throw Error('Use up to 100 count checkpoints.');const ids=new Set();return input.map((c:Unchecked):Cue=>{if(!c||!/^[-\w]{1,100}$/.test(c.id)||ids.has(c.id)||typeof c.label!=='string'||c.label.length>100||!Number.isFinite(c.time)||c.time<0||c.time>duration)throw Error('Invalid count checkpoint.');ids.add(c.id);return {id:c.id,label:c.label,time:c.time};}).sort((a,b)=>a.time-b.time);}
export function ghostInterval(project: Project,time:number){let i=0;for(let n=0;n<project.formations.length;n++)if(project.formations[n].time<=time)i=n;return i;}
export function ghostFrames(project: Project,time:number,aids:RehearsalAids={},selected=new Set<string>()):Ghost[]{
 const i=ghostInterval(project,time),from=project.formations[i],to=project.formations[i+1],times:{time:number;label:string}[]=[];
 if(aids.previous){const previous=project.formations[Math.abs(time-from.time)<.001?i-1:i];if(previous)times.push({time:previous.time,label:'Previous'});}
 if(aids.next&&to)times.push({time:to.time,label:'Next'});
 if(aids.checkpoints)for(const c of project.checkpoints||[])if(c.time>=from.time&&c.time<=(to?.time??project.duration)&&times.length<20)times.push({time:c.time,label:c.label||formatCount(c.time,project.bpm,project.music?.beatOffset||0)});
 if(to&&[1,2,4,8].includes(Number(aids.countStep))){const step=Number(aids.countStep)*60/project.bpm,offset=project.music?.beatOffset||0,routes=(project.routes||[]).filter(r=>r.fromId===from.id&&r.toId===to.id),duration=Math.max(transitionSettings(project,from).duration,...routes.map(r=>Math.max(0,r.duration-r.delay))),start=Math.max(from.time,to.time-duration),first=offset+(Math.floor((start-offset)/step)+1)*step;for(let t=first;t<to.time-.001&&times.length<20;t+=step)times.push({time:t,label:formatCount(t,project.bpm,offset)});}

 const maxFrames=Math.max(1,Math.floor(300/Math.max(1,aids.selectedOnly&&selected.size?selected.size:project.performers.length))),seen=new Set();return times.filter(f=>!seen.has(f.time)&&seen.add(f.time)).slice(0,maxFrames).map(f=>({...f,positions:samplePerformance(project,f.time).filter(p=>p.visible!==false&&(!aids.selectedOnly||!selected.size||selected.has(p.performerId)))}));
}
export function followView(project: Project,positions:Pose[],state:ViewSnapshot):ViewSnapshot{
 const follow=state.aids?.follow;if(!follow)return directedView(project,state.time||0,state);const ids=follow.startsWith('group:')?new Set(project.performers.filter(p=>p.group===follow.slice(6)).map(p=>p.id)):new Set([follow]),people=positions.filter(p=>p.visible!==false&&ids.has(p.performerId));if(!people.length)return state;
 const center={x:people.reduce((v,p)=>v+p.x,0)/people.length,z:people.reduce((v,p)=>v+p.z,0)/people.length},delta=viewVector(center.x*60,-center.z*60,state.rotation,state.mirror,state.flip),zoom=Math.max(.5,Math.min(3,Number(state.aids!.followZoom)||state.zoom||1));
 return {...state,zoom,pan:{x:-delta.x*zoom,y:-delta.y*zoom},camera:{...state.camera,zoom:Math.max(.5,Math.min(3,zoom)),target:[center.x,.2,-center.z]}};
}
