import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,samplePerformance,closePairs,transitionSettings} from '../src/engine.js';
import {safetyIssues} from '../src/production-next-model.js';
import {transitionAnalysis,heatColor} from '../src/analysis-model.js';
import {ghostInterval} from '../src/rehearsal-model.js';
import {mountStage3D,buildInstances,templateBlock,INSTANCE_FLOATS} from '../src/stage3d.js';

// Small deterministic generator so failures reproduce.
const random=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
function scatter(project,seed){const next=random(seed);for(const f of project.formations)for(const p of f.positions){p.x=Math.round((next()-.5)*project.stage.width*.9*100)/100;p.z=Math.round((next()-.5)*project.stage.depth*.9*100)/100;if(next()<.15)p.x=f.positions[0].x;}return project;}

test('closePairs finds exactly the pairs a full nested loop finds, in the same order',()=>{
 for(let seed=1;seed<=120;seed++){
  const next=random(seed),n=Math.floor(next()*60),limit=.2+next()*1.5,points=Array.from({length:n},()=>({x:Math.round(next()*8*4)/4,z:Math.round(next()*6*4)/4}));
  const brute=[];for(let a=0;a<n;a++)for(let b=a+1;b<n;b++){const d=Math.hypot(points[a].x-points[b].x,points[a].z-points[b].z);if(d<limit)brute.push([a,b,d]);}
  assert.deepEqual(closePairs(points,limit),brute,`seed ${seed}`);
 }
});

test('safety spacing warnings are unchanged by the sweep (ids, distances and order)',()=>{
 for(const seed of [3,7,11,19]){
  const project=scatter(createProject('Safety',60),seed),positions=samplePerformance(project,0),visible=positions.filter(p=>p.visible!==false),distance=project.safetyDistance||.55;
  const expected=[];for(let a=0;a<visible.length;a++)for(let b=a+1;b<visible.length;b++){const d=Math.hypot(visible[a].x-visible[b].x,visible[a].z-visible[b].z);if(d<distance)expected.push([visible[a].performerId,visible[b].performerId,d]);}
  const actual=safetyIssues(project,positions,0).filter(v=>v.type==='spacing').map(v=>[...v.ids,v.distance]);
  assert.ok(expected.length>0,'the scattered cast has close pairs to compare');assert.deepEqual(actual,expected);
 }
});

// The pre-sweep spacing heat map, kept here as the reference implementation.
function referenceSpacing(project,time,threshold){
 const index=ghostInterval(project,time),from=project.formations[index],to=project.formations[index+1];
 const routes=(project.routes||[]).filter(r=>r.fromId===from.id&&r.toId===to.id),duration=Math.min(to.time-from.time,Math.max(transitionSettings(project,from).duration,...routes.map(r=>r.duration))),start=to.time-duration,steps=32,cells=new Map(),nx=Math.min(24,Math.max(4,Math.ceil(project.stage.width))),nz=Math.min(24,Math.max(4,Math.ceil(project.stage.depth))),cw=project.stage.width/nx,cd=project.stage.depth/nz;
 let min=Infinity;
 for(let i=0;i<=steps;i++){const positions=samplePerformance(project,start+duration*i/steps).filter(p=>p.visible!==false);
  for(let a=0;a<positions.length;a++)for(let b=a+1;b<positions.length;b++){const p=positions[a],q=positions[b],gap=Math.hypot(p.x-q.x,p.z-q.z);min=Math.min(min,gap);if(gap>=threshold)continue;
   for(const point of [p,q,{x:(p.x+q.x)/2,z:(p.z+q.z)/2}]){const x=Math.max(0,Math.min(nx-1,Math.floor((point.x+project.stage.width/2)/cw))),z=Math.max(0,Math.min(nz-1,Math.floor((point.z+project.stage.depth/2)/cd))),key=x+'/'+z,intensity=1-gap/threshold;if(!cells.has(key))cells.set(key,{x:-project.stage.width/2+(x+.5)*cw,z:-project.stage.depth/2+(z+.5)*cd,width:cw,depth:cd,intensity});else cells.get(key).intensity=Math.max(cells.get(key).intensity,intensity);}}}
 return {minSpacing:Number.isFinite(min)?min:null,cells:[...cells.values()].map(c=>({...c,color:heatColor(c.intensity)}))};
}

