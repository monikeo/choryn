import type {Formation,Point,Pose,Project} from './types.js';
import {samplePerformance,generateLayout,COLORS,timecode} from './engine.js';
import {icon} from './icons.js';
import {TRANSITION_STYLES,CANON_ORDERS,defaultOrder,designTransition,currentDesign} from './transition-styles.js';
import type {TransitionDesign,TransitionStyle,CanonOrder,CanonTiming} from './transition-styles.js';
import {formationVariations,fitToStage} from './formation-variations.js';
import type {Variation} from './formation-variations.js';
import {phraseSeconds,snapFormationsToPhrases,detectSections,addSectionCues,addSectionFormations} from './music-structure.js';
import type {Section} from './music-structure.js';
import {timelineProblems,fixProblem} from './problems-model.js';
import type {Problem} from './problems-model.js';
import {describeChange} from './history-model.js';
import {FORMATION_TEMPLATES} from './templates.js';
import {assignByTravel} from './formation-tools.js';
import {evaluateTransition} from './production-next-model.js';
import {stagePoint,worldPoint} from './stage2d.js';
import {formatCount} from './music-model.js';
import {errorMessage} from './errors.js';

/**
 * Creative tools around the editor: the transition designer (styles, canon and
 * ripple timing), formation variations, music structure (phrases and song
 * sections), the visual undo history, the timeline's problems lane, the shapes
 * palette that drags formations onto the stage, and the Simple / Pro interface.
 */
export interface CreativeApi {
  project:()=>Project; formation:()=>Formation; selected:()=>Set<string>; readOnly:()=>boolean; locked:()=>boolean; playing:()=>boolean;
  replace:(next:Project,message?:string,options?:{formationId?:string;time?:number})=>void;
  dialog:(title:string,body:string,wide?:boolean)=>void; close:()=>void; toast:(message:string)=>void;
  seek:(time:number)=>void; selectFormation:(id:string)=>void;
  /** Decoded music for the current project, or null in silent mode. */
  audio:()=>Promise<AudioBuffer|null>;
  /** Saved undo states, oldest first, and redo states (the next redo last). */
  history:()=>{past:readonly Project[];future:readonly Project[]};
  /** Moves through history: negative undoes, positive redoes, that many steps. */
  travel:(steps:number)=>void;
  firstRun:boolean;
}
let api:CreativeApi;
const $=<T extends Element=HTMLElement>(s:string,root:ParentNode=document)=>root.querySelector<T>(s);
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string,string>)[c]);
const plural=(n:number,one:string,many=one+'s')=>`${n} ${n===1?one:many}`;

// ---------------------------------------------------------------- Simple / Pro
export type Level='simple'|'pro';
export function uiLevel():Level{try{const v=localStorage.getItem('choryn.level');if(v==='simple'||v==='pro')return v;}catch{}return api?.firstRun?'simple':'pro';}
export function applyLevel(){document.documentElement.dataset.level=uiLevel();}
function setLevel(level:Level){try{localStorage.setItem('choryn.level',level);}catch{}applyLevel();document.querySelectorAll<HTMLElement>('[data-creative="toggle-level"]').forEach(el=>{el.setAttribute('aria-checked',String(level==='pro'));el.innerHTML=levelLabel();});}
const levelLabel=()=>`<span class="level-option ${uiLevel()==='simple'?'on':''}">Simple</span><span class="level-option ${uiLevel()==='pro'?'on':''}">Pro</span>`;
/** The header switch between the Simple and Pro interface. */
export function levelSwitch(){return `<button class="level-switch" data-creative="toggle-level" role="switch" aria-checked="${uiLevel()==='pro'}" aria-label="Pro tools" title="Simple shows the essentials; Pro shows every tool">${levelLabel()}</button>`;}

