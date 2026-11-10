// Project records contain only JSON data. Keep older webviews usable without
// changing browser globals or assuming optional media and window APIs exist.
export function cloneData<T>(value:T,environment=globalThis):T{return environment.structuredClone?environment.structuredClone(value):JSON.parse(JSON.stringify(value));}
export function localId(environment=globalThis){
  if(environment.crypto?.randomUUID)return environment.crypto.randomUUID();
  const bytes=new Uint8Array(16);
  if(environment.crypto?.getRandomValues)environment.crypto.getRandomValues(bytes);else for(let i=0;i<16;i++)bytes[i]=Math.floor(Math.random()*256);
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  return Array.from(bytes,(v,i)=>([4,6,8,10].includes(i)?'-':'')+v.toString(16).padStart(2,'0')).join('');
}
// The element type comes from the array type, so loosely typed callers keep `any` elements.
export function lastIndex<A extends readonly unknown[]>(array:A,predicate:(value:A[number],index:number)=>unknown):number{for(let i=array.length-1;i>=0;i--)if(predicate(array[i],i))return i;return -1;}
export const lastMatch=<A extends readonly unknown[]>(array:A,predicate:(value:A[number],index:number)=>unknown):A[number]|undefined=>array[lastIndex(array,predicate)];
// Older Safari only has the prefixed constructor.
type AudioEnvironment={AudioContext?:typeof AudioContext;webkitAudioContext?:typeof AudioContext};
export function createAudioContext(environment:AudioEnvironment=globalThis as AudioEnvironment){const Context=environment.AudioContext||environment.webkitAudioContext;if(!Context)throw Error('Audio is unavailable in this browser. Visual rehearsal and editing still work.');return new Context();}
export function observeSize(element:Element,callback:()=>void,environment=globalThis){
  if(environment.ResizeObserver){const observer=new environment.ResizeObserver(callback);observer.observe(element);return observer;}
  environment.addEventListener('resize',callback);return {disconnect(){environment.removeEventListener('resize',callback);}};
}
export function recordingAvailable(environment=globalThis){return typeof environment.MediaRecorder?.isTypeSupported==='function'&&typeof environment.HTMLCanvasElement?.prototype.captureStream==='function';}
export function setupDeviceViewport(){
  const update=()=>{const viewport=window.visualViewport;const height=viewport&&Math.abs(viewport.scale-1)<.01?viewport.height:window.innerHeight;document.documentElement.style.setProperty('--visible-height',`${Math.round(height)}px`);document.documentElement.style.setProperty('--visible-top',`${Math.round(viewport?.offsetTop||0)}px`);};
  window.addEventListener('resize',update);window.visualViewport?.addEventListener('resize',update);window.visualViewport?.addEventListener('scroll',update);update();
}