test('spacing heat map matches the full pairwise scan exactly',()=>{
 for(const seed of [5,13,29]){
  const project=scatter(createProject('Heat',70),seed);
  for(const threshold of [.55,1.2]){const time=project.formations[1].time-.01,actual=transitionAnalysis(project,time,{heat:'spacing',threshold}),expected=referenceSpacing(project,time,threshold);
   assert.equal(actual.minSpacing,expected.minSpacing);assert.deepEqual(actual.cells,expected.cells);}
 }
});

test('instances group every performer by mesh with rings, warnings and beams',()=>{
 const project=createProject('Groups',9),positions=samplePerformance(project,0),kinds=['female','male','neutral'];
 const figures=positions.map((p,i)=>({p,body:kinds[i%3],color:[i/10,.5,.5]})),ids=positions.map(p=>p.performerId);
 const {data,groups}=buildInstances(figures,{featured:new Set([ids[0]]),selected:new Set([ids[0],ids[1]]),warnings:new Set([ids[2]]),dimOthers:true,beams:true});
 assert.deepEqual([groups.female.count,groups.male.count,groups.neutral.count,groups.marker.count,groups.ring.count,groups.beam.count],[3,3,3,9,4,1]);
 assert.equal(data.length,(9+9+4+1)*INSTANCE_FLOATS);
 let next=0;for(const name of ['female','male','neutral','marker','ring','beam']){assert.equal(groups[name].start,next,`${name} follows the previous group`);next+=groups[name].count;}
 const state=i=>[data[i*INSTANCE_FLOATS+7],data[i*INSTANCE_FLOATS+8]];
 assert.deepEqual(state(0),[1,0],'the featured performer is lit, not dimmed');assert.deepEqual(state(1),[0,1],'others dim while someone is featured');
 const scales=Array.from({length:groups.ring.count},(_,i)=>Math.round(data[(groups.ring.start+i)*INSTANCE_FLOATS+3]*100)/100).sort();assert.deepEqual(scales,[1,1,1.16,1.32]);
 const calm=buildInstances(figures,{dimOthers:true,beams:true});assert.equal(calm.groups.beam.count,0);assert.ok([...Array(9).keys()].every(i=>calm.data[i*INSTANCE_FLOATS+8]===0),'nobody dims without a featured performer');
});

test('template meshes are indexed: far fewer shaded vertices, same triangles when expanded',()=>{
 const {vertices,indices,templates,data}=templateBlock();
 for(const name of ['female','male','neutral']){const t=templates[name],used=new Set(indices.subarray(t.start,t.start+t.count));assert.ok(used.size*3<t.count,`${name}: ${used.size} unique vertices for ${t.count} indices`);}
 assert.equal(data.length,indices.length*12);
 for(const k of [0,templates.male.start+7,templates.beam.start+templates.beam.count-1])assert.deepEqual([...data.subarray(k*12,k*12+12)],[...vertices.subarray(indices[k]*12,indices[k]*12+12)]);
});

