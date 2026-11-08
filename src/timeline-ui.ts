import type {Project} from './types.js';
import {icon} from './icons.js';
import {timelineToolButtons,reorderImpact,timelineFingerprint,timelineCommandReason} from './timeline-tools.js';
import {bindTimelineGestures,bindTimelineResizer} from './timeline-gesture.js';
import {observeSize} from './compat.js';
import {wheelPixels} from './camera-controls.js';
import {createWheelClassifier,bindGesturePinch,bindTouchPinch,bindLongPress} from './input-gestures.js';
const timelineWheel=createWheelClassifier();
import {timedItems} from './production-timing.js';
import {clamp,timecode,uid} from './engine.js';

import {editTimeline,reorderFormation,timelineItem,copyTimelineItem,pasteTimelineItem,duplicateTimelineItem,splitTimelineItem,removeTimelineItem,packMovementRows} from './timeline-model.js';

const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let api,selection,clipboard,pendingRemoval,pendingReorder,pendingTrim,zoom=1,snap='beat',dragMode='reorder',height=null,observer,dragging=false,lastTap=null,gestureController,zoomController,resizeController;
let uiListeners=[],uiNodes=[];
function timelineListen(node,type,handler,options?){node.addEventListener(type,handler,options);uiListeners.push(()=>node.removeEventListener(type,handler,options));}

export function rememberClipSelection(kind,id){if(api)selection={projectId:api.project().id,kind,id};}

function current(){const p=api.project();if(selection?.projectId===p.id){try{timelineItem(p,selection.kind,selection.id);return selection;}catch{}}return {projectId:p.id,kind:'formation',id:api.formation().id};}
export function timelineSelection(){return api?{...current()}:null;}
export function resetTimelineSize(){height=null;}
export function disposeTimeline(){document.dispatchEvent(new Event('timeline-teardown'));resizeController?.dispose();resizeController=null;uiListeners.forEach(remove=>remove());uiListeners=[];uiNodes.forEach(node=>node.remove());uiNodes=[];gestureController?.dispose();gestureController=null;zoomController=null;observer?.disconnect();observer=null;dragging=false;}

const boundaryTime=(project: Project,kind,id,edge)=>{const item=timelineItem(project,kind,id);return kind==='movement'?item[edge]:edge==='start'?item.time:project.formations[project.formations.indexOf(item)+1]?.time??project.duration;};
const selectedItem=()=>{const s=current();return timelineItem(api.project(),s.kind,s.id);};
export function syncRelatedTiming(project: Project,duration=project.duration,includeFormations=false){
 const items=new Map(timedItems(project).map(v=>[v.key,v]));
 for(const node of document.querySelectorAll<HTMLElement>('[data-timeline-id]')){const v=items.get(node.dataset.timelineKind+'/'+node.dataset.timelineId);if(!v||v.kind==='formation'&&!includeFormations)continue;node.style.left=v.time/duration*100+'%';if(v.kind==='movement')node.style.width=(v.item.end-v.item.start)/duration*100+'%';if(v.kind==='formation'){const i=project.formations.indexOf(v.item),span=(project.formations[i+1]?.time??project.duration)-v.time;node.style.width=span/duration*100+'%';const label=node.querySelector<HTMLElement>('.sequence-duration');if(label)label.textContent=+span.toFixed(3)+'s';}}
 for(const node of document.querySelectorAll<HTMLElement>('.production-lane [data-production="event"]')){const key={lights:'light',appearances:'appearance',cameras:'camera'}[node.dataset.key],v=items.get(key+'/'+node.dataset.id);if(v)node.style.left=v.time/duration*100+'%';}
 for(const node of document.querySelectorAll<HTMLElement>('.prop-lane [data-score="prop-frame"]')){const prop=project.props.find(v=>v.id===node.dataset.id),key=prop?.keyframes.find(v=>v.id===node.dataset.frame);if(key)node.style.left=key.time/duration*100+'%';}
}

const actionButton=(action,label,disabled=false)=>`<button class="button" type="button" data-timeline-action="${action}" ${disabled?'disabled':''}>${label}</button>`;

function markSelection(){const s=current();document.querySelectorAll<HTMLElement>('[data-timeline-id]').forEach(el=>{const chosen=el.dataset.timelineKind===s.kind&&el.dataset.timelineId===s.id;el.classList.toggle('clip-selected',chosen);el.setAttribute('aria-pressed',String(chosen));});refreshTimelineTools();}
export function refreshTimelineTools(){if(!api)return;const s=current(),item=selectedItem();document.querySelectorAll<HTMLElement>('.timeline-quick').forEach(button=>{const command=button.dataset.timelineAction,reason=timelineCommandReason(api.project(),s,command,api.time(),{readOnly:api.readOnly(),clipboard});(button as HTMLButtonElement).disabled=!!reason;button.title=(button.getAttribute('aria-label')||command)+(reason?' · '+reason:'');});const name=$('#timeline-selection');if(name)name.textContent=`${s.kind} · ${item.name||item.label}`;
}


