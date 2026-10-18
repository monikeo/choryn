import { COLORS, uid, clamp, clone, timecode, generateLayout, createProject, interpolatePosition, samplePerformance, beatAt, warnings, validateProject } from './engine.js';
import { icon } from './icons.js';

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storageKey='choryn.projects.v1';
const preference = (key,fallback) => {try{return localStorage.getItem(key)||fallback;}catch{return fallback;}};
let projects=[];
let storageError=false;
try { projects=JSON.parse(localStorage.getItem(storageKey)||'[]').map(validateProject); } catch { storageError=true; }
if(!projects.length) projects=[createProject()];
let project=projects[0];
let readOnly=false;
if(location.hash.startsWith('#rehearsal=')) {
  try { project=validateProject(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(location.hash.slice(11)),c=>c.charCodeAt(0)))));readOnly=true; }
  catch { setTimeout(()=>toast('The rehearsal link could not be opened.'),200); }
}
let active=project.formations[1]?.id || project.formations[0].id;
let time=project.formations.find(f=>f.id===active).time;
let selected=new Set(), tab='formations', mode='formation', tool='cursor', search='', showGrid=true, showPaths=false, snap=true, labels=true, view='2d', mirror=false, zoom=1, pan={x:0,y:0};
let playing=false, rate=1, loop=false, muted=false, history=[], future=[], saveTimer, toastTimer, audioContext, audioBuffer, audioSource, audioStart=0, clockStart=0, clockOffset=0, wave=[], audioDB, persistedAudio=false, lastFrame=0;
let panelHidden=false;
const form = () => project.formations.find(f=>f.id===active) || project.formations[0];
const isLocked = () => readOnly || form().status==='approved';
const btn = (name, action, title, cls='', extra='') => `<button class="icon-button ${cls}" data-action="${action}" title="${title}" aria-label="${title}" ${cls.includes('selected')?'aria-pressed="true"':''} ${extra}>${icon(name)}</button>`;
const shortNum = n => Number(n.toFixed(2));

function toast(text) { const el=$('#toast');el.textContent=text;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3600); }
function remember(){ if(readOnly)return; history.push(clone(project));if(history.length>60)history.shift();future=[];const undo=$('[data-action="undo"]'),redo=$('[data-action="redo"]');if(undo)undo.disabled=false;if(redo)redo.disabled=true; }
function persistNow(){
  if(readOnly)return;
  clearTimeout(saveTimer);project.updatedAt=Date.now();const index=projects.findIndex(p=>p.id===project.id);if(index>=0)projects[index]=project;else projects.unshift(project);
  try{localStorage.setItem(storageKey,JSON.stringify(projects));storageError=false;if($('#save-status'))$('#save-status').innerHTML=`${icon('cloud')} Saved on this device`;}
  catch{storageError=true;if($('#save-status'))$('#save-status').innerHTML=`${icon('warning')} Save failed`;toast('Device storage is full or unavailable. Export a backup to keep your changes.');}
}
function save(){
  if(readOnly)return;
  const state=$('#save-status'); if(state) state.innerHTML=`<span class="saving-dot"></span> Saving…`;
  clearTimeout(saveTimer);saveTimer=setTimeout(persistNow,400);
}
function commit(message){save();render();if(message)toast(message);}
function undo(redo=false){if(readOnly)return;const source=redo?future:history,dest=redo?history:future;if(!source.length)return;pause();dest.push(clone(project));const audioName=project.audioName;project=source.pop();project.audioName=audioName;if(!project.formations.some(f=>f.id===active))active=project.formations[0].id;time=form().time;selected.clear();save();render();}

function miniStage(f,width=160,height=86,large=false){
  const padding=large?12:10;
  return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true"><path d="M${width/2} 4v${height-8}M6 ${height/2}h${width-12}" stroke="currentColor" opacity=".12" stroke-dasharray="2 3"/>${f.positions.map(p=>{const perf=project.performers.find(v=>v.id===p.performerId);return `<circle cx="${padding+(p.x/project.stage.width+.5)*(width-padding*2)}" cy="${padding+(.5-p.z/project.stage.depth)*(height-padding*2)}" r="${large?4.5:3.3}" fill="${perf?.color || COLORS[0]}"/>`;}).join('')}</svg>`;
}

function render(){
  document.documentElement.dataset.theme=preference('choryn.theme','light');
  const f=form();
  $('#app').innerHTML=`
    <aside class="app-rail" aria-label="Main navigation">
      <a href="#" class="brand-mark" aria-label="CHORYN Studio" data-action="home">${icon('logo')}</a>
      <div class="rail-top">${btn('grid','projects','Project dashboard')}${btn('studio','studio','Choreography studio','active')}${btn('layers','templates','Formation library')}${btn('people','cast','Performer roster')}${btn('calendar','rehearsals','Rehearsal plan')}</div>
      <div class="rail-bottom">${btn('help','help','Help and keyboard shortcuts')}${btn('settings','settings','Studio preferences')}<button class="profile" data-action="settings" aria-label="Studio preferences">KM</button></div>
    </aside>
    <div class="workspace">
      <header class="app-header">
        <button class="wordmark" data-action="projects">CHORYN<span>STUDIO</span></button>
        <span class="header-divider"></span>
        <button class="project-title" data-action="project-details">${esc(project.name)}${icon('down')}<span class="project-badge">${readOnly?'VIEW ONLY':'DRAFT'}</span></button>
        <span id="save-status" class="save-status">${icon(storageError?'warning':'cloud')}${readOnly?'Rehearsal snapshot':storageError?'Storage unavailable':'Saved on this device'}</span>
        <div class="header-actions"><div class="history-actions">${btn('undo','undo','Undo (Ctrl+Z)','',history.length && !readOnly?'':'disabled')}${btn('redo','redo','Redo (Ctrl+Shift+Z)','',future.length && !readOnly?'':'disabled')}</div><button class="button share-button" data-action="share">${icon('share')}Share</button><button class="button primary" data-action="export">${icon('export')}Export${icon('down')}</button></div>
      </header>
      <nav class="project-nav" aria-label="Project views"><div class="breadcrumbs"><button data-action="projects">Projects</button>${icon('chevron')}<span>${esc(project.name)}</span></div><div class="mode-tabs">${[['formation','studio','Formation studio'],['stage','box','Stage design'],['notes','note','Rehearsal notes']].map(([key,ic,label])=>`<button data-mode="${key}" class="${mode===key?'active':''}">${icon(ic)}${label}</button>`).join('')}</div><span class="project-type"><span></span>${esc(project.discipline)}</span></nav>
      <main class="editor ${panelHidden?'panels-hidden':''}">
        <aside class="assets-panel"><div class="panel-heading"><span>YOUR WORKSPACE</span>${btn('dots','project-details','Project settings')}</div><div class="asset-tabs" role="tablist">${[['formations','Formations'],['performers','Performers'],['media','Media']].map(([key,label])=>`<button role="tab" aria-selected="${tab===key}" data-tab="${key}" class="${tab===key?'active':''}">${label}${key==='formations'?`<span>${project.formations.length}</span>`:''}</button>`).join('')}</div><div class="asset-content">${renderAssets()}</div><div class="sidebar-footer"><span class="tiny-status"></span> ${readOnly?'Read-only rehearsal':'Personal workspace'}<span class="local-badge">LOCAL</span></div></aside>
        <section class="canvas-panel" aria-label="Formation editor">
          <div class="canvas-toolbar"><div class="toolbar-tools" role="toolbar" aria-label="Stage editing tools">${[['cursor','Select (V)'],['hand','Pan (H)'],['path','Movement paths (P)'],['ruler','Measure (M)']].map(([key,title])=>btn(key,`tool-${key}`,title,tool===key?'selected':'')).join('')}<span class="tool-separator"></span>${btn('plus','add-performer','Add performer','',readOnly?'disabled':'')}${btn('align','align','Align selected performers','',isLocked()?'disabled':'')}${btn('flip','mirror','Mirror stage view',mirror?'selected':'')}</div><div class="view-controls">${btn('settings','properties','Open inspector','mobile-properties')}<div class="view-switch"><button data-view="2d" class="${view==='2d'?'active':''}">2D</button><button data-view="spatial" class="${view==='spatial'?'active':''}">${icon('box')}Spatial</button></div></div></div>
          ${mode==='notes'?renderNotes():`<div class="canvas-body"><div class="canvas-heading"><div><div class="eyebrow">SCENE 01 <span>/</span> ${String(project.formations.findIndex(q=>q.id===active)+1).padStart(2,'0')}</div><h1>${esc(f.name)}</h1><div class="canvas-subtitle">${project.performers.length} performers <span>·</span> ${timecode(f.time)} <span>·</span> ${esc(f.status==='approved'?'Approved formation':'Make space for your next idea.')}</div></div><button class="canvas-status" data-action="approve">${icon(f.status==='approved'?'lock':'check')}${f.status==='approved'?'Approved':'Draft formation'}</button></div>
          <div class="stage-viewport" id="stage-viewport"><div class="stage-dimension top-dimension"><span></span>${project.stage.width} m<span></span></div><div class="stage-dimension side-dimension">${project.stage.depth} m</div><div class="stage-wrap ${view==='spatial'?'spatial':''}" id="stage-wrap">${renderStage()}</div><div class="audience-label"><span></span>${icon('people')}AUDIENCE / DOWNSTAGE<span></span></div><div class="canvas-hint" id="canvas-hint">${tool==='hand'?'Drag to pan the stage':tool==='ruler'?'Drag between two points to measure distance':isLocked()?'Approved positions are locked. Unlock to edit.':'Click to select · Shift for multiple · Drag to move'}</div></div>
          <div class="canvas-bottom"><button class="stage-chip" data-action="stage-settings">${icon('box')}Main stage <span>${project.stage.width} × ${project.stage.depth} m</span></button><div class="canvas-options">${btn('grid','grid','Toggle stage grid',showGrid?'selected':'')}${btn('snap','snap','Snap to 0.5 m grid',snap?'selected':'')}<span class="tool-separator"></span>${btn('minus','zoom-out','Zoom out')}<span class="zoom-label">${Math.round(zoom*100)}%</span>${btn('plus','zoom-in','Zoom in')}${btn('expand','fit','Fit stage')}</div></div></div>`}
        </section>
        <aside class="inspector"><div class="inspector-heading"><span>Inspector</span>${btn('dots','inspector-menu','Inspector actions')}</div><div id="inspector-content">${renderInspector()}</div><div class="inspector-tip">${icon('sparkle')}<div><strong>A little space goes a long way.</strong><p>Keep your lines clean and give every performer room to move.</p></div></div></aside>
      </main>
      ${renderTimeline()}
      <footer class="status-bar"><span>${icon('check')}<span id="validation-status">${warnings(project,f.positions).length ? `${warnings(project,f.positions).length} spacing notes`:'All performers within stage'}</span></span><span>From first count to final cue.<span class="status-shortcut">${icon('cursor')} V to select <kbd>?</kbd> Shortcuts</span></span><button data-action="toggle-panels">${icon('studio')} ${panelHidden?'Show panels':'Focus mode'}</button></footer>
    </div>`;
  bindStage(); bindTimeline(); updatePlayback();
  if($('#dialog').open && $('#dialog').dataset.kind==='inspector')$('.modal-body',$('#dialog')).innerHTML=renderInspector();
}

