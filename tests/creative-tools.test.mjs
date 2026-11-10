import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,samplePerformance,closePairs,generateLayout,validateProject} from '../src/engine.js';
import {detectTempo,beatOffsetFor,monoSamples} from '../src/beat-detect.js';
import {assignByTravel,spaceApart,planClearRoutes} from '../src/formation-tools.js';
import {evaluateTransition,transitionSuggestions} from '../src/production-next-model.js';
import {cinematicCamera,smoothShot,createViewVideoRenderer} from '../src/view-video.js';
import {videoSettings,VIDEO_CAMERAS} from '../src/video.js';
import {safeCamera} from '../src/camera-controls.js';

// ---- Synthetic music --------------------------------------------------------------
const random=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
/** A drum pattern: kick on bar beats 1 and 3 (louder on 1), snare on 2 and 4, hi-hats on eighths, quiet noise. */
function song({bpm,firstBeat,seconds=40,rate=22050,seed=1,swing=0}){
  const out=new Float32Array(seconds*rate),next=random(seed),spb=60/bpm;
  for(let i=0;i<out.length;i++)out[i]=(next()-.5)*.02;
  const hit=(time,kind,gain)=>{const start=Math.round(time*rate);for(let j=0;j<rate*.12&&start+j<out.length;j++){if(start+j<0)continue;const t=j/rate,env=Math.exp(-t*(kind==='kick'?18:kind==='snare'?28:60));out[start+j]+=gain*env*(kind==='kick'?Math.sin(2*Math.PI*(55+90*Math.exp(-t*30))*t):(next()*2-1)*(kind==='hat'?.35:.8));}};
  for(let k=0;firstBeat+k*spb<seconds;k++){const t=firstBeat+k*spb,beat=k%4;if(beat===0)hit(t,'kick',1);else if(beat===2)hit(t,'kick',.6);else hit(t,'snare',.7);hit(t,'hat',.25);hit(t+spb/2+swing,'hat',.18);}
  return {samples:out,rate};
}

test('tempo detection finds the BPM and the first downbeat of common dance tempos',()=>{
  for(const [bpm,firstBeat,seed] of [[128,.35,1],[96,.8,2],[140,.1,3],[110,1.2,4],[86,.5,5]]){
    const {samples,rate}=song({bpm,firstBeat,seed}),result=detectTempo(samples,rate);
    assert.ok(result,`detected something at ${bpm}`);
    assert.ok(Math.abs(result.bpm-bpm)<=.5,`${bpm} BPM detected as ${result.bpm}`);
    const bar=4*60/bpm,offset=((result.firstBeat-firstBeat)%bar+bar)%bar;
    assert.ok(Math.min(offset,bar-offset)<.03,`downbeat at ${firstBeat}s detected at ${result.firstBeat}s (${bpm} BPM)`);
    assert.ok(result.firstBeat>=0&&result.firstBeat<bar+1e-9,'reports the earliest downbeat');
    assert.ok(result.confidence>.2,`confident on a clear beat (${result.confidence})`);
  }
});

test('music that starts right on the beat gets count 1 at the start, not one bar later',()=>{
  for(const [bpm,firstBeat] of [[120,0],[120,.004],[100,0],[132,.02]]){
    const {samples,rate}=song({bpm,firstBeat,seed:11}),result=detectTempo(samples,rate);
    assert.ok(Math.abs(result.firstBeat-firstBeat)<.03,`${bpm} BPM from ${firstBeat}s: count 1 at ${result.firstBeat}s`);
  }
});

test('tempo detection declines silence and too-short audio, and keeps fractional tempos it can hear',()=>{
  assert.equal(detectTempo(new Float32Array(22050*2),22050),null,'two seconds is not enough to count bars');
  const quiet=detectTempo(new Float32Array(22050*20),22050);assert.ok(quiet===null||quiet.confidence<.1);
  const {samples,rate}=song({bpm:123.5,firstBeat:.4,seconds:60,seed:9}),result=detectTempo(samples,rate);
  assert.ok(Math.abs(result.bpm-123.5)<=.3,`fractional tempo 123.5 detected as ${result.bpm}`);
  const stereo={numberOfChannels:2,length:4,getChannelData:c=>new Float32Array(c?[1,1,1,1]:[0,0,0,0])};assert.deepEqual([...monoSamples(stereo)],[.5,.5,.5,.5]);
});

