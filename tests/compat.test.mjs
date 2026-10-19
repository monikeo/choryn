import test from 'node:test';
import assert from 'node:assert/strict';
import {cloneData,localId,lastIndex,lastMatch,createAudioContext,observeSize,recordingAvailable} from '../src/compat.js';
import {supportedVideoFormats} from '../src/video.js';

test('JSON project cloning remains independent when structuredClone is unavailable',()=>{
  const source={name:'ក្រុម ✨',positions:[{x:1,z:2}],tags:[]},copy=cloneData(source,{});copy.positions[0].x=9;assert.equal(source.positions[0].x,1);assert.equal(copy.name,source.name);
});
test('local identifiers remain unique without randomUUID, using available crypto entropy',()=>{
  const environment={crypto:{getRandomValues:bytes=>crypto.getRandomValues(bytes)}},ids=Array.from({length:100},()=>localId(environment));assert.equal(new Set(ids).size,100);assert.ok(ids.every(id=>/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)));
});
test('backward formation lookup handles gaps, opening and no match without findLast',()=>{
  const forms=[{time:0},{time:16},{time:48}];assert.equal(lastIndex(forms,f=>f.time<=32),1);assert.equal(lastMatch(forms,f=>f.time<=0),forms[0]);assert.equal(lastMatch(forms,f=>f.time<0),undefined);
});
test('audio constructor supports prefixed WebKit and gives an actionable unavailable error',()=>{
  class Audio{}assert.ok(createAudioContext({webkitAudioContext:Audio}) instanceof Audio);assert.throws(()=>createAudioContext({}),/Visual rehearsal/);
});
test('resize fallback updates on window resize and removes its listener on disposal',()=>{
  const events=new Map(),callback=()=>{},environment={addEventListener:(type,fn)=>events.set(type,fn),removeEventListener:(type,fn)=>{assert.equal(events.get(type),fn);events.delete(type);}};const observer=observeSize({},callback,environment);assert.equal(events.get('resize'),callback);observer.disconnect();assert.equal(events.size,0);
});
test('recording needs both a recorder and canvas stream; encoder exceptions disable only that format',()=>{
  const MediaRecorder={isTypeSupported:mime=>{if(mime.includes('vp9'))throw Error('codec unavailable');return mime==='video/mp4';}};assert.equal(recordingAvailable({MediaRecorder}),false);assert.equal(recordingAvailable({MediaRecorder,HTMLCanvasElement:{prototype:{captureStream(){}}}}),true);assert.deepEqual(supportedVideoFormats(MediaRecorder),[['video/mp4','MP4','mp4']]);
});