function renderAssets(){
  if(tab==='formations')return `<div class="asset-section-title"><h2>Scene 01 <span>· Opening</span></h2>${btn('plus','new-formation','Add formation','',readOnly?'disabled':'')}</div><div class="formation-list">${project.formations.map((f,i)=>`<button class="formation-card ${active===f.id?'active':''}" data-formation="${f.id}"><div class="formation-mini"><span class="formation-index">${String(i+1).padStart(2,'0')}</span>${miniStage(f)}${f.status==='approved'?`<span class="formation-lock">${icon('lock')}</span>`:''}</div><div class="formation-card-info"><span>${esc(f.name)}</span><small>${timecode(f.time)}</small></div><div class="formation-meta">${Math.round((project.formations[i+1]?.time??project.duration)-f.time)}s <span>·</span> ${Math.round(((project.formations[i+1]?.time??project.duration)-f.time)*project.bpm/60)} counts</div></button>`).join('')}</div><button class="add-formation" data-action="new-formation" ${readOnly?'disabled':''}>${icon('plus')} Add formation</button><button class="preset-shortcut" data-action="templates">${icon('layers')}<span>Start with a formation preset<small>Good movement starts with a shape.</small></span>${icon('chevron')}</button>`;
  if(tab==='performers')return `<div class="asset-section-title"><h2>Cast <span>${project.performers.length} performers</span></h2>${btn('plus','add-performer','Add performer','',readOnly?'disabled':'')}</div><label class="search-field">${icon('search')}<input id="performer-search" placeholder="Find a performer…" value="${esc(search)}" /></label><div class="group-summary">${['A','B','C'].map((g,i)=>`<button data-group="${g}" style="--group-color:${COLORS[i]}"><span></span>Group ${g}<b>${project.performers.filter(p=>p.group===g).length}</b></button>`).join('')}</div><div id="performer-list">${renderRoster()}</div><button class="add-formation" data-action="add-performer" ${readOnly?'disabled':''}>${icon('plus')} Add performer</button>`;
  return `<div class="asset-section-title"><h2>Music & reference</h2></div><button class="upload-zone" data-action="upload-audio" ${readOnly?'disabled':''}>${icon('music')}<strong>Bring your rhythm</strong><span>Upload an audio file<br>MP3, WAV, M4A · up to 50 MB</span><b>Choose audio ${icon('plus')}</b></button><div class="media-file">${icon('headphones')}<div><strong>${esc(project.audioName||'First light — studio sketch')}</strong><small>${project.audioName?'Uploaded audio':'Built-in instrumental · 120 BPM'}</small></div></div><p class="sidebar-explainer">Audio is kept on this device. Project backups and rehearsal links include timing and formations, without uploaded audio.</p>${project.audioName?`<button class="text-button" data-action="reset-audio">Use studio sketch instead</button>`:''}`;
}
function renderRoster(){return project.performers.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())).map(p=>`<button class="performer-row ${selected.has(p.id)?'active':''}" data-performer="${p.id}"><span class="performer-avatar" style="--performer-color:${p.color}">${String(p.number).padStart(2,'0')}</span><span>${esc(p.name)}<small>${esc(p.role)} · Group ${p.group}</small></span>${icon(selected.has(p.id)?'check':'chevron')}</button>`).join('')||'<p class="empty-note">No matching performers.</p>';}

function renderStage(){
  const {width:w,depth:d}=project.stage;
  const W=960,H=600, sx=W/w,sz=H/d;
  const paths=showPaths && project.formations[project.formations.findIndex(f=>f.id===active)+1];
  const positions=samplePerformance(project,time);
  const toPoint=p=>[W/2+p.x*sx,H/2-p.z*sz];
  return `<svg class="stage-svg" id="stage-svg" viewBox="-50 -38 1060 676" role="group" aria-label="${esc(form().name)} formation on ${w} by ${d} meter stage"><defs><pattern id="small-grid" width="${sx}" height="${sz}" patternUnits="userSpaceOnUse"><path d="M ${sx} 0 H0 V${sz}" fill="none" stroke="var(--stage-grid)" stroke-width="1"/></pattern><filter id="marker-shadow" x="-80%" y="-80%" width="260%" height="260%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#42325f" flood-opacity=".12"/></filter><marker id="path-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 6 3 0 6" fill="var(--accent)"/></marker></defs><g id="stage-transform" transform="translate(${pan.x} ${pan.y}) translate(480 300) scale(${zoom*(mirror?-1:1)} ${zoom}) translate(-480 -300)"><rect class="stage-floor" x="0" y="0" width="960" height="600" rx="2" fill="var(--stage)" stroke="var(--stage-border)" stroke-width="2"/><rect x="0" y="0" width="960" height="600" fill="${showGrid?'url(#small-grid)':'transparent'}"/><rect class="safe-boundary" x="${sx*.5}" y="${sz*.5}" width="${W-sx}" height="${H-sz}" fill="none" stroke="var(--stage-border)" stroke-dasharray="5 6"/><path d="M480 0v600M0 300h960" stroke="var(--stage-center)" stroke-dasharray="4 5"/><path d="M470 300h20m-10-10v20" stroke="var(--stage-center)" stroke-width="2"/><g class="stage-labels" fill="var(--muted)" font-size="11" font-family="inherit"><text x="480" y="-17" text-anchor="middle" letter-spacing="2">UPSTAGE</text><text x="-17" y="302" text-anchor="middle" transform="rotate(-90 -17 302)" letter-spacing="2">STAGE RIGHT</text><text x="978" y="302" text-anchor="middle" transform="rotate(90 978 302)" letter-spacing="2">STAGE LEFT</text>${Array.from({length:Math.floor(w)+1},(_,i)=>`<text x="${i*sx}" y="622" text-anchor="middle">${shortNum(i-w/2)}</text>`).join('')}</g><g id="movement-paths">${paths?form().positions.map(p=>{const q=paths.positions.find(v=>v.performerId===p.performerId);if(!q)return '';const [x,y]=toPoint(p),[tx,ty]=toPoint(q);return `<path d="${pathGeometry(p,q)}" fill="none" stroke="${project.performers.find(v=>v.id===p.performerId)?.color}" stroke-width="2" stroke-dasharray="5 5" opacity=".5" marker-end="url(#path-arrow)"/><circle cx="${tx}" cy="${ty}" r="13" fill="none" stroke="var(--muted)" opacity=".25"/>`;}).join(''):''}</g><g id="performer-markers">${positions.map(p=>{
    const perf=project.performers.find(v=>v.id===p.performerId);const [x,y]=toPoint(p);const sel=selected.has(p.performerId);
    return `<g class="performer-marker ${sel?'is-selected':''}" data-marker="${p.performerId}" transform="translate(${x} ${y})" tabindex="0" role="button" aria-label="${esc(perf.name)}, performer ${perf.number}, x ${shortNum(p.x)}, z ${shortNum(p.z)} meters"><circle class="selection-ring" r="26" fill="none" stroke="var(--accent)" stroke-width="1.7" stroke-dasharray="3 3" opacity="${sel?1:0}"/><g transform="rotate(${p.facing})"><path d="m-5 21 5 5 5-5" fill="${perf.color}" opacity=".7"/></g><circle class="marker-body" r="19" fill="${perf.color}" stroke="var(--surface)" stroke-width="3" filter="url(#marker-shadow)"/><text text-anchor="middle" dy="4.5" fill="white" font-size="12" font-weight="650" font-family="inherit">${String(perf.number).padStart(2,'0')}</text>${labels?`<text class="marker-name" text-anchor="middle" y="44" fill="var(--secondary)" font-size="11" font-family="inherit">${esc(perf.name)}</text>`:''}</g>`;
  }).join('')}</g><g id="measure-layer"></g></g></svg>`;
}
function pathGeometry(from,to){return Array.from({length:25},(_,i)=>{const p=interpolatePosition(project,from,to,i/24);return `${i?'L':'M'}${480+p.x/project.stage.width*960} ${300-p.z/project.stage.depth*600}`;}).join(' ');}