test('beat offset follows the music trim and start position on the timeline',()=>{
  assert.equal(beatOffsetFor({start:0,trimStart:0},.35,120),.35);
  assert.equal(beatOffsetFor({start:4,trimStart:0},.35,120),4.35,'music placed at 4 s');
  assert.equal(beatOffsetFor({start:0,trimStart:10},.35,120),.35,'trimmed by 5 bars (10 s) keeps the same bar phase');
  assert.equal(beatOffsetFor({start:2,trimStart:1},.35,120),3.35,'first downbeat after the trim point');
});

// ---- Formation tools ----------------------------------------------------------------
test('shortest-travel assignment never makes straight paths cross and never travels further than roster order',()=>{
  const project=createProject('Travel',16),from=project.formations[0].positions,origins=new Map(from.map(p=>[p.performerId,p]));
  for(const shape of ['circle','v','diamond','line','spiral','heart','columns']){
    const layout=generateLayout(shape,project.performers,project.stage),assigned=assignByTravel(layout,origins);
    const total=list=>list.reduce((s,p)=>{const o=origins.get(p.performerId);return s+Math.hypot(p.x-o.x,p.z-o.z);},0);
    assert.ok(total(assigned)<=total(layout)+1e-9,`${shape}: ${total(assigned).toFixed(2)} m vs ${total(layout).toFixed(2)} m`);
    assert.deepEqual(assigned.map(p=>`${p.x},${p.z}`).sort(),layout.map(p=>`${p.x},${p.z}`).sort(),`${shape}: same spots, only who takes them changes`);
    // No two straight paths cross (segments intersect strictly inside).
    const cross=(a,b,c,d)=>{const o=(p,q,r)=>Math.sign((q.x-p.x)*(r.z-p.z)-(q.z-p.z)*(r.x-p.x));return o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0;};
    for(let i=0;i<assigned.length;i++)for(let j=i+1;j<assigned.length;j++)assert.ok(!cross(origins.get(assigned[i].performerId),assigned[i],origins.get(assigned[j].performerId),assigned[j]),`${shape}: paths of ${i} and ${j} cross`);
  }
});

test('fix spacing separates every close pair, stays on stage and leaves others untouched',()=>{
  const project=createProject('Spacing',12),stage=project.stage,next=random(7);
  const crowded=project.performers.map((p,i)=>({performerId:p.id,x:Math.round((next()-.5)*200)/100,z:Math.round((next()-.5)*160)/100,facing:0,visible:true}));
  crowded[3].x=crowded[2].x;crowded[3].z=crowded[2].z;// two on the same spot
  const result=spaceApart(crowded,{distance:.8,stage});
  assert.equal(result.remaining,0);assert.equal(closePairs(result.positions,.8-1e-6).length,0);
  assert.ok(result.positions.every(p=>Math.abs(p.x)<=stage.width/2&&Math.abs(p.z)<=stage.depth/2));
  const ids=new Set([crowded[2].performerId,crowded[3].performerId]),only=spaceApart(crowded,{ids,distance:.8,stage});
  only.positions.forEach((p,i)=>{if(!ids.has(p.performerId))assert.deepEqual([p.x,p.z],[crowded[i].x,crowded[i].z],'unselected performers stay put');});
  assert.ok(only.moved.every(id=>ids.has(id)));
  const tight=spaceApart(crowded,{distance:4,stage:{width:4,depth:3}});assert.ok(tight.remaining>0,'an impossible request reports what is left');
  assert.throws(()=>spaceApart(crowded,{distance:0,stage}),/positive/);
});

