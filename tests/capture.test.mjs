import test from 'node:test';
import assert from 'node:assert/strict';
import {mountStage3D,templateBlock} from '../src/stage3d.js';
import {createProject,samplePerformance} from '../src/engine.js';
import {recordVideo,videoSettings} from '../src/video.js';
import {createViewVideoRenderer} from '../src/view-video.js';

function globals(values){const previous=new Map(Object.keys(values).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const [key,value] of Object.entries(values))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});return ()=>{for(const [key,descriptor] of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];};}
test('3D view capture reuses the stage camera, ghost geometry and high-resolution surface',()=>{
 const uploads=[],matrices=[],draws=[],gl={getShaderParameter:()=>true,getProgramParameter:()=>true,createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({}),getAttribLocation:()=>0,getUniformLocation:()=>({}),bufferData:(type,data)=>uploads.push(data.length),uniformMatrix4fv:(loc,transpose,matrix)=>matrices.push([...matrix]),drawArrays:(...args)=>draws.push(args),getExtension:()=>({loseContext(){}})};
 for(const name of ['shaderSource','compileShader','attachShader','linkProgram','bindBuffer','enableVertexAttribArray','vertexAttribPointer','viewport','clearColor','clear','enable','useProgram','deleteBuffer','deleteProgram','deleteShader'])gl[name]=()=>{};
 for(const [i,name] of ['VERTEX_SHADER','FRAGMENT_SHADER','COMPILE_STATUS','LINK_STATUS','ARRAY_BUFFER','FLOAT','TRIANGLES','DYNAMIC_DRAW','DEPTH_TEST','COLOR_BUFFER_BIT','DEPTH_BUFFER_BIT'].entries())gl[name]=i;
 class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.style={};this.attrs={};this.dataset={};this.classList={add(){},remove(){}};this.textContent='';}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}replaceChildren(){this.children=[];}
  setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}addEventListener(){}removeEventListener(){}getContext(){return gl;}
  contains(node){return node===this||this.children.some(c=>c.contains(node));}remove(){this.parent.children=this.parent.children.filter(c=>c!==this);}
  getBoundingClientRect(){if(this.tagName==='host')return {width:960,height:600,left:0,top:0};const at=/translate\(([-\d.]+)px, ?([-\d.]+)px\)/.exec(this.style.transform||'')||[0,0,0];return {width:28,height:18,left:+at[1]-14,top:+at[2]-9};}
 }
 const restore=globals({document:{createElement:tag=>new Element(tag)},window:{devicePixelRatio:1},matchMedia:()=>({matches:false}),ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:()=>1,cancelAnimationFrame(){},getComputedStyle:()=>({backgroundColor:'#fff',borderColor:'#8465d6',color:'#292530',fontSize:'12px',fontFamily:'Arial',borderRadius:'5px',borderTopWidth:'1px',fontWeight:'600'})});
 let stage;try{const project=createProject('Capture',2),positions=samplePerformance(project,0),host=new Element('host'),camera={yaw:.2,pitch:.7,zoom:1,target:[0,.2,0]},ctx={images:0,texts:[],imageArgs:[],textPositions:[],drawImage(...args){this.images++;this.imageArgs.push(args);},save(){},restore(){},fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},closePath(){},fill(){},stroke(){},rect(){},clip(){},fillText(text,x,y){this.texts.push(text);this.textPositions.push({x,y});}};
  stage=mountStage3D(host,project,positions,{camera,interactive:false,pixelRatio:1.8,selected:()=>new Set()});stage.capture(ctx,1728,1080);assert.equal(host.children[0].width,1728);assert.equal(host.children[0].height,1080);assert.equal(uploads.length,1);assert.ok(ctx.images>0);assert.ok(ctx.texts.includes('01'));assert.equal(host.children[0].tabIndex,-1);const labels=host.children.find(n=>n.className==='stage3d-labels');assert.ok(labels.children.length);assert.ok(labels.children.every(n=>n.tabIndex===-1&&n.attrs.role==='img'));
  stage.update(project,positions);stage.capture(ctx,1728,1080);assert.equal(uploads.length,1,'unchanged capture must reuse uploaded geometry');const beforeOrbit=matrices.at(-1);camera.yaw+=.4;camera.pitch+=.1;stage.capture(ctx,1728,1080);assert.notDeepEqual(matrices.at(-1),beforeOrbit,'export reads the current orbit camera');assert.equal(uploads.length,1,'camera-only navigation does not rebuild geometry');const first=matrices[matrices.length-1];camera.target=[3,.2,-2];stage.update(project,positions,{ghosts:[{time:4,label:'2.1',positions}]});stage.capture(ctx,1728,1080);assert.notDeepEqual(matrices[matrices.length-1],first);assert.ok(uploads[uploads.length-1]>uploads[0]);assert.ok(ctx.texts.some(t=>t.includes('2.1')));const analysis={comparison:[],paths:[],cells:[{x:0,z:0,width:1,depth:1,color:'#d6465f'}],summary:'Spacing · 0.55 m threshold'};stage.update(project,positions,{analysis});stage.capture(ctx,1728,1080);assert.ok(ctx.texts.includes(analysis.summary));const count=uploads.length;stage.update(project,positions,{analysis});stage.capture(ctx,1728,1080);assert.equal(uploads.length,count);const ring=templateBlock().templates.ring,ringDraws=()=>draws.filter(d=>d[1]===ring.start&&d[2]===ring.count).length,beforeWarnings=ringDraws(),uploadsBefore=uploads.length;project.sceneSafety=[{type:'spacing',ids:[project.performers[0].id]}];stage.update(project,positions,{analysis});stage.capture(ctx,1728,1080);assert.equal(ringDraws()-beforeWarnings,1,'3D warning ring is present in matching-view capture');assert.equal(uploads.length,uploadsBefore,'warnings are per-instance and never rebuild scene geometry');
  const withGrid=uploads.at(-1);stage.update(project,positions,{analysis,showGrid:false,labels:true});stage.capture(ctx,1728,1080);assert.ok(uploads.at(-1)<withGrid,'3D grid toggle changes captured geometry');assert.ok(ctx.texts.includes('01 · '+project.performers[0].name),'3D exports include the same visible performer names');stage.capture(ctx,1080,1920);const image=ctx.imageArgs.at(-1);assert.deepEqual(image.slice(1),[0,622.5,1080,675],'portrait capture letterboxes the current wide view');assert.ok(ctx.textPositions.at(-1).y>622.5);
 }finally{stage?.dispose();restore();}
});

