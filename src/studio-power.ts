import {errorMessage} from './errors.js';
import {videoExportFormats,RENDERED_MP4,renderMP4,chooseMP4Route} from './mp4-export.js';
import {createViewVideoRenderer} from './view-video.js';
import {observeSize} from './compat.js';
import {setupTimeline,bindEditorTimeline,requestSequenceReorder} from './timeline-ui.js';
import {clone,clamp,timecode,transitionSettings} from './engine.js';
import {editTimeline,reorderFormation,snappedTime,setFormationTransition} from './timeline-model.js';
import {videoSettings,recordVideo,VIDEO_CAMERAS} from './video.js';
import type {ExportSnapshot} from './view-video.js';
import type {TimelineClip} from './timeline-model.js';
import type {StudioServices} from './types.js';
export type PowerApi=Pick<StudioServices,'project'|'formation'|'selected'|'time'|'readOnly'|'render'|'pause'|'seek'|'replace'|'dialog'|'close'|'toast'|'download'>&{viewSnapshot:()=>ExportSnapshot; selectFormation:(id:string)=>void; setTimelineExpanded:(value:boolean)=>void; details:(kind:string,id:string)=>void; duplicate:()=>void; setLoop:(start:number,end:number)=>void; clearLoop:()=>void; audio:()=>Promise<AudioBuffer|null|undefined>};
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s),esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string,string>)[c]);
let api:PowerApi,timelineZoom=1,timelineSnap='beat',exportJob:AbortController|null|undefined,videoURL:string|null|undefined,exportBlob:Blob|null|undefined,exportName:string|undefined,sequenceDragged:string|null|undefined,sequencePointer:{id:string|undefined;y:number;index:number;moved:boolean}|null|undefined,timelineObserver:{disconnect():void}|undefined,full=false,nativeFull=false,fullTimeline=false,fullscreenPending=false,videoDialogToken=0;
const button=(action:string,label:string)=>`<button class="button" type="button" data-power="${action}">${label}</button>`;
export function releasePowerExport(){videoDialogToken++;exportJob?.abort();exportJob=null;if(videoURL){URL.revokeObjectURL(videoURL);videoURL=null;}exportBlob=null;}
// Handlers read ids from the dialogs and rows this module renders, which always carry them.
export function setupPower(adapter:PowerApi){
  document.addEventListener('studio-recover',()=>{videoDialogToken++;exportJob?.abort();});
  api=adapter;setupTimeline({...adapter,timingDialog,transitionDialog});
  document.addEventListener('click',async event=>{
    const node=(event.target as HTMLElement).closest<HTMLElement>('[data-power]');if(!node)return;event.preventDefault();event.stopImmediatePropagation();
    const action=node.dataset.power;
    try{
      if(action==='video')await videoDialog();
      if(action==='transition')transitionDialog(node.dataset.id);
      if(action==='transition-reset'){const id=$('#sequence-transition-form')?.dataset.id;api.replace(setFormationTransition(api.project(),id!,null),'This sequence uses project movement defaults.');api.close();}
      if(action==='fullscreen-timeline'){fullTimeline=!fullTimeline;syncFullscreen();api.render();}
      if(action==='cancel-video'){exportJob?.abort();}
      if(action==='download-video'&&exportBlob)api.download(exportBlob,exportName!,exportBlob.type);
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
        const project=api.project(),index=project.formations.findIndex(f=>f.id===node.dataset.id),next=reorderFormation(project,node.dataset.id!,index+(action==='sequence-up'?-1:1));
        requestSequenceReorder(next,node.dataset.id!,sequenceDialog);
      }
      if(action==='sequence-select'){api.selectFormation(node.dataset.id!);api.close();}
      if(action==='duplicate'){api.duplicate();}
      if(action==='clear-loop'){api.clearLoop();api.close();}
    }catch(error){api.toast(errorMessage(error));}
  },true);
  document.addEventListener('change',event=>{if((event.target as HTMLElement).id==='timeline-snap')timelineSnap=(event.target as HTMLInputElement).value;if((event.target as HTMLElement).id==='transition-sequence')transitionDialog((event.target as HTMLInputElement).value);});
  document.addEventListener('input',event=>{if((event.target as HTMLElement).id!=='sequence-move-duration')return;const span=Number((event.target as HTMLElement).dataset.span),duration=Number((event.target as HTMLInputElement).value);$('#sequence-hold-summary')!.textContent=`Hold ${Math.max(0,span-duration).toFixed(2)}s, then move for ${duration.toFixed(2)}s into the next formation.`;});
  document.addEventListener('submit',async event=>{
    const form=(event.target as HTMLFormElement),id=form.id;if(!['video-form','cast-customize','timing-form','loop-range-form','sequence-transition-form'].includes(id))return;
    event.preventDefault();event.stopImmediatePropagation();const data=new FormData(form),project=api.project();
    try{
      if(id==='video-form'){await startVideo(data);return;}
      if(id==='sequence-transition-form'){if(api.readOnly())return;api.replace(setFormationTransition(project,form.dataset.id!,{duration:Number(String(data.get('duration')||'')),easing:String(data.get('easing')||''),pathType:String(data.get('pathType')||'')}),'Movement timing saved for this sequence. Individual routes retain their overrides.');api.close();return;}
      if(api.readOnly()&&id!=='loop-range-form')return;
      if(id==='timing-form'){
        const item=String(data.get('item')||'').split('/');const next=editTimeline(project,{kind:item[0],id:item[1],edge:String(data.get('edge')||''),value:Number(String(data.get('time')||''))});api.replace(next,'Timeline updated.');api.close();
      }
      if(id==='loop-range-form'){const start=Number(String(data.get('start')||'')),end=Number(String(data.get('end')||''));if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>project.duration||end-start<.25)throw Error('Choose a valid loop range of at least 0.25 seconds.');api.setLoop(start,end);api.close();}
      if(id==='cast-customize'){
        const ids=new Set(data.getAll('people'));if(!ids.size)throw Error('Select at least one performer.');
        const next=clone(project),group=String(String(data.get('group')||'')).trim(),role=String(String(data.get('role')||'')).trim(),tags=[...new Set(String(String(data.get('tags')||'')).split(',').map(t=>t.trim()).filter(Boolean))];
        if(tags.length>12||tags.some(t=>t.length>30))throw Error('Use up to 12 tags, each at most 30 characters.');
        next.performers.forEach(person=>{if(!ids.has(person.id))return;if(group)person.group=group;if(role)person.role=role;if(data.has('set-color'))person.color=String(data.get('color')||'');if(data.has('set-tags'))person.tags=tags;const identity=String(data.get('identity')??'keep');if(identity!=='keep'){if(identity==='female'||identity==='male')person.identity=identity;else delete person.identity;}});
        api.replace(next,`${ids.size} performer profiles updated.`);api.close();
      }
    }catch(error){api.toast(errorMessage(error));}
  },true);
  document.addEventListener('dragstart',event=>{const row=(event.target as HTMLElement).closest<HTMLElement>('[data-sequence-row]');if(!row)return;sequenceDragged=row.dataset.sequenceRow;event.dataTransfer!.effectAllowed='move';event.dataTransfer!.setData('text/plain',sequenceDragged!);row.classList.add('dragging');});
  // Mouse drag shows the landing row the same way the touch grip does.
  const markDropRow=(row?:HTMLElement|null)=>document.querySelectorAll<HTMLElement>('[data-sequence-row]').forEach(item=>item.classList.toggle('sequence-drop-target',item===row&&item.dataset.sequenceRow!==sequenceDragged));
  document.addEventListener('dragover',event=>{const row=(event.target as HTMLElement).closest<HTMLElement>('[data-sequence-row]');if(sequenceDragged&&row){event.preventDefault();event.dataTransfer!.dropEffect='move';markDropRow(row);}});
  document.addEventListener('drop',event=>{const row=(event.target as HTMLElement).closest<HTMLElement>('[data-sequence-row]');if(!row||!sequenceDragged)return;event.preventDefault();markDropRow(null);const id=sequenceDragged;sequenceDragged=null;if(row.dataset.sequenceRow===id)return;try{requestSequenceReorder(reorderFormation(api.project(),id,Number(row.dataset.index)),id,sequenceDialog);}catch(error){api.toast(errorMessage(error));}});
  document.addEventListener('dragend',()=>{sequenceDragged=null;markDropRow(null);document.querySelectorAll<HTMLElement>('.dragging').forEach(el=>el.classList.remove('dragging'));});
  document.addEventListener('pointerdown',event=>{
    const grip=(event.target as HTMLElement).closest<HTMLElement>('.sequence-grip'),row=grip?.closest<HTMLElement>('[data-sequence-row]');
    if(!row||api.readOnly()||event.button!==0)return;
    event.preventDefault();sequencePointer={id:row.dataset.sequenceRow,y:event.clientY,index:Number(row.dataset.index),moved:false};try{row.setPointerCapture(event.pointerId);}catch{}
  });
  document.addEventListener('pointermove',event=>{
    if(!sequencePointer)return;event.preventDefault();if(Math.abs(event.clientY-sequencePointer.y)<5&&!sequencePointer.moved)return;
    sequencePointer.moved=true;const rows=[...document.querySelectorAll<HTMLElement>('[data-sequence-row]')];let distance=Infinity;
    rows.forEach(row=>{const rect=row.getBoundingClientRect(),d=Math.abs(event.clientY-(rect.top+rect.height/2));if(d<distance){distance=d;sequencePointer!.index=Number(row.dataset.index);}});
    rows.forEach(row=>row.classList.toggle('sequence-drop-target',Number(row.dataset.index)===sequencePointer!.index));
    const body=$('#dialog .modal-body')!,rect=body.getBoundingClientRect();if(event.clientY<rect.top+30)body.scrollTop-=16;else if(event.clientY>rect.bottom-30)body.scrollTop+=16;
  },{passive:false});
  const finishSequence=(cancel:boolean)=>{if(!sequencePointer)return;const gesture=sequencePointer;sequencePointer=null;document.querySelectorAll<HTMLElement>('.sequence-drop-target').forEach(el=>el.classList.remove('sequence-drop-target'));if(cancel||!gesture.moved)return;try{requestSequenceReorder(reorderFormation(api.project(),gesture.id!,gesture.index),gesture.id!,sequenceDialog);}catch(error){api.toast(errorMessage(error));}};
  document.addEventListener('pointerup',()=>finishSequence(false));document.addEventListener('pointercancel',()=>finishSequence(true));
  // A re-rendered list or Escape abandons a grip drag without reordering.
  document.addEventListener('lostpointercapture',()=>finishSequence(true));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&sequencePointer){event.preventDefault();event.stopImmediatePropagation();finishSequence(true);}},true);
  $('#dialog')!.addEventListener('close',()=>{if(!$<HTMLDialogElement>('#dialog')!.open)releasePowerExport();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&full&&!$<HTMLDialogElement>('#dialog')!.open){event.preventDefault();toggleFullscreen();}if(event.key.toLowerCase()==='f'&&!event.ctrlKey&&!event.metaKey&&!(event.target as HTMLElement).matches?.('input,textarea,select')&&!$<HTMLDialogElement>('#dialog')!.open)toggleFullscreen();});
  document.addEventListener('fullscreenchange',()=>{if(nativeFull&&!document.fullscreenElement){full=false;nativeFull=false;syncFullscreen();if(!fullscreenPending)api.render();}});
}
async function toggleFullscreen(){
 if(fullscreenPending){if(full&&!document.fullscreenElement){full=false;syncFullscreen();api.render();}return;}
 fullscreenPending=true;full=!full;syncFullscreen();
 // Embedded browsers can leave native fullscreen promises unsettled. Never let
 // that lock focus-view controls, and dismiss an obsolete late native entry.
 const bounded=(operation:()=>unknown)=>new Promise<boolean>((resolve,reject)=>{
  const timer=setTimeout(()=>resolve(false),1500);
  try{Promise.resolve(operation()).then(()=>{clearTimeout(timer);resolve(true);},error=>{clearTimeout(timer);reject(error);});}catch(error){clearTimeout(timer);reject(error);}
 });
 try{
  if(full&&matchMedia('(min-width:1024px)').matches&&!document.fullscreenElement&&document.documentElement.requestFullscreen){
   try{const completed=await bounded(()=>Promise.resolve(document.documentElement.requestFullscreen()).then(()=>{
    if(!full){if(document.fullscreenElement)try{void Promise.resolve(document.exitFullscreen()).catch(()=>{});}catch{};return;}
    nativeFull=!!document.fullscreenElement;
   }));if(!completed||!nativeFull)api.toast('Stage focus view opened. Browser fullscreen is unavailable here.');}
   catch{api.toast('Stage focus view opened. Browser fullscreen is unavailable here.');}
  }else if(!full&&document.fullscreenElement){
   try{await bounded(()=>document.exitFullscreen());nativeFull=!!document.fullscreenElement;if(nativeFull){full=true;api.toast('Use the browser fullscreen control to exit.');}}
   catch{full=true;nativeFull=true;api.toast('Use the browser fullscreen control to exit.');}
  }
 }finally{fullscreenPending=false;syncFullscreen();api.render();}
}
function syncFullscreen(){document.body.classList.toggle('stage-fullscreen',full);document.body.classList.toggle('fullscreen-with-timeline',full&&fullTimeline);try{document.querySelectorAll<HTMLElement>('.fullscreen-button').forEach(button=>{button.setAttribute('aria-pressed',String(full));button.setAttribute('aria-label',full?'Exit fullscreen':'Fullscreen stage');button.title=full?'Exit fullscreen (Esc)':'Fullscreen stage (F)';});}catch{}}
export function bindPowerTimeline(){bindEditorTimeline();syncFullscreen();document.querySelectorAll<HTMLElement>('[data-power="fullscreen-timeline"]').forEach(button=>{button.textContent=fullTimeline?'Hide timeline':'Show timeline';button.setAttribute('aria-label',`${fullTimeline?'Hide':'Show'} performance timeline`);button.setAttribute('aria-expanded',String(fullTimeline));});timelineObserver?.disconnect();if(full&&fullTimeline){const timeline=$('.timeline')!,update=()=>document.documentElement.style.setProperty('--fullscreen-timeline-height',`${timeline.getBoundingClientRect().height}px`);timelineObserver=observeSize(timeline,update);update();}}
export function transitionDialog(id?:string){
  const p=api.project(),index=p.formations.findIndex(f=>f.id===(id||api.formation().id)),f=p.formations[index],next=p.formations[index+1];
  if(!next){api.dialog('The final formation holds.', '<p class="modal-intro">Choose an earlier sequence to customize its movement into the next formation.</p>');return;}
  const settings=transitionSettings(p,f),span=next.time-f.time,duration=Math.min(settings.duration,span),locked=api.readOnly()||f.status==='approved';
  api.dialog('Give every transition its own rhythm.',`<form id="sequence-transition-form" data-id="${f.id}"><label class="field">Sequence<select id="transition-sequence">${p.formations.slice(0,-1).map((item,i)=>`<option value="${item.id}" ${item.id===f.id?'selected':''}>${i+1}. ${esc(item.name)}</option>`).join('')}</select></label><p class="modal-intro">${esc(f.name)} → ${esc(next.name)} · ${span.toFixed(2)} seconds / ${(span*p.bpm/60).toFixed(1)} counts.</p><label class="field">Movement duration (seconds)<input id="sequence-move-duration" data-span="${span}" name="duration" type="number" min=".1" max="${Math.min(60,span)}" step=".001" value="${duration}" required ${locked?'disabled':''}></label><p id="sequence-hold-summary" class="field-help">Hold ${(span-duration).toFixed(2)}s, then move for ${duration.toFixed(2)}s into the next formation.</p><div class="field-row"><label class="field">Easing<select name="easing" ${locked?'disabled':''}><option value="smooth" ${settings.easing==='smooth'?'selected':''}>Smooth acceleration</option><option value="linear" ${settings.easing==='linear'?'selected':''}>Constant speed</option></select></label><label class="field">Path style<select name="pathType" ${locked?'disabled':''}><option value="direct" ${settings.pathType==='direct'?'selected':''}>Direct</option><option value="curved" ${settings.pathType==='curved'?'selected':''}>Curved</option></select></label></div><p class="field-help">Settings apply to this outgoing sequence and are saved in backups. Existing individual performer routes keep their own timing and paths. If the interval becomes shorter, playback clamps the movement to fit. ${f.status==='approved'?'Unlock this approved formation to edit.':''}</p><div class="modal-footer"><button type="button" class="button" data-power="transition-reset" ${locked?'disabled':''}>Use project defaults</button><button class="button primary" ${locked?'disabled':''}>Save movement timing</button></div></form>`,true);
}