test('collision-free routes keep performers apart where straight paths collide',()=>{
  // Two lines swap sides: every straight path passes through the centre at the same moment.
  const project=createProject('Swap',8),[a,b]=project.formations,left=project.performers.slice(0,4),right=project.performers.slice(4);
  const place=(list,x)=>list.map((p,i)=>({performerId:p.id,x,z:(i-1.5)*1.6,facing:0,visible:true}));
  a.positions=[...place(left,-4),...place(right,4)];b.positions=[...place(left,4),...place(right,-4)];
  const valid=validateProject(project),index=0,straight=transitionSuggestions(valid,valid.formations[0].id).find(s=>s.style==='direct').analysis;
  const plan=planClearRoutes(valid,valid.formations[0].id);
  assert.ok(plan.before>0,'straight paths collide');assert.ok(plan.after<plan.before*.2,`violation ${plan.before.toFixed(2)} → ${plan.after.toFixed(2)}`);assert.ok(plan.adjusted>0);
  const planned=evaluateTransition(plan.project,index);
  const spacing=analysis=>analysis.issues.filter(v=>v.type==='spacing').length;
  assert.ok(spacing(planned)<spacing(straight),`spacing warnings ${spacing(straight)} → ${spacing(planned)}`);
  assert.doesNotThrow(()=>validateProject(plan.project),'planned routes are valid project data');
  // The plan is checked with the engine's own sampling: re-sample and compare.
  const times=Array.from({length:41},(_,k)=>valid.formations[1].time-4+k*.1),minGap=p=>Math.min(...times.map(t=>{const pos=samplePerformance(p,t);let m=Infinity;for(let i=0;i<pos.length;i++)for(let j=i+1;j<pos.length;j++)m=Math.min(m,Math.hypot(pos[i].x-pos[j].x,pos[i].z-pos[j].z));return m;}));
  assert.ok(minGap(plan.project)>minGap(valid),`closest approach ${minGap(valid).toFixed(2)} → ${minGap(plan.project).toFixed(2)} m`);
  assert.ok(transitionSuggestions(valid,valid.formations[0].id).some(s=>s.style==='collision-free'),'offered with the other suggestions');
  assert.ok(planned.maxSpeed<=Math.max(3,straight.maxSpeed*1.05)+.05,`no sprinting: peak ${planned.maxSpeed.toFixed(2)} m/s (straight ${straight.maxSpeed.toFixed(2)} m/s)`);
});

test('the planner leaves already-safe transitions straight',()=>{
  const project=createProject('Calm',6),[a,b]=project.formations;b.positions=a.positions.map(p=>({...p,x:p.x+.5}));
  const valid=validateProject(project),plan=planClearRoutes(valid,valid.formations[0].id);
  assert.equal(plan.before,0);assert.equal(plan.adjusted,0);
  assert.ok(plan.project.routes.filter(r=>r.fromId===valid.formations[0].id).every(r=>!r.waypoints.length&&r.delay===0));
});

// ---- Cinematic video ------------------------------------------------------------------
test('cinematic cameras frame the stage and stay inside the camera limits',()=>{
  const project=createProject('Film',12),clip={start:0,end:20};
  for(const {id} of VIDEO_CAMERAS){
    const shot=cinematicCamera(id,project,10,samplePerformance(project,10),clip);
    if(id==='view'){assert.equal(shot,null,'current view keeps the on-screen camera');continue;}
    assert.deepEqual(safeCamera(shot),{...shot,target:shot.target},`${id} needs no clamping`);
  }
  const orbit=t=>cinematicCamera('orbit',project,t,[],clip).yaw;assert.ok(Math.abs(orbit(20)-orbit(0)-Math.PI*2)<1e-9,'orbit makes one full turn over the clip');
  const short=t=>cinematicCamera('orbit',project,t,[],{start:0,end:2}).yaw;assert.ok(Math.abs(short(2)-short(0)-Math.PI/5)<1e-9,'a 2 s clip turns only 36°, never a dizzy spin');
  const push=t=>cinematicCamera('audience',project,t,[],clip).zoom;assert.ok(push(0)<push(10)&&push(10)<push(20),'audience pushes in');
  assert.ok(cinematicCamera('overhead',project,5,[],clip).pitch>1.3,'overhead looks down');
  assert.ok(Math.abs(cinematicCamera('side',project,5,[],clip).yaw-Math.PI/2)<1e-9,'side shot from the stage-left wing');
});