// ---------------------------------------------------------------- mini stage drawing
function stageSVG(project:Project,layers:{positions?:Pose[];ghost?:Pose[];paths?:Map<string,Point[]>;marks?:Pose[]},{width=320,height=180,label=''}:{width?:number;height?:number;label?:string}={}){
  const pad=10,x=(v:number)=>pad+(v/project.stage.width+.5)*(width-pad*2),y=(v:number)=>pad+(.5-v/project.stage.depth)*(height-pad*2),color=new Map(project.performers.map((p,i)=>[p.id,p.color||COLORS[i%COLORS.length]]));
  const visible=(list?:Pose[])=>(list||[]).filter(p=>p.visible!==false);
  return `<svg viewBox="0 0 ${width} ${height}" ${label?`role="img" aria-label="${esc(label)}"`:'aria-hidden="true"'}><rect x="${pad}" y="${pad}" width="${width-pad*2}" height="${height-pad*2}" rx="4" class="mini-stage-floor"/><path d="M${width/2} ${pad}v${height-pad*2}M${pad} ${height/2}h${width-pad*2}" class="mini-stage-centre"/>`
    +[...(layers.paths||new Map<string,Point[]>()).entries()].map(([id,points])=>`<polyline points="${points.map(p=>`${x(p.x).toFixed(1)},${y(p.z).toFixed(1)}`).join(' ')}" fill="none" stroke="${color.get(id)}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>`).join('')
    +visible(layers.ghost).map(p=>`<circle cx="${x(p.x).toFixed(1)}" cy="${y(p.z).toFixed(1)}" r="3.6" fill="none" stroke="${color.get(p.performerId)}" stroke-width="1.2" opacity=".55"/>`).join('')
    +visible(layers.positions).map(p=>`<circle cx="${x(p.x).toFixed(1)}" cy="${y(p.z).toFixed(1)}" r="4.4" fill="${color.get(p.performerId)}"/>`).join('')
    +visible(layers.marks).map(p=>`<circle cx="${x(p.x).toFixed(1)}" cy="${y(p.z).toFixed(1)}" r="6" fill="${color.get(p.performerId)}" stroke="var(--surface)" stroke-width="1.5"/>`).join('')
    +`<text x="${width/2}" y="${height-1}" text-anchor="middle" class="mini-stage-audience">AUDIENCE</text></svg>`;
}
const STYLE_ICONS:Record<TransitionStyle,string>={
  direct:'<path d="M4 18L20 6M14 6h6v6"/>',
  explode:'<path d="M12 12L5 5M12 12l7-7M12 12l-7 7M12 12l7 7M5 9V5h4M15 5h4v4M5 15v4h4M19 15v4h-4"/>',
  implode:'<path d="M4 4l6 6M20 4l-6 6M4 20l6-6M20 20l-6-6M10 6v4H6M14 6v4h4M10 18v-4H6M14 18v-4h4"/>',
  'spiral-cw':'<path d="M12 12a2 2 0 1 1 2 2 4 4 0 1 1-4-4 6 6 0 1 1 6 6"/><path d="M19 13l-3 3 3 2"/>',
  'spiral-ccw':'<path d="M12 12a2 2 0 1 0-2 2 4 4 0 1 0 4-4 6 6 0 1 0-6 6"/><path d="M5 13l3 3-3 2"/>',
  peel:'<path d="M4 18h4M10 18c6 0 8-4 8-12M15 9l3-3 3 3"/><circle cx="5" cy="14" r="1"/><circle cx="9" cy="14" r="1"/>',
  follow:'<path d="M3 17c3 0 3-10 6-10s3 10 6 10 3-10 6-10"/><circle cx="21" cy="7" r="1.6"/>',
};
const styleIcon=(id:TransitionStyle)=>`<svg viewBox="0 0 24 24" aria-hidden="true" class="style-icon" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${STYLE_ICONS[id]}</svg>`;

