import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,clone,samplePerformance,validateProject} from '../src/engine.js';
import {canonRanks,designTransition,currentDesign,TRANSITION_STYLES} from '../src/transition-styles.js';
import {formationVariations,fitToStage} from '../src/formation-variations.js';
import {phraseStarts,snapToPhrase,snapFormationsToPhrases,detectSections,addSectionCues,addSectionFormations} from '../src/music-structure.js';
import {timelineProblems,fixProblem} from '../src/problems-model.js';
import {describeChange} from '../src/history-model.js';
import {myPart,stageArea,facingWords,travelDirection} from '../src/my-part.js';

const at=(project,time,id)=>samplePerformance(project,time).find(p=>p.performerId===id);
const near=(a,b,eps=1e-6)=>Math.abs(a-b)<=eps;

test('canon ranks group performers by order, ties within a column move together',()=>{
  const p=createProject('Canon',8),positions=p.formations[0].positions;
  const ranks=canonRanks(positions,'left-right',p.performers),sorted=[...positions].sort((a,b)=>a.x-b.x);
  for(let i=1;i<sorted.length;i++)assert.ok(ranks.get(sorted[i].performerId)>=ranks.get(sorted[i-1].performerId),'waves never go backwards from left to right');
  const reversed=canonRanks(positions,'right-left',p.performers);
  assert.equal(reversed.get(sorted.at(-1).performerId),0,'right to left starts with the rightmost dancer');
  const byGroup=canonRanks(positions,'group',p.performers);
  assert.deepEqual([...new Set(p.performers.map(v=>byGroup.get(v.id)))],[0,1,2],'one wave per group, in roster order');
  assert.ok([...canonRanks(positions,'together',p.performers).values()].every(r=>r===0));
});

test('a canon gives equal moves started one after another; each dancer lands and holds before the next formation',()=>{
  const p=createProject('Canon',8),from=p.formations[0],to=p.formations[1];
  const result=designTransition(p,from.id,{style:'direct',order:'left-right',timing:'canon',spread:1});
  assert.doesNotThrow(()=>validateProject(result.project),'designed routes validate, including settle');
  const routes=result.project.routes.filter(r=>r.fromId===from.id&&r.toId===to.id);
  assert.equal(routes.length,8);assert.ok(result.waves>1);assert.equal(result.step,.5,'1 count at 120 BPM');
  const moves=routes.map(r=>r.duration-r.delay-(r.settle||0));
  assert.ok(moves.every(m=>near(m,moves[0],1e-3)),'every dancer moves for the same length of time');
  const first=routes.reduce((a,b)=>a.delay<=b.delay?a:b),last=routes.reduce((a,b)=>a.delay>=b.delay?a:b);
  assert.ok(first.settle>0&&!last.settle,'the first wave settles early, the last arrives on the count');
  const arrival=to.time-first.settle,dest=to.positions.find(v=>v.performerId===first.performerId);
  const landed=at(result.project,arrival+.01,first.performerId);assert.ok(near(landed.x,dest.x,1e-6)&&near(landed.z,dest.z,1e-6),'the first wave has landed');
  const start=from.positions.find(v=>v.performerId===last.performerId),waiting=at(result.project,to.time-result.window+last.delay-.01,last.performerId);
  assert.ok(near(waiting.x,start.x,1e-6)&&near(waiting.z,start.z,1e-6),'the last wave waits for its turn');
});

test('a cascade staggers starts so everyone lands together, and long spreads shrink to keep moves walkable',()=>{
  const p=createProject('Cascade',8),from=p.formations[0];
  const land=designTransition(p,from.id,{style:'direct',order:'front-back',timing:'land',spread:1});
  assert.ok(land.project.routes.every(r=>!r.settle),'no one settles early in a cascade');
  const long=designTransition(p,from.id,{style:'direct',order:'number',timing:'canon',spread:16});
  assert.ok(long.shortened,'a 16-count gap between 8 waves cannot fit in 16 s');
  const moves=long.project.routes.map(r=>r.duration-r.delay-(r.settle||0));
  assert.ok(Math.min(...moves)>=.6-1e-3,'no one gets less than a short walkable move');
  assert.doesNotThrow(()=>validateProject(long.project));
  assert.equal(currentDesign(long.project,from.id).timing,'canon','the designer reopens with the saved timing');
});

