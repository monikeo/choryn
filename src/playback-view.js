import {renderAnalysis2D} from './analysis-view.js';
import {beatAt,timecode} from './engine.js';
import {formatCount} from './music-model.js';
import {sampleAttachedProp,propShapeSVG} from './prop-motion.js';
import {renderMarkers2D,renderGhosts2D} from './stage2d.js';
import {sampleAppearance,lightingSVG,safetySVG,safetyIssues} from './production-next-model.js';
import {contrastText} from './colors.js';

const attr=(node,key,value)=>{if(node&&node.getAttribute(key)!==String(value))node.setAttribute(key,String(value));};
const text=(node,value)=>{if(node&&node.textContent!==String(value))node.textContent=String(value);};

// Keep focused stage objects and performer nodes alive while the clock advances.
export function createPlaybackView(root){
 const find=selector=>root.querySelector(selector),layer=find('#performer-markers'),objects=find('#stage-objects'),ghostLayer=find('#rehearsal-ghosts'),analysisLayer=find('#stage-analysis');
 let markers=new Map(),props=new Map(),playingId=null,activeId=null,ghostsRef,analysisRef;
 const scan=()=>{markers=new Map(Array.from(layer?.querySelectorAll('[data-marker]')||[],node=>[node.dataset.marker,{node,facing:node.querySelector('.marker-facing'),ring:node.querySelector('.selection-ring')} ]));};scan();
 for(const node of objects?.querySelectorAll('[data-stage-object]')||[])props.set(node.dataset.stageObject,{node,shape:node.firstElementChild});
 const clock=find('[data-clock-main]'),fraction=find('#transport-time small'),scrub=find('#fine-scrub'),count=find('#precise-count'),playhead=find('#playhead'),phrase=find('[data-beat-phrase]'),beat=find('[data-beat-number]');
 const clips=new Map(Array.from(root.querySelectorAll('.timeline-formation'),node=>[node.dataset.formation,node]));
 return {update(project,time,{positions,geometryPositions=positions,state,playing=false,active,focused,hud=true}={}){
  if(hud){
  if(scrub&&scrub!==focused)scrub.value=time;
  text(clock,timecode(time));text(fraction,`.${String(Math.floor(time%1*100)).padStart(2,'0')}`);
  text(count,time<(project.music?.beatOffset||0)?'Count-in':formatCount(time,project.bpm,project.music?.beatOffset||0));
  if(playhead)playhead.style.left=`${time/project.duration*100}%`;
  const b=beatAt(project,time);text(phrase,b.phrase);text(beat,b.beat);
  const nextId=playing?active:null;if(playingId!==nextId){clips.get(playingId)?.classList.remove('playing');clips.get(nextId)?.classList.add('playing');playingId=nextId;}
  if(activeId!==active){clips.get(activeId)?.classList.remove('active');clips.get(active)?.classList.add('active');activeId=active;}
  }
  // Pause and dialog entry update transport without supplying stage state.
  // Keep the current overlays intact until an explicit stage update arrives.
  if(!state)return;
  if(analysisLayer&&state.analysis!==analysisRef){analysisLayer.innerHTML=renderAnalysis2D(project,state.analysis,state);analysisRef=state.analysis;}
  if(hud&&geometryPositions){const issues=safetyIssues(project,geometryPositions,time);text(find('#validation-status'),issues.length?`${issues.length} spacing / stage warnings`:'No current geometry warnings');}
  if(!positions)return;
  const lightLayer=find('#production-lighting'),lightHTML=lightLayer?lightingSVG(project,time):'';if(lightLayer&&lightLayer.innerHTML!==lightHTML)lightLayer.innerHTML=lightHTML;
  if(hud){const node=find('#production-safety'),html=safetySVG(project,positions,time);if(node&&node.innerHTML!==html)node.innerHTML=html;}
  if(project.production?.appearances.length){const people=new Map(sampleAppearance(project,time).map(p=>[p.id,p]));for(const [id,{node}] of markers){const person=people.get(id);if(!person)continue;attr(node.querySelector('.marker-body'),'fill',person.color);attr(node.querySelector('.marker-facing path'),'fill',person.color);attr(node.querySelector('text'),'fill',contrastText(person.color));}}
  if(ghostLayer&&state.ghosts!==ghostsRef){ghostLayer.innerHTML=renderGhosts2D(project,state.ghosts||[],state);ghostsRef=state.ghosts;}
  if(layer&&positions.some(p=>p.visible!==false&&!markers.has(p.performerId))){layer.innerHTML=renderMarkers2D(project,positions,state);scan();}
  for(const p of positions){const item=markers.get(p.performerId);if(!item)continue;const {node,facing,ring}=item;const hidden=p.visible===false;
   if(node.style.display!==(hidden?'none':''))node.style.display=hidden?'none':'';
   if(hidden)continue;
   attr(node,'transform',`translate(${(project.stage.width/2+p.x)*60} ${(project.stage.depth/2-p.z)*60})`);attr(facing,'transform',`rotate(${p.facing})`);
   const selected=state.selected.has(p.performerId);attr(ring,'opacity',selected?1:0);attr(node,'aria-pressed',selected);node.classList.toggle('is-selected',selected);
  }
  for(const prop of project.props||[]){if(!prop.keyframes?.length&&!prop.attachments?.length)continue;const item=props.get(prop.id);if(!item)continue;const p=sampleAttachedProp(prop,time,positions),shape=item.shape;
   attr(item.node,'transform',`translate(${(project.stage.width/2+p.x)*60} ${(project.stage.depth/2-p.z)*60})`);attr(shape,'transform',`rotate(${p.rotation})`);attr(shape,'fill',p.color);attr(shape,'stroke',p.color);
   const tag={rectangle:'rect',ellipse:'ellipse',triangle:'path'}[p.shape];if(shape.firstElementChild?.tagName.toLowerCase()!==tag)shape.innerHTML=propShapeSVG(p);
   const geometry=shape.firstElementChild,w=p.width*60,d=p.depth*60;
   if(p.shape==='ellipse'){attr(geometry,'rx',w/2);attr(geometry,'ry',d/2);}
   else if(p.shape==='triangle')attr(geometry,'d',`M0 ${-d/2}L${w/2} ${d/2}H${-w/2}Z`);
   else{attr(geometry,'x',-w/2);attr(geometry,'y',-d/2);attr(geometry,'width',w);attr(geometry,'height',d);attr(geometry,'rx',Math.min(4,w/8,d/8));}
  }
 }};
}
