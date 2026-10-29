import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPlaybackView} from '../src/playback-view.js';
import {createProject,samplePerformance,warnings} from '../src/engine.js';
import {newStageObject} from '../src/production-model.js';
import {setPropPose} from '../src/prop-motion.js';
import {stageSceneKey} from '../src/stage3d.js';

class Node {
 constructor(tag='g'){this.tagName=tag;this.attrs=new Map();this.style={};this.dataset={};this.textContent='';this.writes=0;this.rebuilds=0;this.children=[];this.selectors=new Map();this.classes=new Set();this.classList={add:v=>this.classes.add(v),remove:v=>this.classes.delete(v),toggle:(v,on)=>on?this.classes.add(v):this.classes.delete(v)};}
 getAttribute(k){return this.attrs.get(k)??null;}
 setAttribute(k,v){this.writes++;this.attrs.set(k,String(v));}
 querySelector(k){return this.selectors.get(k)||null;}
 querySelectorAll(k){return this.selectors.get(k)||[];}
 get firstElementChild(){return this.children[0];}
 set innerHTML(v){this.rebuilds++;this.markup=v;this.children=[new Node(v.match(/<([a-z]+)/)?.[1]||'g')];}
}
function workspace(p){
 const root=new Node(),layer=new Node(),objects=new Node(),nodes=p.performers.map(person=>{const n=new Node();n.dataset.marker=person.id;n.selectors.set('.marker-facing',new Node());n.selectors.set('.selection-ring',new Node());return n;});
 layer.selectors.set('[data-marker]',nodes);objects.selectors.set('[data-stage-object]',[]);
 for(const id of ['[data-clock-main]','#transport-time small','#fine-scrub','#precise-count','#playhead','[data-beat-phrase]','[data-beat-number]'])root.selectors.set(id,new Node());
 root.selectors.set('#stage-analysis',new Node());root.selectors.set('#rehearsal-ghosts',new Node());root.selectors.set('#performer-markers',layer);root.selectors.set('#stage-objects',objects);root.selectors.set('.timeline-formation',p.formations.map(f=>{const n=new Node();n.dataset.formation=f.id;return n;}));
 return {root,layer,objects,nodes,state:{selected:new Set(),rotation:0,mirror:false,flip:false,labels:true}};
}
test('3D transport updates geometry warning status without updating 2D markers',()=>{const p=createProject('3D status',2),w=workspace(p),status=new Node();w.root.selectors.set('#validation-status',status);const positions=samplePerformance(p,0);positions.forEach(v=>Object.assign(v,{x:0,z:0}));const view=createPlaybackView(w.root);view.update(p,0,{geometryPositions:positions,state:w.state,hud:true});assert.match(status.textContent,/warnings/);assert.ok(w.nodes.every(v=>v.writes===0));});
test('fullscreen warning rings follow the stage while the timeline HUD is hidden',()=>{const p=createProject('Fullscreen warnings',2),w=workspace(p),layer={innerHTML:''};w.root.selectors.set('#production-safety',layer);const positions=samplePerformance(p,0).map(v=>({...v,x:0,z:0})),view=createPlaybackView(w.root);view.update(p,0,{positions,state:w.state,hud:false});assert.match(layer.innerHTML,/<circle/);const before=layer.innerHTML;positions.forEach(v=>v.x=1);view.update(p,1,{positions,state:w.state,hud:false});assert.notEqual(layer.innerHTML,before);positions[0].x=-3;positions[1].x=3;view.update(p,2,{positions,state:w.state,hud:false});assert.equal(layer.innerHTML,'');});
test('lighting remains smooth while fullscreen transport HUD is idle',()=>{const p=createProject('Lighting frames',1),w=workspace(p),layer={innerHTML:''};p.production.lights=[{id:'a',name:'Red',fixture:'wash',time:0,x:0,z:0,radius:2,intensity:1,color:'#ff0000',fade:true},{id:'b',name:'Blue',fixture:'wash',time:10,x:4,z:0,radius:3,intensity:1,color:'#0000ff',fade:true}];w.root.selectors.set('#production-lighting',layer);const view=createPlaybackView(w.root),options={positions:samplePerformance(p,0),state:w.state,hud:false};view.update(p,1,options);const before=layer.innerHTML;view.update(p,1.1,options);assert.notEqual(layer.innerHTML,before);});
test('playback reuses performer nodes and skips unchanged transform writes through holds',()=>{
 const p=createProject('Stage',100),w=workspace(p),view=createPlaybackView(w.root),positions=samplePerformance(p,1);
 const options={positions,state:w.state,active:p.formations[0].id,playing:true};view.update(p,1,options);const writes=w.nodes.reduce((n,v)=>n+v.writes,0);
 for(let i=0;i<60;i++)view.update(p,1+i/60,options);
 assert.equal(w.layer.rebuilds,0);assert.equal(w.nodes.reduce((n,v)=>n+v.writes,0),writes);
 // External mouse edits are not hidden by an old transform cache.
 w.nodes[0].setAttribute('transform','translate(999 999)');view.update(p,2,options);assert.notEqual(w.nodes[0].getAttribute('transform'),'translate(999 999)');
});
test('prop animation keeps the focused object alive and only rebuilds geometry when shape changes',()=>{
 const p=createProject(),prop=newStageObject();prop.id='prop';let animated=setPropPose(prop,8,{...prop,x:3,width:4,shape:'ellipse',color:'#e06090'});p.props=[animated];const w=workspace(p),object=new Node(),shape=new Node();shape.children=[new Node('rect')];object.dataset.stageObject='prop';object.children=[shape];w.objects.selectors.set('[data-stage-object]',[object]);const view=createPlaybackView(w.root);
 const options={positions:samplePerformance(p,0),state:w.state};view.update(p,2,options);view.update(p,4,options);assert.equal(w.objects.rebuilds,0);assert.equal(shape.rebuilds,0);
 view.update(p,8,options);view.update(p,9,options);assert.equal(shape.rebuilds,1);assert.equal(shape.firstElementChild.tagName,'ellipse');assert.equal(object.getAttribute('transform'),'translate(660 300)');
});
test('scrubbing handles entrance/exit markers and protects the focused scrubber',()=>{
 const p=createProject('Cast',1),w=workspace(p);w.layer.selectors.set('[data-marker]',[]);const view=createPlaybackView(w.root),scrub=w.root.querySelector('#fine-scrub');scrub.value=7;
 view.update(p,3,{positions:samplePerformance(p,3),state:w.state,focused:scrub});assert.equal(w.layer.rebuilds,1);assert.match(w.layer.markup,/performer-marker/);assert.equal(scrub.value,7);
 const current=workspace(p),v=createPlaybackView(current.root);v.update(p,4,{positions:[{...p.formations[0].positions[0],visible:false}],state:current.state});assert.equal(current.nodes[0].style.display,'none');
});
test('transport and playing clip state change without replacing text containers',()=>{
 const p=createProject(),w=workspace(p),v=createPlaybackView(w.root),clips=w.root.querySelectorAll('.timeline-formation');p.music.beatOffset=1;
 v.update(p,.5,{playing:true,active:p.formations[0].id});assert.equal(w.root.querySelector('#precise-count').textContent,'Count-in');assert.ok(clips[0].classes.has('playing'));
 v.update(p,29,{playing:true,active:p.formations[1].id});assert.equal(w.root.querySelector('#precise-count').textContent,'8.1');assert.ok(!clips[0].classes.has('playing'));assert.ok(clips[1].classes.has('playing'));
 v.update(p,29,{playing:false});assert.ok(!clips[1].classes.has('playing'));assert.equal(w.root.querySelector('[data-clock-main]').rebuilds,0);
});
test('spacing reports sample each static prop once for the entire cast',()=>{
 const p=createProject('Large cast',100),prop=newStageObject();let reads=0;Object.defineProperty(prop,'keyframes',{enumerable:true,get(){reads++;return [];}});p.props=[prop];const result=warnings(p,p.formations[0].positions);assert.ok(Array.isArray(result));assert.ok(reads<=3,`${reads} unnecessary keyframe reads`);
});
test('3D holds reuse a scene but changed cast geometry, selection and visibility invalidate it',()=>{
 const p=createProject(),positions=samplePerformance(p,1),selected=new Set(),key=stageSceneKey(p,positions,selected);
 assert.equal(stageSceneKey(p,samplePerformance(p,2),new Set()),key);
 selected.add(p.performers[0].id);assert.notEqual(stageSceneKey(p,positions,selected),key);selected.clear();
 p.performers[0].color='#ff0000';assert.notEqual(stageSceneKey(p,positions,selected),key);p.performers[0].color='#8465d6';
 positions[0].visible=false;assert.notEqual(stageSceneKey(p,positions,selected),key);
});
test('3D scene invalidation includes animated prop shape, size, rotation and colour',()=>{
 const p=createProject(),positions=samplePerformance(p,1);p.props=[newStageObject()];const key=stageSceneKey(p,positions,new Set());
 for(const [field,value] of [['shape','ellipse'],['width',4],['height',3],['rotation',45],['color','#ff0000']]){const old=p.props[0][field];p.props[0][field]=value;assert.notEqual(stageSceneKey(p,positions,new Set()),key);p.props[0][field]=old;}
});
test('fullscreen can leave hidden transport idle while performer animation continues',()=>{
 const p=createProject('Hidden timeline',1),w=workspace(p),view=createPlaybackView(w.root),clock=w.root.querySelector('[data-clock-main]'),scrub=w.root.querySelector('#fine-scrub'),options={state:w.state,playing:true,active:p.formations[0].id};
 p.formations[1].positions[0].x=4;view.update(p,1,{...options,positions:samplePerformance(p,1)});const transform=w.nodes[0].getAttribute('transform'),label=clock.textContent;scrub.value=1;
 view.update(p,15,{...options,positions:samplePerformance(p,15),hud:false});assert.equal(clock.textContent,label);assert.equal(scrub.value,1);assert.notEqual(w.nodes[0].getAttribute('transform'),transform);
 view.update(p,15,{...options,positions:samplePerformance(p,15),hud:true});assert.equal(clock.textContent,'00:15');assert.equal(scrub.value,15);
});

