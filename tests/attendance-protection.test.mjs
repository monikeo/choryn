import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createProject,clone,samplePerformance} from '../src/engine.js';
import {addAttendance,addConstraint,enforceConstraints,assertEnsembleEdits} from '../src/ensemble-model.js';
import {attendanceAffectsSelection} from '../src/ensemble-schema.js';
import {viewFrameSVG} from '../src/view-video.js';
import {sceneProject} from '../src/production-next-model.js';

function covered(project=createProject('Protected rehearsal',4)){
 return addAttendance(project,{absentId:project.performers[0].id,coverId:project.performers[1].id,fromId:project.formations[1].id,toId:project.formations[2].id});
}
test('new mirror and spacing rules cannot reference missing or cover roles during their active range',()=>{
 const p=covered(),before=clone(p),f=p.formations[1];
 for(const type of ['mirror-x','mirror-z','space-x','space-z'])for(const members of [[0,1],[0,2],[1,2]]){
  assert.throws(()=>addConstraint(p,f.id,type,members.map(i=>p.performers[i].id),type.startsWith('space')?1:0),/Attendance protects/);
  assert.deepEqual(p,before);
 }
});
test('unaffected cast, inactive formations and disabled attendance retain normal constraint editing',()=>{
 const p=covered(),ids=p.performers.map(p=>p.id);
 const next=addConstraint(p,p.formations[1].id,'mirror-x',ids.slice(2),0);
 assert.deepEqual(next.formations[1].positions.slice(0,2),p.formations[1].positions.slice(0,2));
 for(const index of [0,3])assert.doesNotThrow(()=>addConstraint(p,p.formations[index].id,'mirror-x',ids.slice(0,2),0));
 const disabled=clone(p);disabled.ensemble.attendance[0].enabled=false;
 assert.doesNotThrow(()=>addConstraint(disabled,disabled.formations[1].id,'mirror-x',ids.slice(0,2),0));
});
test('a blocked constraint does not copy or inspect a large unrelated floor-plan payload',()=>{
 const p=covered(),image={data:'data:image/png;base64,'+'A'.repeat(1000000)};let reads=0;
 Object.defineProperty(p.production.stage,'image',{enumerable:true,get(){reads++;return image;}});
 assert.throws(()=>addConstraint(p,p.formations[1].id,'mirror-x',p.performers.slice(0,2).map(v=>v.id),0),/Attendance protects/);assert.equal(reads,0);
});
test('shared edit validation protects every saved pose field and a removed protected pose',()=>{
 const p=covered(),f=p.formations[1];
 for(const id of p.performers.slice(0,2).map(p=>p.id))for(const key of ['x','z','facing','visible','remove']){
  const next=clone(p),form=next.formations.find(v=>v.id===f.id),pose=form.positions.find(v=>v.performerId===id);
  if(key==='remove')form.positions=form.positions.filter(v=>v!==pose);else pose[key]=key==='visible'?false:pose[key]+.1;
  assert.throws(()=>assertEnsembleEdits(p,next),/Attendance protects/,id+' '+key);
 }
 const unrelated=clone(p);unrelated.formations[1].positions[2].x+=.1;assert.doesNotThrow(()=>assertEnsembleEdits(p,unrelated));
 const disabled=clone(p);disabled.ensemble.attendance[0].enabled=false;disabled.formations[1].positions[0].x+=.1;assert.doesNotThrow(()=>assertEnsembleEdits(p,disabled));
});
test('pre-existing live rules cannot indirectly move a protected saved role through another member',()=>{
 const raw=createProject('Indirect constraint',4),f=raw.formations[1],ids=[raw.performers[0].id,raw.performers[2].id],p=covered(addConstraint(raw,f.id,'mirror-x',ids,0)),next=clone(p);
 next.formations[1].positions.find(v=>v.performerId===ids[1]).x+=1;
 const candidate=clone(next),before=clone(p);
 assert.throws(()=>enforceConstraints(next,p),/Attendance protects/);
 assert.deepEqual(next,candidate);assert.deepEqual(p,before);
});
test('multi-formation enforcement plans changes atomically before rejecting a protected result',()=>{
 let raw=createProject('Atomic constraints',4);const ids=[raw.performers[0].id,raw.performers[2].id];
 for(const index of [0,1])raw=addConstraint(raw,raw.formations[index].id,'mirror-x',ids,0);
 const p=covered(raw),next=clone(p);
 next.formations[0].positions.find(v=>v.performerId===ids[1]).x=2;
 next.formations[1].positions.find(v=>v.performerId===ids[1]).x=1;
 const proposed=clone(next);assert.throws(()=>enforceConstraints(next,p),/Attendance protects/);assert.deepEqual(next,proposed);
});
test('stationary rules and attendance removal preserve the authored poses and permit later editing',()=>{
 const raw=createProject('Restore roles',4),rule=addConstraint(raw,raw.formations[1].id,'mirror-x',raw.performers.slice(0,2).map(p=>p.id),0),p=covered(rule),before=clone(p);
 assert.doesNotThrow(()=>enforceConstraints(p,before));assert.deepEqual(p,before);
 const disabled=clone(p);disabled.ensemble.attendance[0].enabled=false;
 disabled.formations[1].positions[1].x=2;assert.doesNotThrow(()=>enforceConstraints(disabled,p));assert.doesNotThrow(()=>assertEnsembleEdits(p,disabled));
});
test('a rejected constraint leaves the same covered poses in 2D frames and 3D scene data',()=>{
 const p=covered(),before=clone(p.formations),[missing,cover]=p.performers;
 assert.throws(()=>addConstraint(p,p.formations[1].id,'mirror-x',[missing.id,cover.id],0),/Attendance protects/);
 for(const [width,height]of [[1280,800],[1920,1080],[1024,768],[390,660]])for(const time of [16,20,32,47.99]){
  const positions=samplePerformance(p,time),scene=sceneProject(p,time,positions),state={time,kind:'2d',rotation:90,mirror:true,flip:true,zoom:1.2,pan:{x:20,y:10},labels:true,showPaths:true,selected:new Set(),aids:{},viewport:{width,height}};
  const svg=viewFrameSVG(p,time,state,{width,height,labels:true});
  assert.equal(svg.includes('data-marker="'+missing.id+'"'),false);assert.ok(svg.includes('data-marker="'+cover.id+'"'));
  assert.equal(positions.find(v=>v.performerId===missing.id).visible,false);assert.ok(scene.performers.some(v=>v.id===cover.id));
 }
 assert.deepEqual(p.formations,before);
});
test('stage hints identify attendance protection separately from approval and retain 3D navigation help',async()=>{
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8'),code=source.split(/\r?\n/).find(l=>l.startsWith('function stageHint(')),project=covered(),c={project,time:16,selected:new Set(),readOnly:false,view:'2d',tool:'cursor',form:()=>project.formations[1],attendanceAffectsSelection};
 vm.runInNewContext(code,c);assert.match(c.stageHint(),/Attendance protects/);assert.doesNotMatch(c.stageHint(),/Approved/);
 c.selected=new Set([project.performers[2].id]);assert.match(c.stageHint(),/Drag to move/);
 c.selected=new Set([project.performers[1].id]);assert.match(c.stageHint(),/Attendance protects/);
 project.formations[1].status='approved';assert.match(c.stageHint(),/Approved/);
 c.view='spatial';assert.match(c.stageHint(),/Drag orbit/);
});