function renderInspector(){
  if(mode==='stage')return `<div class="inspector-section"><div class="eyebrow">VENUE SETTINGS</div><h2>Main stage</h2><p class="muted small">Real-world dimensions in meters.</p><label class="field">Width (m)<input data-stage-field="width" type="number" min="2" max="100" step="1" value="${project.stage.width}" ${readOnly?'disabled':''}></label><label class="field">Depth (m)<input data-stage-field="depth" type="number" min="2" max="100" step="1" value="${project.stage.depth}" ${readOnly?'disabled':''}></label><p class="field-help">Changing the stage preserves positions. Check spacing and stage boundaries after resizing.</p><button class="button full" data-action="fit">${icon('expand')}Fit to view</button></div>${viewOptions()}`;
  if(selected.size){
    const p=project.performers.find(p=>selected.has(p.id));const pos=form().positions.find(q=>q.performerId===p.id);
    return `<div class="inspector-section"><div class="eyebrow">${selected.size>1?`${selected.size} SELECTED`:'PERFORMER'}</div><div class="selected-person"><span class="performer-avatar large" style="--performer-color:${p.color}">${String(p.number).padStart(2,'0')}</span><div><h2>${esc(p.name)}</h2><small>${esc(p.role)} · Group ${p.group}</small></div></div>${selected.size===1?`<label class="field">Display name<input data-person-field="name" value="${esc(p.name)}" maxlength="100" ${readOnly?'disabled':''}></label><div class="field-row"><label class="field">X position (m)<input data-position-field="x" value="${shortNum(pos.x)}" type="number" step=".5" ${isLocked()?'disabled':''}></label><label class="field">Z position (m)<input data-position-field="z" value="${shortNum(pos.z)}" type="number" step=".5" ${isLocked()?'disabled':''}></label></div><label class="field">Facing direction<select data-position-field="facing" ${isLocked()?'disabled':''}>${[[0,'Downstage · 0°'],[90,'Stage right · 90°'],[180,'Upstage · 180°'],[270,'Stage left · 270°']].map(([v,l])=>`<option value="${v}" ${pos.facing===v?'selected':''}>${l}</option>`).join('')}</select></label><label class="field">Group<select data-person-field="group" ${readOnly?'disabled':''}>${['A','B','C'].map(g=>`<option ${p.group===g?'selected':''} value="${g}">Group ${g}</option>`).join('')}</select></label>`:'<p class="field-help">Drag to move the selected group together. Arrow keys move by 0.1 m, or 0.5 m with Shift.</p>'}<button class="button full" data-action="clear-selection">Clear selection</button><button class="text-button danger" data-action="remove-performer" ${readOnly?'disabled':''}>${icon('trash')}Remove ${selected.size>1?'selected performers':'performer'}</button></div>${viewOptions()}`;
  }
  const f=form();const next=project.formations[project.formations.findIndex(q=>q.id===active)+1];
  return `<div class="inspector-section"><div class="eyebrow">FORMATION ${String(project.formations.findIndex(q=>q.id===active)+1).padStart(2,'0')}</div><h2>${esc(f.name)}</h2><span class="draft-label ${f.status==='approved'?'approved':''}"><span></span>${f.status==='approved'?'Approved':'In progress'}</span><label class="field">Formation name<input data-formation-field="name" value="${esc(f.name)}" maxlength="100" ${isLocked()?'disabled':''}></label><div class="field-row"><label class="field">Start time (s)<input type="number" data-formation-field="time" min="0" max="${project.duration-1}" step=".5" value="${f.time}" ${isLocked()||f.time===0?'disabled':''}></label><label class="field">Duration<div class="input-look">${next?next.time-f.time:project.duration-f.time}<span>seconds</span></div></label></div><div class="property-row"><span>${icon('people')}Performers</span><strong>${project.performers.length}</strong></div><div class="property-row"><span>${icon('music')}Counts</span><strong>${Math.round((next?next.time-f.time:project.duration-f.time)*project.bpm/60)}</strong></div><label class="field">Formation notes<textarea data-formation-field="notes" rows="3" placeholder="A note for your performers…" ${isLocked()?'disabled':''}>${esc(f.notes)}</textarea></label></div><div class="inspector-section"><div class="section-label">TRANSITION TO NEXT ${icon('path')}</div>${next?`<p class="next-formation">${esc(next.name)} ${icon('arrow')}</p><label class="field">Path style<select id="path-style" ${readOnly?'disabled':''}><option value="direct" ${project.pathType==='direct'?'selected':''}>Direct paths</option><option value="curved" ${project.pathType==='curved'?'selected':''}>Curved paths</option></select></label><div class="field-row"><label class="field">Move duration<input type="number" id="transition-duration" min=".5" max="16" step=".5" value="${project.transitionDuration}" ${readOnly?'disabled':''}></label><label class="field">Easing<select id="easing" ${readOnly?'disabled':''}><option value="smooth" ${project.easing==='smooth'?'selected':''}>Smooth</option><option value="linear" ${project.easing==='linear'?'selected':''}>Linear</option></select></label></div><button class="toggle-row" data-action="paths"><span>Show movement paths</span><span class="toggle ${showPaths?'on':''}"></span></button>`:'<p class="field-help">The final formation holds until the end of your performance.</p>'}</div>${viewOptions()}`;
}
function viewOptions(){return `<div class="inspector-section"><div class="section-label">CANVAS DISPLAY</div><button class="toggle-row" data-action="labels"><span>Performer names</span><span class="toggle ${labels?'on':''}"></span></button><button class="toggle-row" data-action="grid"><span>Stage grid</span><span class="toggle ${showGrid?'on':''}"></span></button></div>`;}
function renderNotes(){return `<div class="notes-workspace"><div class="eyebrow">REHEARSAL ROOM</div><h1>Make every count matter.</h1><p class="muted">Keep the small details that make the whole performance.</p><label class="field">Project notes<textarea id="project-notes" rows="12" placeholder="Notes, corrections, moments to revisit…" ${readOnly?'disabled':''}>${esc(project.notes)}</textarea></label><div class="note-callout">${icon('note')}Notes are included in your project backup and printed formation sheets.</div></div>`;}

function waveformSVG(){
  const bars=wave.length?wave:Array.from({length:340},(_,i)=>{const phrase=Math.sin(i*.025)**2;return .10+phrase*.5+Math.abs(Math.sin(i*1.72)*Math.sin(i*.37))*.35;});
  return `<svg viewBox="0 0 1360 46" preserveAspectRatio="none" aria-hidden="true">${bars.map((v,i)=>`<rect x="${i*1360/bars.length}" y="${23-v*21}" width="${Math.max(1,1360/bars.length-1.5)}" height="${Math.max(2,v*42)}" rx=".8" fill="currentColor"/>`).join('')}</svg>`;
}
function renderTimeline(){return `<section class="timeline" aria-label="Performance timeline"><div class="transport"><div class="transport-left"><span class="section-label">PERFORMANCE TIMELINE</span><span class="timeline-duration">${timecode(project.duration)}</span></div><div class="playback-controls">${btn('skip','start','Back to start')}${btn('prev','previous','Previous formation')}<button class="play-button" data-action="play" aria-label="${playing?'Pause':'Play'} (Space)">${icon(playing?'pause':'play')}</button>${btn('next','next','Next formation')}<span class="transport-time" id="transport-time">${timecode(time)}<small>.${String(Math.floor((time%1)*100)).padStart(2,'0')}</small><span>/ ${timecode(project.duration)}</span></span>${btn('loop','loop','Loop performance',loop?'selected':'')}<select id="playback-rate" aria-label="Playback speed">${[.5,.75,1,1.25,1.5].map(r=>`<option value="${r}" ${r===rate?'selected':''}>${r}×</option>`).join('')}</select></div><div class="transport-right"><label class="tempo-control"><input type="number" id="bpm" min="30" max="300" value="${project.bpm}" aria-label="Beats per minute" ${readOnly?'disabled':''}>BPM</label>${btn(muted?'muted':'volume','mute',muted?'Unmute':'Mute')}<span class="beat-counter" id="beat-counter">${beatAt(project,time).phrase}<span>.</span>${beatAt(project,time).beat}<small>/ 8</small></span></div></div><div class="timeline-body"><div class="track-labels"><div class="ruler-label">TRACKS ${icon('layers')}</div><div class="track-name music-track">${icon('music')}<span>Music<small>${project.audioName?'Uploaded audio':'First light'}</small></span><button data-action="upload-audio" aria-label="Replace music" title="Upload music">${icon('plus')}</button></div><div class="track-name">${icon('layers')}<span>Formations</span><small>${project.formations.length}</small></div><div class="track-name cue-track">${icon('flag')}<span>Technical cues</span><button data-action="add-cue" aria-label="Add cue">${icon('plus')}</button></div></div><div class="timeline-scroll"><div class="timeline-tracks" id="timeline-tracks"><div class="time-ruler" id="time-ruler">${Array.from({length:Math.ceil(project.duration/8)+1},(_,i)=>`<span style="left:${i*8/project.duration*100}%">${timecode(i*8)}</span>`).join('')}</div><div class="audio-lane" data-action="scrub"><span class="audio-track-title">${icon('music')} ${esc(project.audioName||'First light — studio sketch')}<small>${project.audioName?'':'Built-in instrumental'}</small></span>${waveformSVG()}</div><div class="formation-lane">${project.formations.map((f,i)=>{const end=project.formations[i+1]?.time??project.duration;return `<button class="timeline-formation ${f.id===active?'active':''}" data-formation="${f.id}" style="left:${f.time/project.duration*100}%;width:${(end-f.time)/project.duration*100}%"><span>${String(i+1).padStart(2,'0')}</span>${esc(f.name)}<i style="width:${Math.min(project.transitionDuration,end-f.time)/(end-f.time)*100}%"></i></button>`;}).join('')}</div><div class="cue-lane">${project.cues.map(c=>`<button class="cue-marker" data-cue="${c.id}" style="left:${Math.min(92,c.time/project.duration*100)}%" title="${esc(c.label)} at ${timecode(c.time)}">${icon('flag')}${esc(c.label)}</button>`).join('')}</div><div class="playhead" id="playhead" style="left:${time/project.duration*100}%"><span></span><i></i></div></div></div></div></section>`;}

