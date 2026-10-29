import {validateProject,samplePerformance,beatAt} from './engine.js';
import {renderStage2D,stageTransform} from './stage2d.js';
import {sceneProject} from './production-next-model.js';
import {createPlaybackView} from './playback-view.js';
import {presentationView,DISPLAY_PROTOCOL} from './presentation.js';
const token=new URLSearchParams(location.hash.slice(1)).get('display'),root=document.querySelector('#app');
root.innerHTML='<main class="rehearsal-display"><header><div><strong>CHORYN</strong><span id="display-project">Rehearsal display</span></div><div><button class="button" data-display="follow">Follow editor</button><button class="button" data-display="2d">2D</button><button class="button" data-display="spatial">3D</button><button class="button" data-display="fullscreen">Fullscreen</button></div></header><div id="display-connection" role="status">Waiting for the editor…</div><div id="display-stage" class="display-stage"></div><footer><span id="display-clock">0.000s</span><span id="display-show"></span><span>Read-only display · music plays in the editor</span></footer></main>';
let lastDisplayedTime=0,mountedKey='';
let channel,project,frame,revision=0,sequence=-1,received=-Infinity,renderFrame=0,lastDraw=-Infinity,override='',stage3D,playback,mountToken=0,stopped=false;
const host=document.querySelector('#display-stage'),connection=document.querySelector('#display-connection'),empty=new Set();
function schedule(){if(!renderFrame&&document.visibilityState!=='hidden')renderFrame=requestAnimationFrame(draw);}
function disposeStage(){mountToken++;stage3D?.dispose();stage3D=null;playback=null;}
function draw(now){renderFrame=0;if(!project||!frame||frame.revision!==revision)return;if(now-lastDraw<1000/30&&frame.playing){schedule();return;}lastDraw=now;
 const age=Math.max(0,performance.now()-received),live=!stopped&&age<2500,time=Math.min(project.duration,Math.max(0,frame.time+(!stopped&&frame.playing?Math.min(age,2000)/1000*frame.rate:0))),positions=samplePerformance(project,time),view={...frame.view,kind:override||frame.view.kind,selected:empty,readOnly:true,ghosts:[],analysis:null,time},f=[...project.formations].reverse().find(f=>f.time<=time)||project.formations[0];
 if(document.documentElement.dataset)document.documentElement.dataset.theme=view.theme;
 lastDisplayedTime=time;
 connection.textContent=live?'Connected · '+(frame.playing?'Playing':'Paused'):'Editor disconnected or suspended · reopen Second screen in the editor to reconnect.';
 const b=beatAt(project,time);document.querySelector('#display-clock').textContent=time.toFixed(3)+'s · '+b.phrase+'.'+b.beat;document.querySelector('#display-project').textContent=project.name+' · '+f.name;
 const show=frame.show;document.querySelector('#display-show').textContent=show?show.name+' · '+(show.index+1)+'/'+show.total+' · '+show.entry?.name+(show.status==='break'?' · '+Math.ceil(Math.max(0,show.remaining-age/1000))+'s':''):'';
 const key=JSON.stringify(view.kind==='2d'?[revision,f.id,view.kind,view.rotation,view.mirror,view.flip,view.labels,view.showGrid,view.showPaths]:[revision,view.kind]);if(mountedKey!==key){disposeStage();mountedKey=key;if(view.kind==='2d'){host.innerHTML=renderStage2D(project,f,positions,view);playback=createPlaybackView(host);}else{host.textContent='Loading 3D rehearsal view…';const t=mountToken;import('./stage3d.js').then(({mountStage3D})=>{if(t!==mountToken)return;stage3D=mountStage3D(host,sceneProject(project,time,positions),positions,{interactive:false,camera:{...view.camera,target:[...view.camera.target]},showGrid:view.showGrid,labels:view.labels,selected:()=>empty});if(stage3D.available===false){override='2d';mountedKey='';}schedule();}).catch(()=>{if(t===mountToken){override='2d';mountedKey='';connection.textContent='3D could not load. Using 2D.';schedule();}});}}
 if(view.kind==='2d'){const transform=host.querySelector('#stage-transform');if(transform)transform.setAttribute('transform',stageTransform(project,view.pan,view.zoom,view.mirror,view.rotation,view.flip));playback?.update(project,time,{positions,state:view,active:f.id,hud:false});}
 else if(stage3D){Object.assign(stage3D.camera,view.camera);stage3D.update(sceneProject(project,time,positions),positions,{showGrid:view.showGrid,labels:view.labels});}
 if(frame.playing&&live)schedule();
}
if(!token||!/^[-\w]{1,100}$/.test(token)||!globalThis.BroadcastChannel){connection.textContent='Live display is unavailable. Open Second screen from a supported editor window.';}
else{channel=new BroadcastChannel('choryn-display-'+token);channel.onmessage=event=>{const value=event.data;if(!value||value.v!==DISPLAY_PROTOCOL||value.token!==token)return;try{
 if(value.type==='score'){if(!Number.isInteger(value.revision)||value.revision<=revision)return;project=validateProject(value.project);revision=value.revision;stopped=false;schedule();}
 if(value.type==='frame'){if(!project||value.revision!==revision||!Number.isInteger(value.sequence)||value.sequence<=sequence||!Number.isFinite(value.time)||value.time<0||value.time>project.duration||!Number.isFinite(value.rate)||value.rate<.25||value.rate>2)return;sequence=value.sequence;frame={revision:value.revision,time:value.time,playing:!!value.playing,rate:value.rate,view:presentationView(value.view),show:value.show&&typeof value.show.name==='string'?value.show:null};received=performance.now();stopped=false;schedule();}
 if(value.type==='stop'){if(frame){frame.time=lastDisplayedTime;frame.playing=false;}stopped=true;schedule();}
 }catch{connection.textContent='The display update could not be read. Reconnect from the editor.';}};channel.postMessage({v:DISPLAY_PROTOCOL,token,type:'hello'});}
document.addEventListener('click',event=>{const button=event.target.closest('[data-display]');if(button){const action=button.dataset.display;if(action==='fullscreen'){if(!document.documentElement.requestFullscreen){connection.textContent='Browser fullscreen is unavailable; the display already fills this window.';return;}Promise.resolve(document.documentElement.requestFullscreen()).catch(()=>{connection.textContent='Browser fullscreen is unavailable; the display already fills this window.';});return;}override=action==='follow'?'':action;mountedKey='';schedule();}if(event.target.closest('[data-view="2d"]')){override='2d';mountedKey='';schedule();}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden'){channel?.postMessage({v:DISPLAY_PROTOCOL,token,type:'hello'});schedule();}});
const heartbeat=setInterval(()=>schedule(),1000);
window.addEventListener('pagehide',()=>{clearInterval(heartbeat);cancelAnimationFrame(renderFrame);disposeStage();channel?.close();});
