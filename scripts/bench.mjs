import {mkdir,readFile,readdir,rm,writeFile,cp} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {performance} from 'node:perf_hooks';

// CPU benchmark for the work the studio repeats every frame, at the largest
// supported cast (100 performers). Run: npm run bench
// GPU time is not measured here; use Playback performance in the app for that.
const emitWarning=process.emitWarning;
process.emitWarning=(warning,...rest)=>String(warning?.message??warning).includes('stripTypeScriptTypes')?undefined:emitWarning.call(process,warning,...rest);
const root=fileURLToPath(new URL('../',import.meta.url)),runtime=resolve(root,'.openai/local/bench-runtime');
if(!runtime.startsWith(resolve(root,'.openai/local')+sep))throw Error('Invalid bench output path');
await rm(runtime,{recursive:true,force:true});await mkdir(resolve(runtime,'src'),{recursive:true});
for(const name of await readdir(resolve(root,'src'))){if(name.endsWith('.d.ts'))continue;const input=resolve(root,'src',name);if(name.endsWith('.ts'))await writeFile(resolve(runtime,'src',name.replace(/\.ts$/,'.js')),stripTypeScriptTypes(await readFile(input,'utf8'),{mode:'strip'}));else await cp(input,resolve(runtime,'src',name));}
await writeFile(resolve(runtime,'package.json'),'{"type":"module"}');
const load=name=>import(pathToFileURL(resolve(runtime,'src',name)).href);
const engine=await load('engine.js'),model=await load('production-next-model.js'),rehearsal=await load('rehearsal-model.js'),analysis=await load('analysis-model.js'),stage2d=await load('stage2d.js'),stage3d=await load('stage3d.js'),tools=await load('formation-tools.js'),beats=await load('beat-detect.js');

function bench(label,fn,{min=60,ms=400}={}){
  for(let i=0;i<5;i++)fn(i);// warm the JIT
  const samples=[];const start=performance.now();let i=0;
  while(samples.length<min||performance.now()-start<ms){const t=performance.now();fn(i++);samples.push(performance.now()-t);if(samples.length>20000)break;}
  samples.sort((a,b)=>a-b);const median=samples[samples.length>>1],p95=samples[Math.floor(samples.length*.95)];
  return {label,median,p95,runs:samples.length};
}
const fmt=v=>v<1?`${(v*1000).toFixed(0)} µs`:`${v.toFixed(2)} ms`;

// A demanding but valid project: 100 performers, routes, props, lights and checkpoints.
const project=engine.createProject('Benchmark',100);
project.props=Array.from({length:12},(_,i)=>({id:'prop'+i,name:'Prop '+i,kind:'prop',x:-5+i,z:i%2?2:-2,width:.8,depth:.6,height:.9,rotation:i*15,shape:i%3?'rectangle':'ellipse',color:'#8a7f6a'}));
project.formations[0].highlights=project.performers.slice(0,4).map(p=>p.id);
const times=Array.from({length:240},(_,i)=>i/240*project.duration);

// 3D stage with a recording WebGL double, so the CPU side of a real frame runs.
const gl={getShaderParameter:()=>true,getProgramParameter:()=>true,createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({}),getAttribLocation:(program,name)=>['position','normal','color','material','iPose','iColor','iState'].indexOf(name),getUniformLocation:()=>({}),getExtension:name=>name==='ANGLE_instanced_arrays'?{drawArraysInstancedANGLE(){},vertexAttribDivisorANGLE(){}}:null,checkFramebufferStatus:()=>1,createFramebuffer:()=>({}),createTexture:()=>({}),createRenderbuffer:()=>({}),FRAMEBUFFER_COMPLETE:1};
for(const name of ['shaderSource','compileShader','attachShader','bindAttribLocation','vertexAttrib3f','vertexAttrib4f','linkProgram','bindBuffer','bufferData','bufferSubData','enableVertexAttribArray','disableVertexAttribArray','vertexAttribPointer','viewport','clearColor','clear','enable','disable','useProgram','deleteBuffer','deleteProgram','deleteShader','blendFunc','depthMask','uniform3f','uniform4f','uniform1f','uniform1i','uniform2f','uniform4fv','uniform3fv','uniformMatrix4fv','drawArrays','bindFramebuffer','bindTexture','texImage2D','texParameteri','framebufferTexture2D','bindRenderbuffer','renderbufferStorage','framebufferRenderbuffer','activeTexture','deleteFramebuffer','deleteRenderbuffer','deleteTexture'])gl[name]=()=>{};
class Node {constructor(tag){this.tagName=tag;this.children=[];this.style={};this.dataset={};this.classList={add(){},remove(){}};this.attrs={};this.textContent='';this.hidden=false;}append(...n){this.children.push(...n);}replaceChildren(){this.children=[];}setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}hasAttribute(k){return k in this.attrs;}addEventListener(){}removeEventListener(){}querySelector(){return new Node('stub');}querySelectorAll(){return [];}getContext(){return gl;}getBoundingClientRect(){return {left:0,top:0,width:1280,height:720};}remove(){}contains(){return false;}}
const frames=[];
Object.assign(globalThis,{document:{createElement:t=>new Node(t),addEventListener(){}},matchMedia:()=>({matches:false}),ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:cb=>{frames.push(cb);return frames.length;},cancelAnimationFrame(){},getComputedStyle:()=>({})});
Object.defineProperty(globalThis,'window',{value:{devicePixelRatio:2},configurable:true});
const flush=()=>{for(const cb of frames.splice(0))cb();};