function selectFormation(id){pause();active=id;time=form().time;selected.clear();render();}
function refreshInspector(){ $('#inspector-content').innerHTML=renderInspector(); }
function refreshStage(){if(!$('#stage-wrap'))return;$('#stage-wrap').innerHTML=renderStage();bindStage();}
function refreshSelection(){ $$('.performer-marker').forEach(el=>{const s=selected.has(el.dataset.marker);el.classList.toggle('is-selected',s);$('.selection-ring',el).setAttribute('opacity',s?1:0);});refreshInspector();if(tab==='performers')$('#performer-list').innerHTML=renderRoster(); }

function openDialog(title,body,wide=false){pause();const d=$('#dialog');d.dataset.kind='';d.innerHTML=`<div class="modal-header"><div><div class="eyebrow">CHORYN STUDIO</div><h2>${title}</h2></div>${btn('close','close-dialog','Close dialog')}</div><div class="modal-body">${body}</div>`;d.className=wide?'wide':'';d.showModal();}
function propertiesDialog(){openDialog(mode==='stage'?'Stage properties':selected.size?'Performer properties':'Formation properties',renderInspector());$('#dialog').dataset.kind='inspector';}
function mobileRoster(){openDialog('Your cast',`<div class="mobile-roster">${project.performers.map(p=>`<button class="performer-row" data-mobile-performer="${p.id}"><span class="performer-avatar" style="--performer-color:${p.color}">${p.number}</span><span>${esc(p.name)}<small>${esc(p.role)} · Group ${p.group}</small></span>${icon('chevron')}</button>`).join('')}</div><button class="button primary full" data-action="add-performer">${icon('plus')}Add performer</button>`);}
function closeDialog(){ $('#dialog').close(); }
function presetDialog(newFormation=false){
  if(readOnly)return toast('This is a read-only rehearsal snapshot.');
  const types=[['staggered','Staggered'],['line','Straight line'],['v','V shape'],['circle','Circle'],['diamond','Diamond'],['columns','Columns'],['arc','Arc'],['diagonal','Diagonal']];
  openDialog(newFormation?'A new moment. A new formation.':'A shape to start from.',`<p class="modal-intro">Choose a starting shape. Every position is yours to refine.</p><div class="preset-grid">${types.map(([type,label])=>`<button class="preset-card ${type==='diamond'?'chosen':''}" data-preset="${type}">${miniStage({positions:generateLayout(type,project.performers,project.stage)},180,105,true)}<span>${label}</span>${icon('check')}</button>`).join('')}</div><form id="preset-form" data-new="${newFormation}"><label class="field">Formation name<input name="name" required maxlength="100" value="${newFormation?`Formation ${project.formations.length+1}`:esc(form().name)}"></label><div class="modal-footer"><span>${project.performers.length} performers · ${project.stage.width} × ${project.stage.depth} m</span><button class="button primary" type="submit">${icon('plus')}${newFormation?'Create formation':'Apply to formation'}</button></div></form>`,true);
}
function projectDialog(){openDialog('Your creative space.',`<p class="modal-intro">Every performance starts with an idea. Pick up where you left off.</p><div class="project-grid">${projects.map(p=>`<article class="project-card"><button data-open-project="${p.id}"><div class="project-cover">${miniStage({positions:p.formations[1]?.positions||p.formations[0].positions},300,160,true)}</div><h3>${esc(p.name)}</h3><p>${esc(p.discipline)} · ${p.performers.length} performers</p><small>${p.formations.length} formations · ${timecode(p.duration)}</small></button><div class="project-card-actions">${btn('copy',`duplicate-project-${p.id}`,'Duplicate project')}${btn('trash',`delete-project-${p.id}`,'Delete project')}</div></article>`).join('')}<button class="new-project-card" data-action="new-project">${icon('plus')}<strong>Create a project</strong><span>Find your next movement.</span></button></div><div class="modal-footer"><span>Saved in this browser · ${projects.length} project${projects.length===1?'':'s'}</span><button class="button" data-action="import">${icon('folder')}Restore a backup</button></div>`,true);}
function newProjectDialog(){openDialog('Start something moving.',`<form id="new-project-form"><label class="field">Project name<input name="name" placeholder="Give your performance a name" required maxlength="100" autofocus></label><label class="field">Discipline<select name="discipline"><option>Contemporary dance</option><option>K-pop & commercial dance</option><option>Taekwondo demonstration</option><option>Freestyle Poomsae</option><option>Theater & musical</option><option>Cheerleading</option><option>Custom performance</option></select></label><div class="field-row"><label class="field">Performers<input name="count" type="number" value="12" min="1" max="100" required></label><label class="field">Tempo (BPM)<input name="bpm" type="number" value="120" min="30" max="300" required></label></div><p class="field-help">Starts with a 16 × 10 m stage and six editable formations. Customize everything in the studio.</p><div class="modal-footer"><span>Personal workspace</span><button type="submit" class="button primary">Create project ${icon('arrow')}</button></div></form>`);}
function detailsDialog(){openDialog('Performance details',`<form id="details-form"><label class="field">Project name<input name="name" value="${esc(project.name)}" required maxlength="100" ${readOnly?'disabled':''}></label><label class="field">Description<input name="description" value="${esc(project.description)}" maxlength="200" ${readOnly?'disabled':''}></label><div class="field-row"><label class="field">Duration (seconds)<input name="duration" type="number" min="${Math.ceil(project.formations.at(-1).time+1)}" max="3600" value="${project.duration}" required ${readOnly?'disabled':''}></label><label class="field">Tempo (BPM)<input name="bpm" type="number" min="30" max="300" value="${project.bpm}" required ${readOnly?'disabled':''}></label></div><div class="modal-footer"><button type="button" class="button" data-action="import">Restore backup</button><button class="button primary" ${readOnly?'disabled':''}>Save details</button></div></form>`);}
function addPerformerDialog(){if(readOnly)return;openDialog('A place for everyone.',`<form id="performer-form"><label class="field">Performer name<input name="name" required maxlength="100" placeholder="Name" autofocus></label><div class="field-row"><label class="field">Group<select name="group"><option>A</option><option>B</option><option>C</option></select></label><label class="field">Role<select name="role"><option>Ensemble</option><option>Lead</option><option>Soloist</option><option>Standby</option></select></label></div><p class="field-help">The performer will be added to all formations at center stage.</p><div class="modal-footer"><span>${project.performers.length} / 100 performers</span><button class="button primary" ${project.performers.length>=100?'disabled':''}>${icon('plus')}Add performer</button></div></form>`);}
function settingsDialog(){openDialog('Make the studio yours.',`<div class="settings-option"><div><h3>Appearance</h3><p>A comfortable space for long creative sessions.</p></div><button class="button" data-action="theme">${icon('sun')}${document.documentElement.dataset.theme==='dark'?'Use light mode':'Use dark mode'}</button></div><div class="settings-option"><div><h3>Local-first projects</h3><p>Your edits and audio are saved in this browser. Export a backup before changing devices or clearing browser data.</p></div>${icon('lock')}</div><div class="settings-option"><div><h3>Coordinate convention</h3><p>Positions use meters. X increases to audience-right; Z increases upstage. Facing 0° looks toward the audience.</p></div>${icon('box')}</div><div class="settings-option"><div><h3>Core studio · v0.1</h3><p>Accounts, team permissions, live collaboration, billing, and translated interfaces are planned backend work.</p></div></div>`);}
function exportDialog(){openDialog('Take your performance with you.',`<p class="modal-intro">From the studio to the rehearsal room. Choose what you need.</p><div class="export-options"><button data-action="export-png">${icon('grid')}<span><strong>Formation image</strong><small>High-resolution PNG · current formation</small></span>${icon('export')}</button><button data-action="export-svg">${icon('layers')}<span><strong>Vector stage plot</strong><small>Editable SVG · current formation</small></span>${icon('export')}</button><button data-action="export-print">${icon('note')}<span><strong>Rehearsal formation sheets</strong><small>All formations, cast, coordinates, and notes · Print / PDF</small></span>${icon('export')}</button><button data-action="export-backup">${icon('folder')}<span><strong>Complete project backup</strong><small>Versioned JSON · restore in any CHORYN studio</small></span>${icon('export')}</button></div><p class="field-help">Uploaded music stays on this device and is not included in exports.</p>`);}
function shareDialog(){openDialog('Give your team the whole picture.',`<div class="share-illustration">${icon('share')}</div><p class="modal-intro">Create a read-only rehearsal snapshot of your current formations, timing, cast, and notes.</p><div class="share-detail">${icon('eye')}View and play back the routine</div><div class="share-detail">${icon('lock')}Changes to the original are not synced</div><p class="field-help">Snapshot links contain project data in the URL. Anyone who can open the site and has the link can view it. Uploaded audio is excluded. This is not authenticated team sharing.</p><div class="modal-footer"><span>${project.formations.length} formations · ${project.performers.length} performers</span><button class="button primary" data-action="copy-share">${icon('copy')}Copy snapshot link</button></div>`);}
function helpDialog(){openDialog('A little guidance. A lot of possibility.',`<p class="modal-intro">Choose a formation on the left. Select and drag performers on stage, or enter exact positions in the inspector. Press play to bring the transitions to life.</p><div class="shortcut-list">${[['Play / pause','Space'],['Undo','Ctrl / ⌘ + Z'],['Redo','Ctrl / ⌘ + Shift + Z'],['Select / pan','V / H'],['Paths / measure','P / M'],['Select all performers','Ctrl / ⌘ + A'],['Move selected performers','Arrow keys'],['Move by 0.5 meters','Shift + arrows'],['Clear selection','Escape'],['Delete selected performers','Delete'],['Keyboard shortcuts','?']].map(([l,k])=>`<div><span>${l}</span><kbd>${k}</kbd></div>`).join('')}</div><p class="field-help">Every stage marker is keyboard focusable. Enter selects it; arrow keys adjust its position. Approved formations must be unlocked before editing.</p>`);}
function rehearsalDialog(){openDialog('Ready for the rehearsal room.',`<p class="modal-intro">${esc(project.name)} · ${project.performers.length} performers · ${timecode(project.duration)}</p><div class="rehearsal-run">${project.formations.map((f,i)=>`<button data-formation="${f.id}"><span class="run-time">${timecode(f.time)}</span><span><strong>${esc(f.name)}</strong><small>${esc(f.notes||'Review positions and transition together.')}</small></span><span class="run-count">${i+1}</span></button>`).join('')}</div><button class="button primary full" data-action="export-print">${icon('note')}Print rehearsal plan / Save PDF</button>`);}