function harness({instancing,indexed=false,gpu=null}){
 const calls={instanced:[],plain:[],shadowPasses:0,elements:[]};
 const timer=gpu&&{TIME_ELAPSED_EXT:1,QUERY_RESULT_AVAILABLE_EXT:2,QUERY_RESULT_EXT:3,GPU_DISJOINT_EXT:4,createQueryEXT:()=>({}),beginQueryEXT(){},endQueryEXT(){},deleteQueryEXT(){},getQueryObjectEXT:(q,what)=>what===2?true:gpu.ms*1e6};
 const gl={getShaderParameter:()=>true,getProgramParameter:()=>true,createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({}),createFramebuffer:()=>({}),createTexture:()=>({}),createRenderbuffer:()=>({}),checkFramebufferStatus:()=>1,FRAMEBUFFER_COMPLETE:1,
  getAttribLocation:(program,name)=>['position','normal','color','material','iPose','iColor','iState'].indexOf(name),getUniformLocation:()=>({}),
  getParameter:what=>what===4?false:'',
  getExtension:name=>name==='EXT_disjoint_timer_query'?timer||null:name==='ANGLE_instanced_arrays'&&instancing?{drawArraysInstancedANGLE:(mode,start,count,n)=>calls.instanced.push([start,count,n]),drawElementsInstancedANGLE:(mode,count,type,offset,n)=>calls.instanced.push([offset/2,count,n]),vertexAttribDivisorANGLE(){}}:null,
  drawArrays:(mode,start,count)=>calls.plain.push([start,count]),bindFramebuffer:(target,fbo)=>{if(fbo)calls.shadowPasses++;}};
 if(indexed){gl.ELEMENT_ARRAY_BUFFER=34963;gl.drawElements=(mode,count,type,offset)=>calls.elements.push([offset/2,count]);}
 for(const name of ['shaderSource','compileShader','attachShader','bindAttribLocation','linkProgram','bindBuffer','bufferData','bufferSubData','enableVertexAttribArray','disableVertexAttribArray','vertexAttribPointer','vertexAttrib3f','vertexAttrib4f','viewport','clearColor','clear','enable','disable','useProgram','deleteBuffer','deleteProgram','deleteShader','blendFunc','depthMask','uniform3f','uniform4f','uniform1f','uniform1i','uniform2f','uniform4fv','uniform3fv','uniformMatrix4fv','bindTexture','texImage2D','texParameteri','framebufferTexture2D','bindRenderbuffer','renderbufferStorage','framebufferRenderbuffer','activeTexture','deleteFramebuffer','deleteRenderbuffer','deleteTexture'])gl[name]=()=>{};
 class Node {constructor(tag){this.tagName=tag;this.children=[];this.style={};this.dataset={};this.classList={add(){},remove(){}};this.attrs={};this.textContent='';}append(...n){this.children.push(...n);}replaceChildren(){this.children=[];}setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}hasAttribute(k){return k in this.attrs;}addEventListener(){}removeEventListener(){}querySelector(){return new Node('stub');}querySelectorAll(){return [];}getContext(){return gl;}getBoundingClientRect(){return {left:0,top:0,width:1280,height:720};}remove(){}contains(){return false;}}
 const frames=[],saved={};for(const key of ['document','matchMedia','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','getComputedStyle','window'])saved[key]=Object.getOwnPropertyDescriptor(globalThis,key);
 const set=(key,value)=>Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
 set('document',{createElement:t=>new Node(t),addEventListener(){}});set('matchMedia',()=>({matches:false}));set('ResizeObserver',class{observe(){}disconnect(){}});set('requestAnimationFrame',cb=>{frames.push(cb);return frames.length;});set('cancelAnimationFrame',()=>{});set('getComputedStyle',()=>({}));set('window',{devicePixelRatio:1});
 return {calls,Node,flush:()=>{for(const cb of frames.splice(0))cb();},restore:()=>{for(const [key,d] of Object.entries(saved))if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key];}};
}