test('path styles shape the routes: explode, implode, spiral, peel-off and follow the leader',()=>{
  const p=createProject('Styles',8),from=p.formations[1],to=p.formations[2];
  const design=style=>designTransition(p,from.id,{style,order:'together',timing:'canon',spread:1}).project.routes.filter(r=>r.fromId===from.id);
  const centre=(list)=>({x:list.reduce((s,v)=>s+v.x,0)/list.length,z:list.reduce((s,v)=>s+v.z,0)/list.length}),c=centre([...from.positions,...to.positions]);
  const half={x:p.stage.width/2,z:p.stage.depth/2};
  for(const {id} of TRANSITION_STYLES){const routes=design(id);assert.equal(routes.length,8,id);for(const r of routes)for(const w of r.waypoints)assert.ok(Math.abs(w.x)<=half.x&&Math.abs(w.z)<=half.z,`${id} waypoints stay on stage`);}
  assert.ok(design('direct').every(r=>!r.waypoints.length));
  const explode=design('explode'),pos=id=>from.positions.find(v=>v.performerId===id);
  assert.ok(explode.filter(r=>{const s=pos(r.performerId),w=r.waypoints[0];return Math.hypot(w.x-c.x,w.z-c.z)>Math.hypot(s.x-c.x,s.z-c.z)+.3;}).length>=6,'explode bursts outward');
  const implode=design('implode'),radii=implode.map(r=>Math.hypot(r.waypoints[0].x-c.x,r.waypoints[0].z-c.z));
  assert.ok(Math.max(...radii)-Math.min(...radii)<.05,'implode gathers on one ring');
  assert.ok(radii[0]>=.7,'the ring leaves room to pass');
  const cw=design('spiral-cw'),ccw=design('spiral-ccw');
  const sweep=(route)=>{const s=pos(route.performerId),w=route.waypoints[1];if(!w)return 0;let d=Math.atan2(w.z-c.z,w.x-c.x)-Math.atan2(s.z-c.z,s.x-c.x);while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d;};
  assert.ok(cw.filter(r=>r.waypoints.length).every(r=>sweep(r)<=1e-6),'clockwise spirals turn the negative way');
  assert.ok(ccw.filter(r=>r.waypoints.length).every(r=>sweep(r)>=-1e-6),'counter-clockwise spirals turn the positive way');
  const follow=designTransition(p,from.id,{style:'follow',order:'left-right',timing:'canon',spread:1}).project.routes.filter(r=>r.fromId===from.id);
  const lead=follow.find(r=>r.delay===0&&!r.waypoints.length);assert.ok(lead,'the leader walks straight');
  assert.ok(follow.some(r=>r.waypoints.length===3),'later dancers walk through the spots of the dancers ahead');
  const starts=new Set(from.positions.map(v=>`${Math.round(v.x*100)/100},${Math.round(v.z*100)/100}`));
  assert.ok(follow.every(r=>r.waypoints.every(w=>starts.has(`${w.x},${w.z}`))),'followers pass through starting spots');
});

test('designed transitions respect locks and reject invalid input; routes with impossible settle times are refused',()=>{
  const p=createProject('Locks',6),from=p.formations[0];
  const locked=clone(p);locked.formations[0].status='approved';
  assert.throws(()=>designTransition(locked,from.id,{style:'direct',order:'together',timing:'canon',spread:1}),/Unlock/);
  assert.throws(()=>designTransition(p,p.formations.at(-1).id,{style:'direct',order:'together',timing:'canon',spread:1}),/following/);
  assert.throws(()=>designTransition(p,from.id,{style:'teleport',order:'together',timing:'canon',spread:1}),/style/);
  const bad=clone(p);bad.routes=[{id:'r',fromId:from.id,toId:p.formations[1].id,performerId:p.performers[0].id,delay:2,duration:4,settle:2,easing:'smooth',locked:false,waypoints:[]}];
  assert.throws(()=>validateProject(bad),/route/);
});