document.addEventListener('click',async e=>{
  const preset=e.target.closest('[data-preset]');if(preset){$$('.preset-card').forEach(el=>el.classList.toggle('chosen',el===preset));return;}
  const f=e.target.closest('[data-formation]');if(f){if($('#dialog').open)closeDialog();selectFormation(f.dataset.formation);return;}
  const op=e.target.closest('[data-open-project]');if(op){await switchProject(op.dataset.openProject);closeDialog();return;}
  const at=e.target.closest('[data-tab]');if(at){tab=at.dataset.tab;render();return;}
  const mo=e.target.closest('[data-mode]');if(mo){mode=mo.dataset.mode;render();if(mode==='stage'&&window.innerWidth<=900)propertiesDialog();return;}
  const mp=e.target.closest('[data-mobile-performer]');if(mp){selected=new Set([mp.dataset.mobilePerformer]);refreshSelection();propertiesDialog();return;}
  const vi=e.target.closest('[data-view]');if(vi){view=vi.dataset.view;render();return;}
  const pe=e.target.closest('[data-performer]');if(pe){if(!e.shiftKey)selected.clear();if(selected.has(pe.dataset.performer))selected.delete(pe.dataset.performer);else selected.add(pe.dataset.performer);refreshSelection();return;}
  const gr=e.target.closest('[data-group]');if(gr){selected=new Set(project.performers.filter(p=>p.group===gr.dataset.group).map(p=>p.id));refreshSelection();return;}
  const cue=e.target.closest('[data-cue]');if(cue){const c=project.cues.find(c=>c.id===cue.dataset.cue);cueDialog(c);return;}
  const el=e.target.closest('[data-action]');if(!el || el.disabled)return;
  const a=el.dataset.action;
  if(a.startsWith('tool-')){tool=a.slice(5);if(tool==='path'){showPaths=true;toast('Paths connect this formation to the next. Adjust path style in the inspector.');}render();return;}
  if(a.startsWith('duplicate-project-')){const id=a.slice(18);const p=clone(projects.find(p=>p.id===id));p.id=uid();p.name+=' — copy';projects.unshift(p);try{localStorage.setItem(storageKey,JSON.stringify(projects));}catch{toast('Could not save the copy. Export a backup.');}projectDialog();return;}
  if(a.startsWith('delete-project-')){const id=a.slice(15);openDialog('Delete this project?',`<p class="modal-intro">This removes “${esc(projects.find(p=>p.id===id)?.name)}” from this browser. Export a backup first if you need a copy.</p><div class="modal-footer"><button class="button" data-action="projects">Keep project</button><button class="button danger-fill" data-action="confirm-delete-${id}">Delete project</button></div>`);return;}
  if(a.startsWith('confirm-delete-')){const id=a.slice(15);projects=projects.filter(p=>p.id!==id);if(!projects.length)projects=[createProject('Untitled performance')];await removeAudio(id);if(project.id===id)await switchProject(projects[0].id);try{localStorage.setItem(storageKey,JSON.stringify(projects));}catch{toast('Could not update browser storage.');}projectDialog();return;}
  switch(a){
    case 'home':case 'studio':e.preventDefault();mode='formation';render();break;
    case 'projects':projectDialog();break;
    case 'new-project':newProjectDialog();break;
    case 'project-details':detailsDialog();break;
    case 'templates':presetDialog(false);break;
    case 'cast':tab='performers';render();if(window.innerWidth<=650)mobileRoster();break;
    case 'properties':propertiesDialog();break;
    case 'stage-settings':mode='stage';render();propertiesDialog();break;
    case 'rehearsals':rehearsalDialog();break;
    case 'settings':settingsDialog();break;
    case 'help':helpDialog();break;
    case 'close-dialog':closeDialog();break;
    case 'undo':undo();break;case 'redo':undo(true);break;
    case 'share':shareDialog();break;
    case 'copy-share':{ const bytes=new TextEncoder().encode(JSON.stringify(project));let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));const link=`${location.origin}${location.pathname}#rehearsal=${btoa(binary)}`;try{await navigator.clipboard.writeText(link);toast('Read-only snapshot link copied.');closeDialog();}catch{$('.modal-body',$('#dialog')).innerHTML=`<label class="field">Copy this read-only snapshot URL<textarea rows="5" readonly>${esc(link)}</textarea></label>`;}break;}
    case 'export':exportDialog();break;
    case 'export-backup':download(JSON.stringify(project,null,2),`${project.name}.choryn.json`,'application/json');closeDialog();toast('Project backup exported.');break;
    case 'export-svg':download(exportSVG(form()),`${form().name}.svg`,'image/svg+xml');closeDialog();break;
    case 'export-png':exportPNG();break;
    case 'export-print':printSheets();break;
    case 'import':if(readOnly)return;$('#backup-input').click();break;
    case 'new-formation':presetDialog(true);break;
    case 'add-performer':addPerformerDialog();break;
    case 'remove-performer':removePerformers();break;
    case 'clear-selection':selected.clear();refreshSelection();break;
    case 'align':if(!isLocked()){if(selected.size<2){toast('Select two or more performers with Shift + click.');break;}remember();const ps=form().positions.filter(p=>selected.has(p.performerId));const z=ps.reduce((s,p)=>s+p.z,0)/ps.length;ps.forEach(p=>p.z=z);commit('Selected performers aligned horizontally.');}break;
    case 'mirror':mirror=!mirror;render();break;
    case 'grid':showGrid=!showGrid;render();break;
    case 'snap':snap=!snap;render();break;
    case 'labels':labels=!labels;render();break;
    case 'paths':showPaths=!showPaths;render();break;
    case 'zoom-in':zoom=clamp(zoom+.1,.5,2);render();break;
    case 'zoom-out':zoom=clamp(zoom-.1,.5,2);render();break;
    case 'fit':zoom=1;pan={x:0,y:0};render();break;
    case 'play':playing?pause():await play();break;
    case 'start':seek(0);break;
    case 'next':selectFormation(project.formations[Math.min(project.formations.length-1,project.formations.findIndex(q=>q.id===active)+1)].id);break;
    case 'previous':selectFormation(project.formations[Math.max(0,project.formations.findIndex(q=>q.id===active)-1)].id);break;
    case 'loop':loop=!loop;render();break;
    case 'mute':muted=!muted;if(gainNode)gainNode.gain.value=muted?0:.65;render();break;
    case 'approve':if(readOnly)return;remember();form().status=form().status==='approved'?'draft':'approved';commit(form().status==='approved'?'Formation approved. Positions are locked.':'Formation unlocked for editing.');break;
    case 'upload-audio':if(!readOnly)$('#audio-input').click();break;
    case 'reset-audio':if(readOnly)return;pause();await removeAudio(project.id);audioBuffer=null;wave=[];project.audioName=null;persistedAudio=false;save();render();toast('Built-in studio sketch restored.');break;
    case 'theme':{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('choryn.theme',theme);}catch{toast('Theme preference could not be saved.');}document.documentElement.dataset.theme=theme;render();settingsDialog();break;}
    case 'toggle-panels':panelHidden=!panelHidden;render();break;
    case 'inspector-menu':openDialog('Formation actions',`<div class="export-options"><button data-action="duplicate-formation">${icon('copy')}Duplicate formation</button><button data-action="approve">${icon('lock')}${form().status==='approved'?'Unlock':'Approve'} formation</button><button data-action="delete-formation" ${project.formations.length<=1||form().time===0?'disabled':''}>${icon('trash')}Delete formation</button></div>`);break;
    case 'duplicate-formation':if(!isLocked()){const index=project.formations.findIndex(f=>f.id===active);const next=project.formations[index+1]?.time??project.duration;const t=shortNum((next+form().time)/2);if(t===form().time)return;remember();const copy={...clone(form()),id:uid(),name:`${form().name} — copy`,time:t,status:'draft'};project.formations.push(copy);project.formations.sort((a,b)=>a.time-b.time);active=copy.id;time=t;closeDialog();commit('Formation duplicated.');}break;
    case 'delete-formation':if(!isLocked()&&form().time!==0){remember();project.formations=project.formations.filter(f=>f.id!==active);active=project.formations[0].id;time=0;closeDialog();commit('Formation deleted. Undo is available.');}break;
    case 'add-cue':if(!readOnly)cueDialog();break;
    case 'delete-cue':if(!readOnly){remember();project.cues=project.cues.filter(c=>c.id!==el.dataset.id);closeDialog();commit('Cue removed.');}break;
  }
});

