import {icon} from './icons.js';
import {timelineToolButtons,magneticTime,reorderImpact,timelineFingerprint} from './timeline-tools.js';
import {observeSize} from './compat.js';
import {clone,clamp,timecode} from './engine.js';

import {editTimeline,reorderFormation,snappedTime,timelineItem,copyTimelineItem,pasteTimelineItem,duplicateTimelineItem,splitTimelineItem,removeTimelineItem,packMovementRows} from './timeline-model.js';

const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let api,selection,clipboard,pendingRemoval,pendingReorder,zoom=1,snap='beat',dragMode='reorder',height=null,observer,dragging=false,lastTap=null;

const keyFor=kind=>({formation:'formations',movement:'actions',cue:'cues'})[kind];

export function rememberClipSelection(kind,id){if(api)selection={projectId:api.project().id,kind,id};}

function current(){const p=api.project();if(selection?.projectId===p.id){try{timelineItem(p,selection.kind,selection.id);return selection;}catch{}}return {projectId:p.id,kind:'formation',id:api.formation().id};}
export function timelineSelection(){return api?{...current()}:null;}
export function resetTimelineSize(){height=null;}

const selectedItem=()=>{const s=current();return timelineItem(api.project(),s.kind,s.id);};

const actionButton=(action,label,disabled=false)=>`<button class="button" type="button" data-timeline-action="${action}" ${disabled?'disabled':''}>${label}</button>`;

function markSelection(){const s=current();document.querySelectorAll('[data-timeline-id]').forEach(el=>{const chosen=el.dataset.timelineKind===s.kind&&el.dataset.timelineId===s.id;el.classList.toggle('clip-selected',chosen);el.setAttribute('aria-pressed',String(chosen));});refreshTimelineTools();}
export function refreshTimelineTools(){if(!api)return;const s=current(),item=selectedItem(),point=s.kind==='cue',locked=s.kind==='formation'&&item.status==='approved',opening=s.kind==='formation'&&item.time===0,end=point?item.time:s.kind==='formation'?api.project().formations[api.project().formations.indexOf(item)+1]?.time??api.project().duration:item.end,start=s.kind==='movement'?item.start:item.time; document.querySelectorAll('.timeline-quick').forEach(button=>{const command=button.dataset.timelineAction;let reason='';if(command!=='copy'&&api.readOnly())reason='Read-only snapshot';else if(command==='paste'&&(!clipboard||clipboard.projectId!==api.project().id))reason='Copy a clip in this project first';else if(['split','trim-start','trim-end'].includes(command)&&point)reason='Cues are point events';else if(['split','delete','cut','trim-start','trim-end'].includes(command)&&locked)reason='Unlock the approved formation first';else if(['delete','cut','trim-start'].includes(command)&&opening)reason='Keep the opening formation';else if(command==='split'&&(api.time()<=start+.099||api.time()>=end-.099))reason='Place the playhead inside this clip';button.disabled=!!reason;button.title=(button.getAttribute('aria-label')||command)+(reason?' · '+reason:'');});const name=$('#timeline-selection');if(name)name.textContent=`${s.kind} · ${item.name||item.label}`;
}


function focusTimeline(){$('.timeline')?.focus({preventScroll:true});}

