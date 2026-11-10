import type {Project} from './types.js';
import {samplePerformance,transitionSettings} from './engine.js';
import {renderStage2D,stagePoint,type Stage2DState} from './stage2d.js';
const escape=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string,string>)[c]);
export function transitionWindow(project: Project,formationId:string){
 const index=project.formations.findIndex(f=>f.id===formationId),from=project.formations[index],to=project.formations[index+1];if(!from||!to)throw Error('Choose an outgoing transition to preview.');
 const duration=Math.max(transitionSettings(project,from).duration,...project.routes.filter(r=>r.fromId===from.id&&r.toId===to.id).map(r=>r.duration));return {from,to,start:Math.max(from.time,to.time-duration),end:to.time};
}
const traceCache=new WeakMap<Project,Map<string,string>>();
export function isolateStageSVG(svg:string,prefix:string){return svg.replace(/\bid="([^"]+)"/g,(_,id)=>`id="${prefix}-${id}"`).replace(/url\(#([^)]+)\)/g,(_,id)=>`url(#${prefix}-${id})`).replace(/\sdata-[\w-]+="[^"]*"/g,'').replace(/tabindex="0"/g,'tabindex="-1"').replace(/role="button"/g,'role="img"');}
function traces(project: Project,formationId:string){let cache=traceCache.get(project);if(!cache){cache=new Map();traceCache.set(project,cache);}if(cache.has(formationId))return cache.get(formationId)!;const window=transitionWindow(project,formationId),ids=project.performers.slice(0,12).map(p=>p.id),paths=new Map(ids.map(id=>[id,[] as string[]]));for(let i=0;i<=24;i++){const positions=samplePerformance(project,window.start+(window.end-window.start)*i/24);for(const p of positions)if(paths.has(p.performerId)){const q=stagePoint(project,p);paths.get(p.performerId)!.push(q.x+','+q.y);}}const svg=[...paths].map(([id,points])=>`<polyline points="${points.join(' ')}" fill="none" stroke="${project.performers.find(p=>p.id===id)!.color}" stroke-width="2" stroke-opacity=".5"/>`).join('');cache.set(formationId,svg);return svg;}
export function transitionPreviewSVG(project: Project,formationId:string,time:number,prefix:string){
 const window=transitionWindow(project,formationId),positions=samplePerformance(project,time),state:Stage2DState={time,zoom:1,pan:{x:0,y:0},rotation:0,mirror:false,flip:false,showGrid:true,showPaths:false,labels:false,selected:new Set(),readOnly:true};
 return renderStage2D(project,window.from,positions,state).replace('<g id="movement-paths"',`<g pointer-events="none">${traces(project,formationId)}</g><g id="movement-paths"`).replace(/\bid="([^"]+)"/g,(_,id)=>`id="${prefix}-${id}"`).replace(/url\(#([^)]+)\)/g,(_,id)=>`url(#${prefix}-${id})`).replace(/\sdata-[\w-]+="[^"]*"/g,'').replace(/tabindex="0"/g,'tabindex="-1"').replace(/role="button"/g,'role="img"');
}
export function suggestionComparison(project: Project,candidate:Project,formationId:string,time:number){
 if(!Number.isFinite(time))throw Error('Choose a valid preview time.');const range=transitionWindow(project,formationId),other=transitionWindow(candidate,formationId),start=Math.min(range.start,other.start),at=Math.max(start,Math.min(range.end,time));
 return `<div class="suggestion-time" role="status">${at.toFixed(3)} seconds · ${escape(range.from.name)} → ${escape(range.to.name)}</div><div class="suggestion-comparison"><figure><figcaption>Current routes</figcaption>${transitionPreviewSVG(project,formationId,at,'current-preview')}</figure><figure><figcaption>Suggested routes</figcaption>${transitionPreviewSVG(candidate,formationId,at,'candidate-preview')}</figure></div><p class="field-help">All performers are shown. Path traces show up to the first 12 performers; red rings show current geometry warnings. This preview does not edit the score.</p>`;
}