function focusTimeline(){$('.timeline')?.focus({preventScroll:true});}

export function setupTimeline(adapter){

  api=adapter;pendingTrim=null;
  $('#dialog')?.addEventListener?.('close',()=>{if(!$('#dialog')?.open)pendingTrim=null;});

  document.addEventListener('click',event=>{

    const menu=$('.timeline-more[open]');if(menu&&(!(event.target as HTMLElement).closest<HTMLElement>('.timeline-more')||(event.target as HTMLElement).closest<HTMLElement>('[data-power],[data-images]')))menu.open=false;
    const button=(event.target as HTMLElement).closest<HTMLElement>('[data-timeline-action]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();if(menu)menu.open=false;

    try{runTimelineCommand(button.dataset.timelineAction);}catch(error){api.toast(error.message);}

  },true);

  document.addEventListener('change',event=>{

    if((event.target as HTMLElement).id==='timeline-snap')snap=(event.target as HTMLInputElement).value;
    if((event.target as HTMLElement).id==='timeline-drag-mode'){dragMode=(event.target as HTMLInputElement).value;api.render();}

    if((event.target as HTMLElement).id==='clip-select'){const [kind,id]=(event.target as HTMLInputElement).value.split('/');rememberClipSelection(kind,id);clipTools();markSelection();}

    if((event.target as HTMLElement).id==='clip-playhead'){const value=Number((event.target as HTMLInputElement).value);if(Number.isFinite(value)){api.seek(value);markSelection();}}

  });

  document.addEventListener('submit',event=>{

    if((event.target as HTMLElement).id!=='timeline-trim-form')return;event.preventDefault();event.stopImmediatePropagation();if(api.readOnly())return;

    try{const pending=pendingTrim;if(!pending||(event.target as HTMLElement).dataset.trimToken!==pending.token)throw Error('This trim dialog expired. Reopen it.');if(pending.before!==timelineFingerprint(api.project()))throw Error('The score changed. Reopen the trim dialog before saving.');const data=new FormData(((event.target as HTMLElement) as HTMLFormElement)),edge=String(data.get('edge')||'');if(!['start','end'].includes(edge))throw Error('Choose the start or end edge.');const next=editTimeline(api.project(),{kind:pending.kind,id:pending.id,edge,value:Number(String(data.get('time')||''))});if(boundaryTime(next,pending.kind,pending.id,edge)===boundaryTime(api.project(),pending.kind,pending.id,edge)){const input=(((event.target as HTMLElement) as HTMLFormElement).elements?.['time'] as HTMLInputElement);if(input)input.value=boundaryTime(next,pending.kind,pending.id,edge);api.toast('No timing change. Existing events or sequence boundaries limit this trim.');return;}api.replace(next,'Clip trimmed. Undo is available.',{formationId:pending.kind==='formation'?pending.id:undefined,time:pending.kind==='formation'?timelineItem(next,'formation',pending.id).time:undefined});pendingTrim=null;rememberClipSelection(pending.kind,pending.id);api.close();markSelection();focusTimeline();}catch(error){api.toast(error.message);}

  },true);

  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){const menu=$('.timeline-more[open]');if(menu){event.preventDefault();event.stopImmediatePropagation();menu.open=false;menu.querySelector('summary')?.focus();return;}}

    if((event.target as HTMLElement).matches('input,textarea,select')||$('#dialog').open||!(event.target as HTMLElement).closest<HTMLElement>('.timeline'))return;

    if(event.key==='Escape'&&dragging){event.preventDefault();event.stopImmediatePropagation();$('#timeline-tracks')?.dispatchEvent(new Event('cancel-timeline-gesture'));return;}
    if(dragging){event.preventDefault();event.stopImmediatePropagation();return;}
    const mod=event.ctrlKey||event.metaKey,key=event.key.toLowerCase();let command;
    if(mod&&['+','=','-','0'].includes(key)){event.preventDefault();event.stopImmediatePropagation();runTimelineCommand(key==='0'?'zoom-fit':key==='-'?'zoom-out':'zoom-in');return;}
    if((event.target as HTMLElement).closest<HTMLElement>('[data-production="event"],[data-score="prop-frame"]'))return;

    if(event.altKey&&event.key==='ArrowLeft')command='move-earlier';else if(event.altKey&&event.key==='ArrowRight')command='move-later';else if(mod&&key==='d')command='duplicate';else if(mod&&key==='c')command='copy';else if(mod&&key==='x')command='cut';else if(mod&&key==='v')command='paste';else if(!mod&&key==='s')command='split';else if(key==='delete'||key==='backspace')command='delete';

    if(command){event.preventDefault();event.stopImmediatePropagation();try{runTimelineCommand(command);}catch(error){api.toast(error.message);}}

    else if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();api.seek(event.key==='Home'?0:event.key==='End'?api.project().duration:api.time()+(event.key==='ArrowLeft'?-1:1)*60/api.project().bpm*(event.shiftKey?4:1));focusTimeline();}

  },true);

}

