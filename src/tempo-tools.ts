// Tap tempo and rehearsal beat cues (metronome click and count vibration).
// Clicks are scheduled slightly ahead on the audio clock, so they stay tight
// even when animation frames are uneven.

export type BeatCueSettings={click:boolean;accent:boolean;haptic:boolean};
const STORAGE_KEY='choryn.tempo.v1';

function loadSettings():BeatCueSettings{
 try{const value=JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY)||'{}');return {click:value.click===true,accent:value.accent!==false,haptic:value.haptic===true};}
 catch{return {click:false,accent:true,haptic:false};}
}
let settings=loadSettings();
export function beatCueSettings():BeatCueSettings{return {...settings};}
export function setBeatCueSettings(next:Partial<BeatCueSettings>){
 settings={...settings,...Object.fromEntries(Object.entries(next).map(([key,value])=>[key,value===true]))};
 try{globalThis.localStorage?.setItem(STORAGE_KEY,JSON.stringify(settings));}catch{}
 return beatCueSettings();
}

/** Tap tempo: averages the recent intervals; a pause longer than `resetAfter` ms starts over. */
export function createTapTempo({now=()=>globalThis.performance?.now?.()??Date.now(),keep=8,resetAfter=2000,min=30,max=300}={}){
 let taps:number[]=[];
 return {
  tap(){
   const time=now();
   if(taps.length&&time-taps[taps.length-1]>resetAfter)taps=[];
   taps.push(time);if(taps.length>keep)taps=taps.slice(-keep);
   if(taps.length<2)return {bpm:null as number|null,taps:taps.length};
   const average=(taps[taps.length-1]-taps[0])/(taps.length-1);
   return {bpm:Math.round(Math.min(max,Math.max(min,60000/average))),taps:taps.length};
  },
  reset(){taps=[];}
 };
}

/** Beats in (from, to] — same counting as engine beatAt(): beat k sits at offset + k·60/bpm. */
export function beatsBetween(from:number,to:number,bpm:number,offset=0){
 const beats:{time:number;index:number;downbeat:boolean}[]=[];
 if(!(to>from)||!(bpm>0))return beats;
 const spb=60/bpm;
 for(let k=Math.max(0,Math.floor((from-offset)/spb+1e-7));beats.length<64;k++){
  const time=offset+k*spb;if(time>to+1e-9)break;
  if(time>from+1e-9)beats.push({time,index:k,downbeat:k%8===0});
 }
 return beats;
}

function click(context:AudioContext,at:number,accent:boolean){
 const oscillator=context.createOscillator(),gain=context.createGain();
 oscillator.type='square';oscillator.frequency.value=accent?1760:1175;
 gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(accent?.32:.2,at+.002);gain.gain.exponentialRampToValueAtTime(.0001,at+.05);
 oscillator.connect(gain);gain.connect(context.destination);oscillator.start(at);oscillator.stop(at+.06);
}

/**
 * `start` runs its own timer (not animation frames, which stop when the tab
 * is hidden or the screen locks while music keeps playing). Each pass
 * schedules beats up to `lookahead` seconds of project time ahead on the audio
 * clock; while hidden, browsers throttle timers to ~1 s, so it looks further
 * ahead. `update` can also be called directly; `reset` forgets scheduled
 * beats after a stop or jump.
 */
type CueState={project:{bpm:number;music?:{beatOffset?:number}};time:number;rate?:number};
export function createBeatCues({audioContext,vibrate=(ms:number)=>globalThis.navigator?.vibrate?.(ms),schedule=(fn:()=>void,ms:number)=>setTimeout(fn,ms),lookahead=.12,hiddenLookahead=1.5,hidden=()=>globalThis.document?.visibilityState==='hidden',every=(fn:()=>void,ms:number)=>setInterval(fn,ms) as unknown,cancel=(id:unknown)=>clearInterval(id as ReturnType<typeof setInterval>)}:{audioContext:()=>AudioContext|null;vibrate?:(ms:number)=>unknown;schedule?:(fn:()=>void,ms:number)=>unknown;lookahead?:number;hiddenLookahead?:number;hidden?:()=>boolean;every?:(fn:()=>void,ms:number)=>unknown;cancel?:(id:unknown)=>void}){
 let scheduledTo:number|null=null,loop:unknown=null;
 const api={
  reset(){scheduledTo=null;},
  start(state:()=>CueState){if(loop!==null)return;const pass=()=>{try{const s=state();api.update(s.project,s.time,s.rate);}catch{}};pass();loop=every(pass,25);},
  stop(){if(loop!==null)cancel(loop);loop=null;scheduledTo=null;},
  get running(){return loop!==null;},
  update(project:CueState['project'],time:number,rate=1){
   if(!settings.click&&!settings.haptic){scheduledTo=null;return [];}
   const from=scheduledTo??time-.001,to=time+(hidden()?hiddenLookahead:lookahead)*Math.max(.1,rate);
   if(to<=from)return [];
   scheduledTo=to;
   const beats=beatsBetween(from,to,project.bpm,project.music?.beatOffset||0);
   const context=settings.click?audioContext():null;
   for(const beat of beats){
    const delay=Math.max(0,(beat.time-time)/Math.max(.1,rate)),accent=settings.accent&&beat.downbeat;
    if(context?.state==='running')try{click(context,context.currentTime+delay,accent);}catch{}
    if(settings.haptic)schedule(()=>{try{vibrate(accent?28:12);}catch{}},delay*1000);
   }
   return beats;
  }
 };
 return api;
}
