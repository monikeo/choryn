import {safeCamera,bindCameraControls} from './camera-controls.js';
import {mountNavigationDock} from './navigation-dock.js';
import {observeSize} from './compat.js';
import {createStageFloor} from './stage-floor.js';
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((v,n,i)=>v+n*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
export function multiply(a,b){const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let i=0;i<4;i++)out[c*4+r]+=a[i*4+r]*b[c*4+i];return out;}
export function cameraMatrix(eye,target,aspect){
  const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);
  const view=new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
  const f=1/Math.tan(Math.PI/7),near=.1,far=500;
  const projection=new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
  return multiply(projection,view);
}
export function projectPoint(matrix,p){const v=[...p,1],out=[0,0,0,0];for(let r=0;r<4;r++)for(let i=0;i<4;i++)out[r]+=matrix[i*4+r]*v[i];return out[3]>.01?[out[0]/out[3],out[1]/out[3],out[2]/out[3]]:null;}
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const stageReferences=new WeakMap();let nextStageReference=0;
const stageReference=value=>{if(!value)return 0;if(!stageReferences.has(value))stageReferences.set(value,++nextStageReference);return stageReferences.get(value);};
export function stageSceneKey(project,positions,selected){return JSON.stringify([project.stage.width,project.stage.depth,stageReference(project.production?.stage),project.sceneLights,project.sceneSafety?.map(v=>[v.type,v.ids]),project.performers.map(p=>[p.id,p.number,p.name,p.color,p.costume]),(project.props||[]).map(p=>[p.id,p.x,p.z,p.width,p.depth,p.height,p.rotation,p.shape,p.color]),positions,[...selected].sort()]);}
function geometry(project,positions,selected,ghosts=[],analysis,showGrid=true){
  const data=[],cast=new Map(project.performers.map(p=>[p.id,p]));
  const unsafe=new Set((project.sceneSafety||[]).flatMap(v=>v.ids));
  const tri=(a,b,c,color)=>{const normal=norm(cross(sub(b,a),sub(c,a)));for(const v of [a,b,c])data.push(...v,...normal,...color);};
  const box=(x,y,z,w,h,d,color,rotation=0)=>{
    const points=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(p=>{const a=rotation*Math.PI/180,dx=p[0]*w/2,dz=p[2]*d/2;return [x+dx*Math.cos(a)-dz*Math.sin(a),y+p[1]*h/2,z+dx*Math.sin(a)+dz*Math.cos(a)];});
    for(const [a,b,c,e] of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]){tri(points[a],points[b],points[c],color);tri(points[a],points[c],points[e],color);}
  };
  const cylinder=(x,y,z,r,h,color,segments=12)=>{
    for(let i=0;i<segments;i++){
      const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
      const p=[x+Math.cos(a)*r,y-h/2,z+Math.sin(a)*r],q=[x+Math.cos(b)*r,y-h/2,z+Math.sin(b)*r],t=[p[0],y+h/2,p[2]],u=[q[0],y+h/2,q[2]];
      tri(p,t,u,color);tri(p,u,q,color);tri([x,y+h/2,z],u,t,color);tri([x,y-h/2,z],p,q,color);
    }
  };
  const w=project.stage.width,d=project.stage.depth;
  box(0,-.14,0,w,.25,d,[.82,.79,.86]);
  if(showGrid)for(let i=0;i<=w;i++)box(i-w/2,.005,0,.012,.012,d,[.66,.62,.72]);
  if(showGrid)for(let i=0;i<=d;i++)box(0,.005,i-d/2,w,.012,.012,[.66,.62,.72]);
  box(0,.015,0,.025,.015,d,[.51,.43,.63]);box(0,.015,0,w,.015,.025,[.51,.43,.63]);
  box(0,-.1,d/2+.6,w*.6,.08,.12,[.49,.38,.78]);
  const line=(a,b,color,width=.05)=>{const dx=b.x-a.x,dz=b.z-a.z;box((a.x+b.x)/2,.06,-(a.z+b.z)/2,Math.hypot(dx,dz),.025,width,color,Math.atan2(-dz,dx)*180/Math.PI);};
  for(const item of project.production?.stage.lines||[])line(item.a,item.b,[.5,.35,.75],.035);
  const outline=project.production?.stage.outline||[];outline.forEach((point,i)=>line(point,outline[(i+1)%outline.length],[.5,.35,.75],.06));
  for(const light of project.sceneLights||[]){if(light.intensity<=0)continue;const mixed=rgb(light.color).map(v=>v*light.intensity*.65+.82*(1-light.intensity*.65));cylinder(light.x,.035,-light.z,light.radius,.012,mixed,32);}
  for(const cell of analysis?.cells||[])box(cell.x,.04,-cell.z,cell.width,.025,cell.depth,rgb(cell.color));
  for(const path of analysis?.paths||[])for(let i=1;i<path.points.length;i++)line(path.points[i-1],path.points[i],rgb(path.color),.08);
  for(const item of analysis?.comparison||[])if(item.from&&item.from.visible!==false){cylinder(item.from.x,.055,-item.from.z,.38,.04,[.5,.4,.8],18);line(item.from,item.to,[.5,.4,.8]);}
  for(const frame of ghosts)for(const p of frame.positions){const person=cast.get(p.performerId);if(person)cylinder(p.x,.045,-p.z,.34,.06,rgb(person.color).map(v=>v*.35+.6),16);}
  for(const prop of project.props||[]){const h=Math.max(.05,prop.height),color=rgb(prop.color);if(prop.shape==='rectangle'||!prop.shape){box(prop.x,h/2,-prop.z,prop.width,h,prop.depth,color,prop.rotation||0);continue;}const n=prop.shape==='triangle'?3:24,a=(prop.rotation||0)*Math.PI/180,points=Array.from({length:n},(_,i)=>{const angle=i/n*Math.PI*2-Math.PI/2,vertex=prop.shape==='triangle'?[[0,-prop.depth/2],[prop.width/2,prop.depth/2],[-prop.width/2,prop.depth/2]][i]:[Math.cos(angle)*prop.width/2,Math.sin(angle)*prop.depth/2],dx=vertex[0],dz=vertex[1];return [prop.x+dx*Math.cos(a)-dz*Math.sin(a),-prop.z+dx*Math.sin(a)+dz*Math.cos(a)];});for(let i=0;i<n;i++){const p=points[i],q=points[(i+1)%n],b=[p[0],0,p[1]],c=[q[0],0,q[1]],t=[p[0],h,p[1]],u=[q[0],h,q[1]];tri(b,t,u,color);tri(b,u,c,color);tri([prop.x,h,-prop.z],u,t,color);tri([prop.x,0,-prop.z],b,c,color);}}
  for(const p of positions){
    if(p.visible===false)continue;
    const performer=cast.get(p.performerId);if(!performer)continue;
    const color=rgb(performer.color),x=p.x,z=-p.z;
    if(unsafe.has(p.performerId)){const color=[.78,.3,.4];for(let i=0;i<24;i++){const a=i/24*Math.PI*2,b=(i+1)/24*Math.PI*2,point=(angle,r)=>[x+Math.cos(angle)*r,.08,z+Math.sin(angle)*r];tri(point(a,.55),point(b,.55),point(b,.62),color);tri(point(a,.55),point(b,.62),point(a,.62),color);}}
    cylinder(x,.025,z,selected.has(p.performerId)?.42:.34,.025,selected.has(p.performerId)?[.48,.32,.79]:[.73,.68,.8],18);
    box(x-.11,.34,z,.15,.6,.18,[.32,.29,.38]);box(x+.11,.34,z,.15,.6,.18,[.32,.29,.38]);
    cylinder(x,.95,z,.24,.68,color);cylinder(x,1.48,z,.17,.28,[.94,.79,.65]);
    const angle=p.facing*Math.PI/180,front=[-Math.sin(angle),Math.cos(angle)],right=[Math.cos(angle),Math.sin(angle)];
    tri([x+front[0]*.65,.04,z+front[1]*.65],[x+right[0]*.14+front[0]*.3,.04,z+right[1]*.14+front[1]*.3],[x-right[0]*.14+front[0]*.3,.04,z-right[1]*.14+front[1]*.3],color);
  }
  return new Float32Array(data);
}