test('variations mirror, flip, turn, scale and recast a formation, all on stage and without duplicates',()=>{
  const p=createProject('Ideas',8),f=p.formations[2],list=formationVariations(p,f.id),ids=list.map(v=>v.id);
  for(const id of ['mirror','flip','tighter','wider','shortest-travel'])assert.ok(ids.includes(id),id);
  assert.ok(ids.includes('rotate-180')||ids.includes('recast'),'for a diagonal line a half turn is the same as reversed casting, so only one is offered');
  const half={x:p.stage.width/2,z:p.stage.depth/2};
  for(const v of list){assert.equal(v.positions.length,f.positions.length);for(const q of v.positions)assert.ok(Math.abs(q.x)<=half.x&&Math.abs(q.z)<=half.z,`${v.id} stays on stage`);}
  const mirror=list.find(v=>v.id==='mirror'),cx=f.positions.reduce((s,v)=>s+v.x,0)/f.positions.length;
  f.positions.forEach((q,i)=>assert.ok(near(mirror.positions[i].x,Math.round((2*cx-q.x)*100)/100,.02)));
  const keys=list.map(v=>JSON.stringify(v.positions.map(q=>[q.performerId,q.x,q.z,Math.round(q.facing)])));assert.equal(new Set(keys).size,keys.length,'no two variations are the same');
  const even=createProject('Even',6);even.performers.forEach((v,i)=>v.group=i<3?'A':'B');
  const swap=formationVariations(even,even.formations[1].id).find(v=>v.id==='swap-groups');assert.ok(swap,'equal groups can swap spots');
  const spotsA=new Set(even.formations[1].positions.filter((_,i)=>i<3).map(q=>`${q.x},${q.z}`));
  assert.ok(swap.positions.filter((_,i)=>i>=3).every(q=>spotsA.has(`${q.x},${q.z}`)),'group B takes group A spots');
  const wide=fitToStage([{performerId:'a',x:-20,z:0,facing:0,visible:true},{performerId:'b',x:20,z:0,facing:0,visible:true}],{width:10,depth:6});
  assert.ok(wide.every(q=>Math.abs(q.x)<=4.7+1e-9),'oversized shapes shrink to the stage');
});

test('phrases follow tempo and count 1; formation starts snap to phrases in order and approved ones stay',()=>{
  const p=createProject('Phrases',6);p.bpm=100;p.music.beatOffset=.6;
  const starts=phraseStarts(p);assert.equal(starts[0],.6);assert.ok(near(starts[1]-starts[0],4.8,1e-3));
  assert.equal(snapToPhrase(p,10),10.2);
  p.formations[2].status='approved';const approved=p.formations[2].time;
  const {project,moved}=snapFormationsToPhrases(p);
  assert.ok(moved.length>0);assert.equal(project.formations[2].time,approved,'approved formations keep their time');
  for(const f of project.formations.slice(1))if(f.status!=='approved')assert.ok(starts.some(t=>near(t,f.time,1e-3)),`${f.name} starts on a phrase`);
  assert.ok(project.formations.every((f,i,all)=>!i||f.time>all[i-1].time),'order is preserved');
});

test('song sections are found where the music gets louder or quieter, and become cues or formations',()=>{
  const p=createProject('Sections',4);p.bpm=120;p.music={mode:'file',trimStart:0,trimEnd:null,start:0,beatOffset:0};
  const rate=8000,samples=new Float32Array(rate*96);
  for(let i=0;i<samples.length;i++){const t=i/rate,level=t<16?.05:t<48?.6:t<64?.08:.5;samples[i]=Math.sin(2*Math.PI*220*t)*level;}
  const sections=detectSections(samples,rate,p);
  assert.deepEqual(sections.map(s=>s.time),[0,16,48,64]);
  assert.equal(sections[0].level,'calm');assert.ok(sections[1].level!=='calm');assert.equal(sections[2].level,'calm');
  const cues=addSectionCues(p,sections),free=sections.filter(s=>!p.cues.some(c=>Math.abs(c.time-s.time)<.5)).length;assert.ok(free>0);assert.equal(cues.added,free,'one cue per section, except where a cue already is');assert.doesNotThrow(()=>validateProject(cues.project));
  assert.equal(addSectionCues(cues.project,sections).added,0,'existing section cues are not duplicated');
  const forms=addSectionFormations(p,sections);
  for(const s of sections.slice(1))assert.ok(forms.project.formations.some(f=>near(f.time,s.time,1e-3)),`a formation starts at ${s.time}`);
  assert.doesNotThrow(()=>validateProject(forms.project));
  assert.deepEqual(detectSections(new Float32Array(rate*96).fill(.2),rate,p).length,1,'even music is a single section');
});

