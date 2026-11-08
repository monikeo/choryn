import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,validateProject,highlightsAt,samplePerformance} from '../src/engine.js';
import {sceneProject} from '../src/production-next-model.js';
import {renderMarkers2D} from '../src/stage2d.js';
import {mountStage3D,bodyMesh,bodyHeight,templateBlock,FLOATS_PER_VERTEX,invert,multiply,floorPointAt,cameraMatrix,projectPoint,stageLookSettings,setStageLook} from '../src/stage3d.js';

const clone=v=>JSON.parse(JSON.stringify(v));
function globals(values){const previous=new Map(Object.keys(values).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const [key,value] of Object.entries(values))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});return ()=>{for(const [key,descriptor] of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];};}
const memoryStorage=()=>{const data=new Map();return {getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};};

test('performer identity is kept only for female or male and survives a save round trip',()=>{
 const p=createProject('Identity',3);p.performers[0].identity='female';p.performers[1].identity='male';p.performers[2].identity='robot';
 const valid=validateProject(clone(p));
 assert.equal(valid.performers[0].identity,'female');assert.equal(valid.performers[1].identity,'male');assert.equal('identity' in valid.performers[2],false,'unknown identities read as Not specified');
 assert.deepEqual(validateProject(clone(valid)).performers.map(v=>v.identity),['female','male',undefined]);
});

test('formation highlights drop unknown and duplicate performers and hold until the next formation',()=>{
 const p=createProject('Highlights',3),[a,b]=p.performers.map(v=>v.id);
 p.formations[0].highlights=[a,a,'ghost',b];
 const valid=validateProject(clone(p));
 assert.deepEqual(valid.formations[0].highlights,[a,b]);
 assert.equal('highlights' in valid.formations[1],false,'formations without features stay compact');
 assert.deepEqual(highlightsAt(valid,valid.formations[0].time),[a,b]);
 const between=(valid.formations[0].time+valid.formations[1].time)/2;
 assert.deepEqual(highlightsAt(valid,between),[a,b],'a featured performer stays lit through the transition');
 assert.deepEqual(highlightsAt(valid,valid.formations[1].time),[]);
 valid.performers=valid.performers.filter(v=>v.id!==b);
 assert.deepEqual(highlightsAt(valid,valid.formations[0].time),[a],'removed performers are never highlighted');
 assert.deepEqual(sceneProject(valid,valid.formations[0].time).sceneHighlights,[a]);
});

test('2D markers show a highlight halo and announce the highlight',()=>{
 const p=createProject('Halo',2),[a,b]=p.performers.map(v=>v.id),positions=samplePerformance(p,0);
 const svg=renderMarkers2D({...p,sceneHighlights:[a]},positions,{selected:new Set(),rotation:0,mirror:false,flip:false});
 const first=svg.slice(svg.indexOf(`data-marker="${a}"`)),second=svg.slice(svg.indexOf(`data-marker="${b}"`));
 assert.match(first.slice(0,first.indexOf('</g></g>')),/class="highlight-halo"/);assert.match(svg,/is-highlighted/);assert.match(svg,/, highlighted,/);
 assert.doesNotMatch(second.slice(0,second.indexOf('</g></g>')),/highlight-halo/);
});

test('3D bodies follow identity proportions, stand on the floor and face downstage',()=>{
 const measure=kind=>{const m=bodyMesh(kind);assert.equal(m.length%(FLOATS_PER_VERTEX*3),0);let top=-Infinity,bottom=Infinity,shoulder=0,hips=0,front=-Infinity;const h=bodyHeight(kind);for(let i=0;i<m.length;i+=FLOATS_PER_VERTEX){const [x,y,z]=[m[i],m[i+1],m[i+2]];top=Math.max(top,y);bottom=Math.min(bottom,y);const kind=Math.round(m[i+9]);if(kind===4&&Math.abs(y-h*.79)<.04)shoulder=Math.max(shoulder,Math.abs(x));if(kind===6&&Math.abs(y-h*.51)<.03)hips=Math.max(hips,Math.abs(x));if(y>h*.85)front=Math.max(front,z);for(let k=3;k<6;k++)assert.ok(Number.isFinite(m[i+k]));}return {top,bottom,shoulder,hips,front,h};};
 const female=measure('female'),male=measure('male'),neutral=measure('neutral');
 for(const body of [female,male,neutral]){assert.ok(Math.abs(body.bottom)<.01,'feet rest on the stage');assert.ok(Math.abs(body.top-body.h)<.08,'top of head matches stature');assert.ok(body.front>.09,'the face (nose) points to +Z so facing reads in 3D');}
 assert.ok(female.h<neutral.h&&neutral.h<male.h);
 assert.ok(male.shoulder/male.hips>female.shoulder/female.hips,'male shoulders are broader relative to hips');
 const {templates,data}=templateBlock();assert.equal(templateBlock().data,data,'templates are built once');
 for(const name of ['female','male','neutral','marker','ring','beam'])assert.ok(templates[name].count>0&&templates[name].count%3===0);
});

