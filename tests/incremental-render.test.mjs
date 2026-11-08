import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createProject,clone,samplePerformance} from '../src/engine.js';
import {renderStage2D,stageLayers2D,assembleStage2D} from '../src/stage2d.js';

// Frequent edits refresh only the workstation regions they change instead of rebuilding #app.
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const line=name=>{const code=app.split(/\r?\n/).find(l=>l.startsWith(`function ${name}(`));assert.ok(code,`Missing actual ${name}`);return code;};
const block=(start,end)=>{const from=app.indexOf(start),to=app.indexOf(end,from);assert.ok(from>=0&&to>from,`Missing actual ${start}`);return app.slice(from,to);};
const state=(project,extra={})=>({selected:new Set(),pan:{x:0,y:0},zoom:1,rotation:0,mirror:false,flip:false,showGrid:true,labels:true,showPaths:false,time:project.formations[1].time,...extra});

test('the 2D stage is assembled from layers with one keyed string per performer marker',()=>{
 const p=createProject('Layers',12),f=p.formations[1],positions=samplePerformance(p,f.time),s=state(p),layers=stageLayers2D(p,f,positions,s);
 assert.equal(renderStage2D(p,f,positions,s),assembleStage2D(p,f,s,layers));
 assert.deepEqual(layers.markers.map(([id])=>id),positions.map(v=>v.performerId));
 const renamed=clone(p);renamed.performers[3].name='Renamed dancer';
 const next=stageLayers2D(renamed,renamed.formations[1],positions,s),changed=next.markers.filter(([id,html],i)=>html!==layers.markers[i][1]).map(([id])=>id);
 assert.deepEqual(changed,[p.performers[3].id],'a name edit changes only that performer marker');
 const hidden=positions.map((v,i)=>i===2?{...v,visible:false}:v);
 assert.equal(stageLayers2D(p,f,hidden,s).markers[2][1],'','hidden performers have no marker');
});

test('commit refreshes the named regions and keeps the full render for structural or failed edits',()=>{
 const calls=[],c={save:()=>c.ok,ok:true,render:()=>calls.push('render'),refresh:parts=>calls.push(parts.join('+')),toast:text=>calls.push('toast:'+text)};
 vm.runInNewContext(line('commit'),c);
 c.commit('Saved',['stage','inspector']);c.commit('Structural');c.ok=false;c.commit('Rejected',['stage']);
 assert.deepEqual(calls,['stage+inspector','toast:Saved','render','toast:Structural','render']);
});

test('refresh waits for the pointer, falls back outside the formation editor and flushes deferred regions',()=>{
 const calls=[],c={pointerDown:true,deferredRender:false,deferredParts:new Set(),renderedMode:'formation',mode:'formation',featureModes:['choreography'],$:()=>({}),render:()=>calls.push('render')};
 vm.runInNewContext([line('refreshable'),line('flushDeferred'),block('function refresh(parts','\nfunction fragment(')].join('\n'),c);
 c.refresh(['stage']);c.refresh(['inspector']);
 assert.deepEqual([...c.deferredParts],['stage','inspector']);assert.deepEqual(calls,[]);
 c.pointerDown=false;c.mode='choreography';c.flushDeferred();
 assert.deepEqual(calls,['render'],'a feature page has no inspector or stage regions, so it is rebuilt');assert.equal(c.deferredParts.size,0);
 c.deferredRender=true;c.refresh(['stage']);assert.deepEqual(calls,['render','render'],'a pending full render wins over a partial refresh');
});

test('undo and redo refresh only what the restored step changed',()=>{
 const c={};vm.runInNewContext(block('function undoParts(','\nfunction miniStage('),c);
 const base=createProject('History',8),active=base.formations[1].id,parts=fn=>{const next=clone(base);fn(next);const result=c.undoParts(base,next,active);return result&&[...result].sort();};
 assert.deepEqual(parts(p=>p.formations[1].positions[0].x=2),['card','inspector','stage'],'a move in the active formation updates only its card');
 assert.deepEqual(parts(p=>p.formations[3].positions[0].x=2),['cards','inspector','stage']);
 assert.deepEqual(parts(p=>p.formations[1].highlights=[p.performers[0].id]),['inspector','stage']);
 assert.deepEqual(parts(p=>p.performers[0].identity='female'),['cards','inspector','roster','stage']);
 assert.deepEqual(parts(p=>p.formations[1].status='approved'),['card','heading','inspector','stage','timeline']);
 assert.ok(['assets','heading'].every(part=>parts(p=>{p.performers.pop();p.formations.forEach(f=>f.positions.pop());}).includes(part)));
 assert.equal(parts(p=>p.formations[2].time+=1),null,'formation timing rebuilds the workstation');
 assert.equal(parts(p=>p.formations[2].name='Renamed'),null);
 assert.equal(parts(p=>p.cues.push({id:'cue',label:'LX 1',time:4})),null);
 assert.equal(parts(p=>p.stage.width+=2),null);
 assert.equal(parts(p=>p.formations.pop()),null);
});
