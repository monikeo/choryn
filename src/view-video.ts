import type {AnalysisFrame,Ghost,Pose,Project,ReferenceVideo,ViewSnapshot} from './types.js';
import type {Stage3D} from './stage3d.js';
import {stageViewBox,captureViewport} from './stage-view.js';
import {transitionAnalysis} from './analysis-model.js';
import {samplePerformance} from './engine.js';
import {renderStage2D} from './stage2d.js';
import {followView,ghostFrames,ghostInterval,referenceTime} from './rehearsal-model.js';
import {lastMatch} from './compat.js';
import {sceneProject} from './production-next-model.js';
import {highlightsAt} from './engine.js';
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string,string>)[c]);
/** The reference video drawn into an export: its timing, the recorded file and its box (fractions of the view). */
export interface ExportReference {config:Pick<ReferenceVideo,'start'|'trimStart'|'trimEnd'>; blob?:Blob|null; box?:{x:number;y:number;width:number;height:number}|null}
/** The editor's view, captured for an image or video export. */
export type ExportSnapshot=Omit<ViewSnapshot,'viewport'>&{pan:{x:number;y:number}; zoom:number; viewport:{width:number;height:number}; reference?:ExportReference|null};
/** Output size and range of exported frames; camera and look apply to video presets. */
export interface FrameSettings {width:number; height:number; start:number; end?:number; labels?:boolean; camera?:string; look?:string}
export function viewFrameSVG(project: Project,time:number,snapshot:ExportSnapshot,settings:FrameSettings,ghosts?:Ghost[],analysisData?:AnalysisFrame|null){
 const positions=samplePerformance(project,time),state=followView(project,positions,{...snapshot,selected:new Set<string>(snapshot.selected||[]),labels:settings.labels??snapshot.labels,time,analysis:analysisData??(snapshot.analysisSettings?transitionAnalysis(project,time,snapshot.analysisSettings,new Set<string>(snapshot.selected||[])):snapshot.analysis),ghosts:ghosts||ghostFrames(project,time,snapshot.aids,new Set<string>(snapshot.selected||[]))}),formation=lastMatch(project.formations,f=>f.time<=time)||project.formations[0];
 const variables=Object.entries(snapshot.colors||{}).map(([name,value])=>`--${name}:${value}`).join(';'),style=`<style>svg{${variables};font-family:${esc(snapshot.font||'system-ui')}}.curve-control{visibility:hidden}.marker-name{font-family:inherit}.is-selected .marker-body{stroke-width:4px}</style>`;
 const box=stageViewBox(project,snapshot.rotation),viewport=captureViewport(snapshot.viewport,settings),svg=renderStage2D(project,formation,positions,state).replace('<defs>',style+'<defs>');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${settings.width}" height="${settings.height}" viewBox="0 0 ${settings.width} ${settings.height}"><rect width="${settings.width}" height="${settings.height}" fill="${esc(snapshot.colors?.bg||'#faf9fc')}"/><svg x="${viewport.x}" y="${viewport.y}" width="${viewport.width}" height="${viewport.height}" viewBox="${box.x} ${box.y} ${box.width} ${box.height}">${svg.slice(svg.indexOf('>')+1,svg.lastIndexOf('</svg>'))}</svg></svg>`;
}
type Shot={yaw:number;pitch:number;zoom:number;target:number[]};
const smoothstep=(u:number)=>{const t=Math.max(0,Math.min(1,u));return t*t*(3-2*t);};
/**
 * The camera for a cinematic video preset at `time` (null keeps the on-screen camera).
 * Audience pushes in slowly, orbit turns once over the clip, follow frames the
 * highlighted dancers (everyone when nobody is highlighted).
 */