document.addEventListener('input',e=>{
  if(e.target.id==='performer-search'){search=e.target.value;$('#performer-list').innerHTML=renderRoster();}
});
document.addEventListener('change',e=>{
  const el=e.target;
  if(el.id==='playback-rate'){const was=playing;pause();rate=Number(el.value);if(was)play();return;}
  if(readOnly)return;
  if(el.matches('[data-stage-field]')){const n=Number(el.value);if(!Number.isFinite(n)||n<2||n>100){toast('Stage dimensions must be between 2 and 100 meters.');render();return;}remember();project.stage[el.dataset.stageField]=n;commit();}
  if(el.matches('[data-formation-field]')&&!isLocked()){
    const key=el.dataset.formationField;let v=el.value;
    if(key==='time'){v=Number(v);if(!Number.isFinite(v)||v<=0||v>=project.duration||project.formations.some(f=>f.id!==active&&f.time===v)){toast('Choose a unique start time inside the performance.');render();return;}}
    if(key==='name'&&!v.trim()){render();return;}
    remember();form()[key]=v;project.formations.sort((a,b)=>a.time-b.time);time=form().time;commit();
  }
  if(el.matches('[data-person-field]')&&selected.size===1){remember();const p=project.performers.find(p=>selected.has(p.id));p[el.dataset.personField]=el.value.slice(0,100);if(el.dataset.personField==='group')p.color=COLORS[['A','B','C'].indexOf(el.value)];commit();}
  if(el.matches('[data-position-field]')&&!isLocked()&&selected.size===1){const n=Number(el.value);if(!Number.isFinite(n)||Math.abs(n)>360)return;remember();const p=form().positions.find(p=>selected.has(p.performerId));p[el.dataset.positionField]=n;commit();}
  const settings={'path-style':'pathType','easing':'easing','transition-duration':'transitionDuration','bpm':'bpm','project-notes':'notes'};
  if(settings[el.id]){const n=['bpm','transition-duration'].includes(el.id)?Number(el.value):el.value;if(el.id==='bpm'&&(!Number.isFinite(n)||n<30||n>300)){toast('Tempo must be 30–300 BPM.');render();return;}if(el.id==='transition-duration'&&(!Number.isFinite(n)||n<.5||n>16)){toast('Transition duration must be 0.5–16 seconds.');render();return;}pause();remember();project[settings[el.id]]=n;commit();}
});

document.addEventListener('submit',async e=>{
  e.preventDefault();if(readOnly)return;
  const data=new FormData(e.target);
  if(data.has('name')&&!String(data.get('name')).trim()){toast('Please enter a name.');return;}
  switch(e.target.id){
    case 'preset-form':{
      if(isLocked()&&e.target.dataset.new!=='true'){toast('Unlock the approved formation first.');return;}
      const type=$('.preset-card.chosen').dataset.preset;remember();
      if(e.target.dataset.new==='true'){
        if(project.formations.length>=100){toast('A project supports up to 100 formations.');history.pop();return;}
        const last=project.formations.at(-1);let t=last.time+16;if(t>=project.duration)project.duration=t+16;const f={id:uid(),name:data.get('name').trim(),time:t,status:'draft',notes:'',positions:generateLayout(type,project.performers,project.stage)};project.formations.push(f);active=f.id;time=t;
      }else{form().name=data.get('name').trim();form().positions=generateLayout(type,project.performers,project.stage);}
      selected.clear();closeDialog();commit('Formation ready. Make it your own.');break;
    }
    case 'new-project-form':{pause();const p=createProject(data.get('name').trim(),Number(data.get('count')),data.get('discipline'));p.bpm=Number(data.get('bpm'));projects.unshift(p);await switchProject(p.id);save();closeDialog();toast('Your new performance is ready.');break;}
    case 'details-form':remember();project.name=data.get('name').trim();project.description=data.get('description');project.duration=Number(data.get('duration'));project.bpm=Number(data.get('bpm'));project.cues=project.cues.filter(c=>c.time<=project.duration);time=clamp(time,0,project.duration);closeDialog();commit('Performance details saved.');break;
    case 'performer-form':{remember();const group=data.get('group');const p={id:uid(),name:data.get('name').trim(),number:project.performers.length+1,group,role:data.get('role'),color:COLORS[['A','B','C'].indexOf(group)]};project.performers.push(p);project.formations.forEach(f=>{f.positions.push({performerId:p.id,x:0,z:0,facing:0,visible:true});f.status='draft';});selected=new Set([p.id]);tab='performers';closeDialog();commit('Performer added to every formation. Approvals reset for review.');break;}
    case 'cue-form':{remember();const id=e.target.dataset.id;const c={id:id||uid(),label:data.get('label').trim(),time:Number(data.get('time'))};if(id)project.cues=project.cues.map(q=>q.id===id?c:q);else project.cues.push(c);project.cues.sort((a,b)=>a.time-b.time);closeDialog();commit('Technical cue saved.');break;}
  }
});
function cueDialog(c){openDialog(c?'Technical cue':'A cue for the next moment.',`<form id="cue-form" data-id="${c?.id||''}"><label class="field">Cue label<input name="label" value="${esc(c?.label||'LX 04 · New cue')}" required maxlength="150" ${readOnly?'disabled':''}></label><label class="field">Time (seconds)<input name="time" type="number" min="0" max="${project.duration}" step=".1" value="${c?.time??shortNum(time)}" required ${readOnly?'disabled':''}></label><p class="field-help">Planning cues are visual rehearsal references. They do not send commands to stage equipment.</p><div class="modal-footer">${c?`<button class="text-button danger" type="button" data-action="delete-cue" data-id="${c.id}" ${readOnly?'disabled':''}>Delete cue</button>`:'<span>Production planning</span>'}<button class="button primary" ${readOnly?'disabled':''}>Save cue</button></div></form>`);}

function removePerformers(){
  if(readOnly||!selected.size)return;
  if(project.performers.length-selected.size<1){toast('Keep at least one performer in your project.');return;}
  remember();project.performers=project.performers.filter(p=>!selected.has(p.id));project.performers.forEach((p,i)=>p.number=i+1);project.formations.forEach(f=>{f.positions=f.positions.filter(p=>!selected.has(p.performerId));f.status='draft';});selected.clear();commit('Performer removed from all formations. Undo is available.');
}

