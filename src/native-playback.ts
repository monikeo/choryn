// Native playback integration:
//  - Screen Wake Lock keeps a phone or tablet awake during a run-through.
//  - Media Session shows lock-screen / notification controls and answers
//    headphone, AirPods, keyboard and Touch Bar media keys.
// Browsers attach Media Session only to a playing media element, and the
// studio's music plays through Web Audio, so a silent looping <audio>
// element ("bridge") runs alongside audible playback. On iOS this also lets
// rehearsal music play with the ring/silent switch on, as music apps do.

type Handlers=Partial<Record<'play'|'pause'|'stop'|'seekbackward'|'seekforward'|'seekto'|'previoustrack'|'nexttrack',(details?:{seekTime?:number;seekOffset?:number})=>void>>;
type Environment={navigator?:any;document?:any;MediaMetadata?:any;Audio?:any;URL?:any;Blob?:any};

/** A short silent mono WAV (≥5 s, which Chrome requires before showing media controls). */
export function silentWav(seconds=6,sampleRate=8000){
 const samples=Math.round(seconds*sampleRate),buffer=new ArrayBuffer(44+samples),view=new DataView(buffer),text=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
 text(0,'RIFF');view.setUint32(4,36+samples,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
 view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate,true);view.setUint16(32,1,true);view.setUint16(34,8,true);text(36,'data');view.setUint32(40,samples,true);
 new Uint8Array(buffer,44).fill(128);// 8-bit PCM silence is the midpoint
 return buffer;
}

export function createNativePlayback(environment:Environment=globalThis as Environment){
 const nav=environment.navigator,doc=environment.document;
 let lock:any=null,requesting=false,wantAwake=false,bridge:any=null,bridgeURL='';

 async function acquire(){
  if(!wantAwake||lock||requesting||!nav?.wakeLock?.request||doc?.visibilityState==='hidden')return;
  requesting=true;
  try{const sentinel=await nav.wakeLock.request('screen');if(!wantAwake){await sentinel.release?.();return;}lock=sentinel;sentinel.addEventListener?.('release',()=>{if(lock===sentinel)lock=null;});}
  catch{lock=null;}// Denied (battery saver, unsupported context): playback continues normally.
  finally{requesting=false;}
 }
 async function release(){const current=lock;lock=null;try{await current?.release?.();}catch{}}
 // Browsers drop the lock whenever the page is hidden; take it back on return.
 doc?.addEventListener?.('visibilitychange',()=>{if(doc.visibilityState==='visible')void acquire();});

 function ensureBridge(){
  if(bridge||!environment.Audio)return bridge;
  try{
   bridgeURL=environment.URL?.createObjectURL?.(new environment.Blob([silentWav()],{type:'audio/wav'}))||'';
   if(!bridgeURL)return null;
   bridge=new environment.Audio(bridgeURL);bridge.loop=true;bridge.preload='auto';bridge.setAttribute?.('aria-hidden','true');
  }catch{bridge=null;}
  return bridge;
 }

 return {
  /** Call synchronously inside the user gesture that starts playback. */
  prime(audible:boolean){
   if(!audible||!nav?.mediaSession)return;
   const element=ensureBridge();
   try{const started=element?.play?.();started?.catch?.(()=>{});}catch{}
  },
  setPlaying(playing:boolean){
   wantAwake=playing;
   if(playing)void acquire();else{void release();try{bridge?.pause?.();}catch{}}
   if(nav?.mediaSession)try{nav.mediaSession.playbackState=playing?'playing':'paused';}catch{}
  },
  setMetadata({title,artist,artwork}:{title:string;artist?:string;artwork?:{src:string;sizes:string;type:string}[]}){
   if(!nav?.mediaSession||!environment.MediaMetadata)return;
   try{nav.mediaSession.metadata=new environment.MediaMetadata({title,artist:artist||'CHORYN Studio',album:'CHORYN Studio',artwork:artwork||[]});}catch{}
  },
  setPosition(duration:number,position:number,rate=1){
   if(!nav?.mediaSession?.setPositionState||!(duration>0))return;
   try{nav.mediaSession.setPositionState({duration,position:Math.max(0,Math.min(duration,position)),playbackRate:rate>0?rate:1});}catch{}
  },
  setActions(handlers:Handlers){
   if(!nav?.mediaSession?.setActionHandler)return;
   for(const [action,handler] of Object.entries(handlers))try{nav.mediaSession.setActionHandler(action,handler||null);}catch{}// Unsupported actions throw.
  },
  get awake(){return !!lock;},
  dispose(){void release();try{bridge?.pause?.();}catch{}if(bridgeURL)environment.URL?.revokeObjectURL?.(bridgeURL);bridge=null;}
 };
}