export function confirmTimelineRemoval(kind,id,operation='delete'){

  if(api.readOnly())return;

  const p=api.project(),item=timelineItem(p,kind,id);removeTimelineItem(p,kind,id);

  pendingRemoval={projectId:p.id,kind,id,operation,before:timelineFingerprint(p)};

  const removalDetail=' Its incoming and outgoing route overrides will also be removed. '+(p.production?.ripple?'Ripple mode also removes events inside this sequence interval, trims overlapping movements, and moves later events and the performance end earlier.':'Other formation times stay in place.');
  api.dialog(`${operation==='cut'?'Cut':'Delete'} this ${kind}?`,`<p class="modal-intro"><strong>${esc(item.name||item.label)}</strong> will be removed from the timeline.${kind==='formation'?removalDetail:''}</p><p class="field-help">${operation==='cut'?'A copy will stay in the project clipboard for pasting. ':''}Undo restores this edit.</p><div class="modal-footer">${actionButton('cancel-remove','Keep '+kind)}<button class="button danger-fill" data-timeline-action="confirm-remove">${operation==='cut'?'Cut':'Delete'} ${kind}</button></div>`);

}

function applyResult(result,message){api.replace(result.project,message,{formationId:result.kind==='formation'?result.item.id:undefined,time:result.item.time??result.item.start});rememberClipSelection(result.kind,result.item.id);api.close();markSelection();focusTimeline();}

export function requestSequenceReorder(next,id,after?){
 if(api.readOnly())return false;const currentProject=api.project(),impact=reorderImpact(currentProject,next),formation=next.formations.find(f=>f.id===id);if(!formation)throw Error('Choose an existing formation.');if(!impact.changed){api.render();return false;}
 if(!impact.removedRoutes.length){api.replace(next,'Sequence reordered. Time slots stay fixed. Undo is available.',{formationId:id,time:formation.time});after?.();return true;}
 pendingReorder={before:timelineFingerprint(currentProject),next,id,time:formation.time,after};api.render();api.dialog('Review sequence reorder',`<p class="modal-intro">Moving <strong>${esc(formation.name)}</strong> changes ${impact.removedRoutes.length} custom performer route${impact.removedRoutes.length===1?'':'s'} between formations that are no longer adjacent. New transitions use formation defaults. Time slots stay fixed. Linked events move with their sequence; unlinked events keep their times.</p><p class="field-help">New order: ${next.formations.map(f=>esc(f.name)).join(' → ')}</p><div class="modal-footer">${actionButton('cancel-reorder','Keep original order')}${actionButton('confirm-reorder','Apply reorder')}</div>`);return false;
}

export function runTimelineCommand(command,override?){
  gestureController?.cancel();resizeController?.cancel();document.dispatchEvent(new Event('timeline-cancel-production'));

  if(override)rememberClipSelection(override.kind,override.id);

  const p=api.project(),s=current();

  if(command==='confirm-reorder'){const pending=pendingReorder;pendingReorder=null;if(!pending||timelineFingerprint(api.project())!==pending.before)throw Error('The project changed. Drag the formation again.');api.replace(pending.next,'Sequence reordered. Affected route overrides rebuilt; Undo is available.',{formationId:pending.id,time:pending.time});api.close();pending.after?.();return;}
  if(command==='cancel-reorder'){pendingReorder=null;api.close();return;}
  if(command==='tools'){clipTools();return;}

  if(command==='timing'){api.timingDialog(s);return;}
  if(command==='transition'){api.transitionDialog(s.kind==='formation'?s.id:undefined);return;}

  if(command==='details'){api.details(s.kind,s.id);return;}

  if(command==='copy'){clipboard=copyTimelineItem(p,s.kind,s.id);api.toast('Clip copied inside this project. Paste at a free playhead time.');refreshTimelineTools();if($('#clip-select'))clipTools();return;}

  if(command==='cancel-remove'){pendingRemoval=null;api.close();return;}

  if(command==='zoom-selection'){const item=timelineItem(p,s.kind,s.id),start=s.kind==='movement'?item.start:item.time,end=s.kind==='movement'?item.end:s.kind==='formation'?(p.formations[p.formations.indexOf(item)+1]?.time??p.duration):start+240/p.bpm;zoomController?.(p.duration/Math.max(.15,(end-start)*1.5),undefined,(start+Math.min(p.duration,end))/2);return;}

  if(command==='zoom-in'||command==='zoom-out'||command==='zoom-fit'){zoomController?.(command==='zoom-fit'?1:zoom*(command==='zoom-in'?1.5:1/1.5));return;}

  if(api.readOnly())return api.toast('This rehearsal snapshot is read-only.');

  if(command==='delete'||command==='cut'){confirmTimelineRemoval(s.kind,s.id,command);return;}

  if(command==='confirm-remove'){

    const pending=pendingRemoval;if(!pending||pending.projectId!==p.id||pending.before!==timelineFingerprint(p))throw Error('The score changed. Review this deletion again.');

    const copied=pending.operation==='cut'?copyTimelineItem(p,pending.kind,pending.id):null;

    const next=removeTimelineItem(p,pending.kind,pending.id);api.replace(next,`${pending.kind} ${pending.operation==='cut'?'cut to clipboard':'deleted'}. Undo is available.`);if(copied)clipboard=copied;pendingRemoval=null;selection=null;api.close();return;

  }

  if(command==='move-earlier'||command==='move-later'){
    const reason=timelineCommandReason(p,s,command,api.time(),{readOnly:api.readOnly(),clipboard});if(reason)throw Error(reason);
    const index=p.formations.findIndex(f=>f.id===s.id);requestSequenceReorder(reorderFormation(p,s.id,index+(command==='move-earlier'?-1:1)),s.id);return;
  }

  if(command==='duplicate'){applyResult(duplicateTimelineItem(p,s.kind,s.id),s.kind==='movement'?'Movement duplicated. Overlaps use separate rows; drag to refine the timing.':'Clip duplicated. Drag it to refine the timing.');return;}

  if(command==='split'){applyResult(splitTimelineItem(p,s.kind,s.id,api.time()),s.kind==='formation'?'Formation split at the sampled pose. Transitions rebuilt; route overrides on this interval removed.':'Movement split at the playhead.');return;}

  if(command==='paste'){applyResult(pasteTimelineItem(p,clipboard,api.time()),'Clip pasted at the playhead.');return;}

  if(command==='trim-start'||command==='trim-end')trimDialog(command==='trim-end'?'end':'start');

}

