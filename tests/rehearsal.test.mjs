import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,validateProject,samplePerformance,clone,uid} from '../src/engine.js';
import {newStageObject} from '../src/production-model.js';
import {ghostFrames,followView,referenceTime,stepFrame,validateReference,validateCheckpoints} from '../src/rehearsal-model.js';
import {setAttachment,sampleProps,validateAttachments} from '../src/prop-motion.js';
import {viewVector} from '../src/stage-view.js';
import {videoSettings,supportedVideoFormats} from '../src/video.js';
import {viewFrameSVG} from '../src/view-video.js';
import {renderStage2D} from '../src/stage2d.js';
import {editTimeline} from '../src/timeline-model.js';
import {packBackup,unpackBackup} from '../src/backups.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const reference=()=>({id:uid(),name:'Local rehearsal.mp4',duration:20,trimStart:2,trimEnd:12,start:3,fps:29.97,visible:true});
function score(){const p=createProject('Rehearsal',2);p.props=[newStageObject()];p.formations[0].positions.forEach(v=>{v.x=0;v.z=0;});p.formations[1].positions.forEach(v=>{v.x=4;v.z=2;});return p;}
test('reference video metadata and named checkpoints survive canonical validation',()=>{
 const p=score();p.referenceVideo=reference();p.checkpoints=[{id:uid(),time:15,label:'handoff'},{id:uid(),time:4,label:'first eight'}];const result=validateProject(p);assert.equal(result.referenceVideo.fps,29.97);assert.equal(result.checkpoints[0].time,4);assert.deepEqual(validateProject(createProject()).checkpoints,[]);
 for(const patch of [{fps:0},{trimStart:15},{trimEnd:21},{duration:Infinity},{id:'<script>'},{name:[]},{start:4000}])assert.throws(()=>validateReference({...reference(),...patch}));
 assert.throws(()=>validateCheckpoints([{id:'same',time:1,label:'a'},{id:'same',time:2,label:'b'}],10));assert.throws(()=>validateCheckpoints([{id:'x',time:11,label:'a'}],10));
});
test('reference sync respects source trims, timeline delay and end hold',()=>{
 const v=reference();assert.deepEqual(referenceTime(v,1),{source:2,active:false});assert.deepEqual(referenceTime(v,3),{source:2,active:true});assert.deepEqual(referenceTime(v,7),{source:6,active:true});assert.deepEqual(referenceTime(v,16),{source:12,active:false});
 near(stepFrame(4,1,30,96),4.033333);near(stepFrame(4,-1,30,96),3.966667);assert.equal(stepFrame(0,-1,30,96),0);assert.equal(stepFrame(96,1,30,96),96);assert.throws(()=>stepFrame(1,1,0,96));
});
test('ghost checkpoints use the canonical curved movement sampler and selected identities',()=>{
 const p=score(),id=p.performers[0].id;p.routes=[{id:uid(),fromId:p.formations[0].id,toId:p.formations[1].id,performerId:id,duration:4,delay:0,easing:'linear',curve:'smooth',waypoints:[{x:1,z:4}]}];p.checkpoints=[{id:uid(),time:14,label:'midpoint'}];const frames=ghostFrames(p,13,{previous:true,next:true,checkpoints:true,selectedOnly:true},new Set([id]));const mid=frames.find(f=>f.time===14);assert.ok(mid);assert.deepEqual(mid.positions,samplePerformance(p,14).filter(v=>v.performerId===id));assert.ok(mid.positions[0].z>2);assert.ok(frames.every(f=>f.positions.length===1));
 assert.equal(ghostFrames(p,16,{previous:true})[0].time,0);assert.equal(ghostFrames(p,0,{previous:true}).length,0);assert.equal(ghostFrames(p,96,{next:true}).length,0);
});
test('dense ghost views bound rendering work and preserve named checkpoints before generated dots',()=>{
 const p=createProject('Large cast',100);p.checkpoints=[{id:uid(),time:14,label:'important'}];const frames=ghostFrames(p,5,{previous:true,next:true,countStep:1,checkpoints:true});assert.ok(frames.reduce((n,f)=>n+f.positions.length,0)<=300);assert.ok(frames.some(f=>f.label==='important'));
});
test('performer and group follow center the transformed camera without changing positions',()=>{
 const p=score(),positions=samplePerformance(p,15),before=clone(positions),base={zoom:1,pan:{x:10,y:4},rotation:90,mirror:true,flip:true,camera:{yaw:.4,pitch:.6,zoom:1},aids:{follow:p.performers[0].id,followZoom:2}};
 const view=followView(p,positions,base),delta=viewVector(positions[0].x*60,-positions[0].z*60,90,true,true);near(view.pan.x,-delta.x*2);near(view.pan.y,-delta.y*2);assert.deepEqual(view.camera.target,[positions[0].x,.2,-positions[0].z]);assert.deepEqual(positions,before);assert.deepEqual(base.pan,{x:10,y:4});
 const group=followView(p,positions,{...base,aids:{follow:'group:'+p.performers[0].group,followZoom:1.5}});assert.equal(group.zoom,1.5);assert.equal(followView(p,positions,{...base,aids:{follow:'missing'}}).pan,base.pan);
});
test('carried props follow performer position and facing while keeping animated size and colour',()=>{
 let p=score(),person=p.performers[0].id;p=setAttachment(p,p.props[0].id,{time:0,performerId:person,x:1,z:0,rotation:20,rotate:true},samplePerformance(p,0));const positions=samplePerformance(p,0);positions[0].facing=90;positions[0].x=2;positions[0].z=3;const prop=sampleProps(p,0,positions)[0];near(prop.x,2);near(prop.z,2);near(prop.rotation,110);assert.equal(prop.carrierId,person);assert.equal(prop.width,p.props[0].width);
});
test('handoffs preserve world pose and floor events detach without moving the prop',()=>{
 let p=score(),prop=p.props[0],a=p.performers[0].id,b=p.performers[1].id,positions=samplePerformance(p,0);positions[0].x=-2;positions[0].facing=70;positions[1].x=3;positions[1].z=2;positions[1].facing=-40;
 p=setAttachment(p,prop.id,{time:0,performerId:a,x:.5,z:.8,rotation:12},positions);const before=sampleProps(p,2,positions)[0];p=setAttachment(p,prop.id,{time:2,performerId:b,keepPosition:true},positions);const after=sampleProps(p,2,positions)[0];near(before.x,after.x);near(before.z,after.z);near(before.rotation,after.rotation);
 p=setAttachment(p,prop.id,{time:3,performerId:null,keepPosition:true},positions);const held=sampleProps(p,3,positions)[0];positions[1].x+=5;near(sampleProps(p,5,positions)[0].x,held.x);assert.equal(p.props[0].attachments.length,3);
});
test('attachment edits are immutable, upsert time identities and reject locks or invalid carriers',()=>{
 const p=score(),before=clone(p),id=p.props[0].id,a=p.performers[0].id,positions=samplePerformance(p,0);let next=setAttachment(p,id,{time:0,performerId:a},positions);const event=next.props[0].attachments[0].id;next=setAttachment(next,id,{time:0,performerId:a,x:2},positions);assert.equal(next.props[0].attachments.length,1);assert.equal(next.props[0].attachments[0].id,event);assert.deepEqual(p,before);
 next.props[0].locked=true;assert.throws(()=>setAttachment(next,id,{time:1,performerId:a},positions));assert.throws(()=>setAttachment(p,id,{time:1,performerId:'unknown'},positions));assert.throws(()=>setAttachment(p,id,{time:100,performerId:a},positions));assert.throws(()=>validateAttachments({attachments:[{id:'a',time:0,performerId:a},{id:'b',time:0,performerId:a}]},p));
});
test('portable backups keep attachment events, reference metadata and checkpoints',async()=>{
 let p=score();p.referenceVideo=reference();p.checkpoints=[{id:uid(),label:'transfer',time:14}];p=setAttachment(p,p.props[0].id,{time:3,performerId:p.performers[0].id,x:1},samplePerformance(p,3));const packed=await packBackup(p,null),result=await unpackBackup(packed,validateProject);assert.deepEqual(result.project.props[0].attachments,p.props[0].attachments);assert.deepEqual(result.project.referenceVideo,p.referenceVideo);assert.deepEqual(result.project.checkpoints,p.checkpoints);
});
test('trimming performance end cannot discard handoffs or checkpoints',()=>{
 let p=score();p=setAttachment(p,p.props[0].id,{time:95,performerId:p.performers[0].id},samplePerformance(p,95));p.checkpoints=[{id:uid(),time:95.5,label:'finish'}];const next=editTimeline(p,{kind:'formation',id:p.formations[p.formations.length-1].id,edge:'end',value:90});assert.equal(next.duration,95.5);assert.doesNotThrow(()=>validateProject(next));
});
test('view-matched SVG export keeps stage rotation, reflection, zoom, ghosts and attached props',()=>{
 let p=score();p=setAttachment(p,p.props[0].id,{time:0,performerId:p.performers[0].id,x:1},samplePerformance(p,0));const time=15,positions=samplePerformance(p,time),snapshot={kind:'2d',rotation:90,mirror:true,flip:true,zoom:1.6,pan:{x:32,y:-17},selected:new Set([p.performers[0].id]),showGrid:false,showPaths:true,labels:true,aids:{previous:true,next:true},colors:{stage:'#f5f3f8',secondary:'#686372'},font:'system-ui'},settings={width:1280,height:720,labels:true};
 const svg=viewFrameSVG(p,time,snapshot,settings);assert.match(svg,/rotate\(90\) scale\(-1.6 -1.6\)/);assert.match(svg,/class="ghost-frame"/);assert.match(svg,/data-stage-object=/);assert.match(svg,/width="1280" height="720"/);assert.ok(!svg.includes('CHORYN / PERFORMANCE'));const expected=renderStage2D(p,p.formations[0],positions,{...snapshot,time,ghosts:ghostFrames(p,time,snapshot.aids,snapshot.selected)});const transform=s=>s.match(/id="stage-transform" transform="([^"]+)"/)[1];assert.equal(transform(svg),transform(expected));
});
test('video frame sizing matches viewport aspect with even codec dimensions and MP4 is preferred when supported',()=>{
 const portrait=videoSettings(96,{aspect:.6,resolution:720});assert.equal(portrait.width,432);assert.equal(portrait.height,720);const wide=videoSettings(96,{aspect:8,resolution:1440});assert.equal(wide.width,4096);assert.equal(wide.height,512);assert.throws(()=>videoSettings(96,{aspect:0}));
 class Recorder {static isTypeSupported(){return true;}}assert.match(supportedVideoFormats(Recorder)[0][0],/^video\/mp4/);
});

test('generated ghosts sample outgoing movement and align to the music count grid',()=>{
 const p=score();p.transitionDuration=4;p.music.beatOffset=.1;const frames=ghostFrames(p,1,{countStep:1});assert.ok(frames.length>0);assert.ok(frames.every(f=>f.time>12&&f.time<16));for(const f of frames)near((f.time-.1)*p.bpm/60,Math.round((f.time-.1)*p.bpm/60));assert.ok(frames.some(f=>f.positions[0].x>0&&f.positions[0].x<4));
 p.routes=[{id:uid(),fromId:p.formations[0].id,toId:p.formations[1].id,performerId:p.performers[0].id,duration:8,delay:1,easing:'linear',waypoints:[]}];assert.ok(ghostFrames(p,1,{countStep:1}).some(f=>f.time<12));
});