// ---------------------------------------------------------------- transition designer
let design:TransitionDesign={style:'direct',order:'together',timing:'canon',spread:1},designFrom='',candidate:{project:Project;window:number;step:number;waves:number;shortened:boolean}|null=null,designError='',scrub=.5,previewTimer=0;
function transitionRange(project:Project,formationId:string){const index=project.formations.findIndex(f=>f.id===formationId),from=project.formations[index],to=project.formations[index+1];return {index,from,to};}
export function transitionDesigner(formationId=api.formation().id){
  const project=api.project(),{from,to}=transitionRange(project,formationId);
  if(!from||!to){api.toast('The last formation holds to the end; choose an earlier formation to design its transition.');return;}
  if(api.readOnly()){api.toast('This is a read-only rehearsal snapshot.');return;}
  designFrom=formationId;design=currentDesign(project,formationId);scrub=.5;
  api.dialog('Design the transition.',`<div class="transition-designer" id="transition-designer"><p class="modal-intro">${esc(from.name)} ${icon('arrow')} ${esc(to.name)} · ${(to.time-from.time).toFixed(1)} s · counts ${formatCount(from.time,project.bpm,project.music.beatOffset)} to ${formatCount(to.time,project.bpm,project.music.beatOffset)}</p>
<div class="section-label">PATH STYLE</div><div class="designer-styles" role="radiogroup" aria-label="Path style">${TRANSITION_STYLES.map(s=>`<button type="button" role="radio" aria-checked="${s.id===design.style}" data-creative-style="${s.id}" title="${esc(s.hint)}">${styleIcon(s.id)}<span>${esc(s.label)}</span></button>`).join('')}</div><p class="field-help" id="designer-style-hint"></p>
<div class="section-label">CANON & RIPPLE</div><div class="field-row"><label class="field">Who moves first<select id="canon-order">${CANON_ORDERS.map(o=>`<option value="${o.id}">${esc(o.label)}</option>`).join('')}</select></label><label class="field">Timing<select id="canon-timing"><option value="canon">Canon · equal moves, one after another</option><option value="land">Cascade · staggered starts, land together</option></select></label></div>
<label class="field designer-spread">Gap between waves <output id="canon-spread-value"></output><input type="range" id="canon-spread" min=".5" max="8" step=".5" aria-describedby="canon-spread-value"></label>
<figure class="designer-preview"><div id="designer-preview"></div><figcaption><input type="range" id="designer-scrub" min="0" max="100" step="1" value="50" aria-label="Preview moment in the transition"><button type="button" class="button" data-creative="designer-play">${icon('play')}Preview</button></figcaption></figure>
<p class="designer-summary" id="designer-summary" role="status" aria-live="polite"></p>
<div class="modal-footer"><button type="button" class="button" data-action="close-dialog">Cancel</button><button type="button" class="button primary" data-creative="apply-transition">Apply transition</button></div></div>`,true);
  syncDesignerControls();updateDesigner();
}
function syncDesignerControls(){
  const root=$('#transition-designer');if(!root)return;
  root.querySelectorAll<HTMLElement>('[data-creative-style]').forEach(el=>{const on=el.dataset.creativeStyle===design.style;el.setAttribute('aria-checked',String(on));el.tabIndex=on?0:-1;});
  const order=$<HTMLSelectElement>('#canon-order'),timing=$<HTMLSelectElement>('#canon-timing'),spread=$<HTMLInputElement>('#canon-spread');
  if(order)order.value=design.order;if(timing){timing.value=design.timing;timing.disabled=design.order==='together';}if(spread){spread.value=String(design.spread);spread.disabled=design.order==='together';}
  const hint=$('#designer-style-hint');if(hint)hint.textContent=TRANSITION_STYLES.find(s=>s.id===design.style)?.hint||'';
}
function updateDesigner(){
  const project=api.project(),out=$('#canon-spread-value');if(out)out.textContent=design.order==='together'?'everyone together':`${design.spread} ${design.spread===1?'count':'counts'}`;
  try{candidate=designTransition(project,designFrom,design);designError='';}catch(error){candidate=null;designError=errorMessage(error);}
  drawDesignerPreview();
  const summary=$('#designer-summary'),apply=$<HTMLButtonElement>('[data-creative="apply-transition"]');if(apply)apply.disabled=!candidate;
  if(!summary)return;
  if(!candidate){summary.textContent=designError;return;}
  const {index}=transitionRange(project,designFrom),analysis=evaluateTransition(candidate.project,index,{steps:32}),misses=analysis.issues.filter(v=>v.type==='spacing').length,counts=(s:number)=>Math.round(s*project.bpm/60*10)/10;
  summary.innerHTML=`<strong>${candidate.waves>1?`${candidate.waves} waves, ${counts(candidate.step)} ${counts(candidate.step)===1?'count':'counts'} apart`:'Everyone moves together'}</strong> · ${counts(candidate.window)} counts of movement · top speed ${analysis.maxSpeed.toFixed(1)} m/s${analysis.maxSpeed>3?' (fast)':''} · ${misses?`<span class="warn">${plural(misses,'near miss','near misses')}</span>`:'no near misses'}${candidate.shortened?' · gap shortened to fit the time available':''}`;
}
function drawDesignerPreview(){
  const host=$('#designer-preview');if(!host)return;const project=api.project(),{from,to}=transitionRange(project,designFrom);if(!from||!to)return;
  const shown=candidate?.project||project,window=candidate?.window??Math.min(to.time-from.time,from.transition?.duration??project.transitionDuration),start=to.time-window,paths=new Map<string,Point[]>();
  for(let k=0;k<=24;k++)for(const p of samplePerformance(shown,start+window*k/24)){if(p.visible===false)continue;if(!paths.has(p.performerId))paths.set(p.performerId,[]);paths.get(p.performerId)!.push(p);}
  host.innerHTML=stageSVG(shown,{ghost:from.positions,positions:to.positions.map(p=>({...p})),paths,marks:samplePerformance(shown,start+window*scrub)},{width:520,height:280,label:`Preview of the transition from ${from.name} to ${to.name}`});
}
function previewPlay(){
  cancelAnimationFrame(previewTimer);const started=performance.now(),length=2600;
  const step=(now:number)=>{const input=$<HTMLInputElement>('#designer-scrub');if(!input)return;scrub=Math.min(1,(now-started)/length);input.value=String(Math.round(scrub*100));drawDesignerPreview();if(scrub<1)previewTimer=requestAnimationFrame(step);};
  previewTimer=requestAnimationFrame(step);
}