function bindStage(){
  const svg=$('#stage-svg');if(!svg)return;
  const point=e=>{const p=new DOMPoint(e.clientX,e.clientY).matrixTransform($('#stage-transform').getScreenCTM().inverse());return{x:(p.x-480)/960*project.stage.width,z:(300-p.y)/600*project.stage.depth,px:p.x,py:p.y};};
  let drag=null;
  svg.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    const marker=e.target.closest('[data-marker]');
    if(marker&&!playing&&!isLocked()&&tool!=='ruler'&&tool!=='hand'&&Math.abs(time-form().time)>.001){time=form().time;updatePlayback(true);}
    const p=point(e);
    if(tool==='ruler'){svg.setPointerCapture(e.pointerId);drag={type:'measure',start:p};return;}
    if(tool==='hand'){svg.setPointerCapture(e.pointerId);drag={type:'pan',start:{x:e.clientX,y:e.clientY},pan:{...pan}};return;}
    if(marker){
      const id=marker.dataset.marker;
      if(e.shiftKey){selected.has(id)?selected.delete(id):selected.add(id);}else if(!selected.has(id)){selected.clear();selected.add(id);}
      refreshSelection();
      if(isLocked()||playing)return;
      svg.setPointerCapture(e.pointerId);drag={type:'move',start:p,positions:clone(form().positions),saved:false};
    }else {selected.clear();refreshSelection();}
  });
  svg.addEventListener('pointermove',e=>{
    if(!drag)return;const p=point(e);
    if(drag.type==='pan'){const ratio=1060/svg.getBoundingClientRect().width;pan={x:drag.pan.x+(e.clientX-drag.start.x)*ratio,y:drag.pan.y+(e.clientY-drag.start.y)*ratio};$('#stage-transform').setAttribute('transform',`translate(${pan.x} ${pan.y}) translate(480 300) scale(${zoom*(mirror?-1:1)} ${zoom}) translate(-480 -300)`);return;}
    if(drag.type==='measure'){$('#measure-layer').innerHTML=`<path d="M${drag.start.px} ${drag.start.py}L${p.px} ${p.py}" stroke="var(--accent)" stroke-width="2" stroke-dasharray="5 4"/><rect x="${(p.px+drag.start.px)/2-42}" y="${(p.py+drag.start.py)/2-28}" width="84" height="25" rx="6" fill="var(--surface)"/><text x="${(p.px+drag.start.px)/2}" y="${(p.py+drag.start.py)/2-11}" text-anchor="middle" fill="var(--accent)" font-size="13">${Math.hypot(p.x-drag.start.x,p.z-drag.start.z).toFixed(2)} m</text>`;return;}
    let dx=p.x-drag.start.x,dz=p.z-drag.start.z;
    if(Math.abs(dx)+Math.abs(dz)<.02&&!drag.saved)return;
    if(!drag.saved){remember();drag.saved=true;}
    if(snap){dx=Math.round(dx*2)/2;dz=Math.round(dz*2)/2;}
    const originals=drag.positions.filter(pos=>selected.has(pos.performerId));
    dx=clamp(dx,-project.stage.width/2+.2-Math.min(...originals.map(p=>p.x)),project.stage.width/2-.2-Math.max(...originals.map(p=>p.x)));
    dz=clamp(dz,-project.stage.depth/2+.2-Math.min(...originals.map(p=>p.z)),project.stage.depth/2-.2-Math.max(...originals.map(p=>p.z)));
    form().positions.forEach(pos=>{if(selected.has(pos.performerId)){const original=drag.positions.find(q=>q.performerId===pos.performerId);pos.x=shortNum(original.x+dx);pos.z=shortNum(original.z+dz);const marker=$(`[data-marker="${pos.performerId}"]`);marker?.setAttribute('transform',`translate(${480+pos.x/project.stage.width*960} ${300-pos.z/project.stage.depth*600})`);}});
  });
  const finish=()=>{if(drag?.type==='move'&&drag.saved){save();render();}drag=null;};
  svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',finish);
  svg.addEventListener('keydown',e=>{const marker=e.target.closest('[data-marker]');if(marker&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();selected=new Set([marker.dataset.marker]);refreshSelection();}});
}
function bindTimeline(){
  const area=$('#timeline-tracks');if(!area)return;let scrubbing=false;
  const update=e=>{const rect=area.getBoundingClientRect();seek(clamp((e.clientX-rect.left)/rect.width,0,1)*project.duration,false);};
  area.addEventListener('pointerdown',e=>{if(e.target.closest('[data-formation],[data-cue]'))return;pause();scrubbing=true;area.setPointerCapture(e.pointerId);update(e);});
  area.addEventListener('pointermove',e=>{if(scrubbing)update(e);});
  area.addEventListener('pointerup',()=>{scrubbing=false;render();});
}

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){selected.clear();refreshSelection();return;}
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||$('#dialog').open)return;
  const mod=e.ctrlKey||e.metaKey;
  if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey);return;}
  if(mod&&e.key.toLowerCase()==='a'){e.preventDefault();selected=new Set(project.performers.map(p=>p.id));refreshSelection();return;}
  if(e.key===' '){e.preventDefault();playing?pause():play();return;}
  if(e.key==='?'){helpDialog();return;}
  if(['v','h','p','m'].includes(e.key.toLowerCase())){tool={v:'cursor',h:'hand',p:'path',m:'ruler'}[e.key.toLowerCase()];if(tool==='path')showPaths=true;render();return;}
  if(e.key==='Delete'||e.key==='Backspace'){if(selected.size){e.preventDefault();removePerformers();}return;}
  if(e.key.startsWith('Arrow')&&selected.size&&!isLocked()&&!playing){e.preventDefault();remember();const step=e.shiftKey?.5:.1;const dx=e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0;const dz=e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0;form().positions.forEach(p=>{if(selected.has(p.performerId)){p.x=shortNum(clamp(p.x+dx,-project.stage.width/2+.2,project.stage.width/2-.2));p.z=shortNum(clamp(p.z+dz,-project.stage.depth/2+.2,project.stage.depth/2-.2));}});save();refreshStage();refreshInspector();}
});

let gainNode;
function getAudioContext(){if(!audioContext){audioContext=new AudioContext();gainNode=audioContext.createGain();gainNode.gain.value=muted?0:.65;gainNode.connect(audioContext.destination);}return audioContext;}
function demoAudio(){
  const ctx=getAudioContext(),sr=ctx.sampleRate,duration=96;
  const buffer=ctx.createBuffer(1,sr*duration,sr),out=buffer.getChannelData(0);
  // Original procedural instrumental. The displayed waveform is derived from this buffer.
  const chords=[[130.81,164.81,196],[110,130.81,164.81],[87.31,110,130.81],[98,123.47,146.83]];
  for(let i=0;i<out.length;i++){
    const t=i/sr,beat=t%.5,chord=chords[Math.floor(t/8)%4];
    const fade=Math.min(1,t/3,(duration-t)/4);
    let value=Math.sin(2*Math.PI*(55*beat+55*.03*(1-Math.exp(-beat/.03))))*Math.exp(-beat*24)*.2;
    const note=chord[Math.floor(t*2)%3]*2;
    value+=(Math.sin(2*Math.PI*note*t)+.3*Math.sin(2*Math.PI*note*2*t))*Math.exp(-beat*7)*.055;
    chord.forEach(hz=>value+=Math.sin(2*Math.PI*hz*t)*(.5+.5*Math.sin(t*.35))*.025);
    out[i]=value*fade;
  }
  return buffer;
}
function computeWave(buffer){const channel=buffer.getChannelData(0);wave=Array.from({length:340},(_,i)=>{const start=Math.floor(i/340*channel.length),end=Math.floor((i+1)/340*channel.length);let peak=0;for(let j=start;j<end;j+=Math.max(1,Math.floor((end-start)/200)))peak=Math.max(peak,Math.abs(channel[j]));return Math.min(1,peak*2.5);});}
async function play(){
  try {
    const ctx=getAudioContext();await ctx.resume();
    if(project.audioName&&!audioBuffer){toast('This snapshot does not include uploaded audio. Upload the original file to play it.');}
    if(!audioBuffer && !project.audioName){audioBuffer=demoAudio();computeWave(audioBuffer);const lane=$('.audio-lane');if(lane){$('svg',lane).outerHTML=waveformSVG();}}
    if(time>=project.duration)time=0;
    playing=true;clockStart=performance.now();clockOffset=time;
    if(audioBuffer&&time<audioBuffer.duration){audioSource=ctx.createBufferSource();audioSource.buffer=audioBuffer;audioSource.playbackRate.value=rate;audioSource.connect(gainNode);audioStart=ctx.currentTime;audioSource.start(0,time);}
    updatePlayButton();requestAnimationFrame(tick);
  }catch(err){playing=false;toast('Audio could not start. Try another audio format.');updatePlayButton();}
}
function clockTime(){return clockOffset+(audioSource?audioContext.currentTime-audioStart:(performance.now()-clockStart)/1000)*rate;}
function pause(){if(playing)time=clamp(clockTime(),0,project.duration);playing=false;if(audioSource){try{audioSource.stop();}catch{}audioSource.disconnect();audioSource=null;}updatePlayButton();}
function updatePlayButton(){const b=$('.play-button');if(b){b.innerHTML=icon(playing?'pause':'play');b.setAttribute('aria-label',`${playing?'Pause':'Play'} (Space)`);}}
function seek(t,reset=true){pause();time=clamp(t,0,project.duration);const f=project.formations.findLast(f=>f.time<=time)||project.formations[0];if(active!==f.id){active=f.id;selected.clear();if(reset)render();}updatePlayback(true);}
function tick(now){if(!playing)return;time=clockTime();if(time>=project.duration){if(loop){pause();time=0;play();return;}pause();time=project.duration;updatePlayback(true);return;}if(now-lastFrame>25){const current=project.formations.findLast(f=>f.time<=time)||project.formations[0];if(active!==current.id){active=current.id;selected.clear();render();}else updatePlayback(true);lastFrame=now;}requestAnimationFrame(tick);}
function updatePlayback(sample=false){
  const tc=$('#transport-time');if(tc)tc.innerHTML=`${timecode(time)}<small>.${String(Math.floor(time%1*100)).padStart(2,'0')}</small><span>/ ${timecode(project.duration)}</span>`;
  const ph=$('#playhead');if(ph)ph.style.left=`${time/project.duration*100}%`;
  const beat=beatAt(project,time);const bc=$('#beat-counter');if(bc)bc.innerHTML=`${beat.phrase}<span>.</span>${beat.beat}<small>/ 8</small>`;
  if(sample||playing){samplePerformance(project,time).forEach(p=>{const el=$(`[data-marker="${p.performerId}"]`);if(el){el.setAttribute('transform',`translate(${480+p.x/project.stage.width*960} ${300-p.z/project.stage.depth*600})`);el.querySelector('g')?.setAttribute('transform',`rotate(${p.facing})`);}});}
  $$('.timeline-formation').forEach((el,i)=>{const next=project.formations[i+1]?.time??project.duration;el.classList.toggle('playing',playing && time>=project.formations[i].time&&time<next);});
}