test('the follow camera frames highlighted dancers and glides between them',()=>{
  const project=createProject('Follow',12),time=project.formations[1].time+1,positions=samplePerformance(project,time);
  const everyone=cinematicCamera('follow',project,time,positions,{start:0,end:10});
  const star=project.performers[3].id,lit={...project,formations:project.formations.map((f,i)=>i===1?{...f,highlights:[star]}:f)};
  const solo=cinematicCamera('follow',lit,time,positions,{start:0,end:10}),p=positions.find(v=>v.performerId===star);
  assert.deepEqual(solo.target,[p.x,.8,-p.z],'centres on the highlighted dancer');assert.ok(solo.zoom>everyone.zoom,'and moves in closer than the whole-cast shot');
  const half=smoothShot(everyone,solo,.6);assert.ok(half.zoom>everyone.zoom&&half.zoom<solo.zoom,'eases towards the new framing');
  assert.equal(smoothShot(null,solo,.1),solo);assert.equal(smoothShot(everyone,solo,5),solo,'a jump in time cuts straight to the shot');
});

test('video settings accept the cinematic camera and lighting, and reject unknown values',()=>{
  const s=videoSettings(60,{camera:'orbit',look:'show'});assert.equal(s.camera,'orbit');assert.equal(s.look,'show');
  assert.deepEqual([videoSettings(60).camera,videoSettings(60).look],['view','view']);
  assert.throws(()=>videoSettings(60,{camera:'drone'}),/camera/);assert.throws(()=>videoSettings(60,{look:'disco'}),/lighting/);
});

test('a cinematic export films the 3D stage from a 2D view with the chosen camera and lighting',async()=>{
  const draws=[],matrices=[],gl={getShaderParameter:()=>true,getProgramParameter:()=>true,createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({}),getAttribLocation:()=>0,getUniformLocation:()=>({}),getExtension:()=>null,uniformMatrix4fv:(l,t,m)=>matrices.push([...m]),drawArrays:(...a)=>draws.push(a)};
  for(const name of ['shaderSource','compileShader','attachShader','linkProgram','bindBuffer','bufferData','enableVertexAttribArray','disableVertexAttribArray','vertexAttribPointer','viewport','clearColor','clear','enable','disable','useProgram','deleteBuffer','deleteProgram','deleteShader','uniform3f','uniform4f','blendFunc','depthMask'])gl[name]=()=>{};
  const looks=[];gl.clearColor=(r,g,b)=>looks.push(r);
  class Node {constructor(tag){this.tagName=tag;this.children=[];this.style={};this.dataset={};this.classList={add(){},remove(){}};this.attrs={};}append(...n){this.children.push(...n);}replaceChildren(){this.children=[];}setAttribute(k,v){this.attrs[k]=v;}addEventListener(){}querySelector(){return new Node('stub');}querySelectorAll(){return [];}getContext(){return gl;}getBoundingClientRect(){return {left:0,top:0,width:800,height:450};}remove(){}contains(){return false;}}
  const saved={};for(const k of ['document','window','matchMedia','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','getComputedStyle'])saved[k]=Object.getOwnPropertyDescriptor(globalThis,k);
  const set=(k,v)=>Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
  set('document',{createElement:t=>new Node(t),addEventListener(){},body:{append(){}}});set('window',{devicePixelRatio:1});set('matchMedia',()=>({matches:false}));set('ResizeObserver',class{observe(){}disconnect(){}});set('requestAnimationFrame',()=>1);set('cancelAnimationFrame',()=>{});set('getComputedStyle',()=>({}));
  let renderer;
  try{
    const project=createProject('Film',6),settings=videoSettings(project.duration,{end:8,camera:'orbit',look:'show'}),snapshot={kind:'2d',rotation:0,zoom:1,pan:{x:0,y:0},selected:new Set(),aids:{},showGrid:true,labels:false,viewport:{width:800,height:450},camera:{yaw:.15,pitch:.68,zoom:1,target:[0,.2,0]}};
    renderer=await createViewVideoRenderer(project,settings,snapshot);
    const ctx={drawImage(){},fillRect(){},save(){},restore(){},beginPath(){},rect(){},clip(){},fillText(){},moveTo(){},lineTo(){},quadraticCurveTo(){},closePath(){},fill(){},stroke(){}};
    await renderer.draw(ctx,0);const first=matrices.at(-1);await renderer.draw(ctx,4);
    assert.ok(draws.length>0,'rendered with the 3D stage although the editor showed 2D');
    assert.notDeepEqual(matrices.at(-1),first,'the orbit camera moves during the clip');
    assert.ok(looks.length&&looks.every(r=>r<.05),'Show light (dark house) was used');
  }finally{renderer?.dispose();for(const [k,d] of Object.entries(saved))if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
});