test('screen picking maps back to the exact floor point',()=>{
 const matrix=cameraMatrix([4,9,14],[0,.2,0],1.6),inv=invert(matrix),identity=multiply(matrix,inv);
 for(let i=0;i<16;i++)assert.ok(Math.abs(identity[i]-(i%5===0?1:0))<1e-3);
 for(const point of [[0,0,0],[3.5,0,-2],[-4,0,3]]){const q=projectPoint(matrix,point),hit=floorPointAt(matrix,q[0],q[1],0);assert.ok(Math.abs(hit.x-point[0])<1e-3&&Math.abs(hit.z-point[2])<1e-3);}
 assert.equal(floorPointAt(cameraMatrix([0,5,10],[0,5,0],1),0,.9,0),null,'a ray above the horizon never hits the floor');
});

test('stage look preference persists and tolerates unavailable storage',()=>{
 let restore=globals({localStorage:memoryStorage()});
 try{assert.deepEqual(stageLookSettings(),{look:'rehearsal',set:true});setStageLook({look:'show'});assert.deepEqual(stageLookSettings(),{look:'show',set:true});setStageLook({set:false});assert.deepEqual(stageLookSettings(),{look:'show',set:false});}finally{restore();}
 restore=globals({localStorage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}});
 try{assert.deepEqual(stageLookSettings(),{look:'rehearsal',set:true});assert.doesNotThrow(()=>setStageLook({look:'show'}));}finally{restore();}
});

// A small DOM/WebGL double that records listeners and draw calls.
function harness(){
 const draws=[],matrices=[],uploads=[],gl={getShaderParameter:()=>true,getProgramParameter:()=>true,createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({}),getAttribLocation:()=>0,getUniformLocation:()=>({}),bufferData:(type,data)=>uploads.push(data.length),uniformMatrix4fv:(loc,transpose,matrix)=>matrices.push([...matrix]),drawArrays:(...args)=>draws.push(args),getExtension:()=>({loseContext(){}})};
 for(const name of ['shaderSource','compileShader','attachShader','linkProgram','bindBuffer','enableVertexAttribArray','disableVertexAttribArray','vertexAttribPointer','viewport','clearColor','clear','enable','disable','useProgram','deleteBuffer','deleteProgram','deleteShader','blendFunc','depthMask','uniform3f','uniform4f','uniform1f','uniform4fv','uniform3fv'])gl[name]=()=>{};
 for(const [i,name] of ['VERTEX_SHADER','FRAGMENT_SHADER','COMPILE_STATUS','LINK_STATUS','ARRAY_BUFFER','FLOAT','TRIANGLES','DYNAMIC_DRAW','DEPTH_TEST','COLOR_BUFFER_BIT','DEPTH_BUFFER_BIT','BLEND','ONE'].entries())gl[name]=i;
 class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.style={};this.attrs={};this.dataset={};this.listeners=[];this.classList={add(){},remove(){},contains(){return false;}};this.textContent='';this.innerHTML='';}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}replaceChildren(){this.children=[];}
  setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}hasAttribute(k){return k in this.attrs;}
  addEventListener(type,fn,options){if(options?.signal?.aborted)return;this.listeners.push({type,fn});options?.signal?.addEventListener('abort',()=>{this.listeners=this.listeners.filter(l=>l.fn!==fn);});}removeEventListener(){}
  dispatch(type,props={}){const event={type,button:0,buttons:1,isPrimary:true,pointerId:1,pointerType:'mouse',shiftKey:false,ctrlKey:false,metaKey:false,stopped:false,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},stopImmediatePropagation(){this.stopped=true;},...props};for(const l of this.listeners.filter(l=>l.type===type)){l.fn(event);if(event.stopped)break;}return event;}
  querySelector(){return new Element('stub');}querySelectorAll(){return [];}getContext(){return gl;}focus(){}setPointerCapture(){}releasePointerCapture(){}hasPointerCapture(){return false;}
  contains(node){return node===this||this.children.some(c=>c.contains(node));}remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
  getBoundingClientRect(){return this.tagName==='host'||this.tagName==='canvas'?{width:960,height:600,left:0,top:0}:{width:28,height:18,left:0,top:0};}
 }
 const frames=[],storage=memoryStorage();
 const restore=globals({document:{createElement:tag=>new Element(tag),addEventListener(){}},window:{devicePixelRatio:1},matchMedia:()=>({matches:false}),ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:cb=>{frames.push(cb);return frames.length;},cancelAnimationFrame(){},localStorage:storage,getComputedStyle:()=>({})});
 const flush=()=>{for(const cb of frames.splice(0))cb();};
 const screen=(point)=>{const q=projectPoint(matrices.at(-1),point);return {clientX:(q[0]*.5+.5)*960,clientY:(-q[1]*.5+.5)*600};};
 return {gl,draws,matrices,uploads,Element,flush,screen,restore,storage};
}