// ---------------------------------------------------------------- variations
let variations:Variation[]=[];
export function variationsDialog(){
  const project=api.project(),f=api.formation();
  if(api.readOnly()){api.toast('This is a read-only rehearsal snapshot.');return;}
  try{variations=formationVariations(project,f.id);}catch(error){api.toast(errorMessage(error));return;}
  if(!variations.length){api.toast('Add at least two performers to see variations.');return;}
  api.dialog('Show me variations.',`<p class="modal-intro">New takes on “${esc(f.name)}”. Pick one to use it; Undo brings the original back.</p><div class="variation-grid"><figure class="variation-card original">${stageSVG(project,{positions:f.positions},{label:`Current ${f.name}`})}<figcaption><strong>Current</strong><small>As it is now</small></figcaption></figure>${variations.map(v=>`<button type="button" class="variation-card" data-creative="apply-variation" data-id="${v.id}" ${api.locked()?'disabled':''}>${stageSVG(project,{positions:v.positions,ghost:f.positions},{label:`${v.label} variation`})}<span><strong>${esc(v.label)}</strong><small>${esc(v.hint)}</small></span></button>`).join('')}</div>${api.locked()?'<p class="field-help">Unlock this formation to use a variation.</p>':''}`,true);
}

// ---------------------------------------------------------------- music structure
let sections:Section[]=[];
export function musicStructureDialog(){
  const project=api.project(),phrase=phraseSeconds(project.bpm),offset=project.music.beatOffset||0;
  const snapped=snapFormationsToPhrases(project);
  api.dialog('Shape the piece to the music.',`<p class="modal-intro">One 8-count phrase lasts ${phrase.toFixed(2)} s at ${project.bpm} BPM, with count 1 at ${offset.toFixed(2)} s. The timeline shades every other phrase.</p>
<div class="section-label">PHRASES</div><p class="field-help">${snapped.moved.length?`${plural(snapped.moved.length,'formation')} would move to the nearest phrase start (count 1 of an eight). Approved formations stay where they are.`:'Every formation already starts on a phrase.'}</p><button type="button" class="button full" data-creative="snap-phrases" ${snapped.moved.length&&!api.readOnly()?'':'disabled'}>${icon('snap')}Snap formation starts to phrases</button>
<div class="section-label">SONG SECTIONS</div>${project.music.mode==='silent'?'<p class="field-help">Silent rehearsal has no music to listen to. Choose music in Music tools first.</p>':`<button type="button" class="button full" data-creative="find-sections" ${api.readOnly()?'disabled':''}>${icon('music')}Find song sections</button><div id="section-results" class="section-results" aria-live="polite"><p class="field-help">Listens for where the music gets louder or quieter, phrase by phrase, and suggests a change of formation at each section.</p></div>`}`);
}
function renderSections(){
  const host=$('#section-results');if(!host)return;const project=api.project();
  if(!sections.length){host.innerHTML='<p class="field-help">No clear sections were found. The music may have an even loudness throughout.</p>';return;}
  host.innerHTML=`<ol class="section-list">${sections.map(s=>`<li><button type="button" data-creative="seek-section" data-time="${s.time}"><span class="section-energy level-${s.level}" style="--energy:${Math.round(s.energy*100)}%"></span><strong>${esc(s.label.split(' · ')[0])}</strong><small>${timecode(s.time)} · count ${formatCount(s.time,project.bpm,project.music.beatOffset)} · ${s.level==='peak'?'high energy':s.level==='calm'?'quiet':'steady'}</small></button></li>`).join('')}</ol><div class="modal-footer"><button type="button" class="button" data-creative="section-cues">${icon('flag')}Add as cues</button><button type="button" class="button primary" data-creative="section-formations">${icon('layers')}New formation at each section</button></div>`;
}

// ---------------------------------------------------------------- visual undo history
export function historyDialog(){
  const {past,future}=api.history(),states=[...past,api.project(),...[...future].reverse()],current=past.length;
  if(states.length<2){api.toast('Nothing to show yet. Each change you make appears here.');return;}
  const items=states.map((state,i)=>{
    const summary=i?describeChange(states[i-1],state):{label:'Where this session started',formationId:null},formation=state.formations.find(f=>f.id===summary.formationId)||state.formations[0];
    return `<li><button type="button" class="history-step ${i===current?'current':i>current?'redo':''}" data-creative="history-jump" data-steps="${i-current}" ${i===current?'aria-current="step"':''}>${stageSVG(state,{positions:formation.positions},{width:120,height:68})}<span><strong>${esc(summary.label)}</strong><small>${i===current?'You are here':i<current?`${plural(current-i,'step')} back`:`${plural(i-current,'step')} forward (redo)`} · ${esc(formation.name)}</small></span></button></li>`;
  }).reverse();
  api.dialog('Your editing history.',`<p class="modal-intro">Newest first. Pick any step to go back to it; steps after it stay available to redo until you make a new change.</p><ol class="history-list">${items.join('')}</ol>`,true);
  $('.history-step.current')?.scrollIntoView({block:'center'});
}

