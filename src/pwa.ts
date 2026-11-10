import {errorMessage} from './errors.js';
import type {CacheStatus} from './types.js';
export function installedDisplay(environment=globalThis){return environment.navigator?.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>environment.matchMedia?.(`(display-mode: ${mode})`).matches);}
export function installGuidance(environment=globalThis){
 const nav:Partial<Navigator>=environment.navigator||{},ua=nav.userAgent||'';
 if(/iPad|iPhone|iPod/.test(ua)||nav.platform==='MacIntel'&&(nav.maxTouchPoints??0)>1)return {platform:'iPhone / iPad',steps:['Open CHORYN in Safari and sign in to this private site if needed.','Open Share, then Add to Home Screen. On newer versions, keep Open as Web App enabled.','Confirm the CHORYN name and five-node icon, then tap Add.']};
 if(/Mac/.test(nav.platform||ua)&&/Safari/.test(ua)&&!/(Chrome|Chromium|Edg|OPR)/.test(ua))return {platform:'Mac · Safari',steps:['On macOS Sonoma 14 or later, choose File → Add to Dock (or Share → Add to Dock).','Confirm the CHORYN name and icon, then Add. Older Safari versions can use bookmarks or an install-capable browser.']};
 if(/Android/.test(ua))return {platform:'Android',steps:['Use Install now when available, or open your browser menu and choose Install app / Add to Home screen.','Confirm the CHORYN icon. Depending on the browser, this creates an installed app or a browser shortcut.']};
 return {platform:'Desktop',steps:['In a compatible browser, choose Install CHORYN from the address bar or the browser’s app menu.','Chrome and Edge provide installation on supported Windows, macOS, Linux and ChromeOS versions. Other browsers may offer a shortcut or bookmark instead.']};
}
/** Chromium's install prompt (`beforeinstallprompt`), which lib.dom does not describe. */
interface InstallPromptEvent extends Event {prompt():Promise<void>; userChoice:Promise<{outcome:string}>}
/** What the install & offline dialog shows. */
export interface PWAState {online:boolean; installed:boolean; installAvailable:boolean; offlineReady:boolean; offlineStatus:string; cached:number; total:number; version:string; updateReady:boolean; checking:boolean; busy:boolean; persisted:boolean|null; usage:number|null; quota:number|null; error:string}
export function createPWAManager(environment=globalThis){
 const nav:Partial<Navigator>=environment.navigator||{},win=environment.window||environment,doc=environment.document;
 let promptEvent:InstallPromptEvent|null=null,registration:ServiceWorkerRegistration|null=null,waiting:ServiceWorker|null=null,updating=false,registering:Promise<void>|null=null,lastCheck=0,refreshToken=0,started=false,notify=()=>{};
 const state:PWAState={online:nav.onLine!==false,installed:installedDisplay(environment),installAvailable:false,offlineReady:false,offlineStatus:'checking',cached:0,total:0,version:'',updateReady:false,checking:false,busy:false,persisted:null,usage:null,quota:null,error:''};
 const changed=()=>notify(),snapshot=()=>({...state});
 function request(worker:ServiceWorker|null|undefined,type:string,timeout=5000){return new Promise<CacheStatus>((resolve,reject)=>{
  if(!worker||!environment.MessageChannel){reject(Error('Offline status is not available in this browser.'));return;}
  const channel=new environment.MessageChannel(),finish=(error:unknown,value?:CacheStatus)=>{environment.clearTimeout(timer);channel.port1.close();channel.port2.close();error?reject(error):resolve(value as CacheStatus);},timer=environment.setTimeout(()=>finish(Error('The offline worker did not respond. Reconnect, then retry.')),timeout);
  channel.port1.onmessage=event=>event.data?.ok===false?finish(Error(event.data.error||'Offline operation failed.')):finish(null,event.data);
  try{worker.postMessage({type},[channel.port2]);}catch(error){finish(error);}
 });}
 function checkWaiting(){waiting=registration?.waiting||null;state.updateReady=!!waiting;}
 async function storageStatus(){try{state.persisted=nav.storage?.persisted?await nav.storage.persisted():null;const estimate=await nav.storage?.estimate?.();state.usage=Number.isFinite(estimate?.usage)?estimate!.usage!:null;state.quota=Number.isFinite(estimate?.quota)?estimate!.quota!:null;}catch{state.persisted=null;state.usage=state.quota=null;}}
 async function refresh(){const token=++refreshToken;checkWaiting();const worker=registration?.active||nav.serviceWorker?.controller;if(!worker){state.offlineReady=false;state.offlineStatus=registration?'preparing':'unsupported';changed();return;}
  try{const result=await request(worker,'CACHE_STATUS');if(token!==refreshToken)return;state.offlineReady=result?.complete===true;state.offlineStatus=state.offlineReady?'ready':'incomplete';state.cached=Number(result.cached)||0;state.total=Number(result.total)||0;state.version=String(result.version||'');state.error='';}
  catch(error){if(token!==refreshToken)return;state.offlineReady=false;state.offlineStatus='unverified';state.error=errorMessage(error);}
  await storageStatus();changed();
 }
 async function register():Promise<void>{if(registering)return registering;registering=(async()=>{
  if(!nav.serviceWorker||environment.isSecureContext===false){state.offlineStatus='unsupported';state.error='Offline installation requires HTTPS and a browser with service workers.';changed();return;}
  // `npm run dev` has no generated /sw.js; only `npm run build` emits the
  // verified offline worker. Skip registration instead of requesting a 404.
  if(doc?.querySelector?.('meta[name="choryn-build"]')?.getAttribute('content')==='development'){state.offlineStatus='unsupported';state.error='Offline files are prepared by the production build. Run npm run build, then npm start.';changed();return;}
  try{registration=await nav.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
   const watch=(worker:ServiceWorker|null)=>worker?.addEventListener('statechange',()=>{if(worker.state==='redundant'){void refresh().then(()=>{state.error='Offline setup or an update could not finish. Check the connection and retry.';if(!state.offlineReady)state.offlineStatus='error';changed();});}else if(['installed','activated'].includes(worker.state))void refresh();});
   watch(registration.installing);registration.addEventListener('updatefound',()=>{state.offlineStatus=state.offlineReady?'ready':'preparing';watch(registration!.installing);changed();});await refresh();
  }catch(error){state.offlineReady=false;state.offlineStatus='error';state.error='Offline setup failed. Reconnect and retry. '+errorMessage(error);changed();}
 })().finally(()=>{registering=null;});return registering;}
 async function checkForUpdates(){if(state.checking)return;state.checking=true;state.error='';changed();lastCheck=Date.now();try{if(!registration)await register();else{await registration.update();await refresh();}}catch(error){state.error='Update check failed. '+errorMessage(error);}finally{state.checking=false;changed();}}
 async function repairOffline(){if(state.busy)return;state.busy=true;state.error='';changed();try{if(!registration)await register();checkWaiting();if(waiting)throw Error('An update is ready. Save and update before repairing offline files.');const worker=registration?.active||nav.serviceWorker?.controller;if(!worker)throw Error('Offline setup is still preparing. Keep this page open online, then retry.');await request(worker,'REPAIR_OFFLINE',60000);await refresh();}catch(error){state.error=errorMessage(error);await refresh();state.error=errorMessage(error);}finally{state.busy=false;changed();}}
 async function protectStorage(){if(!nav.storage?.persist)return 'This browser does not provide persistent-storage requests. Keep portable project backups.';try{state.persisted=await nav.storage.persist();await storageStatus();changed();return state.persisted?'Persistent storage granted. Keep project backups for device changes.':'The browser did not grant persistent storage. Your projects remain saved here; keep portable backups.';}catch{return 'Persistent storage could not be requested. Keep portable project backups.';}}
 async function installApp(){if(state.installed)return 'CHORYN is already running as an installed app.';if(!promptEvent)return installGuidance(environment).steps.join(' ');const event=promptEvent;promptEvent=null;state.installAvailable=false;changed();try{await event.prompt();const result=await event.userChoice;return result.outcome==='accepted'?'Installation requested. Confirm completion in your browser.':'Installation dismissed. You can install later from your browser menu.';}catch{return 'The browser could not open installation. Use its Install app or Add to Home Screen menu.';}}
 async function applyUpdate(){checkWaiting();if(!waiting)return 'No prepared update is waiting. Check for updates first.';try{updating=true;await request(waiting,'ACTIVATE_UPDATE');return 'Applying the prepared update…';}catch(error){updating=false;state.error=errorMessage(error);changed();return errorMessage(error);}}
 async function setupPWA(onChange=()=>{}){notify=onChange;if(started){changed();return;}started=true;
  win.addEventListener('online',()=>{state.online=true;changed();void checkForUpdates();});win.addEventListener('offline',()=>{state.online=false;changed();});
  win.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event as InstallPromptEvent;state.installAvailable=true;changed();});win.addEventListener('appinstalled',()=>{state.installed=true;promptEvent=null;state.installAvailable=false;changed();});
  for(const mode of ['standalone','fullscreen','minimal-ui','window-controls-overlay']){const media=environment.matchMedia?.(`(display-mode: ${mode})`);const handler=()=>{state.installed=installedDisplay(environment);changed();};if(media?.addEventListener)media.addEventListener('change',handler);else media?.addListener?.(handler);}
  doc?.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='visible'&&state.online&&Date.now()-lastCheck>15*60*1000)void checkForUpdates();});
  nav.serviceWorker?.addEventListener('controllerchange',()=>{if(updating){environment.location.reload();return;}void refresh();});changed();await register();
 }
 return {pwaState:snapshot,setupPWA,installApp,applyUpdate,checkForUpdates,repairOffline,protectStorage,refresh};
}
const manager=createPWAManager();
export const {pwaState,setupPWA,installApp,applyUpdate,checkForUpdates,repairOffline,protectStorage,refresh:refreshPWA}=manager;