test('pausing or opening a dialog preserves analysis and ghost layers during a transport-only update',()=>{
 const p=createProject('Pause regression',1),w=workspace(p),view=createPlaybackView(w.root),analysis={cells:[],paths:[],comparison:[],summary:'Comparison active'};
 view.update(p,3,{positions:samplePerformance(p,3),state:{...w.state,analysis,ghosts:[]},playing:true,active:p.formations[0].id});
 const layer=w.root.querySelector('#stage-analysis'),ghosts=w.root.querySelector('#rehearsal-ghosts'),markup=layer.markup,writes=layer.rebuilds,ghostWrites=ghosts.rebuilds;
 assert.doesNotThrow(()=>view.update(p,3,{playing:false,active:p.formations[0].id}));
 assert.equal(layer.markup,markup);assert.equal(layer.rebuilds,writes);assert.equal(ghosts.rebuilds,ghostWrites);
 assert.doesNotThrow(()=>view.update(p,3,{playing:false,hud:false}));assert.doesNotThrow(()=>view.update(p,3));
 assert.equal(w.root.querySelector('[data-clock-main]').textContent,'00:03');
 view.update(p,4,{positions:samplePerformance(p,4),state:{...w.state,analysis:{...analysis,summary:'Still editable'}},playing:false});assert.match(layer.markup,/Still editable/);
});