test('instanced 3D draws 100 performers in a handful of GPU calls and reuses shadows while only the camera moves',()=>{
 const h=harness({instancing:true,indexed:true});let stage;
 try{
  const project=createProject('Crowd',100);project.performers.forEach((p,i)=>{if(i%3===0)p.identity='female';else if(i%3===1)p.identity='male';});
  const positions=samplePerformance(project,0),camera={yaw:.15,pitch:.68,zoom:1,target:[0,.2,0]};
  stage=mountStage3D(new h.Node('host'),project,positions,{interactive:false,camera,selected:()=>new Set()});h.calls.shadowPasses=0;h.flush();
  const first=stage.stats;assert.equal(first.instanced,true);assert.equal(first.indexed,true);assert.equal(h.calls.elements.length,0,'instanced indexed draws never fall back to one call per performer');assert.ok(first.shadows);assert.ok(first.drawCalls<=10,`draw calls per frame: ${first.drawCalls}`);
  const {templates}=templateBlock(),bodies=h.calls.instanced.filter(([start])=>[templates.female.start,templates.male.start,templates.neutral.start].includes(start));
  assert.equal(bodies.reduce((n,c)=>n+c[2],0),200,'every performer is drawn once in the shadow pass and once in the main pass');
  assert.equal(h.calls.shadowPasses,1);
  camera.yaw+=.3;stage.update(project,positions);h.flush();assert.equal(stage.stats.shadowReused,true,'orbiting keeps the shadow map');assert.equal(h.calls.shadowPasses,1);
  const moved=positions.map((p,i)=>i?p:{...p,x:p.x+1});stage.update(project,moved);h.flush();assert.equal(stage.stats.shadowReused,false);assert.equal(h.calls.shadowPasses,2,'moving a performer redraws shadows');
 }finally{stage?.dispose();h.restore();}
});

test('live 3D lowers its render scale when GPU frames run long and restores it when they are cheap',()=>{
 const gpu={ms:30},h=harness({instancing:true,indexed:true,gpu});let stage;
 try{
  const project=createProject('Adaptive',40),positions=samplePerformance(project,0),host=new h.Node('host');
  stage=mountStage3D(host,project,positions,{interactive:false,camera:{yaw:.15,pitch:.68,zoom:1,target:[0,.2,0]},selected:()=>new Set()});
  const frame=()=>{stage.update(project,positions);h.flush();},canvas=host.children[0];
  frame();assert.equal(canvas.width,1280,'starts at full resolution');assert.equal(stage.stats.adaptive,true);
  for(let i=0;i<8;i++)frame();
  assert.ok(stage.stats.scale<1&&canvas.width<1280,`slow GPU frames lower the scale (now ${stage.stats.scale}, ${canvas.width}px)`);
  assert.ok(stage.stats.gpuMs>16,'the last GPU time stays reported right after a scale change');
  const until0=Date.now()+3000;while(stage.stats.scale>.75&&Date.now()<until0)frame();
  assert.equal(stage.stats.scale,.75,'never below 75% however slow');
  const lowered=canvas.width;gpu.ms=2;const until=Date.now()+2500;
  while(canvas.width<=lowered&&Date.now()<until)frame();
  assert.ok(canvas.width>lowered,'fast frames raise it again');
  assert.equal(mountStage3D(new h.Node('host'),project,positions,{interactive:false,pixelRatio:1.5,selected:()=>new Set()}).stats.adaptive,false,'exports keep their exact pixel ratio');
 }finally{stage?.dispose();h.restore();}
});

test('without instancing the renderer still draws every performer, one call each',()=>{
 const h=harness({instancing:false});let stage;
 try{
  const project=createProject('Fallback',20),positions=samplePerformance(project,0);
  stage=mountStage3D(new h.Node('host'),project,positions,{interactive:false,camera:{yaw:.15,pitch:.68,zoom:1,target:[0,.2,0]},selected:()=>new Set()});h.flush();
  const {templates}=templateBlock();assert.equal(stage.stats.instanced,false);assert.equal(h.calls.instanced.length,0);
  assert.equal(h.calls.plain.filter(([start])=>start===templates.neutral.start).length,40,'20 shadow + 20 main body draws');
 }finally{stage?.dispose();h.restore();}
});
