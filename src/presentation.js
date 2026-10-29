import {uid} from './engine.js';
export const DISPLAY_PROTOCOL=1;
export function presentationView(view={}){
 const finite=(n,lo,hi,fallback)=>Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):fallback;
 return {theme:view.theme==='dark'?'dark':'light',kind:view.kind==='spatial'?'spatial':'2d',zoom:finite(view.zoom,.25,6,1),pan:{x:finite(view.pan?.x,-10000,10000,0),y:finite(view.pan?.y,-10000,10000,0)},mirror:!!view.mirror,flip:!!view.flip,rotation:finite(view.rotation,-360,360,0),labels:!!view.labels,showGrid:view.showGrid!==false,showPaths:!!view.showPaths,camera:{yaw:finite(view.camera?.yaw,-20,20,0),pitch:finite(view.camera?.pitch,.15,1.4,.68),zoom:finite(view.camera?.zoom,.5,3,1),target:Array.isArray(view.camera?.target)&&view.camera.target.length===3?view.camera.target.map(n=>finite(n,-200,200,0)):[0,.2,0]}};
}
export function createPresentation(adapter,{Channel=globalThis.BroadcastChannel,open=(url,name,features)=>window.open(url,name,features),origin=()=>location.href,now=()=>performance.now(),setTimer=setInterval,clearTimer=clearInterval}={}){
 let channel=null,token='',dirty=true,last=-Infinity,sequence=0,scoreRevision=0,timer,win,scoreSource;
 const send=value=>channel?.postMessage({v:DISPLAY_PROTOCOL,token,...value});
 function close(){if(channel){try{send({type:'stop'});}catch{}channel.close();}channel=null;if(timer)clearTimer(timer);timer=null;win=null;scoreSource=null;adapter.status?.('Second screen disconnected.');}
 function sync(force=false){if(win?.closed){close();return;}if(!channel||!force&&now()-last<50)return;last=now();try{const project=adapter.project();if(dirty||project!==scoreSource){scoreRevision++;send({type:'score',revision:scoreRevision,project});scoreSource=project;dirty=false;}const transport=adapter.transport();send({type:'frame',revision:scoreRevision,sequence:++sequence,time:transport.time,playing:!!transport.playing,rate:transport.rate,view:presentationView(adapter.view()),show:transport.show||null});}catch(error){close();adapter.error?.(error);}}
 function launch(){if(!Channel)throw Error('This browser does not support a live second screen. Use stage fullscreen on this device.');close();token=uid();const url=new URL(origin());url.hash='display='+token;channel=new Channel('choryn-display-'+token);channel.onmessage=event=>{if(event.data?.v===DISPLAY_PROTOCOL&&event.data.token===token&&event.data.type==='hello'){dirty=true;sync(true);if(channel)adapter.status?.('Second screen connected · music plays in the editor.');}};
  try{win=open(url.href,'choryn-display-'+token,'popup,width=1280,height=800');}catch(error){close();throw error;}if(!win){close();throw Error('Allow this site to open the rehearsal display, then try again.');}try{win.opener=null;}catch{}dirty=true;last=-Infinity;sync(true);if(!channel)throw Error('The rehearsal display could not receive the score.');adapter.status?.('Waiting for the rehearsal display to connect…');timer=setTimer(()=>sync(true),500);return url.href;
 }
 return {launch,close,sync,invalidate(){dirty=true;},active:()=>!!channel};
}
