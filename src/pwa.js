let promptEvent=null,waiting=null,updating=false;
let state={online:navigator.onLine,offlineReady:false,installed:matchMedia('(display-mode: standalone)').matches||navigator.standalone===true,updateReady:false};
let notify=()=>{};
export const pwaState=()=>({...state});
export async function setupPWA(onChange){
  notify=onChange;
  window.addEventListener('online',()=>{state.online=true;notify();});window.addEventListener('offline',()=>{state.online=false;notify();});
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;notify();});
  window.addEventListener('appinstalled',()=>{state.installed=true;promptEvent=null;notify();});
  if(!('serviceWorker' in navigator))return;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updating)location.reload();});
  try{
    const registration=await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});
    const check=()=>{if(registration.waiting&&navigator.serviceWorker.controller){waiting=registration.waiting;state.updateReady=true;}else if(!registration.waiting){waiting=null;state.updateReady=false;}notify();};
    check();registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')check();});});
    const ready=await navigator.serviceWorker.ready;
    state.offlineReady=!!ready.active;check();notify();
  }catch{state.offlineReady=false;notify();}
}
export async function installApp(){
  if(state.installed)return 'CHORYN is already running as an installed app.';
  if(promptEvent){const event=promptEvent;promptEvent=null;await event.prompt();const result=await event.userChoice;return result.outcome==='accepted'?'Installation requested.':'You can install later from your browser menu.';}
  return /iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1?'In Safari, open Share, then choose Add to Home Screen and turn on Open as Web App.':'Use your browser’s Install app or Add to Home Screen command. Installation is supported by compatible browsers.';
}
export function applyUpdate(){if(!waiting)return false;updating=true;waiting.postMessage({type:'ACTIVATE_UPDATE'});return true;}