function sequenceDialog(){const p=api.project();api.dialog('Build the arc of your performance.',`<p class="modal-intro">Drag rows to reorder, or use the arrows. Time slots stay fixed; routes between separated formations are removed. Approved formations must be unlocked first.</p><div class="sequence-list">${p.formations.map((f,i)=>`<div data-sequence-row="${f.id}" data-index="${i}" draggable="${!api.readOnly()&&f.status!=='approved'}"><span class="sequence-grip" aria-hidden="true">⠿</span><button data-power="sequence-select" data-id="${f.id}"><strong>${String(i+1).padStart(2,'0')} · ${esc(f.name)}</strong><small>${timecode(f.time)} · ${(p.formations[i+1]?.time??p.duration)-f.time}s · ${f.status}</small></button><button class="sequence-timing" data-power="transition" data-id="${f.id}" aria-label="Movement timing for ${esc(f.name)}" ${i===p.formations.length-1?'disabled':''}>${i===p.formations.length-1?'Hold':Math.min(transitionSettings(p,f).duration,p.formations[i+1].time-f.time)+'s move'}</button><button data-power="sequence-up" data-id="${f.id}" aria-label="Move ${esc(f.name)} earlier" ${!i||api.readOnly()?'disabled':''}>↑</button><button data-power="sequence-down" data-id="${f.id}" aria-label="Move ${esc(f.name)} later" ${i===p.formations.length-1||api.readOnly()?'disabled':''}>↓</button></div>`).join('')}</div><div class="modal-footer">${button('duplicate','Duplicate current formation')}<button class="button primary" data-action="new-formation">Add formation</button></div>`,true);}
function timingDialog(selection?:{kind:string;id:string}){const p=api.project(),items=[...p.formations.slice(1).map(item=>({kind:'formation',item})),...p.actions.map(item=>({kind:'movement',item})),...p.cues.map(item=>({kind:'cue',item}))] as {kind:string;item:TimelineClip}[];if(!items.length){api.dialog('The opening starts at zero.','<p class="modal-intro">Add a formation, movement, or cue to edit its start time. Use Trim end in Clip tools to change the opening formation’s duration.</p>');return;}const chosen=items.find(v=>v.kind===selection?.kind&&v.item.id===selection?.id)||items[0],value=chosen.kind==='movement'?chosen.item.start:chosen.item.time;api.dialog('Every moment, precisely placed.',`<form id="timing-form"><label class="field">Timeline item<select name="item">${items.map(({kind,item})=>`<option value="${kind}/${item.id}" ${item.id===chosen.item.id&&kind===chosen.kind?'selected':''}>${kind} · ${esc(item.name||item.label)}</option>`).join('')}</select></label><div class="field-row"><label class="field">Edit<select name="edge"><option value="move">Start / move whole clip</option><option value="start">Trim start</option><option value="end">Trim end / shared boundary</option></select></label><label class="field">Time in seconds<input name="time" type="number" min="0" max="3600" step=".001" value="${value}" required></label></div><p class="field-help">Formation boundaries stay between their neighbors with a minimum 0.1 second gap. The opening stays at zero. Use Sequence to change the order.</p><div class="modal-footer"><span>All timing edits support Undo.</span><button class="button primary" ${api.readOnly()?'disabled':''}>Save timing</button></div></form>`);}

