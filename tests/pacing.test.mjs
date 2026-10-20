import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaybackPacer} from '../src/playback-pacer.js';

test('phase-aligned playback retains 60 updates on common refresh rates without rounding skips',()=>{
 for(const hz of [60,90,120,144]){const pacer=createPlaybackPacer('smooth');let updates=0;pacer.reset();for(let frame=0;frame<hz*10;frame++){const now=frame*1000/hz;if(pacer.due(now)){updates++;pacer.record(now,1);}}assert.ok(updates>=599&&updates<=601,`${hz}Hz: ${updates}`);}
 const efficient=createPlaybackPacer('efficient');let count=0;for(let frame=0;frame<600;frame++)if(efficient.due(frame*1000/60))count++;assert.equal(count,300);
});
test('long stalls drop obsolete deadlines rather than producing a catch-up burst',()=>{
 const pacer=createPlaybackPacer();pacer.reset(0);assert.ok(pacer.due(0));assert.ok(pacer.due(5000));assert.equal(pacer.due(5000),false);assert.equal(pacer.due(5005),false);assert.ok(pacer.due(5017));
});
test('automatic quality lowers the render target for expensive stages and recovers after sustained headroom',()=>{
 const pacer=createPlaybackPacer();for(let i=0;i<25;i++)pacer.record(i*17,18);assert.equal(pacer.summary().target,30);
 for(let i=0;i<180;i++)pacer.record(500+i*34,1);assert.equal(pacer.summary().target,60);
 const smooth=createPlaybackPacer('smooth');for(let i=0;i<50;i++)smooth.record(i*17,25);assert.equal(smooth.summary().target,60);
});
test('local playback statistics are bounded, reset per run and reject invalid cost samples',()=>{
 const pacer=createPlaybackPacer('unknown');for(let i=0;i<300;i++)pacer.record(i*1000/60,2);pacer.record(NaN,2);pacer.record(1,-1);const stats=pacer.summary();assert.equal(stats.mode,'auto');assert.equal(stats.samples,120);assert.ok(Math.abs(stats.updatesPerSecond-60)<1e-8);assert.equal(stats.p95Ms,2);
 pacer.setMode('efficient');assert.equal(pacer.summary().samples,0);assert.equal(pacer.summary().target,30);pacer.setMode('invalid');assert.equal(pacer.summary().mode,'auto');
});
