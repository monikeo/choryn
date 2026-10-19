import {observeSize} from './compat.js';
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
function geometry(project,positions,selected){
  const data=[];
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
  for(let i=0;i<=w;i++)box(i-w/2,.005,0,.012,.012,d,[.66,.62,.72]);
  for(let i=0;i<=d;i++)box(0,.005,i-d/2,w,.012,.012,[.66,.62,.72]);
  box(0,.015,0,.025,.015,d,[.51,.43,.63]);box(0,.015,0,w,.015,.025,[.51,.43,.63]);
  box(0,-.1,d/2+.6,w*.6,.08,.12,[.49,.38,.78]);
  for(const prop of project.props||[]){const h=Math.max(.05,prop.height),color=rgb(prop.color);if(prop.shape==='rectangle'||!prop.shape){box(prop.x,h/2,-prop.z,prop.width,h,prop.depth,color,prop.rotation||0);continue;}const n=prop.shape==='triangle'?3:24,a=(prop.rotation||0)*Math.PI/180,points=Array.from({length:n},(_,i)=>{const angle=i/n*Math.PI*2-Math.PI/2,vertex=prop.shape==='triangle'?[[0,-prop.depth/2],[prop.width/2,prop.depth/2],[-prop.width/2,prop.depth/2]][i]:[Math.cos(angle)*prop.width/2,Math.sin(angle)*prop.depth/2],dx=vertex[0],dz=vertex[1];return [prop.x+dx*Math.cos(a)-dz*Math.sin(a),-prop.z+dx*Math.sin(a)+dz*Math.cos(a)];});for(let i=0;i<n;i++){const p=points[i],q=points[(i+1)%n],b=[p[0],0,p[1]],c=[q[0],0,q[1]],t=[p[0],h,p[1]],u=[q[0],h,q[1]];tri(b,t,u,color);tri(b,u,c,color);tri([prop.x,h,-prop.z],u,t,color);tri([prop.x,0,-prop.z],b,c,color);}}
  for(const p of positions){
    if(p.visible===false)continue;
    const performer=project.performers.find(v=>v.id===p.performerId);if(!performer)continue;
    const color=rgb(performer.color),x=p.x,z=-p.z;
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
  const canvas=document.createElement('canvas');canvas.tabIndex=0;canvas.setAttribute('aria-label','3D stage preview. Drag to orbit. Arrow keys rotate. Plus and minus zoom.');
  host.append(canvas);
  const gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:false});
  const fallback=()=>{host.innerHTML='<div class="stage3d-fallback"><strong>3D is unavailable on this device.</strong><p>You can keep editing and rehearsing in 2D.</p><button class="button" data-view="2d">Return to 2D</button></div>';};
  if(!gl){fallback();return {update(){},dispose(){}};}
  const vertex=`attribute vec3 position;attribute vec3 normal;attribute vec3 color;uniform mat4 matrix;varying vec3 lit;void main(){float light=.52+.48*abs(dot(normalize(normal),normalize(vec3(.4,.8,.5))));lit=color*light;gl_Position=matrix*vec4(position,1.);}`;
  const fragment=`precision mediump float;varying vec3 lit;void main(){gl_FragColor=vec4(lit,1.);}`;
  const shader=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('Shader compilation failed');return shader;};
  let program,buffer,vs,fs;
  try{vs=shader(gl.VERTEX_SHADER,vertex);fs=shader(gl.FRAGMENT_SHADER,fragment);program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('3D program failed');buffer=gl.createBuffer();}catch{fallback();return {update(){},dispose(){}};}
  const controller=new AbortController(),signal=controller.signal;
  const camera=options.camera||{yaw:.15,pitch:.68,zoom:1};let yaw=camera.yaw,pitch=camera.pitch,disposed=false;
  let current=project,currentPositions=positions;
  const labels=document.createElement('div');labels.className='stage3d-labels';host.append(labels);
  const caption=document.createElement('p');caption.className='stage3d-caption';caption.textContent='Drag to orbit · + / − to zoom · purple edge faces the audience';host.append(caption);
  function draw(){
    if(disposed)return;
    const rect=host.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
    const dpr=Math.min(window.devicePixelRatio||1,matchMedia('(pointer: coarse)').matches?1:1.5);
    const width=Math.max(1,Math.floor(rect.width*dpr)),height=Math.max(1,Math.floor(rect.height*dpr));if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
    gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.94,.925,.955,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.useProgram(program);
    const aspect=canvas.width/canvas.height;
    const horizontal=current.stage.width*Math.abs(Math.cos(yaw))+current.stage.depth*Math.abs(Math.sin(yaw));
    const vertical=(current.stage.depth*Math.abs(Math.cos(yaw))+current.stage.width*Math.abs(Math.sin(yaw)))*Math.sin(pitch)+2.5;
    let fitted=Math.max(horizontal/(2*Math.tan(Math.PI/7)*aspect),vertical/(2*Math.tan(Math.PI/7)))*1.18;
    const corners=[];for(const x of [-current.stage.width/2,current.stage.width/2])for(const z of [-current.stage.depth/2,current.stage.depth/2])for(const y of [0,1.8])corners.push([x,y,z]);
    for(let step=0;step<16;step++){const eye=[Math.sin(yaw)*Math.cos(pitch)*fitted,Math.sin(pitch)*fitted,Math.cos(yaw)*Math.cos(pitch)*fitted],matrix=cameraMatrix(eye,[0,.2,0],aspect);if(corners.every(p=>{const q=projectPoint(matrix,p);return q&&Math.abs(q[0])<.91&&Math.abs(q[1])<.87;}))break;fitted*=1.08;}
    const distance=fitted/camera.zoom;
    const eye=[Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance];
    const matrix=cameraMatrix(eye,[0,.2,0],canvas.width/canvas.height);
    gl.uniformMatrix4fv(gl.getUniformLocation(program,'matrix'),false,matrix);
    const vertices=geometry(current,currentPositions,options.selected?.()||new Set());gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.DYNAMIC_DRAW);
    for(const [name,offset] of [['position',0],['normal',12],['color',24]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,36,offset);}
    gl.drawArrays(gl.TRIANGLES,0,vertices.length/9);
    labels.replaceChildren();
    for(const p of currentPositions){
      if(p.visible===false)continue;const pos=projectPoint(matrix,[p.x,1.95,-p.z]);if(!pos||Math.abs(pos[0])>1||Math.abs(pos[1])>1)continue;
      const person=current.performers.find(v=>v.id===p.performerId),label=document.createElement('button');label.textContent=String(person.number).padStart(2,'0');label.title=person.name;label.setAttribute('aria-label',`Select ${person.name} in 3D`);label.style.left=`${(pos[0]*.5+.5)*100}%`;label.style.top=`${(-pos[1]*.5+.5)*100}%`;label.style.color='var(--text)';label.style.borderColor=person.color;label.onclick=()=>options.onSelect?.(p.performerId);labels.append(label);
    }
  }
  const pointers=new Map();let start;
  let pinch=null;
  canvas.addEventListener('pointerdown',event=>{canvas.focus();canvas.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});start={x:event.clientX,y:event.clientY,yaw,pitch};if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom:camera.zoom};}},{signal});
  canvas.addEventListener('pointermove',event=>{if(!pointers.has(event.pointerId))return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===2&&pinch){const [a,b]=[...pointers.values()];camera.zoom=Math.max(.5,Math.min(3,pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance));options.onCameraChange?.();draw();}else if(pointers.size===1&&start){yaw=start.yaw-(event.clientX-start.x)*.008;pitch=Math.max(.12,Math.min(1.45,start.pitch+(event.clientY-start.y)*.006));camera.yaw=yaw;camera.pitch=pitch;draw();}},{signal});
  const end=event=>{pointers.delete(event.pointerId);start=null;pinch=null;};canvas.addEventListener('pointerup',end,{signal});canvas.addEventListener('pointercancel',end,{signal});
  canvas.addEventListener('keydown',event=>{let handled=true;if(event.key==='ArrowLeft')yaw-=.1;else if(event.key==='ArrowRight')yaw+=.1;else if(event.key==='ArrowUp')pitch=Math.min(1.45,pitch+.08);else if(event.key==='ArrowDown')pitch=Math.max(.12,pitch-.08);else if(event.key==='+'||event.key==='=')camera.zoom=Math.min(3,camera.zoom*1.1);else if(event.key==='-')camera.zoom=Math.max(.5,camera.zoom/1.1);else handled=false;if(handled){event.preventDefault();event.stopPropagation();camera.yaw=yaw;camera.pitch=pitch;options.onCameraChange?.();draw();}},{signal});
  canvas.addEventListener('webglcontextlost',event=>{if(!disposed){event.preventDefault();fallback();}},{signal});
  const resize=observeSize(host,draw);draw();
  return {update(project,positions){current=project;currentPositions=positions;draw();},dispose(){disposed=true;controller.abort();resize.disconnect();gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);gl.getExtension('WEBGL_lose_context')?.loseContext();}};
}