test('actual Properties, Preferences and workspace dialog entry paths can pause the initialized analysis view',async()=>{
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8'),p=createProject('Dialog regression',1),w=workspace(p),view=createPlaybackView(w.root);
 view.update(p,2,{positions:samplePerformance(p,2),state:{...w.state,analysis:{cells:[],paths:[],comparison:[],summary:'Enabled'}},playing:true});
 let opened=0,syncs=0;const dialog={dataset:{},showModal(){opened++;this.open=true;}},context={project:p,time:2,playing:false,playbackToken:0,playbackFrame:0,rate:1,active:p.formations[0].id,audioSource:null,playbackView:view,cancelAnimationFrame(){},syncEnsembleTools(){syncs++;},pauseShowForEditor(){},releaseEnsembleScene(){},syncReference(){},updatePlayButton(){},clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),document:{activeElement:null,body:{classList:{contains:()=>false}},documentElement:{dataset:{theme:'light'}}},$:()=>dialog,btn:()=>'',icon:()=>'',mode:'formation',selected:new Set(),renderInspector:()=>'<p>Properties accessible</p>',recordingAvailable:()=>false,FORMATION_TEMPLATES:[],esc:String};
 const functions=['pause','openDialog','propertiesDialog','settingsDialog','workspaceMenu'].map(name=>{const text=source.split(/\r?\n/).find(line=>line.startsWith(`function ${name}(`));assert.ok(text,`Missing actual ${name} entry path`);return text;}).join('\n');
 vm.runInNewContext(functions,context);assert.doesNotThrow(()=>context.propertiesDialog());assert.equal(dialog.dataset.kind,'inspector');assert.match(dialog.innerHTML,/Properties accessible/);assert.doesNotThrow(()=>context.settingsDialog());assert.match(dialog.innerHTML,/Error recovery/);assert.doesNotThrow(()=>context.workspaceMenu());assert.equal(opened,3);assert.equal(syncs,3);
});