function clipTools(){
  const p=api.project(),s=current(),item=selectedItem(),point=s.kind==='cue',locked=s.kind==='formation'&&item.status==='approved';
  const commands=[['duplicate','Duplicate'],['split','Split at playhead'],['trim-start','Trim start'],['trim-end','Trim end'],['copy','Copy'],['paste','Paste at playhead'],['cut','Cut to clipboard'],['delete','Delete…'],...(s.kind==='formation'?[['move-earlier','Move earlier'],['move-later','Move later'],['transition','Movement timing']]:[]),['details','Edit details'],['timing','Exact timing']];
  const buttons=commands.map(([command,label])=>{const reason=timelineCommandReason(p,s,command,api.time(),{readOnly:api.readOnly(),clipboard});return `<button class="button timeline-quick" type="button" data-timeline-action="${command}" aria-label="${label}" title="${esc(reason||label)}" ${reason?'disabled':''}>${label}</button>`;}).join('');
  api.dialog('Clip inspector',`<label class="field">Selected clip<select id="clip-select">${[['formation','formations'],['movement','actions'],['cue','cues']].flatMap(([kind,key])=>p[key].map(item=>`<option value="${kind}/${item.id}" ${kind===s.kind&&item.id===s.id?'selected':''}>${kind} · ${esc(item.name||item.label)}</option>`)).join('')}</select></label><div class="clip-summary"><strong>${esc(item.name||item.label)}</strong><span>${s.kind} · ${point?item.time+'s':s.kind==='movement'?`${item.start}–${item.end}s`:`${item.time}–${p.formations[p.formations.indexOf(item)+1]?.time??p.duration}s`} ${locked?'· approved':''}</span></div><label class="field">Playhead / split / paste time (seconds)<input id="clip-playhead" type="number" min="0" max="${p.duration}" step=".001" value="${api.time().toFixed(3)}"></label><div class="clip-command-grid">${buttons}</div><p class="field-help">Drag → Reorder moves sequences between fixed time slots; Retime moves a start within its neighbors. Handles trim shared boundaries. On touch, scroll clip bodies and drag a grip or edge. Alt bypasses snapping; Escape cancels a drag. Ctrl/⌘ D duplicates, C/X/V copies/cuts/pastes; S splits. Alt ←/→ moves a sequence. Delete and Cut always ask first. Split formations sample the playhead pose and rebuild their interval transitions.</p>`,true);
}

function trimDialog(edge){const p=api.project(),s=current(),item=selectedItem();if(s.kind==='cue')throw Error('Cues are point events. Edit their time instead.');const value=boundaryTime(p,s.kind,s.id,edge);

  pendingTrim={kind:s.kind,id:s.id,before:timelineFingerprint(p),token:uid()};
  api.dialog('Trim with precision.',`<form id="timeline-trim-form" data-trim-token="${pendingTrim.token}"><p class="modal-intro">${esc(item.name)}. Formation clips share boundaries with their neighbors. The last formation’s end controls the performance duration and cannot cut off existing movements, cues, or notes.</p><label class="field">Edge<select name="edge"><option value="start" ${edge==='start'?'selected':''}>Start</option><option value="end" ${edge==='end'?'selected':''}>End</option></select></label><label class="field">Time (seconds)<input name="time" type="number" min="0" max="${s.kind==='formation'?3600:p.duration}" step=".001" value="${value}" required></label><div class="modal-footer"><span>Undo restores the previous timing.</span><button class="button primary">Save trim</button></div></form>`);

}