async function getDB(){if(audioDB)return audioDB;return new Promise((resolve,reject)=>{const req=indexedDB.open('choryn-media',1);req.onupgradeneeded=()=>req.result.createObjectStore('audio');req.onsuccess=()=>{audioDB=req.result;resolve(audioDB);};req.onerror=()=>reject(req.error);});}
async function putAudio(blob){const db=await getDB();return new Promise((resolve,reject)=>{const tx=db.transaction('audio','readwrite');tx.objectStore('audio').put(blob,project.id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
async function removeAudio(id){try{const db=await getDB();const tx=db.transaction('audio','readwrite');tx.objectStore('audio').delete(id);}catch{}}
async function loadAudio(){audioBuffer=null;persistedAudio=false;wave=[];if(!project.audioName||readOnly)return;try{const db=await getDB();const blob=await new Promise((resolve,reject)=>{const req=db.transaction('audio').objectStore('audio').get(project.id);req.onsuccess=()=>resolve(req.result);req.onerror=reject;});if(blob){audioBuffer=await getAudioContext().decodeAudioData(await blob.arrayBuffer());computeWave(audioBuffer);persistedAudio=true;}}catch{toast('Saved music could not be loaded. Upload it again.');}}
async function switchProject(id){pause();clearTimeout(saveTimer);if(!readOnly){const index=projects.findIndex(p=>p.id===project.id);if(index>=0)projects[index]=project;try{localStorage.setItem(storageKey,JSON.stringify(projects));}catch{toast('Could not save before switching. Export a backup.');}}project=projects.find(p=>p.id===id);readOnly=false;if(location.hash)historyReplace();active=project.formations[0].id;time=0;history=[];future=[];selected.clear();await loadAudio();render();}
function historyReplace(){window.history.replaceState(null,'',location.pathname);}
$('#audio-input').addEventListener('change',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file||readOnly)return;
  if(file.size>50*1024*1024){toast('Choose an audio file smaller than 50 MB.');return;}
  toast('Reading your music…');pause();
  try{const buffer=await getAudioContext().decodeAudioData(await file.arrayBuffer());if(buffer.duration>3600)throw new Error('too long');remember();audioBuffer=buffer;computeWave(buffer);project.audioName=file.name;const minLength=project.formations.at(-1).time+1;project.duration=Math.max(minLength,Math.ceil(buffer.duration));time=0;try{await putAudio(file);persistedAudio=true;toast('Music uploaded and saved on this device.');}catch{toast('Music loaded for this session. Browser storage is unavailable.');}save();render();}catch{toast('This audio format could not be decoded. Try an MP3 or WAV under one hour.');}
});
$('#backup-input').addEventListener('change',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file||readOnly)return;
  if(file.size>5*1024*1024){toast('Project backup is too large (maximum 5 MB).');return;}
  try{const p=validateProject(JSON.parse(await file.text()));p.id=uid();p.name+=' — restored';projects.unshift(p);await switchProject(p.id);save();closeDialog();toast('Backup restored as a new project. Upload its music separately.');}catch(err){toast(err.message==='This is not a valid CHORYN v1 project backup.'?err.message:'Could not read this project backup.');}
});

function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name.replace(/[<>:"/\\|?*]/g,'-');a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function exportSVG(f){
  const w=1200,h=800,pad=90,sw=w-pad*2,sh=h-pad*2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="880" viewBox="0 0 1200 880"><rect width="1200" height="880" fill="#faf9fc"/><text x="60" y="44" font-family="Arial,sans-serif" fill="#272330" font-size="23" font-weight="700">CHORYN / ${esc(project.name)}</text><text x="60" y="75" font-family="Arial,sans-serif" fill="#746b7f" font-size="16">${esc(f.name)} · ${timecode(f.time)} · ${project.stage.width} × ${project.stage.depth} m</text><g transform="translate(0 20)"><rect x="${pad}" y="${pad}" width="${sw}" height="${sh}" fill="#f0eef5" stroke="#c6c0d2"/><path d="M${w/2} ${pad}v${sh}M${pad} ${h/2}h${sw}" fill="none" stroke="#c6c0d2" stroke-dasharray="5 5"/>${Array.from({length:Math.floor(project.stage.width)+1},(_,i)=>`<path d="M${pad+i/project.stage.width*sw} ${pad}v${sh}" stroke="#ddd9e6"/>`).join('')}${Array.from({length:Math.floor(project.stage.depth)+1},(_,i)=>`<path d="M${pad} ${pad+i/project.stage.depth*sh}h${sw}" stroke="#ddd9e6"/>`).join('')}${f.positions.map(p=>{const perf=project.performers.find(q=>q.id===p.performerId),x=pad+(p.x/project.stage.width+.5)*sw,y=pad+(.5-p.z/project.stage.depth)*sh;return `<circle cx="${x}" cy="${y}" r="21" fill="${perf.color}" stroke="white" stroke-width="3"/><text x="${x}" y="${y+5}" fill="white" text-anchor="middle" font-family="Arial,sans-serif" font-size="14">${String(perf.number).padStart(2,'0')}</text><text x="${x}" y="${y+39}" fill="#4d4659" text-anchor="middle" font-family="Arial,sans-serif" font-size="14">${esc(perf.name)}</text>`;}).join('')}<text x="600" y="${h-30}" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" letter-spacing="4" fill="#746b7f">AUDIENCE / DOWNSTAGE</text></g><text x="60" y="860" font-family="Arial,sans-serif" fill="#746b7f" font-size="13">From first count to final cue. · CHORYN Studio</text></svg>`;
}
async function exportPNG(){try{const svg=exportSVG(form());const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=1760;canvas.getContext('2d').drawImage(img,0,0,2400,1760);URL.revokeObjectURL(url);canvas.toBlob(blob=>{if(blob){download(blob,`${form().name}.png`,'image/png');closeDialog();toast('Formation image exported.');}},'image/png');}catch{toast('Image export failed. Try the SVG stage plot instead.');}}
function printSheets(){
  const win=window.open('','_blank');if(!win){toast('Allow the print window, then try again.');return;}
  win.document.write(`<!doctype html><html><head><title>${esc(project.name)} — CHORYN rehearsal sheets</title><style>body{font:12px Arial;color:#272330;margin:30px}h1{font-size:24px}h2{font-size:19px}p{white-space:pre-line}section{break-after:page}svg{width:100%;max-height:480px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:5px 8px;border-bottom:1px solid #ddd}header{display:flex;justify-content:space-between}.notes{color:#665e73}button{padding:10px 20px;margin-bottom:20px}@media print{button{display:none}body{margin:0}section:last-child{break-after:auto}}@page{size:A4 portrait;margin:14mm}</style></head><body><button onclick="window.print()">Print / Save as PDF</button>${project.formations.map((f,i)=>`<section><header><h1>CHORYN / ${esc(project.name)}</h1><p>${i+1} / ${project.formations.length}</p></header>${exportSVG(f)}<h2>${esc(f.name)} · ${timecode(f.time)}</h2><p class="notes">${esc(f.notes)}</p><table><thead><tr><th>#</th><th>Performer</th><th>Group</th><th>X (m)</th><th>Z (m)</th><th>Facing</th></tr></thead><tbody>${f.positions.map(p=>{const perf=project.performers.find(q=>q.id===p.performerId);return `<tr><td>${perf.number}</td><td>${esc(perf.name)}</td><td>${perf.group}</td><td>${shortNum(p.x)}</td><td>${shortNum(p.z)}</td><td>${p.facing}°</td></tr>`;}).join('')}</tbody></table>${i===0?`<h3>Project notes</h3><p class="notes">${esc(project.notes)}</p>`:''}</section>`).join('')}</body></html>`);win.document.close();closeDialog();
}

$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const rect=e.target.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)closeDialog();}});
window.addEventListener('pagehide',persistNow);
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#rehearsal='))location.reload();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persistNow();});
render();
loadAudio().then(()=>{if(project.audioName)render();});
if(!readOnly&&!storageError)save();
if(storageError)setTimeout(()=>toast('Browser storage could not be read. Export a backup to keep this session.'),800);
