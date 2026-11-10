import type {Project} from './types.js';
import {clone,uid,validateProject,samplePerformance} from './engine.js';
import {assertTrackUnlocked} from './production-timing.js';
import {renderStage2D} from './stage2d.js';
import {sampleAppearance,sampleLights} from './production-next-model.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const round=n=>Math.round(n*1000)/1000;
export function placeCAD(lines,{x=0,z=0,rotation=0}={}){
 if(![x,z,rotation].every(Number.isFinite)||Math.abs(rotation)>360)throw Error('Use a valid CAD position and rotation.');
 const c=Math.cos(rotation*Math.PI/180),s=Math.sin(rotation*Math.PI/180),point=p=>({x:round(x+c*p.x-s*p.z),z:round(z+s*p.x+c*p.z)});
 const result=lines.map(l=>({a:point(l.a),b:point(l.b)}));if(result.some(l=>[l.a,l.b].some(p=>Math.abs(p.x)>100||Math.abs(p.z)>100)))throw Error('Placed CAD exceeds ±100 m. Check scale and position.');return result;
}
export function editStageGeometry(project: Project,kind,id,mode,delta,{snap=.25}={}){
 assertTrackUnlocked(project,'props');if(![delta.x,delta.z,snap].every(Number.isFinite)||snap<0)throw Error('Invalid stage movement.');
 const next=clone(project),quantize=n=>round(snap?Math.round(n/snap)*snap:n),limit=(n,a,b)=>Math.max(a,Math.min(b,n));
 if(kind==='vertex'){
  if(!next.production.stage.outline.length){const w=next.stage.width/2,d=next.stage.depth/2;next.production.stage.outline=[{x:-w,z:-d},{x:w,z:-d},{x:w,z:d},{x:-w,z:d}];}
  const p=next.production.stage.outline[Number(id)];if(!p)throw Error('This outline vertex no longer exists.');p.x=limit(quantize(p.x+delta.x),-next.stage.width/2,next.stage.width/2);p.z=limit(quantize(p.z+delta.z),-next.stage.depth/2,next.stage.depth/2);
 }else{
  const zone=next.production.zones.find(v=>v.id===id);if(!zone)throw Error('This zone no longer exists.');
  if(mode==='resize'){zone.width=limit(quantize(zone.width+delta.x*2),.1,100);zone.depth=limit(quantize(zone.depth+delta.z*2),.1,100);}
  else{zone.x=limit(quantize(zone.x+delta.x),-100,100);zone.z=limit(quantize(zone.z+delta.z),-100,100);}
 }
 return validateProject(next);
}
export function addAppearanceStates(project: Project,ids:Iterable<string>,{time,color,costume}){
 assertTrackUnlocked(project,'appearance');const unique=[...new Set(ids)];if(!unique.length)throw Error('Choose at least one performer.');
 if(unique.some(id=>!project.performers.some(p=>p.id===id)))throw Error('A selected performer no longer exists.');
 if(project.production.appearances.some(v=>unique.includes(v.performerId)&&v.time===time))throw Error('A performer already has a state at this time. Edit that state or choose another time.');
 const next=clone(project);next.production.appearances.push(...unique.map(performerId=>({id:uid(),performerId,time,color,costume})));return validateProject(next);
}
export function blackoutLights(project: Project,time){
 assertTrackUnlocked(project,'lighting');const lights=sampleLights(project,time);if(!lights.length)throw Error('No active fixtures to black out at this time.');
 if(project.production.lights.some(v=>v.time===time&&lights.some(l=>l.fixture===v.fixture)))throw Error('A fixture already has a cue at this time. Edit it or choose another time.');
 const next=clone(project);next.production.lights.push(...lights.map(v=>({...v,id:uid(),time,intensity:0,name:'Blackout · '+v.fixture,fade:false})));return validateProject(next);
}
export function stageDesignerControls(project: Project){
 const outline=project.production.stage.outline.length||4,targets=[...Array.from({length:outline},(_,i)=>['vertex:'+i+':move','Outline point '+(i+1)]),...project.production.zones.flatMap(z=>[['zone:'+z.id+':move','Move '+z.name],['zone:'+z.id+':resize','Resize '+z.name]])],select=(name,label,values)=>`<label class="field">${label}<select data-design-setting="${name}">${values.map(([value,label])=>`<option value="${esc(value)}">${esc(label)}</option>`).join('')}</select></label>`,button=(command,label,text)=>`<button type="button" class="button" data-design-command="${command}" aria-label="${label}" title="${label}">${text}</button>`;
 return `<div data-design-controls class="design-controls"><div class="design-toolbar">${select('target','Edit target',targets)}${select('mode','Canvas gesture',[['edit','Edit handles'],['pan','Pan view']])}${select('snap','Drag snap',[['.25','0.25 m'],['.1','0.1 m'],['0','No snapping']])}</div><div class="design-adjustments">${select('step','Button step',[['.1','0.1 m'],['.25','0.25 m'],['1','1 m']])}<div class="design-nudges" role="group" aria-label="Adjust selected target">${button('left','Adjust left','←')}${button('up','Adjust upstage','↑')}${button('down','Adjust downstage','↓')}${button('right','Adjust right','→')}</div><div class="design-zoom" role="group" aria-label="Stage designer view">${button('zoom-out','Zoom stage designer out','−')}<output data-design-zoom aria-label="Designer zoom">100%</output>${button('zoom-in','Zoom stage designer in','+')}${button('fit','Fit stage designer','Fit')}</div></div><p class="field-help" data-design-status role="status">Choose a target or tap a handle. Arrows move it; resize arrows adjust width/depth.</p></div>`;
}
export function productionSceneSVG(project: Project,time,{editable=false,zoom=1,pan={x:0,y:0},selection=''}={}){
 const formation=[...project.formations].reverse().find(f=>f.time<=time)||project.formations[0],state={time,zoom,pan,rotation:0,mirror:false,flip:false,showGrid:true,showPaths:false,labels:false,selected:new Set<string>(),readOnly:true};
 const prefix=editable?'stage-designer':'production-preview';
 let svg=renderStage2D(project,formation,samplePerformance(project,time),state).replace(/\bid="([^"]+)"/g,(_,id)=>`id="${prefix}-${id}"`).replace(/url\(#([^)]+)\)/g,(_,id)=>`url(#${prefix}-${id})`).replace(/\sdata-[\w-]+="[^"]*"/g,'').replace(/tabindex="0"/g,'tabindex="-1"').replace(/role="button"/g,'role="img"');
 if(!editable)return svg;
 const point=p=>({x:(project.stage.width/2+p.x)*60,y:(project.stage.depth/2-p.z)*60}),handle=(kind,id,mode,label,body)=>`<g data-design-kind="${kind}" data-design-id="${id}" data-design-mode="${mode}" data-design-selected="${selection===kind+':'+id+':'+mode}" aria-pressed="${selection===kind+':'+id+':'+mode}" role="button" tabindex="0" aria-label="${esc(label)}. Arrow keys adjust; Shift for one meter, Alt for precision.">${body}</g>`;
 const w=project.stage.width/2,d=project.stage.depth/2,hit=Math.max(28,(Math.max(w,d)*120+140)*.035),outline=project.production.stage.outline.length?project.production.stage.outline:[{x:-w,z:-d},{x:w,z:-d},{x:w,z:d},{x:-w,z:d}];
 const zones=project.production.zones.map(v=>{const p=point(v),r=point({x:v.x+v.width/2,z:v.z+v.depth/2});return handle('zone',v.id,'move','Move '+v.name,`<rect x="${p.x-v.width*30}" y="${p.y-v.depth*30}" width="${v.width*60}" height="${v.depth*60}" fill="${v.color}" fill-opacity=".06" stroke="${v.color}" stroke-width="2"/><text x="${p.x}" y="${p.y}" text-anchor="middle" fill="var(--secondary)" font-size="16" pointer-events="none">${esc(v.name)}</text>`)+handle('zone',v.id,'resize','Resize '+v.name,`<circle cx="${r.x}" cy="${r.y}" r="${hit}" fill="transparent"/><rect x="${r.x-12}" y="${r.y-12}" width="24" height="24" rx="4" fill="var(--surface)" stroke="${v.color}" stroke-width="3"/>`);}).join('');
 const vertices=outline.map((v,i)=>{const p=point(v);return handle('vertex',i,'move','Outline vertex '+(i+1),`<circle cx="${p.x}" cy="${p.y}" r="${hit}" fill="transparent"/><circle cx="${p.x}" cy="${p.y}" r="14" fill="var(--surface)" stroke="var(--accent)" stroke-width="3"/>`);}).join('');
 return svg.replace('</g></svg>',`<g class="design-handles">${zones}${vertices}</g></g></svg>`);
}
export function productionStateSummary(project: Project,time){
 const lights=sampleLights(project,time),people=sampleAppearance(project,time),cues=[...project.cues].sort((a,b)=>a.time-b.time),cue=[...cues].reverse().find(v=>v.time<=time),upcoming=cues.find(v=>v.time>time);
 return `<p>${time.toFixed(3)}s · ${lights.length} active fixtures</p><p class="field-help">${cue?'Current cue: '+esc(cue.label):'No cue yet'}${upcoming?' · Next: '+esc(upcoming.label)+' at '+upcoming.time.toFixed(3)+'s':''}</p><div class="production-swatch-list">${lights.map(v=>`<span><i style="background:${v.color}"></i>${esc(v.fixture)} · ${Math.round(v.intensity*100)}%</span>`).join('')}${people.map(v=>`<span><i style="background:${v.color}"></i>${esc(v.name)} · ${esc(v.costume||'Base appearance')}</span>`).join('')}</div>`;
}
