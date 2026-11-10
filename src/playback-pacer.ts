export const PLAYBACK_MODES:readonly string[]=['auto','smooth','efficient'];
// Keep a phase-aligned deadline. Comparing elapsed time to 33.333ms repeatedly
// can turn a 60Hz display into alternating 33/50ms updates.
export function createPlaybackPacer(initial='auto'){
 let mode=PLAYBACK_MODES.includes(initial)?initial:'auto',target=mode==='efficient'?30:60,next=0,average=0,samples=0,good=0,frames:{at:number;cost:number}[]=[];
 return {
  reset(now=0){next=now;average=0;samples=0;good=0;frames=[];target=mode==='efficient'?30:60;},
  setMode(value:string){mode=PLAYBACK_MODES.includes(value)?value:'auto';this.reset();},
  due(now:number){if(now+.75<next)return false;const period=1000/target;next+=period;if(next<now-period)next=now+period;return true;},
  record(now:number,cost:number){if(!Number.isFinite(now)||!Number.isFinite(cost)||cost<0)return;average=samples?average*.9+cost*.1:cost;samples++;frames.push({at:now,cost});if(frames.length>120)frames.shift();
   if(mode==='auto'&&samples>=20){if(target===60&&average>12){target=30;good=0;}else if(target===30){good=average<5?good+1:0;if(good>=120){target=60;good=0;}}}
  },
  summary(){const costs=frames.map(f=>f.cost).sort((a,b)=>a-b),elapsed=frames.length>1?frames[frames.length-1].at-frames[0].at:0;return {mode,target,samples:frames.length,updatesPerSecond:elapsed>0?(frames.length-1)*1000/elapsed:0,meanMs:costs.length?costs.reduce((a,b)=>a+b,0)/costs.length:0,p95Ms:costs.length?costs[Math.ceil(costs.length*.95)-1]:0};}
 };
}