function loopDialog(){const p=api.project();api.dialog('Practice a section, on repeat.',`<form id="loop-range-form"><div class="field-row"><label class="field">From (seconds)<input name="start" type="number" min="0" max="${p.duration}" step=".1" value="${Math.min(api.time(),p.duration-.25).toFixed(1)}" required></label><label class="field">To (seconds)<input name="end" type="number" min=".25" max="${p.duration}" step=".01" value="${Math.min(p.duration,api.time()+8).toFixed(1)}" required></label></div><div class="modal-footer">${button('clear-loop','Clear loop')}<button class="button primary">Set rehearsal loop</button></div></form>`);}
function castDialog(){const p=api.project(),selected=api.selected();api.dialog('A cast with its own identity.',`<form id="cast-customize"><p class="modal-intro">Choose performers, then apply the fields you need. Blank group and role fields keep existing values.</p><div class="cast-picker">${p.performers.map(person=>`<label><input type="checkbox" name="people" value="${person.id}" ${selected.has(person.id)?'checked':''}><span><strong>${person.number}. ${esc(person.name)}</strong><small>${esc(person.group)} · ${esc(person.role)}${person.tags?.length?' · '+esc(person.tags.join(', ')):''}</small></span></label>`).join('')}</div><div class="field-row"><label class="field">Custom group<input name="group" maxlength="40" placeholder="e.g. Front line, Brass, Blue team" list="cast-groups"><datalist id="cast-groups">${[...new Set(p.performers.map(p=>p.group))].map(g=>`<option value="${esc(g)}">`).join('')}</datalist></label><label class="field">Role<input name="role" maxlength="100" placeholder="Keep current role"></label></div><label class="field checkbox-field"><input name="set-color" type="checkbox">Apply marker color <input name="color" type="color" value="#8465d6" aria-label="Performer marker color"></label><label class="field">Tags, separated by commas<input name="tags" maxlength="370" placeholder="solo, entrance-left, understudy"></label><label class="field checkbox-field"><input name="set-tags" type="checkbox">Replace tags for selected performers (empty clears them)</label><label class="field">Identity (3D body)<select name="identity"><option value="keep">Keep current</option><option value="">Not specified</option><option value="female">Female</option><option value="male">Male</option></select></label><div class="modal-footer"><span>Search the roster by name, group, role, or tag.</span><button class="button primary" ${api.readOnly()?'disabled':''}>Apply to selected cast</button></div></form>`,true);}
async function videoDialog(){const p=api.project(),snapshot=api.viewSnapshot();api.dialog('Video export', '<p class="modal-intro" role="status">Checking MP4 and other encoders on this device…</p>',true);const pending=$('#dialog .modal-body'),requestToken=videoDialogToken,probe=videoSettings(p.duration,{end:Math.min(p.duration,1),aspect:snapshot.viewport.width/snapshot.viewport.height}),formats=await videoExportFormats(probe);if(requestToken!==videoDialogToken||!$<HTMLDialogElement>('#dialog')!.open||pending!==$('#dialog .modal-body'))return;api.dialog('Your performance, in motion.',formats.length?`<form id="video-form"><p class="modal-intro">Export the current stage view: its 2D/3D camera, rotation, zoom, follow camera, ghosts, paths, analysis and animated props. The frame matches the stage viewport aspect ratio. Editing controls are excluded.</p><div class="field-row"><label class="field">Resolution<select name="resolution"><option value="480">480p · compact</option><option value="720" selected>720p · HD</option><option value="1080">1080p · Full HD</option><option value="1440">1440p · QHD</option></select></label><label class="field">Quality<select name="quality"><option value="compact">Compact file</option><option value="standard" selected>Standard</option><option value="high">High bitrate</option></select></label></div><div class="field-row"><label class="field">Camera<select name="camera">${VIDEO_CAMERAS.map(c=>`<option value="${c.id}">${c.label}</option>`).join('')}</select></label><label class="field">Lighting<select name="look"><option value="view">As on screen</option><option value="rehearsal">Rehearsal light</option><option value="show">Show light</option></select></label></div><div class="field-row"><label class="field">Frame rate<select name="fps"><option>24</option><option selected>30</option><option>60</option></select></label><label class="field">Format<select name="mime">${formats.map(([mime,label])=>`<option value="${mime}">${label}</option>`).join('')}</select></label></div><div class="field-row"><label class="field">From (seconds)<input name="start" type="number" min="0" max="${p.duration}" step=".01" value="0" required></label><label class="field">To (seconds)<input name="end" type="number" min=".25" max="${p.duration}" step=".01" value="${p.duration}" required></label></div><label class="field checkbox-field"><input name="reference" type="checkbox" ${p.referenceVideo?.visible?'checked':''}>Include visible reference video</label><div class="field-row"><label class="field checkbox-field"><input name="audio" type="checkbox" checked>Include music</label><label class="field checkbox-field"><input name="labels" type="checkbox" ${snapshot.labels?'checked':''}>Performer names</label></div><p class="field-help">MP4 automatically chooses frame rendering or the browser recorder according to video and music encoder support. Frame rendering uses the selected FPS; recording runs in real time. Keep this tab visible and the device awake. Large exports use more memory; try 720p on mobile. Only formats supported by this browser are offered. Current view uses the stage camera and viewport; the cinematic cameras film the 3D stage (also from 2D) with the chosen lighting. ${formats.some(([mime])=>mime.includes('mp4'))?'MP4 encoding is available.':'This device cannot encode H.264 MP4 at this quality. Try a current Chrome, Edge or Safari browser, or use WebM.'} Silent rehearsal exports without a soundtrack.</p><div class="modal-footer"><span>Preview before downloading.</span><button class="button primary">Create video</button></div></form>`:'<p class="modal-intro">This browser does not support local video recording. Open CHORYN in a current Chrome, Edge, Firefox, or Safari browser with recording support to export a video.</p>',true);}
async function startVideo(data:FormData){
  if(exportJob)return;
  const body=$('#dialog .modal-body');if(!$<HTMLDialogElement>('#dialog')!.open||!body)return;
  // Form values are text; the dialog always offers a format.
  const project=clone(api.project()),snapshot=api.viewSnapshot(),settings=videoSettings(project.duration,{aspect:snapshot.viewport.width/snapshot.viewport.height,resolution:data.get('resolution') as string|null,quality:data.get('quality') as string|null,fps:data.get('fps') as string|null,start:data.get('start') as string|null,end:data.get('end') as string|null,labels:data.has('labels'),camera:String(data.get('camera')||'view'),look:String(data.get('look')||'view')}),mime=data.get('mime') as string;
  releasePowerExport();const controller=new AbortController();exportJob=controller;
  const submit=body.querySelector?.('button.primary') as HTMLButtonElement|null|undefined,previousLabel=submit?.textContent;if(submit){submit.disabled=true;submit.textContent='Checking export…';}
  let frameRenderer:Awaited<ReturnType<typeof createViewVideoRenderer>>|undefined,started=false;
  const current=()=>{if(exportJob!==controller||!$<HTMLDialogElement>('#dialog')!.open||body!==$('#dialog .modal-body'))return false;if(controller.signal.aborted)throw Error('Video export cancelled.');return true;};
  try{
    const available=await videoExportFormats(settings);if(!current())return;if(!available.some(f=>f[0]===mime))throw Error('This format is unavailable at the selected quality. Try 720p or a supported browser.');
    started=true;body.innerHTML=`<div class="video-progress"><h3>Exporting ${settings.width} × ${settings.height}</h3><canvas id="video-preview" aria-label="Video export preview"></canvas><progress max="1" value="0"></progress><p role="status" id="video-status">Preparing music…</p>${button('cancel-video','Cancel export')}</div>`;
    const buffer=data.has('audio')?await api.audio():null;if(!current())return;
    const route=mime===RENDERED_MP4?await chooseMP4Route(settings,buffer):{rendered:false,mime};if(!current())return;
    if(!data.has('reference'))snapshot.reference=null;frameRenderer=await createViewVideoRenderer(project,settings,snapshot,{signal:controller.signal});if(!current())return;
    const onProgress=(progress:number)=>{if(!current()){controller.abort();return;}const el=$('#video-status');if(el){el.textContent=route.rendered?`${Math.floor(progress*100)}% · rendering MP4 frames`:`${Math.floor(progress*100)}% · ${Math.ceil((settings.end-settings.start)*(1-progress))} seconds remaining`;$<HTMLProgressElement>('#dialog progress')!.value=progress;}};
    const options={frameRenderer,audioBuffer:buffer,signal:controller.signal,canvas:$<HTMLCanvasElement>('#video-preview')!,onProgress},blob=route.rendered?await renderMP4(project,settings,options):await recordVideo(project,settings,{...options,mime:route.mime});
    if(!current())return;if(mime===RENDERED_MP4&&!blob.type.startsWith('video/mp4'))throw Error('The encoder did not return MP4. Choose another supported format or lower quality.');
    videoURL=URL.createObjectURL(blob);exportBlob=blob;const extension=blob.type.includes('mp4')?'mp4':'webm';exportName=`${project.name}-${settings.height}p.${extension}`;
    body.innerHTML=`<div class="video-progress"><h3>Your video is ready.</h3><video id="exported-video" src="${videoURL}" controls playsinline preload="metadata" aria-label="Exported performance video"></video><p role="status">${settings.width} × ${settings.height} · ${settings.fps} fps target · ${settings.quality} · ${(blob.size/1024/1024).toFixed(1)} MB · ${extension.toUpperCase()}</p><p class="field-help">${route.rendered?'Rendered MP4 uses the selected frame timestamps.':'Browser recording frame rate depends on device performance.'} Download this video before closing the preview.</p>${button('download-video','Download video')}</div>`;
  }catch(error){if(exportJob===controller&&$<HTMLDialogElement>('#dialog')!.open&&body===$('#dialog .modal-body')){if(!started)throw error;body.innerHTML=`<p class="modal-intro" role="status">${esc(errorMessage(error))}</p>${button('video','Return to video settings')}`;}}
  finally{try{frameRenderer?.dispose();}finally{if(exportJob===controller){exportJob=null;if(submit){submit.disabled=false;submit.textContent=previousLabel as string|null;}}}}
}
