// Tempo and first-downbeat detection for uploaded music.
//
// 1. Onset strength: the rise in loudness (log energy) of a low band (kick, bass)
//    and of sharp transients (snare, claps), 100 times a second.
// 2. Tempo: autocorrelation of that onset curve over 70–180 BPM, with a gentle
//    preference for common dance tempos to settle half/double-time ambiguity.
// 3. Refinement: a fine tempo search that lines a beat grid up with the onsets
//    (comb filter); its best alignment gives the beat phase.
// 4. Downbeat: of the four beats in a bar, the one with the strongest low-band
//    accent is taken as count 1.
// Everything runs on plain arrays (no Web Audio graph), so it is testable in Node.

export type TempoResult={bpm:number;firstBeat:number;confidence:number;beats:number};

const FPS=100;

/** Mixes the channels of an AudioBuffer-like object to mono. */
export function monoSamples(buffer:{numberOfChannels:number;length:number;getChannelData:(c:number)=>Float32Array}):Float32Array{
  if(buffer.numberOfChannels<=1)return buffer.getChannelData(0);
  const out=new Float32Array(buffer.length);
  for(let c=0;c<buffer.numberOfChannels;c++){const data=buffer.getChannelData(c);for(let i=0;i<out.length;i++)out[i]+=data[i]/buffer.numberOfChannels;}
  return out;
}

/** Onset strength curves (FPS frames per second): overall and low band. */
export function onsetEnvelope(samples:Float32Array,sampleRate:number){
  const hop=Math.max(1,Math.round(sampleRate/FPS)),frames=Math.floor(samples.length/hop);
  const low=new Float32Array(frames),high=new Float32Array(frames),alpha=1-Math.exp(-2*Math.PI*150/sampleRate);
  let lp=0,previous=0;
  for(let f=0;f<frames;f++){
    let el=0,eh=0;
    for(let i=f*hop,end=i+hop;i<end;i++){const x=samples[i];lp+=alpha*(x-lp);el+=lp*lp;const d=x-previous;previous=x;eh+=d*d;}
    low[f]=Math.log1p(el*1000/hop);high[f]=Math.log1p(eh*1000/hop);
  }
  const onset=new Float32Array(frames),lowOnset=new Float32Array(frames),fps=sampleRate/hop;// the true frame rate (hop is whole samples)
  for(let f=1;f<frames;f++){lowOnset[f]=Math.max(0,low[f]-low[f-1]);onset[f]=lowOnset[f]+Math.max(0,high[f]-high[f-1]);}
  // Remove the slowly varying part so autocorrelation measures rhythm, not loudness.
  const detrend=(v:Float32Array)=>{const out=new Float32Array(v.length),w=50;let sum=0;for(let f=0;f<v.length;f++){sum+=v[f];if(f>=w)sum-=v[f-w];const mean=sum/Math.min(f+1,w);out[f]=Math.max(0,v[f]-mean);}return out;};
  return {onset:detrend(onset),low:detrend(lowOnset),fps};
}

/** Strength of a beat grid (period and phase in frames) against an onset curve, tolerating ±1 frame. */
function gridScore(onset:Float32Array,period:number,phase:number){
  let sum=0,count=0;
  for(let t=phase;t<onset.length-1;t+=period){const i=Math.round(t);sum+=Math.max(onset[i-1]||0,onset[i],onset[i+1]||0);count++;}
  return count?sum/count:0;
}

export function detectTempo(samples:Float32Array,sampleRate:number,{minBpm=70,maxBpm=180}={}):TempoResult|null{
  if(!(sampleRate>0)||samples.length<sampleRate*6)return null;// needs a few bars
  // Analyse at most the first 3 minutes: plenty for a steady tempo, and fast.
  const {onset,low,fps}=onsetEnvelope(samples.length>sampleRate*180?samples.subarray(0,sampleRate*180):samples,sampleRate);
  const minLag=Math.floor(fps*60/maxBpm),maxLag=Math.ceil(fps*60/minBpm);
  if(onset.length<maxLag*4)return null;
  const acf=new Float64Array(maxLag*2+2);
  for(let lag=1;lag<acf.length;lag++){let s=0;for(let t=0;t+lag<onset.length;t++)s+=onset[t]*onset[t+lag];acf[lag]=s/(onset.length-lag);}
  // Score each lag with its multiples (a real beat repeats) and a log-normal tempo prior around 115 BPM.
  let bestLag=0,bestScore=-Infinity,mean=0,count=0;
  for(let lag=minLag;lag<=maxLag;lag++){
    const bpm=60*fps/lag,prior=Math.exp(-.5*(Math.log2(bpm/115)/.75)**2),score=(acf[lag]+.5*(acf[2*lag]||0))*prior;
    mean+=score;count++;if(score>bestScore){bestScore=score;bestLag=lag;}
  }
  mean/=count;
  if(!(bestScore>0))return null;
  // Fine search around the winner: ±4% in 0.05 BPM steps, best phase for each.
  const coarse=60*fps/bestLag;let bpm=coarse,phase=0,best=-Infinity;
  for(let candidate=coarse*.96;candidate<=coarse*1.04;candidate+=.05){
    const period=60*fps/candidate;
    for(let p=0;p<period;p+=.5){const s=gridScore(onset,period,p);if(s>best){best=s;bpm=candidate;phase=p;}}
  }
  // Common tempos are whole numbers; keep a decimal only when the music clearly asks for it.
  const whole=Math.round(bpm),rounded=Math.abs(bpm-whole)<.2?whole:Math.round(bpm*10)/10;
  const period=60*fps/rounded;
  // Re-fit the phase on the final tempo.
  best=-Infinity;for(let p=0;p<period;p+=.25){const s=gridScore(onset,period,p);if(s>best){best=s;phase=p;}}
  // Count 1: the beat of the bar (every 4 beats) with the strongest low-band accent.
  let bar=0,barScore=-Infinity;
  for(let k=0;k<4;k++){const s=gridScore(low,period*4,phase+k*period);if(s>barScore){barScore=s;bar=k;}}
  // Earliest downbeat in the music. An estimate a few milliseconds before 0 is the song's own first beat,
  // not a reason to skip to the next bar (that would shift every 8-count by a bar).
  const barSeconds=period*4/fps;let first=(phase+bar*period)/fps;
  while(first-barSeconds>=-.06)first-=barSeconds;
  first=Math.max(0,first);
  const confidence=Math.max(0,Math.min(1,(bestScore/mean-1)/3));
  return {bpm:rounded,firstBeat:Math.round(first*1000)/1000,confidence:Math.round(confidence*100)/100,beats:Math.floor((samples.length/sampleRate-first)*rounded/60)};
}

/** Project-time beat offset for a detected first downbeat, following the music's trim and start. */
export function beatOffsetFor(music:{start?:number;trimStart?:number},firstBeat:number,bpm:number){
  const bar=4*60/bpm;let source=firstBeat;
  // The first downbeat inside the trimmed part of the song.
  const trim=music.trimStart||0;if(source<trim)source+=Math.ceil((trim-source)/bar-1e-9)*bar;
  return Math.round(((music.start||0)+source-trim)*1000)/1000;
}
