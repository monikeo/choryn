// Input helpers that make mouse, trackpad, pen and touch behave the way each
// platform's native apps do:
//  - Mouse wheel zooms the stage; a trackpad two-finger swipe pans it and a
//    pinch zooms it (Chrome/Edge/Firefox send pinch as Ctrl+wheel; Safari on
//    macOS sends WebKit gesture events instead).
//  - Touch screens pinch the timeline and long-press clips for their tools.

export type WheelPreference='auto'|'mouse'|'trackpad';
type Listen=(node:EventTarget,type:string,handler:(event:any)=>void,options?:AddEventListenerOptions|boolean)=>void;
type WheelLike={deltaX?:number;deltaY?:number;deltaMode?:number;ctrlKey?:boolean;metaKey?:boolean;wheelDeltaY?:number};

const STORAGE_KEY='choryn.input.v1';
const defaultListen:Listen=(node,type,handler,options)=>node.addEventListener(type,handler,options);

let preference:WheelPreference=(()=>{try{const value=JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY)||'{}').wheel;return value==='mouse'||value==='trackpad'?value:'auto';}catch{return 'auto';}})();

export function wheelPreference():WheelPreference{return preference;}
export function setWheelPreference(value:string){
 preference=value==='mouse'||value==='trackpad'?value:'auto';
 try{globalThis.localStorage?.setItem(STORAGE_KEY,JSON.stringify({wheel:preference}));}catch{}
 return preference;
}

/**
 * Best-effort device detection for a single wheel event.
 * Mouse wheels report line/page units (Firefox) or notch multiples of 120 in
 * the legacy wheelDeltaY (Chromium, WebKit); trackpads report fine pixel
 * deltas and usually some horizontal movement.
 */
export function looksLikeTrackpad(event:WheelLike){
 if(event.deltaMode!==0)return false;
 if(event.deltaX)return true;
 const legacy=event.wheelDeltaY;
 if(typeof legacy==='number'&&legacy!==0)return legacy%120!==0;
 const y=Math.abs(event.deltaY||0);
 return y>0&&y<50&&!Number.isInteger(y);
}

/**
 * Returns a classifier answering "should this wheel event pan?" for one
 * surface. A burst of wheel events (including trackpad momentum) keeps the
 * classification of its first event, so a scroll never flips between pan and
 * zoom halfway through. Ctrl/⌘ (and trackpad pinch) always zoom.
 */
export function createWheelClassifier(now:()=>number=()=>globalThis.performance?.now?.()??Date.now()){
 let last=-Infinity,trackpad=false;
 return (event:WheelLike)=>{
  if(event.ctrlKey||event.metaKey)return false;
  if(preference!=='auto')return preference==='trackpad';
  const time=now();
  if(time-last>220)trackpad=looksLikeTrackpad(event);else if(event.deltaX)trackpad=true;
  last=time;return trackpad;
 };
}

// Touches currently on screen. iOS also emits gesture events for touch
// pinches, which the pointer-based handlers already cover.
let touchesDown=0,touchTracking=false;
function trackTouches(){
 if(touchTracking||typeof document==='undefined')return;touchTracking=true;
 const update=(event:TouchEvent)=>{touchesDown=event.touches?.length||0;};
 for(const type of ['touchstart','touchend','touchcancel'])document.addEventListener(type,update,{capture:true,passive:true});
}

/** Safari (macOS) trackpad pinch → incremental zoom factor around the pointer. */
export function bindGesturePinch(element:EventTarget,onZoom:(factor:number,clientX:number,clientY:number)=>void,{listen=defaultListen,signal}:{listen?:Listen,signal?:AbortSignal}={}){
 trackTouches();
 let previous=1,active=false;
 const options={passive:false,signal};
 listen(element,'gesturestart',event=>{if(touchesDown)return;event.preventDefault();previous=1;active=true;},options);
 listen(element,'gesturechange',event=>{if(!active)return;event.preventDefault();const scale=Number.isFinite(event.scale)&&event.scale>0?event.scale:1;onZoom(scale/previous,event.clientX,event.clientY);previous=scale;},options);
 listen(element,'gestureend',event=>{if(!active)return;event.preventDefault();active=false;},options);
}

/** Two-finger touch pinch. `change` receives the scale since the pinch began. */
export function bindTouchPinch(element:EventTarget,{start,change,end}:{start?:()=>void,change:(scale:number,centerX:number)=>void,end?:()=>void},{listen=defaultListen}:{listen?:Listen}={}){
 let initial=0;
 const spread=(touches:TouchList)=>Math.max(1,Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY));
 listen(element,'touchstart',(event:TouchEvent)=>{if(event.touches.length===2){initial=spread(event.touches);start?.();}},{passive:true});
 listen(element,'touchmove',(event:TouchEvent)=>{if(!initial||event.touches.length!==2)return;if(event.cancelable)event.preventDefault();change(spread(event.touches)/initial,(event.touches[0].clientX+event.touches[1].clientX)/2);},{passive:false});
 const stop=(event:TouchEvent)=>{if(initial&&event.touches.length<2){initial=0;end?.();}};
 listen(element,'touchend',stop,{passive:true});listen(element,'touchcancel',stop,{passive:true});
}