// ---------------------------------------------------------------- problems lane
let problems:Problem[]=[],problemTimer:ReturnType<typeof setTimeout>|undefined;
const PROBLEM_ICON:Record<string,string>={spacing:'people',boundary:'box',obstacle:'warning',speed:'clock'};
/** Re-checks the choreography shortly after edits settle and redraws the lane. */
export function scheduleProblems(delay=200){clearTimeout(problemTimer);problemTimer=setTimeout(syncProblems,delay);}
export function syncProblems(){
  const tracks=$('#timeline-tracks'),labels=$('.track-labels'),timeline=$('.timeline');if(!tracks||!labels||!timeline)return;
  if(api.playing()){scheduleProblems(1000);return;}
  const project=api.project();try{problems=timelineProblems(project);}catch{problems=[];}
  tracks.querySelector('.problem-lane')?.remove();labels.querySelector('.problem-track')?.remove();
  const byFormation=new Map<string,Problem[]>();for(const p of problems){if(!byFormation.has(p.formationId))byFormation.set(p.formationId,[]);byFormation.get(p.formationId)!.push(p);}
  tracks.querySelectorAll<HTMLElement>('.timeline-formation[data-formation]').forEach(el=>{const list=byFormation.get(el.dataset.formation!);el.classList.toggle('has-problem',!!list);if(list)el.dataset.problems=list.map(p=>p.message).join('\n');else delete el.dataset.problems;});
  timeline.classList.toggle('has-problems',problems.length>0);
  if(!problems.length)return;
  const fixable=problems.filter(p=>p.fix).length,label=document.createElement('div');label.className='track-name problem-track';
  label.innerHTML=`${icon('warning')}<span>Problems<small>${problems.length}</small></span>${fixable&&!api.readOnly()?`<button data-creative="fix-all-problems" aria-label="Fix all ${fixable} fixable problems" title="Fix all fixable problems">${icon('sparkle')}</button>`:''}`;
  labels.insertBefore(label,$('.track-name.cue-track'));
  const lane=document.createElement('div');lane.className='problem-lane';lane.setAttribute('role','group');lane.setAttribute('aria-label','Choreography problems');
  lane.innerHTML=problems.map(p=>`<button class="problem-marker kind-${p.kind}" data-creative="problem" data-problem="${esc(p.id)}" style="left:${Math.min(98.5,p.time/project.duration*100)}%" title="${esc(p.message)} · ${timecode(p.time)}" aria-label="${esc(p.message)} at ${timecode(p.time)}">${icon(PROBLEM_ICON[p.kind]||'warning')}</button>`).join('');
  lane.addEventListener('pointerdown',event=>event.stopPropagation());
  tracks.insertBefore(lane,$('.cue-lane',tracks));
}
function problemDialog(problem:Problem){
  const project=api.project(),names=new Map(project.performers.map(p=>[p.id,p.name]));
  api.selectFormation(problem.formationId);api.seek(problem.time);
  api.dialog('Fix a problem.',`<div class="problem-detail kind-${problem.kind}"><p class="modal-intro"><strong>${esc(problem.message)}</strong><br>${timecode(problem.time)} · count ${formatCount(problem.time,project.bpm,project.music.beatOffset)} · ${problem.phase==='hold'?'while holding the formation':'while travelling to the next formation'}</p><p>${problem.ids.slice(0,12).map(id=>esc(names.get(id)||'')).join(', ')}${problem.ids.length>12?` and ${problem.ids.length-12} more`:''}</p>${problem.fix&&!api.readOnly()?`<div class="modal-footer"><button type="button" class="button" data-action="close-dialog">Look first</button><button type="button" class="button primary" data-creative="fix-problem" data-problem="${esc(problem.id)}">${icon('sparkle')}${esc(problem.fix)}</button></div>`:`<p class="field-help">${problem.kind==='obstacle'?'Move these performers away from the prop or zone, or move the prop.':'Adjust the positions or timing on stage; the lane updates as you edit.'}</p>`}</div>`);
}
async function fixAll(){
  api.toast('Fixing problems…');await new Promise(resolve=>setTimeout(resolve,30));
  let project=api.project(),fixed=0,failed=0;const done=new Set<string>();
  for(let round=0;round<40;round++){
    const next=timelineProblems(project).find(p=>p.fix&&!done.has(p.id));if(!next)break;done.add(next.id);
    try{const result=fixProblem(project,next);if(result){project=result.project;fixed++;}}catch{failed++;}
  }
  if(!fixed){api.toast(failed?'These problems need a manual fix (unlock formations, or give moves more time).':'Nothing could be fixed automatically.');return;}
  const left=timelineProblems(project).length;
  api.replace(project,`Fixed ${plural(fixed,'problem')}.${left?` ${plural(left,'problem')} left to look at.`:' No problems left.'} Undo restores everything.`);
}