export function bindEditorTimeline(){

  disposeTimeline();
  const timeline=$('.timeline'),area=$('#timeline-tracks'),scroll=$('.timeline-scroll');if(!area)return;

  timeline.tabIndex=0;timeline.setAttribute('aria-description','Select a clip, then use clip tools or timeline keyboard shortcuts.');

  const limits=()=>{const min=Math.min(innerWidth<=767?240:160,Math.max(120,innerHeight*.5));return {min,max:Math.max(min,innerHeight*.7)};},minimumHeight=limits().min,maximumHeight=limits().max;
  if(height!==null){const safe=clamp(height,minimumHeight,maximumHeight);timeline.style.setProperty('height',safe+'px','important');timeline.style.setProperty('min-height',safe+'px','important');timeline.classList.add('manually-sized');}

  const resize=document.createElement('div');resize.className='timeline-resizer';resize.title='Drag to resize timeline; double-click to reset';resize.setAttribute('role','separator');resize.setAttribute('aria-label','Resize timeline');resize.setAttribute('aria-orientation','horizontal');resize.tabIndex=0;timeline.prepend(resize);

  resize.setAttribute('aria-valuemin',String(minimumHeight));resize.setAttribute('aria-valuemax',String(Math.round(maximumHeight)));resize.setAttribute('aria-valuenow',String(timeline.clientHeight));
  uiNodes.push(resize);const initialHeight=timeline.style.height||'',initialMin=timeline.style.minHeight||'',initialManual=timeline.classList.contains('manually-sized'),initialHeightPriority=timeline.style.getPropertyPriority?.('height')||'',initialMinPriority=timeline.style.getPropertyPriority?.('min-height')||'';
  resizeController=bindTimelineResizer(resize,{height:()=>timeline.clientHeight,limits,start:()=>gestureController?.cancel(),preview:value=>{timeline.style.setProperty('height',value+'px','important');timeline.style.setProperty('min-height',value+'px','important');timeline.classList.add('manually-sized');resize.setAttribute('aria-valuenow',String(Math.round(value)));},rollback:()=>{timeline.style.setProperty('height',initialHeight,initialHeightPriority);timeline.style.setProperty('min-height',initialMin,initialMinPriority);timeline.classList.toggle('manually-sized',initialManual);resize.setAttribute('aria-valuenow',String(timeline.clientHeight));},commit:value=>{height=value;api.setTimelineExpanded(true);api.render();},reset:()=>{height=null;api.setTimelineExpanded(false);api.render();}});

  const controls=document.createElement('div');controls.className='timeline-editbar';controls.innerHTML=`<div class="timeline-primary"><span class="timeline-icon-tools" role="group" aria-label="Timeline editing commands">${timelineToolButtons()}</span><label class="drag-mode-label"><span>Drag</span><select id="timeline-drag-mode" aria-label="Formation drag mode"><option value="reorder" ${dragMode==='reorder'?'selected':''}>Reorder</option><option value="retime" ${dragMode==='retime'?'selected':''}>Retime</option></select></label><label><span>Snap</span><select id="timeline-snap" aria-label="Timeline snapping">${[['beat','Beat'],['half-beat','½ beat'],['second','Second'],['off','Off']].map(([v,l])=>`<option value="${v}" ${v===snap?'selected':''}>${l}</option>`).join('')}</select></label></div><div class="timeline-zoom"><button type="button" data-timeline-action="zoom-out" aria-label="Zoom timeline out" title="Zoom timeline out">${icon('minus')}</button><button type="button" data-timeline-action="zoom-fit" title="Fit entire performance" aria-label="Fit entire timeline">${Math.round(zoom*100)}%</button><button type="button" data-timeline-action="zoom-in" aria-label="Zoom timeline in" title="Zoom timeline in">${icon('plus')}</button></div>`;timeline.insertBefore(controls,$('.timeline-body'));uiNodes.push(controls);
  const more=controls.querySelector<HTMLElement>('.timeline-more');if(more)timelineListen(more,'toggle',()=>{if(!(more as HTMLDialogElement).open)return;const menu=more.querySelector<HTMLElement>('.timeline-menu'),anchor=more.querySelector<HTMLElement>('summary').getBoundingClientRect(),max=Math.max(80,innerHeight-24),menuHeight=Math.min(menu.scrollHeight,max),left=clamp(anchor.left,12,Math.max(12,innerWidth-menu.offsetWidth-12)),top=anchor.top>=menuHeight+20?anchor.top-menuHeight-8:clamp(anchor.bottom+8,12,Math.max(12,innerHeight-menuHeight-12));Object.assign(menu.style,{position:'fixed',left:left+'px',top:top+'px',bottom:'auto',maxHeight:max+'px'});});
  const status=document.createElement('div');status.className='timeline-feedback';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');status.hidden=true;timeline.append(status);uiNodes.push(status);
  area.style.width=`${zoom*100}%`;area.style.minWidth='100%';area.style.setProperty('--beat-width',`${60/api.project().bpm/api.project().duration*100}%`);
  area.querySelectorAll('.timeline-body-grip,.timeline-handle,.sequence-move-window,.cue-grip').forEach(node=>node.remove());
  area.querySelectorAll('.timeline-formation').forEach((el,index)=>{
    const p=api.project(),f=p.formations[index],to=p.formations[index+1];el.dataset.timelineKind='formation';el.dataset.timelineId=f.id;
    el.insertAdjacentHTML('afterbegin','<span class="timeline-body-grip" data-reorder-grip title="Drag sequence" aria-hidden="true">⠿</span>');
    el.setAttribute('aria-label',`Sequence ${index+1}: ${f.name}, ${f.time} to ${to?.time??p.duration} seconds${f.status==='approved'?', approved':''}`);
    el.title=`${f.name} · ${f.time}s. Drag to ${dragMode}; handles trim. Alt bypasses snapping. Right-click for tools.`;el.classList.toggle('clip-locked',f.status==='approved');
    if(to){const move=Math.min(f.transition?.duration??p.transitionDuration,to.time-f.time);el.insertAdjacentHTML('beforeend',`<i class="sequence-move-window" style="width:${move/(to.time-f.time)*100}%" title="${move}s movement to next formation"></i>`);}
    if(f.status!=='approved'&&!api.readOnly()){
      if(index)el.insertAdjacentHTML('beforeend','<b class="timeline-handle start" data-drag-time="start" aria-hidden="true"></b>');
      if(to?.status!=='approved')el.insertAdjacentHTML('beforeend','<b class="timeline-handle end" data-drag-time="end" aria-hidden="true"></b>');
    }
  });
  const rowHeight=globalThis.matchMedia?.('(pointer: coarse)')?.matches?50:34,packed=packMovementRows(api.project().actions),lane=$('.movement-lane'),label=$('.track-name.movement-track');if(lane){lane.style.setProperty('height',packed.count*rowHeight+'px','important');label?.style.setProperty('height',packed.count*rowHeight+'px','important');}
  area.querySelectorAll('.movement-lane>button').forEach(el=>{
    el.dataset.timelineKind='movement';el.dataset.timelineId=el.dataset.id;el.style.top=`${5+(packed.rows.get(el.dataset.id)||0)*rowHeight}px`;
    el.setAttribute('aria-label',el.title||el.textContent);
    el.insertAdjacentHTML('afterbegin','<span class="timeline-body-grip" data-reorder-grip title="Drag movement" aria-hidden="true">⠿</span>');
    if(!api.readOnly())el.insertAdjacentHTML('beforeend','<b class="timeline-handle start" data-drag-time="start" aria-hidden="true"></b><b class="timeline-handle end" data-drag-time="end" aria-hidden="true"></b>');
  });
  area.querySelectorAll('.cue-marker').forEach(el=>{el.dataset.timelineKind='cue';el.dataset.timelineId=el.dataset.cue;el.setAttribute('aria-label',el.title);el.insertAdjacentHTML('afterbegin','<span class="cue-grip" data-reorder-grip aria-hidden="true">⠿</span>');});
  timelineListen(scroll,'scroll',()=>{const labels=$('.track-labels');if(labels)labels.style.transform=`translateY(${-scroll.scrollTop}px)`;});
  observer?.disconnect();const ruler=()=>{
    const width=area.clientWidth,p=api.project(),desired=p.duration/Math.max(1,width/65),step=[1,2,4,8,16,30,60,120,240,300,600,1200,3600].find(s=>s>=desired)||3600;
    $('#time-ruler').innerHTML=Array.from({length:Math.floor(p.duration/step)+1},(_,i)=>`<span style="left:${i*step/p.duration*100}%">${timecode(i*step)}</span>`).join('');$('#time-ruler').style.backgroundImage=width*60/p.bpm/p.duration<6?'none':'';
  };ruler();observer=observeSize(area,ruler);markSelection();
  let suppressUntil=0,floating,guide;
  const blocks=new Map([...area.querySelectorAll('[data-timeline-id]')].map(el=>[el.dataset.timelineKind+'/'+el.dataset.timelineId,el]));
  const originals=new Map([...blocks].map(([id,el])=>[id,{left:el.style.left,width:el.style.width}]));
  const labels=new Map<string,{index?:HTMLElement;duration?:HTMLElement;move?:HTMLElement;indexText?:string;durationText?:string;moveWidth?:string}>(api.project().formations.map(f=>{const el=blocks.get('formation/'+f.id),index=el.querySelector('.sequence-index'),duration=el.querySelector('.sequence-duration'),move=el.querySelector('.sequence-move-window');return [f.id,{index,duration,move,indexText:index?.textContent,durationText:duration?.textContent,moveWidth:move?.style.width}];}));
  const restore=()=>{for(const [id,style] of originals){const el=blocks.get(id);el.style.left=style.left;el.style.width=style.width;el.classList.remove('timeline-dragging');el.removeAttribute('data-drop-slot');}for(const label of labels.values()){if(label.index)label.index.textContent=label.indexText;if(label.duration)label.duration.textContent=label.durationText;if(label.move)label.move.style.width=label.moveWidth;}};
  const feedback=(message,error=false)=>{if(status.textContent!==message)status.textContent=message;status.hidden=!message;status.classList.toggle('is-error',error);};
  const pointer=g=>{
    if(!floating){floating=document.createElement('div');floating.className='timeline-floating';floating.setAttribute('aria-hidden','true');floating.textContent=timelineItem(g.project,g.kind,g.id).name||timelineItem(g.project,g.kind,g.id).label;floating.style.top=Math.max(4,g.item.getBoundingClientRect().top-12)+'px';document.body.append(floating);guide=document.createElement('div');guide.className='timeline-drop-guide';guide.setAttribute('aria-hidden','true');area.append(guide);area.classList.add('gesture-active');area.classList.toggle('reordering',g.edge==='reorder');}
    floating.style.top=Math.max(4,Math.min(innerHeight-52,g.clientY-48))+'px';floating.style.transform=`translate3d(${Math.max(4,Math.min(innerWidth-194,g.clientX-60))}px,0,0)`;
  };
  const activate=(kind,id)=>{
    rememberClipSelection(kind,id);
    const double=lastTap?.id===id&&lastTap?.kind===kind&&performance.now()-lastTap.at<400;lastTap=double?null:{kind,id,at:performance.now()};
    if(double)api.details(kind,id);else if(kind==='formation')api.selectFormation(id);else markSelection();
  };
  gestureController=bindTimelineGestures(area,scroll,{
    project:()=>api.project(),time:()=>api.time(),readOnly:()=>api.readOnly(),pause:()=>api.pause(),snap:()=>snap,mode:()=>dragMode,
    active:value=>{if(value){resizeController?.cancel();document.dispatchEvent(new Event('timeline-cancel-production'));}dragging=value;},
    select(kind,id){rememberClipSelection(kind,id);markSelection();focusTimeline();},pointer,
    suppressClick(){suppressUntil=performance.now()+350;lastTap=null;},
    tap(g){if(g.kind){suppressUntil=performance.now()+250;activate(g.kind,g.id);}else focusTimeline();},
    preview(g,{magnetic}){
      const p=g.candidate,el=blocks.get(g.kind+'/'+g.id);let at,end;
      syncRelatedTiming(p,g.project.duration);
      floating?.classList.remove('is-error');
      if(g.kind==='formation'){
        p.formations.forEach((f,index)=>{const block=blocks.get('formation/'+f.id),span=(p.formations[index+1]?.time??p.duration)-f.time,label=labels.get(f.id);if(block){block.style.left=`${f.time/g.project.duration*100}%`;block.style.width=`${span/g.project.duration*100}%`;}if(label?.index)label.index.textContent=String(index+1).padStart(2,'0');if(label?.duration)label.duration.textContent=`${+span.toFixed(3)}s`;if(label?.move)label.move.style.width=`${Math.min(f.transition?.duration??p.transitionDuration,span)/span*100}%`;});
        const index=p.formations.findIndex(f=>f.id===g.id),f=p.formations[index];at=g.edge==='end'?(p.formations[index+1]?.time??p.duration):f.time;end=p.formations[index+1]?.time??p.duration;
        if(g.edge==='reorder'){el.dataset.dropSlot=String(index+1);const routes=reorderImpact(g.project,p).removedRoutes.length;feedback(`Drop as sequence ${index+1} of ${p.formations.length} · ${f.time.toFixed(3)}s${routes?' · '+routes+' custom routes need review':''}`);}
        else feedback(`${g.edge==='end'?'End':'Start'} ${at.toFixed(3)}s · interval ${(end-f.time).toFixed(3)}s · ${magnetic.label}`);
      }else if(g.kind==='movement'){
        const a=p.actions.find(a=>a.id===g.id);at=g.edge==='end'?a.end:a.start;el.style.left=`${a.start/g.project.duration*100}%`;el.style.width=`${(a.end-a.start)/g.project.duration*100}%`;feedback(`${a.start.toFixed(3)}–${a.end.toFixed(3)}s · duration ${(a.end-a.start).toFixed(3)}s · ${magnetic.label}`);
      }else{at=p.cues.find(c=>c.id===g.id).time;el.style.left=`${at/g.project.duration*100}%`;feedback(`Cue ${at.toFixed(3)}s · ${magnetic.label}`);}
      if(guide){guide.style.display='';guide.style.left=`${at/g.project.duration*100}%`;}el.classList.add('timeline-dragging');
    },
    invalid(g,message){restore();floating?.classList.add('is-error');if(guide)guide.style.display='none';feedback(message,true);},
    clear(){restore();syncRelatedTiming(api.project());floating?.remove();guide?.remove();floating=guide=null;area.classList.remove('gesture-active','reordering');feedback('');},
    cancel(g,message){lastTap=null;if(message)api.toast(message);},
    commit(g){
      if(g.edge==='reorder'){requestSequenceReorder(g.candidate,g.id);return;}
      const f=g.kind==='formation'?g.candidate.formations.find(f=>f.id===g.id):null;
      api.replace(g.candidate,'Timeline edit saved. Undo is available.',{formationId:f?.id,time:f?.time});focusTimeline();
    },scrub:value=>api.seek(value,false)
  });
  timelineListen(area,'click',event=>{
    const item=event.target.closest('[data-timeline-kind]');if(!item)return;event.preventDefault();event.stopImmediatePropagation();
    if(performance.now()<suppressUntil)return;
    activate(item.dataset.timelineKind,item.dataset.timelineId);
  },true);
  timelineListen(area,'contextmenu',event=>{const item=event.target.closest('[data-timeline-kind]');if(!item)return;event.preventDefault();gestureController.cancel();rememberClipSelection(item.dataset.timelineKind,item.dataset.timelineId);markSelection();clipTools();});
  zoomController=(value,clientX,centerTime)=>{
    const rect=scroll.getBoundingClientRect(),offset=clientX===undefined?scroll.clientWidth/2:clamp(clientX-rect.left,0,scroll.clientWidth),ratio=(scroll.scrollLeft+offset)/Math.max(1,area.offsetWidth);
    zoom=clamp(value,1,32);area.style.width=`${zoom*100}%`;scroll.scrollLeft=Number.isFinite(centerTime)?centerTime/api.project().duration*area.offsetWidth-scroll.clientWidth/2:ratio*area.offsetWidth-offset;ruler();
    controls.querySelector<HTMLElement>('[data-timeline-action="zoom-fit"]').textContent=`${Math.round(zoom*100)}%`;
    (controls.querySelector<HTMLElement>('[data-timeline-action="zoom-out"]') as HTMLButtonElement).disabled=zoom<=1;
    (controls.querySelector<HTMLElement>('[data-timeline-action="zoom-in"]') as HTMLButtonElement).disabled=zoom>=32;
  };
  zoomController(zoom);
  const idle=()=>!dragging&&!area.querySelector('.timeline-event-active');
  timelineListen(area,'wheel',event=>{
    const delta=wheelPixels(event,scroll.clientHeight);
    if(event.ctrlKey||event.metaKey){event.preventDefault();if(idle())zoomController(zoom*Math.exp(clamp(-delta.y*.002,-.3,.3)),event.clientX);}
    else if(event.shiftKey&&delta.y){event.preventDefault();if(idle())scroll.scrollLeft+=delta.y;}
    // Over the tracks a mouse wheel moves through time, as in native timeline
    // editors (the track-name column scrolls tracks vertically, below);
    // trackpads keep their own two-axis scrolling.
    else if(delta.y&&!delta.x&&!timelineWheel(event)){event.preventDefault();if(idle())scroll.scrollLeft+=delta.y;}
  },{passive:false});
  // The track-name column mirrors the tracks' vertical scroll with a
  // transform, so it needs its own wheel handling to scroll them.
  const trackNames=$('.track-labels');
  if(trackNames)timelineListen(trackNames,'wheel',event=>{if(event.ctrlKey||event.metaKey)return;const delta=wheelPixels(event,scroll.clientHeight),dy=delta.y||delta.x;if(!dy||scroll.scrollHeight<=scroll.clientHeight)return;event.preventDefault();scroll.scrollTop+=dy;},{passive:false});
  // Safari trackpad pinch and two-finger touch pinch zoom around the fingers.
  bindGesturePinch(area,(factor,clientX)=>{if(idle()&&zoomController)zoomController(zoom*factor,clientX);},{listen:timelineListen});
  let pinchStart=zoom;
  bindTouchPinch(scroll,{start(){gestureController?.cancel();pinchStart=zoom;},change(scale,centerX){if(zoomController&&!area.querySelector('.timeline-event-active'))zoomController(pinchStart*scale,centerX);}},{listen:timelineListen});
  // Touch long-press on a clip opens its tools (iOS has no touch contextmenu).
  bindLongPress(area,{selector:'[data-timeline-kind]',ignore:'[data-reorder-grip],[data-drag-time]',onPress(item){if(dragging)return;rememberClipSelection(item.dataset.timelineKind,item.dataset.timelineId);markSelection();clipTools();}},{listen:timelineListen});
}