test('recording awaits the current-view frame renderer and preserves the actual MP4 type',async()=>{
 let now=0,stopped=0;const frames=[],ctx={};class Recorder {
  constructor(stream,options){this.mimeType=options.mimeType;this.state='inactive';}start(){this.state='recording';}stop(){if(this.state!=='recording')return;this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['encoded'],{type:this.mimeType})});this.onstop?.();});}
 }
 const restore=globals({MediaRecorder:Recorder,performance:{now:()=>{now+=100;return now;}},document:{addEventListener(){},removeEventListener(){}},requestAnimationFrame:callback=>setImmediate(callback),cancelAnimationFrame:clearImmediate});
 try{const canvas={getContext:()=>ctx,captureStream:()=>({getTracks:()=>[{stop(){stopped++;}}]})},settings=videoSettings(2,{start:0,end:.5,resolution:480});const blob=await recordVideo(createProject(),settings,{mime:'video/mp4',canvas,frameRenderer:{async draw(context,time){assert.equal(context,ctx);await Promise.resolve();frames.push(time);}}});assert.equal(blob.type,'video/mp4');assert.ok(frames.length>=3);assert.equal(frames[0],0);assert.equal(frames[frames.length-1],.5);assert.equal(stopped,1);
 }finally{restore();}
});
test('view-renderer failures reject an export and stop its capture tracks',async()=>{
 let now=0,stopped=0,calls=0;class Recorder {constructor(){this.state='inactive';this.mimeType='video/webm';}start(){this.state='recording';}stop(){this.state='inactive';queueMicrotask(()=>this.onstop?.());}}
 const restore=globals({MediaRecorder:Recorder,performance:{now:()=>{now+=100;return now;}},document:{addEventListener(){},removeEventListener(){}},requestAnimationFrame:callback=>setImmediate(callback),cancelAnimationFrame:clearImmediate});
 try{const canvas={getContext:()=>({}),captureStream:()=>({getTracks:()=>[{stop(){stopped++;}}]})};await assert.rejects(()=>recordVideo(createProject(),videoSettings(2,{start:0,end:.5}),{mime:'video/webm',canvas,frameRenderer:{async draw(){if(++calls>1)throw Error('Decode failed');}}}),/Decode failed/);assert.equal(stopped,1);
 }finally{restore();}
});


test('view renderer includes a synced reference and holds its final decoded frame without repeated seeks',async()=>{
 const seeks=[],images=[];class Media extends EventTarget {constructor(){super();this._time=0;this.duration=10;this.videoWidth=1920;this.videoHeight=1080;}set src(value){queueMicrotask(()=>this.dispatchEvent(new Event('loadeddata')));}get currentTime(){return this._time;}set currentTime(value){this._time=value;seeks.push(value);queueMicrotask(()=>this.dispatchEvent(new Event('seeked')));}pause(){}removeAttribute(){}load(){}}
 class Frame extends EventTarget {set src(value){queueMicrotask(()=>this.dispatchEvent(new Event('load')));}}
 const restore=globals({document:{createElement:()=>new Media()},Image:Frame});let renderer;
 try{const project=createProject(),settings=videoSettings(96,{start:0,end:20,resolution:480,aspect:1.6}),snapshot={kind:'2d',rotation:0,mirror:false,flip:false,zoom:1,pan:{x:0,y:0},selected:new Set(),aids:{},colors:{bg:'#fff'},viewport:{width:960,height:600},reference:{blob:new Blob(['local']),config:{start:0,trimStart:1,trimEnd:10},box:{x:.5,y:0,width:.5,height:.5}}},ctx={fillRect(){},drawImage(...args){images.push(args);}};
 renderer=await createViewVideoRenderer(project,settings,snapshot);await renderer.draw(ctx,3);assert.equal(seeks[0],4);await renderer.draw(ctx,15);assert.equal(seeks[1],9.999);await renderer.draw(ctx,16);assert.equal(seeks.length,2);assert.equal(images.length,6);const ref=images[images.length-1];assert.equal(ref[3]/ref[4],1920/1080);
 }finally{renderer?.dispose();restore();}
});

test('view decoding observes cancellation and releases its temporary resources',async()=>{
 class Frame extends EventTarget {set src(value){}}const restore=globals({Image:Frame});let renderer;
 try{const project=createProject(),controller=new AbortController();renderer=await createViewVideoRenderer(project,videoSettings(96),{kind:'2d',rotation:0,zoom:1,pan:{x:0,y:0},selected:new Set(),aids:{}},{signal:controller.signal});const pending=renderer.draw({},1);controller.abort();await assert.rejects(pending,/cancelled/);
 }finally{renderer?.dispose();restore();}
});