export function setupTimeline(adapter){

  api=adapter;

  document.addEventListener('click',event=>{

    const button=event.target.closest('[data-timeline-action]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();

    try{runTimelineCommand(button.dataset.timelineAction);}catch(error){api.toast(error.message);}

  },true);

  document.addEventListener('change',event=>{

    if(event.target.id==='timeline-snap')snap=event.target.value;
    if(event.target.id==='timeline-drag-mode'){dragMode=event.target.value;api.render();}

    if(event.target.id==='clip-select'){const [kind,id]=event.target.value.split('/');rememberClipSelection(kind,id);clipTools();markSelection();}

    if(event.target.id==='clip-playhead'){const value=Number(event.target.value);if(Number.isFinite(value)){api.seek(value);markSelection();}}

  });

  document.addEventListener('submit',event=>{

    if(event.target.id!=='timeline-trim-form')return;event.preventDefault();event.stopImmediatePropagation();if(api.readOnly())return;

    try{const data=new FormData(event.target),s=current(),next=editTimeline(api.project(),{...s,edge:data.get('edge'),value:Number(data.get('time'))});api.replace(next,'Clip trimmed. Undo is available.');api.close();}catch(error){api.toast(error.message);}

  },true);

  document.addEventListener('keydown',event=>{

    if(event.target.matches('input,textarea,select')||$('#dialog').open||!event.target.closest('.timeline'))return;

    if(event.key==='Escape'&&dragging){event.preventDefault();event.stopImmediatePropagation();$('#timeline-tracks')?.dispatchEvent(new Event('cancel-timeline-gesture'));return;}
    if(dragging){event.preventDefault();event.stopImmediatePropagation();return;}
    const mod=event.ctrlKey||event.metaKey,key=event.key.toLowerCase();let command;

    if(mod&&key==='d')command='duplicate';else if(mod&&key==='c')command='copy';else if(mod&&key==='x')command='cut';else if(mod&&key==='v')command='paste';else if(!mod&&key==='s')command='split';else if(key==='delete'||key==='backspace')command='delete';

    if(command){event.preventDefault();event.stopImmediatePropagation();try{runTimelineCommand(command);}catch(error){api.toast(error.message);}}

    else if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();api.seek(event.key==='Home'?0:event.key==='End'?api.project().duration:api.time()+(event.key==='ArrowLeft'?-1:1)*60/api.project().bpm*(event.shiftKey?4:1));focusTimeline();}

  },true);

}

export function confirmTimelineRemoval(kind,id,operation='delete'){

  if(api.readOnly())return;

  const p=api.project(),item=timelineItem(p,kind,id);removeTimelineItem(p,kind,id);

  pendingRemoval={projectId:p.id,kind,id,operation};

  api.dialog(`${operation==='cut'?'Cut':'Delete'} this ${kind}?`,`<p class="modal-intro"><strong>${esc(item.name||item.label)}</strong> will be removed from the timeline.${kind==='formation'?' Its incoming and outgoing route overrides will also be removed. Other formation times stay in place.':''}</p><p class="field-help">${operation==='cut'?'A copy will stay in the project clipboard for pasting. ':''}Undo restores this edit.</p><div class="modal-footer">${actionButton('cancel-remove','Keep '+kind)}<button class="button danger-fill" data-timeline-action="confirm-remove">${operation==='cut'?'Cut':'Delete'} ${kind}</button></div>`);

}

function applyResult(result,message){api.replace(result.project,message,{formationId:result.kind==='formation'?result.item.id:undefined,time:result.item.time??result.item.start});rememberClipSelection(result.kind,result.item.id);api.close();markSelection();focusTimeline();}

export function requestSequenceReorder(next,id,after){
 if(api.readOnly())return false;const currentProject=api.project(),impact=reorderImpact(currentProject,next),formation=next.formations.find(f=>f.id===id);if(!formation)throw Error('Choose an existing formation.');if(!impact.changed){api.render();return false;}
 if(!impact.removedRoutes.length){api.replace(next,'Sequence reordered. Time slots stay fixed. Undo is available.',{formationId:id,time:formation.time});after?.();return true;}
 pendingReorder={before:timelineFingerprint(currentProject),next,id,time:formation.time,after};api.render();api.dialog('Review sequence reorder',`<p class="modal-intro">Moving <strong>${esc(formation.name)}</strong> changes ${impact.removedRoutes.length} custom performer route${impact.removedRoutes.length===1?'':'s'} between formations that are no longer adjacent. New transitions use formation defaults. Time slots stay fixed; prop events, checkpoints and cues keep their times.</p><p class="field-help">New order: ${next.formations.map(f=>esc(f.name)).join(' → ')}</p><div class="modal-footer">${actionButton('cancel-reorder','Keep original order')}${actionButton('confirm-reorder','Apply reorder')}</div>`);return false;
}