const results=[];
let firstMesh=performance.now();stage3d.templateBlock();firstMesh=performance.now()-firstMesh;
results.push({label:'3D body meshes (built once per page)',median:firstMesh,p95:firstMesh,runs:1});
results.push(bench('samplePerformance (positions at a time)',i=>engine.samplePerformance(project,times[i%times.length])));
const positionsAt=times.map(t=>engine.samplePerformance(project,t));
results.push(bench('sceneProject (props, lights, safety, highlights)',i=>model.sceneProject(project,times[i%times.length],positionsAt[i%times.length])));
results.push(bench('safetyIssues (100 performers, all pairs)',i=>model.safetyIssues(project,positionsAt[i%times.length],times[i%times.length])));
results.push(bench('ghostFrames (previous + next + counts)',i=>rehearsal.ghostFrames(project,times[i%times.length],{previous:true,next:true,countStep:2})));
results.push(bench('transitionAnalysis spacing heatmap',i=>analysis.transitionAnalysis(project,times[i%times.length],{heat:'spacing'}),{min:20,ms:400}));
results.push(bench('renderStage2D full SVG (re-render)',i=>stage2d.renderStage2D(project,project.formations[0],positionsAt[i%times.length],{selected:new Set(),pan:{x:0,y:0},zoom:1,rotation:0,mirror:false,flip:false,showGrid:true,labels:true,time:times[i%times.length]}),{min:20,ms:400}));
const host=new Node('host');const stage=stage3d.mountStage3D(host,model.sceneProject(project,0,positionsAt[0]),positionsAt[0],{interactive:false,selected:()=>new Set(),camera:{yaw:.15,pitch:.68,zoom:1,target:[0,.2,0]}});flush();
results.push(bench('3D frame: update + draw (shadow + main + labels)',i=>{const k=i%times.length;stage.update(model.sceneProject(project,times[k],positionsAt[k]),positionsAt[k]);flush();}));
results.push(bench('3D frame: camera orbit only (same positions)',()=>{stage.camera.yaw+=.001;stage.update(model.sceneProject(project,0,positionsAt[0]),positionsAt[0]);flush();}));
const gpuCalls=stage.stats.drawCalls;stage.dispose();
results.push(bench('validateProject (open/import a 100-performer project)',()=>engine.validateProject(JSON.parse(JSON.stringify(project))),{min:20,ms:400}));
// One-off tools (run on a click, not per frame).
const origins=new Map(project.formations[0].positions.map(p=>[p.performerId,p])),circle=engine.generateLayout('circle',project.performers,project.stage);
results.push(bench('assignByTravel (shortest-travel spots, 100 dancers)',()=>tools.assignByTravel(circle,origins),{min:10,ms:400}));
const crowded=project.formations[0].positions.map((p,i)=>({...p,x:(i%10-4.5)*.4,z:(Math.floor(i/10)-4.5)*.3}));
results.push(bench('spaceApart (fix spacing, 100 dancers packed tight)',()=>tools.spaceApart(crowded,{distance:.55,stage:project.stage}),{min:5,ms:400}));
results.push(bench('planClearRoutes (collision-free, 100 dancers)',()=>tools.planClearRoutes(project,project.formations[1].id),{min:3,ms:400}));
const rate=22050,song=new Float32Array(rate*180);for(let k=0;k*rate*.5<song.length;k++){const s=Math.round(k*rate*.5);for(let j=0;j<rate*.08&&s+j<song.length;j++)song[s+j]=Math.exp(-j/rate*25)*Math.sin(j*.05);}
results.push(bench('detectTempo (3-minute song)',()=>beats.detectTempo(song,rate),{min:3,ms:400}));

const width=Math.max(...results.map(r=>r.label.length));
console.log(`CHORYN CPU benchmark · ${project.performers.length} performers · ${project.formations.length} formations · Node ${process.version}\n`);
console.log('step'.padEnd(width),' median   p95      runs');
for(const r of results)console.log(r.label.padEnd(width),fmt(r.median).padEnd(8),fmt(r.p95).padEnd(8),r.runs);
console.log(`\n3D GPU draw calls per frame (instanced): ${gpuCalls}`);
console.log('Budget: a 60 fps frame has 16.7 ms for everything (JavaScript, layout, GPU).');
await rm(runtime,{recursive:true,force:true});
