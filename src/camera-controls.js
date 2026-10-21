const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
export function safeCamera(camera={}){return {yaw:finite(camera.yaw,.15),pitch:clamp(finite(camera.pitch,.68),.12,1.45),zoom:clamp(finite(camera.zoom,1),.5,3),target:[0,.2,0].map((v,i)=>clamp(finite(camera.target?.[i],v),-200,200))};}
export function wheelPixels(event,height=600){const scale=event.deltaMode===1?16:event.deltaMode===2?Math.max(1,height):1;return {x:clamp(finite(event.deltaX)*scale,-2400,2400),y:clamp(finite(event.deltaY)*scale,-2400,2400)};}
export function orbitCamera(camera,dx,dy,{width=600,height=400}={}){const c=safeCamera(camera),yaw=c.yaw-finite(dx)*Math.PI/Math.max(240,width);return {...c,yaw:Math.atan2(Math.sin(yaw),Math.cos(yaw)),pitch:clamp(c.pitch+finite(dy)*Math.PI*.65/Math.max(160,height),.12,1.45)};}
export function panCamera(camera,dx,dy,{height=400,distance=20}={}){
 const c=safeCamera(camera),units=2*Math.max(.1,finite(distance,20))*Math.tan(Math.PI/7)/Math.max(1,height),right=[Math.cos(c.yaw),0,-Math.sin(c.yaw)],up=[-Math.sin(c.yaw)*Math.sin(c.pitch),Math.cos(c.pitch),-Math.cos(c.yaw)*Math.sin(c.pitch)];
 return {...c,target:c.target.map((value,i)=>clamp(value+(-right[i]*finite(dx)+up[i]*finite(dy))*units,-200,200))};
}
export function zoomCamera(camera,factor,point,metrics={}){const c=safeCamera(camera),zoom=clamp(c.zoom*Math.max(.01,finite(factor,1)),.5,3);if(!point)return {...c,zoom};const shift=1-c.zoom/zoom;return {...panCamera(c,-finite(point.x)*shift,-finite(point.y)*shift,metrics),zoom};}
export function bindCameraControls(canvas,{camera,metrics,changed,mode=()=> 'orbit',manualPan=()=>{},following=()=>false,reset=()=>{},environment=globalThis,signal}={}){
 const pointers=new Map();let pair=null,panStarted=false;
 const apply=next=>{Object.assign(camera,next);changed?.(camera);};
 const pan=(dx,dy)=>{if(!dx&&!dy)return;if(!panStarted){manualPan();panStarted=true;}apply(panCamera(camera,dx,dy,metrics()));};
 const stop=()=>{const ids=[...pointers.keys()];pointers.clear();for(const id of ids)try{if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);}catch{}pointers.clear();pair=null;panStarted=false;canvas.classList?.remove('camera-dragging');};
 const geometry=()=>{const [a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};};
 const point=(x,y)=>{const rect=canvas.getBoundingClientRect();return {x:x-rect.left-rect.width/2,y:y-rect.top-rect.height/2};};
 canvas.addEventListener('pointerdown',event=>{if(![0,1,2].includes(event.button)||pointers.size>=2)return;event.preventDefault();canvas.focus({preventScroll:true});pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,pan:event.button!==0||event.shiftKey||mode()==='pan'});try{canvas.setPointerCapture(event.pointerId);}catch{stop();return;}panStarted=false;canvas.classList?.add('camera-dragging');if(pointers.size===2)pair={...geometry(),origin:geometry(),panning:false};},{signal});
 canvas.addEventListener('pointermove',event=>{const previous=pointers.get(event.pointerId);if(!previous)return;pointers.set(event.pointerId,{...previous,x:event.clientX,y:event.clientY});
  if(pointers.size===2&&pair){const next=geometry();if(Math.hypot(next.x-pair.origin.x,next.y-pair.origin.y)>4)pair.panning=true;if(pair.panning){manualPan();apply(panCamera(camera,next.x-pair.x,next.y-pair.y,metrics()));}apply(zoomCamera(camera,next.distance/pair.distance,following()?null:point(next.x,next.y),metrics()));pair={...next,origin:pair.origin,panning:pair.panning};return;}
  if(pointers.size!==1)return;const dx=event.clientX-previous.x,dy=event.clientY-previous.y;if(previous.pan)pan(dx,dy);else apply(orbitCamera(camera,dx,dy,metrics()));
 },{signal});
 canvas.addEventListener('pointerup',event=>{if(!pointers.has(event.pointerId))return;pointers.delete(event.pointerId);pair=null;panStarted=false;if(!pointers.size)canvas.classList?.remove('camera-dragging');},{signal});
 canvas.addEventListener('pointercancel',event=>{if(pointers.has(event.pointerId))stop();},{signal});canvas.addEventListener('lostpointercapture',event=>{if(pointers.has(event.pointerId))stop();},{signal});
 canvas.addEventListener('wheel',event=>{event.preventDefault();if(pointers.size)return;const delta=wheelPixels(event,metrics().height);panStarted=false;if(!event.ctrlKey&&!event.metaKey&&(event.shiftKey||mode()==='pan'))pan(-delta.x,-delta.y);else apply(zoomCamera(camera,Math.exp(-delta.y*(event.ctrlKey ? .01 : .0015)),following()?null:point(event.clientX,event.clientY),metrics()));},{signal,passive:false});
 canvas.addEventListener('contextmenu',event=>event.preventDefault(),{signal});canvas.addEventListener('dblclick',event=>{event.preventDefault();stop();reset();},{signal});
 canvas.addEventListener('keydown',event=>{let dx=0,dy=0;if(event.key==='ArrowLeft')dx=-24;else if(event.key==='ArrowRight')dx=24;else if(event.key==='ArrowUp')dy=-24;else if(event.key==='ArrowDown')dy=24;else if(event.key==='+'||event.key==='='){apply(zoomCamera(camera,1.1));}else if(event.key==='-'){apply(zoomCamera(camera,1/1.1));}else if(event.key==='Home'){reset();}else if(event.key==='Escape'){stop();}else return;if(dx||dy){panStarted=false;if(event.shiftKey||mode()==='pan')pan(-dx,-dy);else apply(orbitCamera(camera,dx,dy,metrics()));}event.preventDefault();event.stopPropagation();},{signal});
 environment.addEventListener?.('blur',stop,{signal});environment.document?.addEventListener('studio-recover',stop,{signal});environment.document?.addEventListener('visibilitychange',()=>{if(environment.document.visibilityState==='hidden')stop();},{signal});signal?.addEventListener('abort',stop,{once:true});
 return {stop,pan:(dx,dy)=>{panStarted=false;pan(dx,dy);},orbit:(dx,dy)=>apply(orbitCamera(camera,dx,dy,metrics())),zoom:factor=>apply(zoomCamera(camera,factor))};
}