export function runTimelineCommand(command,override){

  if(override)rememberClipSelection(override.kind,override.id);

  const p=api.project(),s=current();

  if(command==='confirm-reorder'){const pending=pendingReorder;pendingReorder=null;if(!pending||timelineFingerprint(api.project())!==pending.before)throw Error('The project changed. Drag the formation again.');api.replace(pending.next,'Sequence reordered. Affected route overrides rebuilt; Undo is available.',{formationId:pending.id,time:pending.time});api.close();pending.after?.();return;}
  if(command==='cancel-reorder'){pendingReorder=null;api.close();return;}
  if(command==='tools'){clipTools();return;}

  if(command==='timing'){api.timingDialog(s);return;}
  if(command==='transition'){api.transitionDialog(s.kind==='formation'?s.id:undefined);return;}

  if(command==='details'){api.details(s.kind,s.id);return;}

  if(command==='copy'){clipboard=copyTimelineItem(p,s.kind,s.id);api.toast('Clip copied inside this project. Paste at a free playhead time.');if($('#clip-select'))clipTools();return;}

  if(command==='cancel-remove'){pendingRemoval=null;api.close();return;}

  if(command==='zoom-in'||command==='zoom-out'||command==='zoom-fit'){const scroll=$('.timeline-scroll'),old=scroll?.scrollWidth||1,anchor=scroll?(scroll.scrollLeft+scroll.clientWidth/2)/old:0;zoom=command==='zoom-fit'?1:clamp(zoom*(command==='zoom-in'?1.5:1/1.5),1,32);api.render();const next=$('.timeline-scroll');if(next)next.scrollLeft=anchor*next.scrollWidth-next.clientWidth/2;return;}

  if(api.readOnly())return api.toast('This rehearsal snapshot is read-only.');

  if(command==='delete'||command==='cut'){confirmTimelineRemoval(s.kind,s.id,command);return;}

  if(command==='confirm-remove'){

    const pending=pendingRemoval;if(!pending||pending.projectId!==p.id)throw Error('The selected project changed. Choose the clip again.');

    const copied=pending.operation==='cut'?copyTimelineItem(p,pending.kind,pending.id):null;

    const next=removeTimelineItem(p,pending.kind,pending.id);api.replace(next,`${pending.kind} ${pending.operation==='cut'?'cut to clipboard':'deleted'}. Undo is available.`);if(copied)clipboard=copied;pendingRemoval=null;selection=null;api.close();return;

  }

  if(command==='duplicate'){applyResult(duplicateTimelineItem(p,s.kind,s.id),'Clip duplicated. Drag it to refine the timing.');return;}

  if(command==='split'){applyResult(splitTimelineItem(p,s.kind,s.id,api.time()),s.kind==='formation'?'Formation split at the sampled pose. Transitions rebuilt; route overrides on this interval removed.':'Movement split at the playhead.');return;}

  if(command==='paste'){applyResult(pasteTimelineItem(p,clipboard,api.time()),'Clip pasted at the playhead.');return;}

  if(command==='trim-start'||command==='trim-end')trimDialog(command==='trim-end'?'end':'start');

}

function clipTools(){

  const p=api.project(),s=current(),item=selectedItem(),point=s.kind==='cue',locked=s.kind==='formation'&&item.status==='approved';

  api.dialog('Edit the performance, one moment at a time.',`<label class="field">Selected clip<select id="clip-select">${[['formation','formations'],['movement','actions'],['cue','cues']].flatMap(([kind,key])=>p[key].map(item=>`<option value="${kind}/${item.id}" ${kind===s.kind&&item.id===s.id?'selected':''}>${kind} · ${esc(item.name||item.label)}</option>`)).join('')}</select></label><div class="clip-summary"><strong>${esc(item.name||item.label)}</strong><span>${s.kind} · ${point?item.time+'s':s.kind==='movement'?`${item.start}–${item.end}s`:`${item.time}–${p.formations[p.formations.indexOf(item)+1]?.time??p.duration}s`} ${locked?'· approved':''}</span></div><label class="field">Playhead / split / paste time (seconds)<input id="clip-playhead" type="number" min="0" max="${p.duration}" step=".001" value="${api.time().toFixed(3)}"></label><div class="clip-command-grid">${actionButton('duplicate','Duplicate',api.readOnly())}${actionButton('split','Split at playhead',point||locked||api.readOnly())}${actionButton('trim-start','Trim start',point||locked||api.readOnly()||s.kind==='formation'&&item.time===0)}${actionButton('trim-end','Trim end',point||locked||api.readOnly())}${actionButton('copy','Copy')}${actionButton('paste','Paste at playhead',api.readOnly()||!clipboard||clipboard.projectId!==p.id)}${actionButton('cut','Cut to clipboard',locked||api.readOnly()||s.kind==='formation'&&item.time===0)}${actionButton('delete','Delete…',locked||api.readOnly()||s.kind==='formation'&&item.time===0)}${s.kind==='formation'?actionButton('transition','Movement timing'):''}${actionButton('details','Edit details')}${actionButton('timing','Exact timing')}</div><p class="field-help">Use Drag → Reorder to move whole formation sequences across the timeline; Retime adjusts starts within neighboring boundaries. Handles trim either edge. Select a clip with one click; double-click for details. Right-click opens these tools. Timeline focus: Ctrl/⌘ D duplicates, Ctrl/⌘ C/X/V copies/cuts/pastes, S splits, Delete asks before removal. Split formations use the pose at the playhead and rebuild transitions.</p>`,true);

}