export function cinematicCamera(preset:string,project:Project,time:number,positions:import('./types.js').Pose[],clip:{start:number;end:number}):Shot|null{
 const u=(time-clip.start)/Math.max(.001,clip.end-clip.start);
 if(preset==='audience')return {yaw:0,pitch:.3,zoom:1+.22*smoothstep(u),target:[0,.9,0]};
 if(preset==='overhead')return {yaw:0,pitch:1.42,zoom:1.05,target:[0,0,0]};
 if(preset==='side')return {yaw:Math.PI/2,pitch:.34,zoom:1.15,target:[0,.8,0]};
 // One turn over the clip, but never faster than one turn per 20 s (18°/s), so short clips stay calm.
 if(preset==='orbit')return {yaw:.15+Math.max(0,time-clip.start)/Math.max(20,clip.end-clip.start)*Math.PI*2,pitch:.5,zoom:1,target:[0,.6,0]};
 if(preset==='follow'){
  const featured=new Set(highlightsAt(project,time)),visible=positions.filter(p=>p.visible!==false),group=visible.some(p=>featured.has(p.performerId))?visible.filter(p=>featured.has(p.performerId)):visible;
  if(!group.length)return {yaw:.12,pitch:.5,zoom:1,target:[0,.8,0]};
  const cx=group.reduce((s,p)=>s+p.x,0)/group.length,cz=group.reduce((s,p)=>s+p.z,0)/group.length,span=Math.max(2,...group.map(p=>Math.abs(p.x-cx)*2+2),...group.map(p=>Math.abs(p.z-cz)*2+2));
  return {yaw:.12,pitch:.5,zoom:Math.max(.8,Math.min(2.4,Math.max(project.stage.width,project.stage.depth)/span)),target:[cx,.8,-cz]};
 }
 return null;
}
/** Eases a moving shot towards its target so tracking glides instead of jumping (time constant 0.6 s). */
export function smoothShot(previous:Shot|null,next:Shot,dt:number):Shot{
 if(!previous||!(dt>0)||dt>2)return next;const k=1-Math.exp(-dt/.6),mix=(a:number,b:number)=>a+(b-a)*k;
 return {yaw:mix(previous.yaw,next.yaw),pitch:mix(previous.pitch,next.pitch),zoom:mix(previous.zoom,next.zoom),target:next.target.map((v,i)=>mix(previous.target[i],v))};
}
function graphicsReady(promise:unknown,signal?:AbortSignal){return new Promise((resolve,reject)=>{const abort=()=>{signal?.removeEventListener('abort',abort);reject(Error('Video export cancelled.'));};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}Promise.resolve(promise).then(value=>{signal?.removeEventListener('abort',abort);resolve(value);},error=>{signal?.removeEventListener('abort',abort);reject(error);});});}
function mediaWait(element:EventTarget,event:string,signal?:AbortSignal){return new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>finish(Error('Video frame decoding timed out. Try a smaller reference or disable its export.')),10000),success=()=>finish(),error=()=>finish(Error('View frame decoding failed.')),abort=()=>finish(Error('Video export cancelled.'));function finish(reason?:unknown){clearTimeout(timer);element.removeEventListener(event,success);element.removeEventListener('error',error);signal?.removeEventListener('abort',abort);reason?reject(reason):resolve();}element.addEventListener(event,success,{once:true});element.addEventListener('error',error,{once:true});signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();});}
export async function createViewVideoRenderer(project: Project,settings:FrameSettings,snapshot:ExportSnapshot,{signal}:{signal?:AbortSignal}={}){
 let stage:Stage3D|undefined,host:HTMLDivElement|undefined,reference:HTMLVideoElement|undefined,referenceURL:string|undefined,ghostKey='',ghosts:Ghost[]=[],analysisKey:number|string='',analysis:AnalysisFrame|null|undefined,shot:Shot|null=null,shotTime=NaN;
 // Cinematic cameras film the 3D stage even when the editor shows 2D.
 const cinematic=!!settings.camera&&settings.camera!=='view',look=settings.look==='show'||settings.look==='rehearsal'?settings.look:undefined;
 // A cinematic camera is a named preset from the video dialog, whose settings always have an end.
 const cameraAt=(time:number,positions:Pose[],state:ViewSnapshot)=>{if(!cinematic)return state.camera;const next=cinematicCamera(settings.camera!,project,time,positions,settings as {start:number;end:number})!;shot=settings.camera==='follow'?smoothShot(shot,next,time-shotTime):next;shotTime=time;return {...state.camera,...shot};};
 const selected=new Set<string>(snapshot.selected||[]),getGhosts=(time:number)=>{const index=ghostInterval(project,time),key=`${index}/${Math.abs(time-project.formations[index].time)<.001}`;if(key!==ghostKey){ghostKey=key;ghosts=ghostFrames(project,time,snapshot.aids,selected);}return ghosts;};
 const getAnalysis=(time:number)=>{const key=ghostInterval(project,time);if(key!==analysisKey){analysisKey=key;analysis=snapshot.analysisSettings?transitionAnalysis(project,time,snapshot.analysisSettings,selected):snapshot.analysis;}return analysis;};
 const dispose=()=>{stage?.dispose();host?.remove();if(reference){reference.pause();reference.removeAttribute('src');reference.load();}if(referenceURL)URL.revokeObjectURL(referenceURL);};
 try{
  if(snapshot.kind==='spatial'||cinematic){
   const {mountStage3D}=await import('./stage3d.js');host=document.createElement('div');host.className='stage-wrap';host.style.cssText=`position:fixed;left:-20000px;top:0;width:${Math.max(1,snapshot.viewport.width)}px;height:${Math.max(1,snapshot.viewport.height)}px;pointer-events:none;`;host.style.fontFamily=snapshot.font||'system-ui';document.body.append(host);const positions=samplePerformance(project,settings.start),state=followView(project,positions,{...snapshot,time:settings.start});stage=mountStage3D(host,sceneProject(project,settings.start,positions),positions,{interactive:false,look,pixelRatio:settings.height/Math.max(1,snapshot.viewport.height),camera:{...cameraAt(settings.start,positions,state)},showGrid:snapshot.showGrid,labels:settings.labels??snapshot.labels,selected:()=>selected,ghosts:getGhosts(settings.start),analysis:getAnalysis(settings.start)});if(!stage.capture)throw Error('This device cannot render the current 3D view for export. Switch to 2D or use a device with WebGL.');
  }
  if(snapshot.reference?.blob){reference=document.createElement('video');reference.muted=true;reference.playsInline=true;reference.preload='auto';referenceURL=URL.createObjectURL(snapshot.reference.blob);const ready=mediaWait(reference,'loadeddata',signal);reference.src=referenceURL;await ready;}
  // A reference element exists only when the snapshot carried a reference video.
  return {referenceSVG(){if(!reference)return '';const box=snapshot.reference!.box||{x:.65,y:.04,width:.32,height:.25},viewport=captureViewport(snapshot.viewport,settings),canvas=document.createElement('canvas');const factor=Math.min(1,4096/reference.videoWidth,4096/reference.videoHeight);canvas.width=Math.max(1,Math.round(reference.videoWidth*factor));canvas.height=Math.max(1,Math.round(reference.videoHeight*factor));canvas.getContext('2d')!.drawImage(reference,0,0,canvas.width,canvas.height);return `<rect x="${viewport.x+box.x*viewport.width}" y="${viewport.y+box.y*viewport.height}" width="${box.width*viewport.width}" height="${box.height*viewport.height}" fill="${esc(snapshot.colors?.stage||'#f5f3f8')}"/><image x="${viewport.x+box.x*viewport.width}" y="${viewport.y+box.y*viewport.height}" width="${box.width*viewport.width}" height="${box.height*viewport.height}" preserveAspectRatio="xMidYMid meet" href="${canvas.toDataURL('image/png')}"/>`;},async draw(ctx:CanvasRenderingContext2D,time:number){
   if(signal?.aborted)throw Error('Video export cancelled.');
   if(stage){const positions=samplePerformance(project,time),state=followView(project,positions,{...snapshot,time});Object.assign(stage.camera,cameraAt(time,positions,state));stage.update(sceneProject(project,time,positions),positions,{ghosts:getGhosts(time),analysis:getAnalysis(time),showGrid:snapshot.showGrid,labels:settings.labels??snapshot.labels});await graphicsReady(stage.ready,signal);if(signal?.aborted)throw Error('Video export cancelled.');stage.capture!(ctx,settings.width,settings.height);}
   else{const svg=viewFrameSVG(project,time,snapshot,settings,getGhosts(time),getAnalysis(time)),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),img=new Image();try{const ready=mediaWait(img,'load',signal);img.src=url;await ready;ctx.fillStyle=snapshot.colors?.bg||'#faf9fc';ctx.fillRect(0,0,settings.width,settings.height);ctx.drawImage(img,0,0,settings.width,settings.height);}finally{URL.revokeObjectURL(url);}}
   if(reference){const point=referenceTime(snapshot.reference!.config,time),target=Math.min(point.source,Math.max(0,reference.duration-.001));if(Math.abs(reference.currentTime-target)>.001){const ready=mediaWait(reference,'seeked',signal);reference.currentTime=target;await ready;}const box=snapshot.reference!.box||{x:.65,y:.04,width:.32,height:.25};const viewport=captureViewport(snapshot.viewport,settings),x=viewport.x+box.x*viewport.width,y=viewport.y+box.y*viewport.height,w=box.width*viewport.width,h=box.height*viewport.height,fit=Math.min(w/reference.videoWidth,h/reference.videoHeight),rw=reference.videoWidth*fit,rh=reference.videoHeight*fit;ctx.fillStyle=snapshot.colors?.stage||'#f5f3f8';ctx.fillRect(x,y,w,h);ctx.drawImage(reference,x+(w-rw)/2,y+(h-rh)/2,rw,rh);}
  },dispose};
 }catch(error){dispose();throw error;}
}
