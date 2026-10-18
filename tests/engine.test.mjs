import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, generateLayout, samplePerformance, beatAt, validateProject, warnings } from '../src/engine.js';

const layouts=['staggered','line','v','circle','diamond','columns','arc','diagonal'];
test('presets use stable identities and bounded real-world geometry for 1–100 performers',()=>{
  for(const n of [1,5,20,50,100]){
    const p=createProject('Test',n);
    for(const type of layouts){
      const positions=generateLayout(type,p.performers,p.stage);
      assert.equal(positions.length,n);assert.equal(new Set(positions.map(q=>q.performerId)).size,n);
      assert.ok(positions.every(q=>Number.isFinite(q.x)&&Number.isFinite(q.z)&&Math.abs(q.x)<=8&&Math.abs(q.z)<=5));
      if(n===1)assert.deepEqual([positions[0].x,positions[0].z],[0,0]);
    }
  }
});
test('canonical formations round-trip through JSON without geometry changes',()=>{
  const p=createProject();const recovered=validateProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(recovered.formations,p.formations);assert.deepEqual(recovered.performers,p.performers);
});
test('sampling holds positions before the movement interval and reaches exact destinations',()=>{
  const p=createProject();
  assert.deepEqual(samplePerformance(p,0),p.formations[0].positions);
  assert.deepEqual(samplePerformance(p,11),p.formations[0].positions);
  assert.deepEqual(samplePerformance(p,16),p.formations[1].positions);
  assert.deepEqual(samplePerformance(p,p.duration),p.formations.at(-1).positions);
});
test('linear interpolation and curved routes have deterministic shared positions',()=>{
  const p=createProject();p.easing='linear';
  const at14=samplePerformance(p,14);
  at14.forEach((q,i)=>{
    assert.ok(Math.abs(q.x-(p.formations[0].positions[i].x+p.formations[1].positions[i].x)/2)<1e-12);
    assert.ok(Math.abs(q.z-(p.formations[0].positions[i].z+p.formations[1].positions[i].z)/2)<1e-12);
  });
  p.pathType='curved';const curved=samplePerformance(p,14);
  curved.forEach((q,i)=>assert.ok(Math.abs(q.x-at14[i].x-.65)<1e-12));
  assert.deepEqual(samplePerformance(p,14),curved);
});
test('sampling never mutates authored formation data',()=>{
  const p=createProject();const before=JSON.stringify(p);
  for(let t=0;t<=96;t+=.13)samplePerformance(p,t);
  assert.equal(JSON.stringify(p),before);
});
test('short formation intervals clamp transition lengths',()=>{
  const p=createProject();p.formations[1].time=1;
  const at=samplePerformance(p,.5);
  assert.ok(at.every(q=>Number.isFinite(q.x)&&Number.isFinite(q.z)));
  assert.deepEqual(samplePerformance(p,1),p.formations[1].positions);
});
test('beat counts adapt to tempo without changing formation timestamps',()=>{
  const p=createProject();assert.deepEqual(beatAt(p,4),{beat:1,phrase:2,total:9});
  const original=p.formations.map(f=>f.time);p.bpm=90;
  assert.deepEqual(beatAt(p,4),{beat:7,phrase:1,total:7});assert.deepEqual(p.formations.map(f=>f.time),original);
});
test('facing interpolation takes the shortest route',()=>{
  const p=createProject();p.formations[0].positions[0].facing=350;p.formations[1].positions[0].facing=10;
  assert.equal(samplePerformance(p,14)[0].facing,360);
});
test('backup validation rejects malformed identities, timing and geometry',()=>{
  const cases=[p=>p.schemaVersion=2,p=>p.stage.width=Infinity,p=>p.bpm=0,p=>p.formations[1].time=0,p=>p.formations[0].time=1,p=>p.formations[0].positions[0].performerId='missing',p=>p.formations[0].positions[0].x=NaN,p=>p.formations[0].positions.pop(),p=>p.performers[1].id=p.performers[0].id,p=>p.formations[1].id=p.formations[0].id,p=>p.performers[0].color='url(evil)',p=>p.duration=30];
  for(const mutate of cases){const p=createProject();mutate(p);assert.throws(()=>validateProject(p));}
});
test('backup validation removes unknown fields rather than merging them into application state',()=>{
  const p=createProject();p.externalToken='no';p.performers[0].html='<script>';const v=validateProject(p);
  assert.equal(v.externalToken,undefined);assert.equal(v.performers[0].html,undefined);
});
test('spacing validation reports close markers and offstage performers',()=>{
  const p=createProject();const positions=structuredClone(p.formations[0].positions);assert.deepEqual(warnings(p,positions),[]);
  positions[0].x=100;assert.ok(warnings(p,positions).some(v=>v.includes('outside stage')));
  positions[0].x=positions[1].x;positions[0].z=positions[1].z;assert.ok(warnings(p,positions).some(v=>v.includes('0.55 m')));
});
test('representative 100-person playback stays within an interactive sampling budget',()=>{
  const p=createProject('Large cast',100);const start=performance.now();
  for(let i=0;i<1000;i++)samplePerformance(p,i/1000*p.duration);
  const elapsed=performance.now()-start;
  assert.ok(elapsed<3000,`1000 samples took ${elapsed.toFixed(0)} ms`);
});