function trimDialog(edge){const p=api.project(),s=current(),item=selectedItem();if(s.kind==='cue')throw Error('Cues are point events. Edit their time instead.');const value=s.kind==='movement'?item[edge]:edge==='start'?item.time:p.formations[p.formations.indexOf(item)+1]?.time??p.duration;

  api.dialog('Trim with precision.',`<form id="timeline-trim-form"><p class="modal-intro">${esc(item.name)}. Formation clips share boundaries with their neighbors. The last formation’s end controls the performance duration and cannot cut off existing movements, cues, or notes.</p><label class="field">Edge<select name="edge"><option value="start" ${edge==='start'?'selected':''}>Start</option><option value="end" ${edge==='end'?'selected':''}>End</option></select></label><label class="field">Time (seconds)<input name="time" type="number" min="0" max="${s.kind==='formation'?3600:p.duration}" step=".001" value="${value}" required></label><div class="modal-footer"><span>Undo restores the previous timing.</span><button class="button primary">Save trim</button></div></form>`);

}

export function bindEditorTimeline(){

  const timeline=$('.timeline'),area=$('#timeline-tracks'),scroll=$('.timeline-scroll');if(!area)return;

  timeline.tabIndex=0;timeline.setAttribute('aria-description','Select a clip, then use clip tools or timeline keyboard shortcuts.');

  if(height!==null){const safe=clamp(height,140,Math.max(140,innerHeight*.7));timeline.style.setProperty('height',safe+'px','important');timeline.style.setProperty('min-height',safe+'px','important');timeline.classList.add('manually-sized');}

  const resize=document.createElement('div');resize.className='timeline-resizer';resize.title='Drag to resize timeline; double-click to reset';resize.setAttribute('role','separator');resize.setAttribute('aria-label','Resize timeline');resize.setAttribute('aria-orientation','horizontal');resize.tabIndex=0;timeline.prepend(resize);

  resize.setAttribute('aria-valuemin','140');resize.setAttribute('aria-valuemax',String(Math.round(Math.max(140,innerHeight*.7))));resize.setAttribute('aria-valuenow',String(timeline.clientHeight));
  let resizing;resize.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();resize.setPointerCapture(event.pointerId);resizing={y:event.clientY,height:timeline.clientHeight};};resize.onpointermove=event=>{if(!resizing)return;height=clamp(resizing.height+resizing.y-event.clientY,140,Math.max(140,innerHeight*.7));timeline.style.setProperty('height',height+'px','important');timeline.style.setProperty('min-height',height+'px','important');timeline.classList.add('manually-sized');resize.setAttribute('aria-valuenow',String(Math.round(height)));};resize.onpointerup=()=>{if(resizing){resizing=null;api.setTimelineExpanded(true);api.render();}};resize.onpointercancel=()=>resizing=null;resize.ondblclick=()=>{height=null;api.setTimelineExpanded(false);api.render();};resize.onkeydown=event=>{if(['ArrowUp','ArrowDown','Home'].includes(event.key)){event.preventDefault();height=event.key==='Home'?null:clamp((height||timeline.clientHeight)+(event.key==='ArrowUp'?30:-30),140,Math.max(140,innerHeight*.7));api.setTimelineExpanded(event.key!=='Home');api.render();}};

  const controls=document.createElement('div');controls.className='timeline-editbar';controls.innerHTML=`<div><span class="timeline-icon-tools" role="toolbar" aria-label="Timeline editing commands">${timelineToolButtons()}<button data-power="sequence" title="Formation sequence" aria-label="Formation sequence">${icon('layers')}</button><button data-images="timeline" title="Preview images from selected timeline clip" aria-label="Preview images from selected timeline clip">${icon('camera')}</button><button data-power="loop-range" title="Set rehearsal loop range" aria-label="Set rehearsal loop range">${icon('loop')}</button></span><label class="drag-mode-label"><span>Drag</span><select id="timeline-drag-mode" aria-label="Formation drag mode"><option value="reorder" ${dragMode==='reorder'?'selected':''}>Reorder</option><option value="retime" ${dragMode==='retime'?'selected':''}>Retime</option></select></label><label><span>Snap</span><select id="timeline-snap" aria-label="Timeline snapping">${[['beat','Beat'],['half-beat','½ beat'],['second','Second'],['off','Off']].map(([v,l])=>`<option value="${v}" ${v===snap?'selected':''}>${l}</option>`).join('')}</select></label><span id="timeline-selection"></span></div><div><button data-timeline-action="zoom-out" aria-label="Zoom timeline out" title="Zoom timeline out">${icon('minus')}</button><button data-timeline-action="zoom-fit" title="Fit entire performance" aria-label="Fit entire timeline">${Math.round(zoom*100)}%</button><button data-timeline-action="zoom-in" aria-label="Zoom timeline in" title="Zoom timeline in">${icon('plus')}</button></div>`;timeline.insertBefore(controls,$('.timeline-body'));


  area.style.width=`${zoom*100}%`;area.style.minWidth='100%';area.style.setProperty('--beat-width',`${60/api.project().bpm/api.project().duration*100}%`);

  area.querySelectorAll('.timeline-formation').forEach((el,index)=>{const f=api.project().formations[index];el.dataset.timelineKind='formation';el.dataset.timelineId=f.id;el.insertAdjacentHTML('afterbegin','<span class="timeline-body-grip" data-reorder-grip title="Drag sequence" aria-hidden="true">⠿</span>');el.title=`${f.name} · ${f.time}s. Drag body to ${dragMode}; handles trim. Right-click for clip tools.`;const to=api.project().formations[index+1];if(to){const move=Math.min(f.transition?.duration??api.project().transitionDuration,to.time-f.time);el.insertAdjacentHTML('beforeend',`<i class="sequence-move-window" style="width:${move/(to.time-f.time)*100}%" title="${move}s movement to next formation"></i>`);}
    if(f.status!=='approved'&&!api.readOnly()){if(index)el.insertAdjacentHTML('beforeend','<b class="timeline-handle start" data-drag-time="start" aria-hidden="true">⋮</b>');el.insertAdjacentHTML('beforeend','<b class="timeline-handle end" data-drag-time="end" aria-hidden="true"></b>');}});

  const packed=packMovementRows(api.project().actions),lane=$('.movement-lane'),label=$('.track-name.movement-track');if(lane){lane.style.setProperty('height',packed.count*34+'px','important');label?.style.setProperty('height',packed.count*34+'px','important');}

  area.querySelectorAll('.movement-lane>button').forEach(el=>{el.dataset.timelineKind='movement';el.dataset.timelineId=el.dataset.id;el.style.top=`${5+(packed.rows.get(el.dataset.id)||0)*34}px`;el.insertAdjacentHTML('beforeend','<b class="timeline-handle start" data-drag-time="start" aria-hidden="true"></b><b class="timeline-handle end" data-drag-time="end" aria-hidden="true"></b>');});

  area.querySelectorAll('.cue-marker').forEach(el=>{el.dataset.timelineKind='cue';el.dataset.timelineId=el.dataset.cue;});

  scroll.addEventListener('scroll',()=>{const labels=$('.track-labels');if(labels)labels.style.transform=`translateY(${-scroll.scrollTop}px)`;});

  observer?.disconnect();const ruler=()=>{const width=area.clientWidth,p=api.project(),desired=p.duration/Math.max(1,width/65),step=[1,2,4,8,16,30,60,120,240,300,600,1200,3600].find(s=>s>=desired)||3600;$('#time-ruler').innerHTML=Array.from({length:Math.floor(p.duration/step)+1},(_,i)=>`<span style="left:${i*step/p.duration*100}%">${timecode(i*step)}</span>`).join('');$('#time-ruler').style.backgroundImage=width*60/p.bpm/p.duration<6?'none':'';};ruler();observer=observeSize(area,ruler);markSelection();

  let gesture=null,suppressUntil=0,autoFrame=0,floating,guide;
  const decorate=event=>{if(!gesture?.moved||!gesture.item)return;if(!floating){floating=document.createElement('div');floating.className='timeline-floating';floating.textContent=gesture.item.textContent;floating.style.top=Math.max(0,gesture.item.getBoundingClientRect().top-8)+'px';document.body.append(floating);guide=document.createElement('div');guide.className='timeline-drop-guide';guide.setAttribute('aria-hidden','true');area.append(guide);area.classList.add('gesture-active');}floating.style.left=Math.max(4,Math.min(innerWidth-190,event.clientX-70))+'px';};
  const clearDecorations=()=>{floating?.remove();guide?.remove();floating=null;guide=null;area.classList.remove('gesture-active');};

  const position=event=>clamp((event.clientX-area.getBoundingClientRect().left)/area.getBoundingClientRect().width,0,1)*api.project().duration;

  const preview=event=>{

    const g=gesture;if(!g)return;if(Math.abs(event.clientX-g.x)>4)g.moved=true;g.clientX=event.clientX;decorate(event);

    if(!g.kind){api.seek(position(event),false);return;}if(!g.moved)return;if(!g.editable){controls.dataset.status=api.readOnly()?'Read-only snapshot':g.start===0?'Opening stays at zero; drag its right edge to trim.':'Unlock this approved formation before retiming.';return;}

    const magnetic=magneticTime(g.edge==='move'?g.start+position(event)-g.at:position(event),g.project,{snap,playhead:api.time(),pixelsPerSecond:area.offsetWidth/g.project.duration}),value=magnetic.time;

    try{const target=g.edge==='reorder'?Math.max(0,Math.min(g.project.formations.length-1,g.project.formations.filter(f=>f.time<=position(event)).length-1)):null,token=g.edge==='reorder'?target:value;if(g.lastValue===token)return;g.lastValue=token;g.candidate=g.edge==='reorder'?reorderFormation(g.project,g.id,target):editTimeline(g.project,{kind:g.kind,id:g.id,edge:g.edge,value});

      const el=area.querySelector(`[data-timeline-id="${g.id}"]`);let at,length;

      if(g.kind==='formation'){

        g.candidate.formations.forEach((f,index)=>{const block=area.querySelector(`[data-timeline-id="${f.id}"]`);if(block){block.style.left=`${f.time/g.project.duration*100}%`;block.style.width=`${((g.candidate.formations[index+1]?.time??g.candidate.duration)-f.time)/g.project.duration*100}%`;}});at=g.edge==='end'?(g.candidate.formations[g.candidate.formations.findIndex(f=>f.id===g.id)+1]?.time??g.candidate.duration):g.candidate.formations.find(f=>f.id===g.id).time;

      }else if(g.kind==='movement'){const a=g.candidate.actions.find(a=>a.id===g.id);at=a.start;length=a.end-a.start;el.style.left=`${at/g.project.duration*100}%`;el.style.width=`${length/g.project.duration*100}%`;}

      else{at=g.candidate.cues.find(c=>c.id===g.id).time;el.style.left=`${at/g.project.duration*100}%`;}

      if(guide)guide.style.left=`${(g.edge==='reorder'?g.project.formations[target].time:at)/g.project.duration*100}%`;el.classList.add('timeline-dragging');controls.dataset.status=g.edge==='reorder'?`Drop into sequence ${g.candidate.formations.findIndex(f=>f.id===g.id)+1} · ${reorderImpact(g.project,g.candidate).removedRoutes.length} route overrides affected`:`${g.kind} ${g.edge} · ${at.toFixed(3)}s · ${magnetic.label}`;

    }catch(error){g.candidate=null;g.lastValue=null;controls.dataset.status=error.message;}

  };

  const autoScroll=()=>{const g=gesture;if(!g||!g.moved)return;const rect=scroll.getBoundingClientRect(),delta=g.clientX<rect.left+28?-12:g.clientX>rect.right-28?12:0;if(delta){const before=scroll.scrollLeft;scroll.scrollLeft+=delta;if(scroll.scrollLeft!==before)preview({clientX:g.clientX});}autoFrame=requestAnimationFrame(autoScroll);};

  area.addEventListener('pointerdown',event=>{

    if(event.button!==0)return;const item=event.target.closest('[data-timeline-kind]'),kind=item?.dataset.timelineKind,id=item?.dataset.timelineId,edge=event.target.closest('[data-drag-time]')?.dataset.dragTime||(kind==='formation'&&dragMode==='reorder'?'reorder':'move');

    if(event.pointerType==='touch'&&item?.dataset.timelineKind==='formation'&&!event.target.closest('[data-reorder-grip],[data-drag-time]'))return;
    api.pause();const p=api.project();if(item){rememberClipSelection(kind,id);markSelection();}

    const value=item?timelineItem(p,kind,id):null,start=kind==='movement'?value.start:value?.time||0;

    const editable=!api.readOnly()&&!(kind==='formation'&&(value.status==='approved'||value.time===0&&edge!=='end'&&edge!=='reorder'));

    gesture={item,kind,id,edge,x:event.clientX,clientX:event.clientX,at:position(event),start,project:clone(p),candidate:null,moved:false,editable};dragging=true;

    area.setPointerCapture(event.pointerId);if(item){event.preventDefault();focusTimeline();}else api.seek(position(event),false);

  });

  area.addEventListener('pointermove',event=>{if(!gesture)return;preview(event);if(gesture.moved&&!autoFrame)autoFrame=requestAnimationFrame(autoScroll);});

  const finish=cancel=>{if(!gesture)return;const g=gesture;gesture=null;dragging=false;cancelAnimationFrame(autoFrame);autoFrame=0;clearDecorations();

    if(g.moved)suppressUntil=performance.now()+350;if(g.moved||cancel)lastTap=null;

    if(!cancel&&g.moved&&g.candidate&&timelineFingerprint(g.project)!==timelineFingerprint(api.project())){api.render();api.toast('The score changed during the drag. Please drag again.');return;}
    if(!cancel&&g.moved&&g.candidate){const f=g.kind==='formation'?g.candidate.formations.find(f=>f.id===g.id):null,impact=g.edge==='reorder'?reorderImpact(g.project,g.candidate):null;
      if(impact&&!impact.changed){api.render();return;}
      if(g.edge==='reorder'){requestSequenceReorder(g.candidate,f.id);return;}
      api.replace(g.candidate,g.edge==='reorder'?'Sequence reordered. Time slots stay fixed. Undo is available.':'Timeline edit saved. Undo is available.',{formationId:f?.id,time:f?.time});}


    else if(!cancel&&!g.moved&&g.kind){
      const double=lastTap?.id===g.id&&performance.now()-lastTap.at<400;lastTap=double?null:{id:g.id,at:performance.now()};
      if(double){api.details(g.kind,g.id);return;}
      if(g.kind==='formation')api.selectFormation(g.id);else markSelection();
    }else api.render();focusTimeline();

  };

  area.addEventListener('cancel-timeline-gesture',()=>finish(true));area.addEventListener('pointerup',()=>finish(false));area.addEventListener('pointercancel',()=>finish(true));area.addEventListener('lostpointercapture',()=>{if(gesture)finish(true);});

  area.addEventListener('click',event=>{const item=event.target.closest('[data-timeline-kind]');if(item||performance.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();if(item){rememberClipSelection(item.dataset.timelineKind,item.dataset.timelineId);if(item.dataset.timelineKind==='formation'&&performance.now()>=suppressUntil)api.selectFormation(item.dataset.timelineId);else markSelection();}}},true);

  area.addEventListener('dblclick',event=>{const item=event.target.closest('[data-timeline-kind]');if(!item)return;event.preventDefault();event.stopImmediatePropagation();if(!$('#dialog').open){rememberClipSelection(item.dataset.timelineKind,item.dataset.timelineId);api.details(item.dataset.timelineKind,item.dataset.timelineId);}},true);

  area.addEventListener('contextmenu',event=>{const item=event.target.closest('[data-timeline-kind]');if(!item)return;event.preventDefault();rememberClipSelection(item.dataset.timelineKind,item.dataset.timelineId);markSelection();clipTools();});

  area.addEventListener('wheel',event=>{if(!event.ctrlKey&&!event.metaKey)return;event.preventDefault();if(dragging)return;const rect=scroll.getBoundingClientRect(),ratio=(scroll.scrollLeft+event.clientX-rect.left)/area.offsetWidth;zoom=clamp(zoom*(event.deltaY<0?1.15:1/1.15),1,32);area.style.width=`${zoom*100}%`;scroll.scrollLeft=ratio*area.offsetWidth-(event.clientX-rect.left);controls.querySelector('[data-timeline-action="zoom-fit"]').textContent=`${Math.round(zoom*100)}%`;},{passive:false});

}

