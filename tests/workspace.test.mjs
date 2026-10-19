import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,samplePerformance,validateProject,transitionSettings,uid,generateLayout} from '../src/engine.js';
import {setFormationTransition,reorderFormation,duplicateTimelineItem} from '../src/timeline-model.js';
import {viewVector,worldDelta,stageViewBox,audienceDirection,edgeLabelAngle} from '../src/stage-view.js';
import {customizeLayout,FORMATION_TEMPLATES} from '../src/templates.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function score(){const p=createProject('Timing',1);for(const f of p.formations)f.positions[0]={...f.positions[0],x:0,z:0};p.formations[1].positions[0].x=4;p.pathType='direct';p.easing='linear';return p;}
test('each sequence holds then moves for its own duration while other sequences retain defaults',()=>{
 const p=score(),next=setFormationTransition(p,p.formations[0].id,{duration:2,easing:'linear',pathType:'direct'});
 assert.equal(samplePerformance(next,13)[0].x,0);assert.equal(samplePerformance(next,14)[0].x,0);assert.equal(samplePerformance(next,15)[0].x,2);assert.equal(samplePerformance(next,16)[0].x,4);
 assert.equal(p.formations[0].transition,undefined);assert.equal(transitionSettings(next,next.formations[1]).duration,p.transitionDuration);
});
test('individual performer route timing remains authoritative over sequence timing',()=>{
 let p=score();p=setFormationTransition(p,p.formations[0].id,{duration:8,easing:'linear',pathType:'direct'});p.routes=[{id:uid(),fromId:p.formations[0].id,toId:p.formations[1].id,performerId:p.performers[0].id,duration:1,delay:0,easing:'linear',waypoints:[]}];
 assert.equal(samplePerformance(p,15)[0].x,0);assert.equal(samplePerformance(p,15.5)[0].x,2);
});
test('movement overrides survive validation, duplication and reorder, and reset independently',()=>{
 let p=score();p=setFormationTransition(p,p.formations[1].id,{duration:3,easing:'linear',pathType:'curved'});assert.deepEqual(validateProject(p).formations[1].transition,p.formations[1].transition);
 assert.deepEqual(duplicateTimelineItem(p,'formation',p.formations[1].id).item.transition,p.formations[1].transition);
 const moved=reorderFormation(p,p.formations[1].id,3);assert.equal(moved.formations[3].transition.duration,3);assert.equal(moved.formations[3].time,48);
 assert.equal(setFormationTransition(p,p.formations[1].id,null).formations[1].transition,undefined);
});
test('invalid movement settings and approved sequence edits cannot mutate the score',()=>{
 const p=score(),id=p.formations[0].id;for(const duration of [NaN,0,17,61])assert.throws(()=>setFormationTransition(p,id,{duration,easing:'smooth',pathType:'direct'}));
 p.formations[0].status='approved';assert.throws(()=>setFormationTransition(p,id,{duration:2,easing:'linear',pathType:'direct'}));assert.throws(()=>setFormationTransition(p,id,null));
 p.formations[1].transition={duration:NaN,easing:'linear',pathType:'direct'};assert.throws(()=>validateProject(p));
});
test('shortened sequence intervals clamp movement sampling without losing saved timing',()=>{
 let p=score();p=setFormationTransition(p,p.formations[0].id,{duration:8,easing:'linear',pathType:'direct'});p.formations[1].time=2;assert.equal(samplePerformance(p,1)[0].x,2);assert.equal(p.formations[0].transition.duration,8);
});
test('rotated and flipped camera movement has a stable inverse for mouse and keyboard editing',()=>{
 for(const rotation of [0,45,90,180,270,-45])for(const mirror of [true,false])for(const flip of [true,false]){const screen=viewVector(3,-2,rotation,mirror,flip),world=worldDelta(screen.x,screen.y,rotation,mirror,flip);near(world.x,3);near(world.z,2);}
 assert.equal(audienceDirection(0,false,false),'down ↓');assert.equal(audienceDirection(0,false,true),'up ↑');assert.equal(audienceDirection(90,false,false),'left ←');assert.equal(audienceDirection(270,false,false),'right →');
});
test('stage fitting follows camera rotation around the same stage center',()=>{
 const p=createProject(),a=stageViewBox(p,0),b=stageViewBox(p,90);near(a.width,b.height);near(a.height,b.width);near(b.x+b.width/2,p.stage.width*30);near(b.y+b.height/2,p.stage.depth*30);
});
test('creative shapes rotate and mirror to fit narrow stages without altering performer identities',()=>{
 const p=createProject('Dance',50);for(const template of FORMATION_TEMPLATES)for(const angle of [45,90,135,270]){const stage={width:2,depth:20},source=generateLayout(template.id,p.performers,stage),before=structuredClone(source),out=customizeLayout(source,stage,{angle,scale:1.2,mirrorX:true,facing:90});assert.deepEqual(source,before);assert.deepEqual(out.map(p=>p.performerId),source.map(p=>p.performerId));assert.ok(out.every(p=>Math.abs(p.x)<=1&&Math.abs(p.z)<=10&&p.facing===90));}
});

test('stage-edge labels follow the viewed edge and never turn upside down',()=>{
 for(const angle of [0,45,90,135,180,270])for(const base of [0,90,-90])for(const flip of [true,false]){const direction=edgeLabelAngle(base,angle,true,flip);assert.ok(direction>=-90&&direction<=90);}
 near(edgeLabelAngle(0,180),0);near(edgeLabelAngle(90,90),0);
});