export function mountStage3D(host,project,positions,options={}){
  host.classList.add('webgl-stage');host.classList.remove('spatial');host.replaceChildren();
  const canvas=document.createElement('canvas');canvas.tabIndex=0;canvas.setAttribute('aria-label','3D stage. Drag to orbit; right or middle drag pans. Wheel or pinch zooms. Open View controls for camera buttons.');
  host.append(canvas);
  const gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:false});
  const fallback=()=>{host.innerHTML='<div class="stage3d-fallback"><strong>3D is unavailable on this device.</strong><p>You can keep editing and rehearsing in 2D.</p><button class="button" data-view="2d">Return to 2D</button></div>';};
  if(!gl){fallback();return {update(){},dispose(){}};}
  const vertex=`attribute vec3 position;attribute vec3 normal;attribute vec3 color;uniform mat4 matrix;varying vec3 lit;void main(){float light=.52+.48*abs(dot(normalize(normal),normalize(vec3(.4,.8,.5))));lit=color*light;gl_Position=matrix*vec4(position,1.);}`;
  const fragment=`precision mediump float;varying vec3 lit;void main(){gl_FragColor=vec4(lit,1.);}`;
  const shader=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);throw Error('Shader compilation failed');}return shader;};
  let program,buffer,vs,fs;
  try{vs=shader(gl.VERTEX_SHADER,vertex);fs=shader(gl.FRAGMENT_SHADER,fragment);program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('3D program failed');buffer=gl.createBuffer();}catch{if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);fallback();return {update(){},dispose(){}};}
  const controller=new AbortController(),signal=controller.signal;
  const floor=createStageFloor(gl,()=>requestDraw());floor.load(project.production?.stage.image?.data||'');
  const camera=options.camera||{};Object.assign(camera,safeCamera(camera));let yaw=camera.yaw,pitch=camera.pitch,disposed=false,contextLost=false;
  let currentShowGrid=options.showGrid!==false,currentLabels=options.labels===true;
  let current=project,currentPositions=positions,currentGhosts=options.ghosts||[],currentAnalysis=options.analysis,vertices,dirty=true,frame=0,fitKey='',fitDistance=0,sceneKey=stageSceneKey(project,positions,options.selected?.()||new Set())+JSON.stringify(options.ghosts||[]);
  let cast=new Map(project.performers.map(p=>[p.id,p]));const labelNodes=new Map(),ghostNodes=new Map();
  const matrixLocation=gl.getUniformLocation(program,'matrix');
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(const [name,offset] of [['position',0],['normal',12],['color',24]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,36,offset);}
  const ghostLabels=document.createElement('div');ghostLabels.className='stage3d-labels stage3d-ghosts';host.append(ghostLabels);
  const analysisLabels=document.createElement('div');analysisLabels.className='stage3d-labels analysis-labels';host.append(analysisLabels);const analysisLabel=document.createElement('span');analysisLabels.append(analysisLabel);
  const labels=document.createElement('div');labels.className='stage3d-labels';host.append(labels);
  const caption=document.createElement('p');caption.className='stage3d-caption';caption.textContent='Drag orbit · Right/middle drag pan · Wheel/pinch zoom · View controls above';host.append(caption);
  function requestDraw(){if(!disposed&&!frame)frame=requestAnimationFrame(()=>{frame=0;draw();});}
  function draw(){
    if(disposed||contextLost)return;
    caption.textContent=floor.error?'Floor plan unavailable · the 3D stage remains usable. Reimport the image to include it in exports.':'Drag orbit · Right/middle drag pan · Wheel/pinch zoom · View controls above';
    yaw=camera.yaw;pitch=camera.pitch;const started=performance.now();
    const rect=host.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
    const dpr=options.pixelRatio?Math.max(.25,Math.min(32,options.pixelRatio)):Math.min(window.devicePixelRatio||1,matchMedia('(pointer: coarse)').matches?1:1.5);
    const width=Math.max(1,Math.floor(rect.width*dpr)),height=Math.max(1,Math.floor(rect.height*dpr));if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
    gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.94,.925,.955,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.useProgram(program);
    const aspect=canvas.width/canvas.height;
    const key=[current.stage.width,current.stage.depth,aspect,yaw,pitch].join('/');
    if(key!==fitKey){
    const horizontal=current.stage.width*Math.abs(Math.cos(yaw))+current.stage.depth*Math.abs(Math.sin(yaw));
    const vertical=(current.stage.depth*Math.abs(Math.cos(yaw))+current.stage.width*Math.abs(Math.sin(yaw)))*Math.sin(pitch)+2.5;
    let fitted=Math.max(horizontal/(2*Math.tan(Math.PI/7)*aspect),vertical/(2*Math.tan(Math.PI/7)))*1.18;
    const corners=[];for(const x of [-current.stage.width/2,current.stage.width/2])for(const z of [-current.stage.depth/2,current.stage.depth/2])for(const y of [0,1.8])corners.push([x,y,z]);
    for(let step=0;step<16;step++){const eye=[Math.sin(yaw)*Math.cos(pitch)*fitted,Math.sin(pitch)*fitted,Math.cos(yaw)*Math.cos(pitch)*fitted],matrix=cameraMatrix(eye,[0,.2,0],aspect);if(corners.every(p=>{const q=projectPoint(matrix,p);return q&&Math.abs(q[0])<.91&&Math.abs(q[1])<.87;}))break;fitted*=1.08;}
    fitKey=key;fitDistance=fitted;}
    const distance=fitDistance/camera.zoom,target=camera.target||[0,.2,0];
    const eye=[target[0]+Math.sin(yaw)*Math.cos(pitch)*distance,target[1]+Math.sin(pitch)*distance,target[2]+Math.cos(yaw)*Math.cos(pitch)*distance];
    const matrix=cameraMatrix(eye,target,canvas.width/canvas.height);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(const [name,offset] of [['position',0],['normal',12],['color',24]]){const location=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,36,offset);}
    gl.uniformMatrix4fv(matrixLocation,false,matrix);
    if(dirty){vertices=geometry(current,currentPositions,options.selected?.()||new Set(),currentGhosts,currentAnalysis,currentShowGrid);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.DYNAMIC_DRAW);dirty=false;}
    gl.drawArrays(gl.TRIANGLES,0,vertices.length/9);
    floor.draw(matrix,current.production?.stage.image);
    for(const node of labelNodes.values())node.hidden=true;
    for(const p of currentPositions){
      if(p.visible===false)continue;const pos=projectPoint(matrix,[p.x,1.95,-p.z]);if(!pos||Math.abs(pos[0])>1||Math.abs(pos[1])>1)continue;
      const person=cast.get(p.performerId);if(!person)continue;let label=labelNodes.get(p.performerId);if(!label){label=document.createElement('button');label.onclick=()=>options.onSelect?.(p.performerId);labels.append(label);labelNodes.set(p.performerId,label);}label.hidden=false;label.textContent=String(person.number).padStart(2,'0')+(currentLabels?' · '+person.name:'');label.title=person.name+(person.costume?' · '+person.costume:'');label.setAttribute('aria-label',`Select ${person.name} in 3D`);label.style.left=`${(pos[0]*.5+.5)*100}%`;label.style.top=`${(-pos[1]*.5+.5)*100}%`;label.style.color='var(--text)';label.style.borderColor=person.color;
    }
    const liveGhosts=new Set();for(const ghost of currentGhosts)for(const p of ghost.positions){const pos=projectPoint(matrix,[p.x,.2,-p.z]);if(!pos||Math.abs(pos[0])>1||Math.abs(pos[1])>1)continue;const person=cast.get(p.performerId),key=`${ghost.time}/${p.performerId}`;liveGhosts.add(key);let label=ghostNodes.get(key);if(!label){label=document.createElement('span');ghostLabels.append(label);ghostNodes.set(key,label);}const text=`${ghost.label} · ${person?.number||''}`;if(label.textContent!==text)label.textContent=text;label.style.left=`${(pos[0]*.5+.5)*100}%`;label.style.top=`${(-pos[1]*.5+.5)*100}%`;}
    for(const [key,label] of ghostNodes)if(!liveGhosts.has(key)){label.remove();ghostNodes.delete(key);}

    analysisLabel.hidden=!currentAnalysis?.summary;analysisLabel.textContent=currentAnalysis?.summary||'';
    options.onRenderCost?.(performance.now()-started);
  }
  let navigation=options.navigationMode==='pan'?'pan':'orbit';host.dataset.navigation=navigation;
  const metrics=()=>{const rect=host.getBoundingClientRect();return {width:rect.width,height:rect.height,distance:(fitDistance||Math.max(current.stage.width,current.stage.depth)*1.4)/camera.zoom};};
  const changed=()=>{options.onCameraChange?.(camera);requestDraw();};
  const reset=()=>{options.onManualPan?.();Object.assign(camera,{yaw:.15,pitch:.68,zoom:1,target:[0,.2,0]});changed();};
  const controls=options.interactive===false?null:bindCameraControls(canvas,{camera,metrics,changed,mode:()=>navigation,manualPan:()=>options.onManualPan?.(),following:()=>options.following?.()||false,reset,signal});
  const dock=options.interactive===false?null:mountNavigationDock(host,{kind:'spatial',getMode:()=>navigation,mode:value=>{navigation=value;host.dataset.navigation=value;options.onNavigationMode?.(value);},pan:controls.pan,orbit:controls.orbit,zoom:controls.zoom,fit:reset,focus:()=>options.onFocus?.(),signal});
  canvas.addEventListener('webglcontextlost',event=>{if(!disposed){event.preventDefault();contextLost=true;fallback();}},{signal});
  const resize=observeSize(host,requestDraw);requestDraw();
  return {camera,get ready(){return floor.ready;},update(project,positions,extras={}){if(disposed||contextLost)return;const grid=extras.showGrid??currentShowGrid;if(grid!==currentShowGrid){currentShowGrid=grid;dirty=true;}currentLabels=extras.labels??currentLabels;const ghosts=extras.ghosts||currentGhosts,key=stageSceneKey(project,positions,options.selected?.()||new Set())+JSON.stringify(ghosts);floor.load(project.production?.stage.image?.data||'');if(key===sceneKey&&extras.analysis===currentAnalysis){requestDraw();return;}sceneKey=key;currentAnalysis=extras.analysis;current=project;currentPositions=positions;currentGhosts=ghosts;cast=new Map(project.performers.map(p=>[p.id,p]));dirty=true;requestDraw();},
   capture(ctx,width,height){if(contextLost)throw Error('3D graphics were interrupted. Reload the studio or export the 2D view.');cancelAnimationFrame(frame);frame=0;draw();const rect=host.getBoundingClientRect(),scale=Math.min(width/rect.width,height/rect.height),captureWidth=rect.width*scale,captureHeight=rect.height*scale,offsetX=(width-captureWidth)/2,offsetY=(height-captureHeight)/2;ctx.fillStyle='rgb(240,236,244)';ctx.fillRect(0,0,width,height);ctx.drawImage(canvas,offsetX,offsetY,captureWidth,captureHeight);ctx.save();ctx.beginPath();ctx.rect(offsetX,offsetY,captureWidth,captureHeight);ctx.clip();for(const label of [...ghostLabels.children,...analysisLabels.children,...labels.children]){if(label.hidden)continue;const box=label.getBoundingClientRect(),style=getComputedStyle(label),x=offsetX+(box.left-rect.left)/rect.width*captureWidth,y=offsetY+(box.top-rect.top)/rect.height*captureHeight,w=box.width/rect.width*captureWidth,h=box.height/rect.height*captureHeight;ctx.save();ctx.globalAlpha=ghostLabels.contains(label) ? .45 : 1;ctx.fillStyle=style.backgroundColor;const r=Math.min(w/2,h/2,(parseFloat(style.borderRadius)||0)*captureHeight/rect.height);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();ctx.fill();if(parseFloat(style.borderTopWidth)>0){ctx.strokeStyle=style.borderColor;ctx.lineWidth=parseFloat(style.borderTopWidth)*captureHeight/rect.height;ctx.stroke();}ctx.fillStyle=style.color;ctx.font=`${style.fontWeight||'normal'} ${parseFloat(style.fontSize)*captureHeight/rect.height}px ${style.fontFamily}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label.textContent,x+w/2,y+h/2);ctx.restore();}ctx.restore();},
   dispose(){disposed=true;floor.dispose();dock?.dispose();cancelAnimationFrame(frame);controller.abort();resize.disconnect();gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);gl.getExtension('WEBGL_lose_context')?.loseContext();}};
}