/**
 * Touch/pen long-press on elements matching `selector` (iOS never fires
 * contextmenu for touch; Android does, so the native event that follows a
 * handled long-press is swallowed, as is the click it would otherwise send).
 */
/**
 * Multi-finger taps (the iPad convention: two fingers undo, three redo). All
 * fingers must land within 150 ms, lift within 350 ms and move under 12 px,
 * so pinches, pans and holds never count.
 */
export function bindMultiFingerTap(element:EventTarget,{onTap,enabled=()=>true}:{onTap:(fingers:number)=>void,enabled?:(event:TouchEvent)=>boolean},{listen=defaultListen,now=()=>Date.now()}:{listen?:Listen,now?:()=>number}={}){
 let active=false,start=0,fingers=0,moved=false;const origins=new Map<number,{x:number,y:number}>();
 listen(element,'touchstart',(event:TouchEvent)=>{
  const time=now();
  if(event.touches.length===event.changedTouches.length){active=enabled(event);start=time;fingers=0;moved=false;origins.clear();}
  else if(time-start>150)active=false;
  if(!active)return;
  fingers=Math.max(fingers,event.touches.length);
  for(const touch of Array.from(event.changedTouches))origins.set(touch.identifier,{x:touch.clientX,y:touch.clientY});
 },{passive:true});
 listen(element,'touchmove',(event:TouchEvent)=>{
  if(!active||moved)return;
  for(const touch of Array.from(event.changedTouches)){const origin=origins.get(touch.identifier);if(origin&&Math.hypot(touch.clientX-origin.x,touch.clientY-origin.y)>12){moved=true;break;}}
 },{passive:true});
 listen(element,'touchend',(event:TouchEvent)=>{
  if(!active||event.touches.length)return;active=false;
  if(!moved&&fingers>=2&&now()-start<=350)onTap(fingers);
 },{passive:true});
 listen(element,'touchcancel',()=>{active=false;},{passive:true});
}

/**
 * Palm rejection: while a stylus is down or hovering, and briefly after it
 * lifts, touch input is ignored so a resting hand cannot move, cancel or
 * pinch the drawing.
 */
export function createPalmGuard({now=()=>globalThis.performance?.now?.()??Date.now(),grace=600}={}){
 let penDown=false,lastPen=-Infinity;
 return {
  note(event:{pointerType?:string;type?:string}){
   if(event.pointerType!=='pen')return;lastPen=now();
   if(event.type==='pointerdown')penDown=true;else if(event.type==='pointerup'||event.type==='pointercancel')penDown=false;
  },
  rejects(event:{pointerType?:string}){return event.pointerType==='touch'&&(penDown||now()-lastPen<grace);}
 };
}

// Module-wide so the swallow still applies when the press re-renders (and
// re-binds) the surface it started on.
let longPressAt=-Infinity;
export function bindLongPress(element:EventTarget,{selector,ignore,onPress,delay=480,slop=10}:{selector:string,ignore?:string,onPress:(target:HTMLElement)=>void,delay?:number,slop?:number},{listen=defaultListen}:{listen?:Listen}={}){
 let timer:ReturnType<typeof setTimeout>|null=null,start:{x:number,y:number,id:number}|null=null;
 const cancel=()=>{if(timer)clearTimeout(timer);timer=null;start=null;};
 listen(element,'pointerdown',(event:PointerEvent)=>{
  if(event.pointerType!=='touch'&&event.pointerType!=='pen')return;
  const node=event.target as HTMLElement,target=node.closest?.(selector) as HTMLElement|null;
  if(!target||ignore&&node.closest(ignore))return;
  cancel();start={x:event.clientX,y:event.clientY,id:event.pointerId};
  timer=setTimeout(()=>{timer=null;start=null;longPressAt=Date.now();try{navigator.vibrate?.(10);}catch{}onPress(target);},delay);
 });
 listen(element,'pointermove',(event:PointerEvent)=>{if(start&&event.pointerId===start.id&&Math.hypot(event.clientX-start.x,event.clientY-start.y)>slop)cancel();});
 for(const type of ['pointerup','pointercancel'])listen(element,type,(event:PointerEvent)=>{if(start&&event.pointerId===start.id)cancel();});
 const swallow=(event:Event)=>{if(Date.now()-longPressAt<800){event.preventDefault();event.stopImmediatePropagation();}};
 listen(element,'contextmenu',swallow,true);listen(element,'click',swallow,true);
 return cancel;
}
