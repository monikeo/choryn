import {clone,clamp,timecode} from './engine.js';
import {editTimeline,reorderFormation,snappedTime} from './timeline-model.js';
import {videoSettings,supportedVideoFormats,recordVideo} from './video.js';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let api,timelineZoom=1,timelineSnap='beat',exportJob,videoURL,exportBlob,exportName,sequenceDragged,sequencePointer,timelineObserver,full=false,nativeFull=false;
const button=(action,label)=>`<button class="button" type="button" data-power="${action}">${label}</button>`;
export function setupPower(adapter){
  api=adapter;
  document.addEventListener('click',async event=>{
    const node=event.target.closest('[data-power]');if(!node)return;event.preventDefault();event.stopImmediatePropagation();
    const action=node.dataset.power;
    try{
      if(action==='video')videoDialog();
      if(action==='cancel-video'){exportJob?.abort();}
      if(action==='download-video'&&exportBlob)api.download(exportBlob,exportName,exportBlob.type);
      if(action==='sequence')sequenceDialog();
      if(action==='cast-edit')castDialog();
      if(action==='timeline-edit')timingDialog();
      if(action==='loop-range')loopDialog();
      if(action==='fullscreen')await toggleFullscreen();
      if(action==='timeline-in'||action==='timeline-out'||action==='timeline-fit'){
        const scroll=$('.timeline-scroll'),old=scroll?.scrollWidth||1,anchor=scroll?(scroll.scrollLeft+scroll.clientWidth/2)/old:0;
        timelineZoom=action==='timeline-fit'?1:clamp(timelineZoom*(action==='timeline-in'?1.5:1/1.5),1,16);api.render();const next=$('.timeline-scroll');if(next)next.scrollLeft=anchor*next.scrollWidth-next.clientWidth/2;
      }
      if(action==='sequence-up'||action==='sequence-down'){
        const project=api.project(),index=project.formations.findIndex(f=>f.id===node.dataset.id),next=reorderFormation(project,node.dataset.id,index+(action==='sequence-up'?-1:1));
        api.replace(next,'Formation sequence updated. Existing time slots stay in place.');sequenceDialog();
      }
      if(action==='sequence-select'){api.selectFormation(node.dataset.id);api.close();}
      if(action==='duplicate'){api.duplicate();}
      if(action==='clear-loop'){api.clearLoop();api.close();}
    }catch(error){api.toast(error.message);}
  },true);
  document.addEventListener('change',event=>{if(event.target.id==='timeline-snap')timelineSnap=event.target.value;});
  document.addEventListener('submit',async event=>{
    const form=event.target,id=form.id;if(!['video-form','cast-customize','timing-form','loop-range-form'].includes(id))return;
    event.preventDefault();event.stopImmediatePropagation();const data=new FormData(form),project=api.project();
    try{
      if(id==='video-form'){await startVideo(data);return;}
      if(api.readOnly()&&id!=='loop-range-form')return;
      if(id==='timing-form'){
        const item=data.get('item').split('/');const next=editTimeline(project,{kind:item[0],id:item[1],edge:data.get('edge'),value:Number(data.get('time'))});api.replace(next,'Timeline updated.');api.close();
      }
      if(id==='loop-range-form'){const start=Number(data.get('start')),end=Number(data.get('end'));if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>project.duration||end-start<.25)throw Error('Choose a valid loop range of at least 0.25 seconds.');api.setLoop(start,end);api.close();}
      if(id==='cast-customize'){
        const ids=new Set(data.getAll('people'));if(!ids.size)throw Error('Select at least one performer.');
        const next=clone(project),group=String(data.get('group')).trim(),role=String(data.get('role')).trim(),tags=[...new Set(String(data.get('tags')).split(',').map(t=>t.trim()).filter(Boolean))];
        if(tags.length>12||tags.some(t=>t.length>30))throw Error('Use up to 12 tags, each at most 30 characters.');
        next.performers.forEach(person=>{if(!ids.has(person.id))return;if(group)person.group=group;if(role)person.role=role;if(data.has('set-color'))person.color=data.get('color');if(data.has('set-tags'))person.tags=tags;});
        api.replace(next,`${ids.size} performer profiles updated.`);api.close();
      }
    }catch(error){api.toast(error.message);}
  },true);
  document.addEventListener('dragstart',event=>{const row=event.target.closest('[data-sequence-row]');if(!row)return;sequenceDragged=row.dataset.sequenceRow;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',sequenceDragged);row.classList.add('dragging');});
  document.addEventListener('dragover',event=>{if(sequenceDragged&&event.target.closest('[data-sequence-row]')){event.preventDefault();event.dataTransfer.dropEffect='move';}});
  document.addEventListener('drop',event=>{const row=event.target.closest('[data-sequence-row]');if(!row||!sequenceDragged)return;event.preventDefault();try{api.replace(reorderFormation(api.project(),sequenceDragged,Number(row.dataset.index)),'Formation sequence reordered.');sequenceDialog();}catch(error){api.toast(error.message);}sequenceDragged=null;});
  document.addEventListener('dragend',()=>{sequenceDragged=null;document.querySelectorAll('.dragging').forEach(el=>el.classList.remove('dragging'));});
  document.addEventListener('pointerdown',event=>{
    const grip=event.target.closest('.sequence-grip'),row=grip?.closest('[data-sequence-row]');
    if(!row||api.readOnly()||event.button!==0)return;
    event.preventDefault();row.setPointerCapture(event.pointerId);sequencePointer={id:row.dataset.sequenceRow,y:event.clientY,index:Number(row.dataset.index),moved:false};
  });
  document.addEventListener('pointermove',event=>{
    if(!sequencePointer)return;event.preventDefault();if(Math.abs(event.clientY-sequencePointer.y)<5&&!sequencePointer.moved)return;
    sequencePointer.moved=true;const rows=[...document.querySelectorAll('[data-sequence-row]')];let distance=Infinity;
    rows.forEach(row=>{const rect=row.getBoundingClientRect(),d=Math.abs(event.clientY-(rect.top+rect.height/2));if(d<distance){distance=d;sequencePointer.index=Number(row.dataset.index);}});
    rows.forEach(row=>row.classList.toggle('sequence-drop-target',Number(row.dataset.index)===sequencePointer.index));
    const body=$('#dialog .modal-body'),rect=body.getBoundingClientRect();if(event.clientY<rect.top+30)body.scrollTop-=16;else if(event.clientY>rect.bottom-30)body.scrollTop+=16;
  },{passive:false});
  const finishSequence=cancel=>{if(!sequencePointer)return;const gesture=sequencePointer;sequencePointer=null;document.querySelectorAll('.sequence-drop-target').forEach(el=>el.classList.remove('sequence-drop-target'));if(cancel||!gesture.moved)return;try{api.replace(reorderFormation(api.project(),gesture.id,gesture.index),'Formation sequence reordered.');sequenceDialog();}catch(error){api.toast(error.message);}};
  document.addEventListener('pointerup',()=>finishSequence(false));document.addEventListener('pointercancel',()=>finishSequence(true));
  $('#dialog').addEventListener('close',()=>{exportJob?.abort();if(videoURL){URL.revokeObjectURL(videoURL);videoURL=null;}exportBlob=null;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&full){event.preventDefault();toggleFullscreen();}if(event.key.toLowerCase()==='f'&&!event.ctrlKey&&!event.metaKey&&!event.target.matches('input,textarea,select')&&!$('#dialog').open)toggleFullscreen();});
  document.addEventListener('fullscreenchange',()=>{if(nativeFull&&!document.fullscreenElement){full=false;nativeFull=false;document.body.classList.remove('stage-fullscreen');api.render();}});
}
async function toggleFullscreen(){full=!full;document.body.classList.toggle('stage-fullscreen',full);if(full&&matchMedia('(min-width:1024px)').matches&&!document.fullscreenElement&&document.documentElement.requestFullscreen){try{await document.documentElement.requestFullscreen();nativeFull=true;}catch{api.toast('Stage focus view opened. Browser fullscreen is unavailable here.');}}else if(!full&&document.fullscreenElement){await document.exitFullscreen();nativeFull=false;}api.render();}
export function bindPowerTimeline(){
  const timeline=$('.timeline'),area=$('#timeline-tracks'),scroll=$('.timeline-scroll');if(!area)return;
  const controls=document.createElement('div');controls.className='timeline-editbar';controls.innerHTML=`<div><button data-power="sequence">Sequence</button><button data-power="timeline-edit">Edit timing</button><button data-power="loop-range">Loop range</button><label>Snap <select id="timeline-snap" aria-label="Timeline snapping">${[['beat','Beat'],['half-beat','½ beat'],['second','Second'],['off','Off']].map(([v,l])=>`<option value="${v}" ${v===timelineSnap?'selected':''}>${l}</option>`).join('')}</select></label></div><div><button data-power="timeline-out" aria-label="Zoom timeline out">−</button><button data-power="timeline-fit" title="Fit entire performance">${Math.round(timelineZoom*100)}%</button><button data-power="timeline-in" aria-label="Zoom timeline in">+</button></div>`;
  timeline.insertBefore(controls,$('.timeline-body'));area.style.width=`${timelineZoom*100}%`;area.style.minWidth='100%';area.style.setProperty('--beat-width',`${60/api.project().bpm/api.project().duration*100}%`);
  area.querySelectorAll('.timeline-formation').forEach((el,index)=>{const formation=api.project().formations[index];el.dataset.timelineKind='formation';el.dataset.timelineId=formation.id;el.title=`${formation.name} · ${formation.time}s. Drag to retime; use Sequence to reorder.`;if(index&&formation.status!=='approved'&&!api.readOnly())el.insertAdjacentHTML('beforeend',`<b class="timeline-handle start" data-drag-time="start" aria-hidden="true">⋮</b>`);});
  area.querySelectorAll('.movement-lane>button').forEach(el=>{el.dataset.timelineKind='movement';el.dataset.timelineId=el.dataset.id;el.insertAdjacentHTML('beforeend','<b class="timeline-handle start" data-drag-time="start" aria-hidden="true"></b><b class="timeline-handle end" data-drag-time="end" aria-hidden="true"></b>');});
  area.querySelectorAll('.cue-marker').forEach(el=>{el.dataset.timelineKind='cue';el.dataset.timelineId=el.dataset.cue;});
  timelineObserver?.disconnect();
  const drawRuler=()=>{const width=area.clientWidth,duration=api.project().duration,desired=duration/Math.max(1,width/65),step=[1,2,4,8,16,30,60,120,240,300,600,1200,3600].find(s=>s>=desired)||3600;$('#time-ruler').innerHTML=Array.from({length:Math.floor(duration/step)+1},(_,i)=>`<span style="left:${i*step/duration*100}%">${timecode(i*step)}</span>`).join('');$('#time-ruler').style.backgroundImage=width*60/api.project().bpm/duration<6?'none':'';};
  drawRuler();timelineObserver=new ResizeObserver(drawRuler);timelineObserver.observe(area);
  let gesture=null,suppressClick=false;
  const position=event=>clamp((event.clientX-area.getBoundingClientRect().left)/area.getBoundingClientRect().width,0,1)*api.project().duration;
  area.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;const item=event.target.closest('[data-timeline-kind]'),edge=event.target.closest('[data-drag-time]')?.dataset.dragTime;
    if(item&&item.dataset.timelineKind==='formation'){const f=api.project().formations.find(f=>f.id===item.dataset.timelineId);if(f.time===0||f.status==='approved')return;}
    if(item&&api.readOnly())return;
    api.pause();const project=api.project(),kind=item?.dataset.timelineKind,id=item?.dataset.timelineId;
    const start=kind==='movement'?project.actions.find(a=>a.id===id).start:kind==='cue'?project.cues.find(c=>c.id===id).time:kind==='formation'?project.formations.find(f=>f.id===id).time:0;
    gesture={item,kind,id,edge:edge||'move',x:event.clientX,at:position(event),start,project:clone(project),candidate:null,moved:false,scroll:scroll.scrollLeft};
    area.setPointerCapture(event.pointerId);if(item)event.preventDefault();else api.seek(position(event),false);
  });
  area.addEventListener('pointermove',event=>{
    if(!gesture)return;const g=gesture;if(Math.abs(event.clientX-g.x)>4)g.moved=true;
    if(!g.kind){api.seek(position(event),false);return;}if(!g.moved)return;
    const rect=scroll.getBoundingClientRect();if(event.clientX<rect.left+24)scroll.scrollLeft-=12;if(event.clientX>rect.right-24)scroll.scrollLeft+=12;
    const value=snappedTime(g.edge==='move'?g.start+position(event)-g.at:position(event),g.project.bpm,timelineSnap);
    try{g.candidate=editTimeline(g.project,{kind:g.kind,id:g.id,edge:g.edge,value});
      const el=area.querySelector(`[data-timeline-id="${g.id}"]`);let at,length;
      if(g.kind==='formation'){const index=g.candidate.formations.findIndex(f=>f.id===g.id);at=g.candidate.formations[index].time;length=(g.candidate.formations[index+1]?.time??g.project.duration)-at;const previous=area.querySelector(`[data-timeline-id="${g.candidate.formations[index-1].id}"]`);previous.style.width=`${(at-g.candidate.formations[index-1].time)/g.project.duration*100}%`;}
      if(g.kind==='movement'){const action=g.candidate.actions.find(a=>a.id===g.id);at=action.start;length=action.end-at;}
      if(g.kind==='cue')at=g.candidate.cues.find(c=>c.id===g.id).time;
      el.style.left=`${at/g.project.duration*100}%`;if(length!==undefined)el.style.width=`${length/g.project.duration*100}%`;el.classList.add('timeline-dragging');el.title=`${at.toFixed(2)} seconds`;controls.dataset.status=`${g.kind} · ${at.toFixed(2)}s`;
    }catch(error){controls.dataset.status=error.message;}
  });
  const finish=(cancel=false)=>{if(!gesture)return;const g=gesture;gesture=null;suppressClick=g.moved;if(!cancel&&g.moved&&g.candidate)api.replace(g.candidate,'Timeline edit saved. Undo is available.');else if(!cancel&&!g.moved&&g.item){if(g.kind==='formation')api.selectFormation(g.id);else g.item.click();}else api.render();};
  area.addEventListener('pointerup',()=>finish());area.addEventListener('pointercancel',()=>finish(true));
  area.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopImmediatePropagation();suppressClick=false;}},true);
  area.addEventListener('wheel',event=>{if(!event.ctrlKey&&!event.metaKey)return;event.preventDefault();const rect=scroll.getBoundingClientRect(),ratio=(scroll.scrollLeft+event.clientX-rect.left)/area.offsetWidth;timelineZoom=clamp(timelineZoom*(event.deltaY<0?1.15:1/1.15),1,16);area.style.width=`${timelineZoom*100}%`;scroll.scrollLeft=ratio*area.offsetWidth-(event.clientX-rect.left);controls.querySelector('[data-power="timeline-fit"]').textContent=`${Math.round(timelineZoom*100)}%`;},{passive:false});
}
function sequenceDialog(){const p=api.project();api.dialog('Build the arc of your performance.',`<p class="modal-intro">Drag rows to reorder, or use the arrows. Time slots stay fixed; routes between separated formations are removed. Approved formations must be unlocked first.</p><div class="sequence-list">${p.formations.map((f,i)=>`<div data-sequence-row="${f.id}" data-index="${i}" draggable="${!api.readOnly()&&f.status!=='approved'}"><span class="sequence-grip" aria-hidden="true">⠿</span><button data-power="sequence-select" data-id="${f.id}"><strong>${String(i+1).padStart(2,'0')} · ${esc(f.name)}</strong><small>${timecode(f.time)} · ${(p.formations[i+1]?.time??p.duration)-f.time}s · ${f.status}</small></button><button data-power="sequence-up" data-id="${f.id}" aria-label="Move ${esc(f.name)} earlier" ${!i||api.readOnly()?'disabled':''}>↑</button><button data-power="sequence-down" data-id="${f.id}" aria-label="Move ${esc(f.name)} later" ${i===p.formations.length-1||api.readOnly()?'disabled':''}>↓</button></div>`).join('')}</div><div class="modal-footer">${button('duplicate','Duplicate current formation')}<button class="button primary" data-action="new-formation">Add formation</button></div>`,true);}
function timingDialog(){const p=api.project();api.dialog('Every moment, precisely placed.',`<form id="timing-form"><label class="field">Timeline item<select name="item">${p.formations.slice(1).map(f=>`<option value="formation/${f.id}">Formation · ${esc(f.name)} (${f.time}s)</option>`).join('')}${p.actions.map(a=>`<option value="movement/${a.id}">Movement · ${esc(a.name)} (${a.start}–${a.end}s)</option>`).join('')}${p.cues.map(c=>`<option value="cue/${c.id}">Cue · ${esc(c.label)} (${c.time}s)</option>`).join('')}</select></label><div class="field-row"><label class="field">Edit<select name="edge"><option value="move">Start / move whole clip</option><option value="start">Trim movement start</option><option value="end">Trim movement end</option></select></label><label class="field">Time in seconds<input name="time" type="number" min="0" max="${p.duration}" step=".001" value="${api.time().toFixed(3)}" required></label></div><p class="field-help">Formation boundaries stay between their neighbors with a minimum 0.1 second gap. The opening stays at zero. Use Sequence to change the order.</p><div class="modal-footer"><span>All timing edits support Undo.</span><button class="button primary" ${api.readOnly()?'disabled':''}>Save timing</button></div></form>`);}
function loopDialog(){const p=api.project();api.dialog('Practice a section, on repeat.',`<form id="loop-range-form"><div class="field-row"><label class="field">From (seconds)<input name="start" type="number" min="0" max="${p.duration}" step=".1" value="${Math.min(api.time(),p.duration-.25).toFixed(1)}" required></label><label class="field">To (seconds)<input name="end" type="number" min=".25" max="${p.duration}" step=".01" value="${Math.min(p.duration,api.time()+8).toFixed(1)}" required></label></div><div class="modal-footer">${button('clear-loop','Clear loop')}<button class="button primary">Set rehearsal loop</button></div></form>`);}
function castDialog(){const p=api.project(),selected=api.selected();api.dialog('A cast with its own identity.',`<form id="cast-customize"><p class="modal-intro">Choose performers, then apply the fields you need. Blank group and role fields keep existing values.</p><div class="cast-picker">${p.performers.map(person=>`<label><input type="checkbox" name="people" value="${person.id}" ${selected.has(person.id)?'checked':''}><span><strong>${person.number}. ${esc(person.name)}</strong><small>${esc(person.group)} · ${esc(person.role)}${person.tags?.length?' · '+esc(person.tags.join(', ')):''}</small></span></label>`).join('')}</div><div class="field-row"><label class="field">Custom group<input name="group" maxlength="40" placeholder="e.g. Front line, Brass, Blue team" list="cast-groups"><datalist id="cast-groups">${[...new Set(p.performers.map(p=>p.group))].map(g=>`<option value="${esc(g)}">`).join('')}</datalist></label><label class="field">Role<input name="role" maxlength="100" placeholder="Keep current role"></label></div><label class="field checkbox-field"><input name="set-color" type="checkbox">Apply marker color <input name="color" type="color" value="#8465d6" aria-label="Performer marker color"></label><label class="field">Tags, separated by commas<input name="tags" maxlength="370" placeholder="solo, entrance-left, understudy"></label><label class="field checkbox-field"><input name="set-tags" type="checkbox">Replace tags for selected performers (empty clears them)</label><div class="modal-footer"><span>Search the roster by name, group, role, or tag.</span><button class="button primary" ${api.readOnly()?'disabled':''}>Apply to selected cast</button></div></form>`,true);}
function videoDialog(){const p=api.project(),formats=supportedVideoFormats();api.dialog('Your performance, in motion.',formats.length?`<form id="video-form"><p class="modal-intro">Export the animated top-down stage with your exact routes, timings, props, colors, and optional music.</p><div class="field-row"><label class="field">Resolution<select name="resolution"><option value="480">480p · compact</option><option value="720" selected>720p · HD</option><option value="1080">1080p · Full HD</option><option value="1440">1440p · QHD</option></select></label><label class="field">Quality<select name="quality"><option value="compact">Compact file</option><option value="standard" selected>Standard</option><option value="high">High bitrate</option></select></label></div><div class="field-row"><label class="field">Frame rate<select name="fps"><option>24</option><option selected>30</option><option>60</option></select></label><label class="field">Format<select name="mime">${formats.map(([mime,label])=>`<option value="${mime}">${label}</option>`).join('')}</select></label></div><div class="field-row"><label class="field">From (seconds)<input name="start" type="number" min="0" max="${p.duration}" step=".01" value="0" required></label><label class="field">To (seconds)<input name="end" type="number" min=".25" max="${p.duration}" step=".01" value="${p.duration}" required></label></div><div class="field-row"><label class="field checkbox-field"><input name="audio" type="checkbox" checked>Include music</label><label class="field checkbox-field"><input name="labels" type="checkbox" checked>Performer names</label></div><p class="field-help">Recording takes the clip’s full duration. Keep this tab visible and the device awake. Large exports use more memory; try 720p on mobile. Only formats supported by this browser are offered. Output is a 2D stage video.</p><div class="modal-footer"><span>Preview before downloading.</span><button class="button primary">Create video</button></div></form>`:'<p class="modal-intro">This browser does not support local video recording. Open CHORYN in a current Chromium or Safari browser to export a video.</p>',true);}
async function startVideo(data){
  const project=clone(api.project()),settings=videoSettings(project.duration,{resolution:data.get('resolution'),quality:data.get('quality'),fps:data.get('fps'),start:data.get('start'),end:data.get('end'),labels:data.has('labels')}),mime=data.get('mime');
  if(!supportedVideoFormats().some(f=>f[0]===mime))throw Error('This format is unavailable in this browser.');
  exportJob=new AbortController();const controller=exportJob;
  const body=$('#dialog .modal-body');body.innerHTML=`<div class="video-progress"><h3>Recording ${settings.width} × ${settings.height}</h3><canvas id="video-preview" aria-label="Video export preview"></canvas><progress max="1" value="0"></progress><p role="status" id="video-status">Preparing music…</p>${button('cancel-video','Cancel export')}</div>`;
  try{
    const buffer=data.has('audio')?await api.audio():null;if(controller.signal.aborted)throw Error('Video export cancelled.');
    const blob=await recordVideo(project,settings,{mime,audioBuffer:buffer,signal:controller.signal,canvas:$('#video-preview'),onProgress:progress=>{const el=$('#video-status');if(el){el.textContent=`${Math.floor(progress*100)}% · ${Math.ceil((settings.end-settings.start)*(1-progress))} seconds remaining`;$('#dialog progress').value=progress;}}});
    if(!$('#dialog').open)return;
    videoURL=URL.createObjectURL(blob);exportBlob=blob;const extension=blob.type.includes('mp4')?'mp4':'webm';exportName=`${project.name}-${settings.height}p.${extension}`;
    body.innerHTML=`<div class="video-progress"><h3>Your video is ready.</h3><video id="exported-video" src="${videoURL}" controls playsinline preload="metadata" aria-label="Exported performance video"></video><p role="status">${settings.width} × ${settings.height} · ${settings.fps} fps target · ${settings.quality} · ${(blob.size/1024/1024).toFixed(1)} MB · ${extension.toUpperCase()}</p><p class="field-help">Actual frame rate depends on device performance. Download this video before closing the preview.</p>${button('download-video','Download video')}</div>`;
  }catch(error){if($('#dialog').open){body.innerHTML=`<p class="modal-intro" role="status">${esc(error.message)}</p>${button('video','Return to video settings')}`;}}finally{if(exportJob===controller)exportJob=null;}
}