// ---------------------------------------------------------------- shapes palette
const PALETTE=['line','staggered','v','diamond','circle','arc','wedge','columns','triangle','semicircle','spiral','starburst'];
let paletteOpen=false;
function shapeLayout(type:string,at:Point|null):Pose[]{
  const project=api.project(),f=api.formation(),selected=api.selected(),index=project.formations.indexOf(f);
  const visible=f.positions.filter(p=>p.visible!==false),movers=selected.size>=2?visible.filter(p=>selected.has(p.performerId)):visible;
  const people=movers.map(p=>project.performers.find(v=>v.id===p.performerId)!).filter(Boolean);if(people.length<1)return f.positions;
  let layout=generateLayout(type,people,project.stage);
  const cx=layout.reduce((s,p)=>s+p.x,0)/layout.length,cz=layout.reduce((s,p)=>s+p.z,0)/layout.length,target=at||{x:movers.reduce((s,p)=>s+p.x,0)/movers.length,z:movers.reduce((s,p)=>s+p.z,0)/movers.length};
  layout=fitToStage(layout.map(p=>({...p,x:p.x-cx+target.x,z:p.z-cz+target.z})),project.stage);
  const origins=new Map((project.formations[index-1]||f).positions.filter(p=>p.visible!==false).map(p=>[p.performerId,{x:p.x,z:p.z}]));
  const spots=new Map(assignByTravel(layout,origins).map(p=>[p.performerId,p]));
  return f.positions.map(p=>{const s=spots.get(p.performerId);return s?{...p,x:s.x,z:s.z}:p;});
}
function applyShape(type:string,at:Point|null){
  if(api.readOnly()){api.toast('This is a read-only rehearsal snapshot.');return;}
  if(api.locked()){api.toast('Unlock this formation before reshaping it.');return;}
  const project=api.project(),f=api.formation(),next=structuredClone(project),name=FORMATION_TEMPLATES.find(t=>t.id===type)?.name||'Shape';
  next.formations.find(v=>v.id===f.id)!.positions=shapeLayout(type,at);
  api.replace(next,`${name} placed${api.selected().size>=2?` for ${api.selected().size} selected performers`:''}. Each dancer took the nearest spot. Undo to go back.`);
}
function paletteHTML(){
  const project=api.project();
  return `<div class="shape-palette" id="shape-palette" role="toolbar" aria-label="Shapes: drag one onto the stage, or press it to place it in the middle"><div class="shape-palette-head"><strong>Shapes</strong><small>Drag onto the stage</small>${`<button type="button" class="icon-button" data-creative="shapes" aria-label="Close shapes">${icon('close')}</button>`}</div><div class="shape-palette-grid">${PALETTE.map(id=>{const meta=FORMATION_TEMPLATES.find(t=>t.id===id);if(!meta)return '';const layout=generateLayout(id,project.performers.slice(0,12),project.stage);return `<button type="button" class="shape-chip" data-shape="${id}" aria-label="${esc(meta.name)}">${stageSVG(project,{positions:layout.map((p,i)=>({...p,performerId:project.performers[i]?.id||p.performerId}))},{width:84,height:50})}<span>${esc(meta.name)}</span></button>`;}).join('')}</div></div>`;
}
function syncPalette(){
  const viewport=$('#stage-viewport'),existing=$('#shape-palette');
  if(!paletteOpen||!viewport){existing?.remove();document.querySelectorAll('[data-creative="shapes"]').forEach(el=>el.setAttribute('aria-pressed','false'));return;}
  if(!existing||existing.parentElement!==viewport){existing?.remove();viewport.insertAdjacentHTML('beforeend',paletteHTML());}
  document.querySelectorAll('.canvas-toolbar [data-creative="shapes"]').forEach(el=>el.setAttribute('aria-pressed','true'));
}
// Drag from a chip to the stage, with a live preview of where everyone will land.
interface ShapeDrag {type:string; id:number; x:number; y:number; started:boolean; ghost:HTMLElement|null; at:Point|null}
let shapeDrag:ShapeDrag|null=null,suppressClick=false;
function stageAt(clientX:number,clientY:number):Point|null{
  const wrap=$('#stage-wrap');if(!wrap)return null;const box=wrap.getBoundingClientRect();if(clientX<box.left||clientX>box.right||clientY<box.top||clientY>box.bottom)return null;
  const group=$<SVGGElement>('#stage-transform'),matrix=group?.getScreenCTM?.();if(!group||!matrix)return {x:0,z:0};
  const p=new DOMPoint(clientX,clientY).matrixTransform(matrix.inverse()),w=worldPoint(api.project(),p),s=api.project().stage;
  return {x:Math.max(-s.width/2,Math.min(s.width/2,w.x)),z:Math.max(-s.depth/2,Math.min(s.depth/2,w.z))};
}
function drawShapeGhost(positions:Pose[]|null){
  const group=$<SVGGElement>('#stage-transform');document.getElementById('shape-ghost')?.remove();if(!group||!positions)return;
  const project=api.project(),g=document.createElementNS('http://www.w3.org/2000/svg','g');g.id='shape-ghost';g.setAttribute('aria-hidden','true');
  g.innerHTML=positions.filter(p=>p.visible!==false).map(p=>{const pt=stagePoint(project,p);return `<circle cx="${pt.x}" cy="${pt.y}" r="17" class="shape-ghost-dot"/>`;}).join('');group.append(g);
}
function endShapeDrag(drop:boolean){
  const drag=shapeDrag;shapeDrag=null;drawShapeGhost(null);drag?.ghost?.remove();document.body.classList.remove('shape-dragging');
  if(drag?.started){suppressClick=true;setTimeout(()=>{suppressClick=false;},0);if(drop&&drag.at)applyShape(drag.type,drag.at);}
}