test('3D drag moves the pressed performer on the floor without orbiting the camera',()=>{
 const h=harness();let stage;
 try{
  const project=createProject('Drag',2),positions=samplePerformance(project,0).map((p,i)=>({...p,x:i?3:-2,z:i?-1:1,facing:0}));
  project.performers[0].identity='female';project.performers[1].identity='male';
  const id=project.performers[0].id,calls=[],host=new h.Element('host'),camera={yaw:.15,pitch:.68,zoom:1,target:[0,.2,0]};
  stage=mountStage3D(host,project,positions,{camera,selected:()=>new Set([id]),onSelect:(v,add)=>calls.push(['select',v,add]),onDragStart:t=>{calls.push(['start',t]);return true;},onDragMove:(t,dx,dz)=>calls.push(['move',t,dx,dz]),onDragEnd:(t,commit)=>calls.push(['end',t,commit])});
  h.flush();const canvas=host.children[0];assert.equal(canvas.tagName,'canvas');
  const {templates}=templateBlock();assert.ok(h.draws.some(d=>d[1]===templates.female.start&&d[2]===templates.female.count),'female body drawn');assert.ok(h.draws.some(d=>d[1]===templates.male.start),'male body drawn');
  const yaw=camera.yaw,down=canvas.dispatch('pointerdown',h.screen([-2,0,-1]));
  assert.equal(down.stopped,true,'camera controls never see a press on a performer');
  assert.deepEqual(calls.slice(0,2),[['select',id,false],['start',{kind:'performer',id}]]);
  canvas.dispatch('pointermove',h.screen([-1,0,-1.5]));
  const move=calls.find(c=>c[0]==='move');assert.ok(move,'drag moves after the threshold');assert.ok(Math.abs(move[2]-1)<1e-3&&Math.abs(move[3]-.5)<1e-3,`floor delta ${move[2]},${move[3]}`);
  canvas.dispatch('pointerup',h.screen([-1,0,-1.5]));assert.deepEqual(calls.at(-1),['end',{kind:'performer',id},true]);assert.equal(camera.yaw,yaw);
  // Pressing empty floor orbits as before.
  calls.length=0;canvas.dispatch('pointerdown',{...h.screen([0,0,3.5]),pointerId:2});canvas.dispatch('pointermove',{...h.screen([0,0,3.5]),clientX:h.screen([0,0,3.5]).clientX+80,pointerId:2});
  assert.equal(calls.length,0);assert.notEqual(camera.yaw,yaw,'empty stage still orbits');
 }finally{stage?.dispose();h.restore();}
});

test('3D props can be picked and a cancelled drag reports no commit',()=>{
 const h=harness();let stage;
 try{
  const project=createProject('Props',1),positions=samplePerformance(project,0).map(p=>({...p,x:3,z:2}));
  project.props=[{id:'riser',name:'Riser',x:-3,z:-1.5,width:1.6,depth:1.2,height:.6,rotation:30,shape:'rectangle',color:'#8a7f6a'}];
  const calls=[],host=new h.Element('host');
  stage=mountStage3D(host,project,positions,{camera:{yaw:.15,pitch:.68,zoom:1,target:[0,.2,0]},selected:()=>new Set(),onSelect:()=>{},onDragStart:t=>{calls.push(['start',t]);return true;},onDragMove:()=>calls.push(['move']),onDragEnd:(t,commit)=>calls.push(['end',t,commit])});
  h.flush();const canvas=host.children[0];
  canvas.dispatch('pointerdown',h.screen([-3,0,1.5]));assert.deepEqual(calls[0],['start',{kind:'prop',id:'riser'}]);
  canvas.dispatch('pointercancel',{});assert.deepEqual(calls.at(-1),['end',{kind:'prop',id:'riser'},false]);
  calls.length=0;canvas.dispatch('pointerdown',h.screen([-3,0,1.5]));canvas.dispatch('pointerup',h.screen([-3,0,1.5]));assert.deepEqual(calls.at(-1),['end',{kind:'prop',id:'riser'},false],'a click without movement is not a move');
 }finally{stage?.dispose();h.restore();}
});

test('Show light adds a follow beam only over highlighted performers; read-only views never drag',()=>{
 const h=harness();let stage;
 try{
  h.storage.setItem('choryn.stage3d.v1',JSON.stringify({look:'show',set:true}));
  const project=createProject('Feature',3),positions=samplePerformance(project,0),id=project.performers[1].id,{templates}=templateBlock(),beams=()=>h.draws.filter(d=>d[1]===templates.beam.start).length;
  const host=new h.Element('host');let started=0;
  stage=mountStage3D(host,project,positions,{interactive:false,camera:{yaw:.15,pitch:.68,zoom:1,target:[0,.2,0]},selected:()=>new Set(),onDragStart:()=>{started++;return true;}});
  h.flush();assert.equal(beams(),0);assert.equal(host.dataset.look,'show');
  h.draws.length=0;stage.update({...project,sceneHighlights:[id]},positions);h.flush();assert.equal(beams(),1);
  assert.equal(h.uploads.length,1,'highlighting and colour changes do not re-upload geometry');
  host.children[0].dispatch('pointerdown',h.screen([positions[1].x,0,-positions[1].z]));assert.equal(started,0);
 }finally{stage?.dispose();h.restore();}
});