test('the problems lane finds crowding, off-stage and rushed moves, and one click fixes them',()=>{
  const p=createProject('Problems',6),f=p.formations[2];
  f.positions[1].x=f.positions[0].x+.1;f.positions[1].z=f.positions[0].z;f.positions[2].x=p.stage.width/2+1;
  const problems=timelineProblems(p),spacing=problems.find(v=>v.kind==='spacing'&&v.phase==='hold'&&v.formationId===f.id),boundary=problems.find(v=>v.kind==='boundary'&&v.formationId===f.id);
  assert.ok(spacing&&boundary,'crowding and off-stage are reported on the formation');
  assert.equal(spacing.fix,'Fix spacing');assert.equal(timelineProblems(p),problems,'unchanged choreography reuses the cached check');
  const spaced=fixProblem(p,spacing).project;assert.ok(!timelineProblems(spaced).some(v=>v.kind==='spacing'&&v.phase==='hold'&&v.formationId===f.id));
  const onstage=fixProblem(spaced,timelineProblems(spaced).find(v=>v.kind==='boundary'&&v.phase==='hold')).project;
  assert.ok(!timelineProblems(onstage).some(v=>v.kind==='boundary'&&v.formationId===f.id));
  const rush=createProject('Rush',4),a=rush.formations[0];a.transition={duration:.5,easing:'smooth',pathType:'direct'};
  const fast=timelineProblems(rush).find(v=>v.kind==='speed'&&v.formationId===a.id);assert.ok(fast,'a half-second sprint is flagged');
  const slower=fixProblem(rush,fast).project;assert.equal(slower.formations[0].transition.duration,rush.formations[1].time-a.time);
  assert.ok(!timelineProblems(slower).some(v=>v.kind==='speed'&&v.formationId===a.id));
  const locked=clone(p);locked.formations[2].status='approved';assert.throws(()=>fixProblem(locked,spacing),/Unlock/);
});

test('history steps describe what changed in plain words',()=>{
  const p=createProject('History',6),edit=fn=>{const next=clone(p);fn(next);return describeChange(p,next);};
  assert.match(edit(n=>{n.formations[1].positions[0].x+=1;n.formations[1].positions[1].x+=1;}).label,/^Moved 2 performers in “Open diamond”$/);
  assert.equal(edit(n=>{n.formations[1].positions[0].x+=1;}).formationId,p.formations[1].id);
  assert.match(edit(n=>n.formations[1].name='Burst').label,/Renamed “Open diamond” to “Burst”/);
  assert.match(edit(n=>n.bpm=96).label,/Tempo 120 → 96 BPM/);
  assert.match(edit(n=>n.performers.pop()).label,/Removed 1 performer/);
  assert.match(edit(n=>n.routes.push({id:'r',fromId:n.formations[0].id,toId:n.formations[1].id,performerId:n.performers[0].id,delay:0,duration:4,easing:'smooth',locked:false,waypoints:[]})).label,/Changed paths into “Open diamond”/);
  assert.match(edit(n=>n.cues.push({id:'c',time:3,label:'LX'})).label,/Added 1 cue/);
  assert.equal(edit(()=>{}).label,'Edited project details');
});

test('My part describes each formation in stage words: spot, facing, neighbours and travel',()=>{
  assert.equal(stageArea(0,-4,{width:16,depth:10}),'Downstage centre');
  assert.equal(stageArea(5,4,{width:16,depth:10}),'Upstage left','+x is stage left (the audience’s right)');
  assert.equal(stageArea(-5,0,{width:16,depth:10}),'Centre right');
  assert.equal(stageArea(0,0,{width:16,depth:10}),'Centre stage');
  assert.equal(facingWords(0),'Face the audience');assert.equal(facingWords(180),'Face upstage');assert.equal(facingWords(-90),'Face left (270°)');
  assert.equal(travelDirection(2,-2),'toward downstage stage left');assert.equal(travelDirection(0,0),'in place');
  const p=createProject('Part',8),id=p.performers[0].id,steps=myPart(p,id);
  assert.equal(steps.length,p.formations.length);assert.equal(steps[0].travel,null);assert.equal(steps[0].count,'1.1');
  assert.ok(steps.slice(1).some(s=>s.travel&&s.travel.distance>0&&s.travel.counts>=1));
  assert.ok(steps.every(s=>s.neighbours.length<=2&&!s.neighbours.includes(p.performers[0].name)));
  assert.throws(()=>myPart(p,'nobody'),/performer/);
});