// ---------------------------------------------------------------- wiring
export function creativeCommands(){
  const run=(title:string,go:()=>void,keywords:string)=>({title,group:'Create',run:go,keywords});
  return [run('Design transition: styles, canon & ripple',()=>transitionDesigner(),'transition canon ripple explode implode spiral peel follow stagger cascade'),run('Show me variations of this formation',variationsDialog,'variation mirror flip rotate swap alternative idea'),run('Phrases & song sections',musicStructureDialog,'music phrase eight count section snap structure verse chorus'),run('Editing history',historyDialog,'undo redo history steps back'),run('Shapes palette (drag onto stage)',()=>{paletteOpen=!paletteOpen;syncPalette();},'shape drag drop template palette'),run(`Switch to ${uiLevel()==='pro'?'Simple':'Pro'} view`,()=>setLevel(uiLevel()==='pro'?'simple':'pro'),'simple pro beginner advanced interface level')];
}
/** Call after each render or partial refresh of the workstation. */
export function syncCreative(){applyLevel();syncPalette();if($('#timeline-tracks')&&!$('.problem-lane')&&!$('.timeline.has-problems-checked'))syncProblems();else scheduleProblems();$('.timeline')?.classList.add('has-problems-checked');}

export function setupCreative(adapter:CreativeApi){
  api=adapter;applyLevel();
  document.addEventListener('click',async event=>{
    const target=event.target as HTMLElement,el=target.closest<HTMLElement>('[data-creative],[data-creative-style],[data-shape]');if(!el)return;
    if(el.dataset.shape){if(suppressClick)return;applyShape(el.dataset.shape,null);return;}
    if(el.dataset.creativeStyle){design.style=el.dataset.creativeStyle as TransitionStyle;if(design.order==='together'&&design.style!=='direct')design.order=defaultOrder(design.style);syncDesignerControls();updateDesigner();return;}
    const project=api.project();
    try{
      switch(el.dataset.creative){
        case 'toggle-level':case 'level-menu':setLevel(uiLevel()==='pro'?'simple':'pro');if(el.dataset.creative==='level-menu')api.close();api.toast(uiLevel()==='pro'?'Pro view: every tool is showing.':'Simple view: just the essentials. Switch to Pro any time.');break;
        case 'transition-designer':transitionDesigner(el.dataset.id||api.formation().id);break;
        case 'designer-play':previewPlay();break;
        case 'apply-transition':{if(!candidate)break;const {to}=transitionRange(project,designFrom),style=TRANSITION_STYLES.find(s=>s.id===design.style)!.label;api.close();api.replace(candidate.project,`${style}${candidate.waves>1?` ${design.timing==='canon'?'canon':'cascade'} in ${candidate.waves} waves`:''} into “${to?.name||''}”. Undo restores the previous paths.`,{formationId:designFrom});break;}
        case 'variations':variationsDialog();break;
        case 'apply-variation':{const v=variations.find(v=>v.id===el.dataset.id);if(!v)break;const next=structuredClone(project),f=next.formations.find(f=>f.id===api.formation().id)!;f.positions=v.positions;api.close();api.replace(next,`${v.label} applied to “${f.name}”. Undo brings the original back.`);break;}
        case 'music-structure':musicStructureDialog();break;
        case 'snap-phrases':{const result=snapFormationsToPhrases(project);if(!result.moved.length){api.toast('Every formation already starts on a phrase.');break;}api.close();api.replace(result.project,`${plural(result.moved.length,'formation')} now ${result.moved.length===1?'starts':'start'} on count 1 of a phrase.`);break;}
        case 'find-sections':{const host=$('#section-results');if(host)host.innerHTML='<p class="field-help">Listening to the music…</p>';(el as HTMLButtonElement).disabled=true;const buffer=await api.audio();if(!buffer){if(host)host.innerHTML='<p class="field-help">The music is not loaded here. Upload or restore it in Music tools.</p>';break;}const {monoSamples}=await import('./beat-detect.js');await new Promise(resolve=>setTimeout(resolve,20));sections=detectSections(monoSamples(buffer),buffer.sampleRate,api.project());renderSections();(el as HTMLButtonElement).disabled=false;break;}
        case 'seek-section':api.seek(Number(el.dataset.time));break;
        case 'section-cues':{const result=addSectionCues(project,sections);if(!result.added){api.toast('Each section already has a cue.');break;}api.close();api.replace(result.project,`${plural(result.added,'section cue')} added to the timeline.`);break;}
        case 'section-formations':{const result=addSectionFormations(project,sections);if(!result.added.length){api.toast('Each section already starts with a formation.');break;}api.close();api.replace(result.project,`${plural(result.added.length,'new formation')} at the section changes. Reshape each one on stage.`,{formationId:result.added[0]});break;}
        case 'history':historyDialog();break;
        case 'history-jump':{const steps=Number(el.dataset.steps);if(!steps)break;api.close();api.travel(steps);api.toast(steps<0?`Went back ${plural(-steps,'step')}. Redo or History brings them back.`:`Went forward ${plural(steps,'step')}.`);break;}
        case 'problem':{const problem=problems.find(p=>p.id===el.dataset.problem);if(problem)problemDialog(problem);break;}
        case 'fix-problem':{const problem=problems.find(p=>p.id===el.dataset.problem);if(!problem)break;const result=fixProblem(project,problem);api.close();if(!result){api.toast('Nothing to change automatically here.');break;}api.replace(result.project,result.message,{formationId:problem.formationId});break;}
        case 'fix-all-problems':await fixAll();break;
        case 'shapes':paletteOpen=!paletteOpen;syncPalette();if(paletteOpen)$<HTMLElement>('.shape-chip')?.focus();break;
      }
    }catch(error){api.toast(errorMessage(error));}
  });
  document.addEventListener('input',event=>{
    const target=event.target as HTMLInputElement;
    if(target.id==='designer-scrub'){cancelAnimationFrame(previewTimer);scrub=Number(target.value)/100;drawDesignerPreview();}
    else if(target.id==='canon-spread'){design.spread=Number(target.value);updateDesigner();}
  });
  document.addEventListener('change',event=>{
    const target=event.target as HTMLSelectElement;
    if(target.id==='level-preference'&&(target.value==='simple'||target.value==='pro')){setLevel(target.value);api.toast(target.value==='pro'?'Pro view: every tool is showing.':'Simple view: just the essentials.');}
    else if(target.id==='canon-order'){design.order=target.value as CanonOrder;syncDesignerControls();updateDesigner();}
    else if(target.id==='canon-timing'){design.timing=target.value as CanonTiming;updateDesigner();}
  });
  document.addEventListener('pointerdown',event=>{
    const chip=(event.target as HTMLElement).closest<HTMLElement>('.shape-chip[data-shape]');if(!chip||event.button>0)return;
    shapeDrag={type:chip.dataset.shape!,id:event.pointerId,x:event.clientX,y:event.clientY,started:false,ghost:null,at:null};
  });
  document.addEventListener('pointermove',event=>{
    const drag=shapeDrag;if(!drag||event.pointerId!==drag.id)return;
    if(!drag.started){if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<6)return;drag.started=true;document.body.classList.add('shape-dragging');const chip=$(`.shape-chip[data-shape="${drag.type}"]`);drag.ghost=document.createElement('div');drag.ghost.className='shape-drag-ghost';drag.ghost.innerHTML=chip?.querySelector('svg')?.outerHTML||'';document.body.append(drag.ghost);}
    event.preventDefault();
    if(drag.ghost){drag.ghost.style.left=event.clientX+'px';drag.ghost.style.top=event.clientY+'px';}
    drag.at=stageAt(event.clientX,event.clientY);
    drawShapeGhost(drag.at&&!api.locked()?shapeLayout(drag.type,drag.at):null);
    drag.ghost?.classList.toggle('over-stage',!!drag.at);
  },{passive:false});
  document.addEventListener('pointerup',event=>{if(shapeDrag&&event.pointerId===shapeDrag.id)endShapeDrag(true);});
  document.addEventListener('pointercancel',event=>{if(shapeDrag&&event.pointerId===shapeDrag.id)endShapeDrag(false);});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&shapeDrag){endShapeDrag(false);return;}
    // The path-style picker is a radio group: arrow keys move the choice, like native radios.
    const radio=(event.target as HTMLElement).closest?.<HTMLElement>('[data-creative-style]');if(!radio||!['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();const all=[...document.querySelectorAll<HTMLElement>('[data-creative-style]')],index=all.indexOf(radio);
    const next=event.key==='Home'?all[0]:event.key==='End'?all[all.length-1]:all[(index+(event.key==='ArrowRight'||event.key==='ArrowDown'?1:-1)+all.length)%all.length];
    next.focus();next.click();
  });
}
