import type {Project} from './types.js';
import {clone,uid} from './engine.js';
import {musicWindow,formatCount} from './music-model.js';
import {editTimeline,splitTimelineItem} from './timeline-model.js';

/**
 * Music-aware structure: 8-count phrases from the tempo and count 1, formation
 * starts snapped to phrases, and song sections found from the music's loudness.
 * All times are performance seconds.
 */
export const phraseSeconds=(bpm:number,counts=8)=>counts*60/bpm;

/** Phrase starts (count 1 of each 8, or of each `counts`) inside the performance. */
export function phraseStarts(project:Project,counts=8):number[]{
  const length=phraseSeconds(project.bpm,counts),offset=project.music?.beatOffset||0,out:number[]=[];
  if(!(length>0))return out;
  for(let t=offset-Math.floor(offset/length)*length;t<=project.duration+1e-9&&out.length<5000;t+=length)out.push(Math.round(t*1000)/1000);
  return out;
}

/** The phrase start nearest to `time`. */
export function snapToPhrase(project:Project,time:number,counts=8){
  const length=phraseSeconds(project.bpm,counts),offset=project.music?.beatOffset||0;
  return Math.round((offset+Math.round((time-offset)/length)*length)*1000)/1000;
}

/**
 * Moves every formation start (except the opening one and approved formations) to
 * its nearest phrase start, keeping the order. A formation whose phrase is taken
 * moves to the next free phrase, or stays where it is if none fits.
 */
export function snapFormationsToPhrases(project:Project,counts=8){
  let next=project;const moved:string[]=[],starts=phraseStarts(project,counts);
  for(const id of project.formations.map(f=>f.id)){
    const index=next.formations.findIndex(f=>f.id===id),f=next.formations[index],previous=next.formations[index-1],following=next.formations[index+1];
    if(!previous||f.status==='approved')continue;
    const lower=previous.time+.1,upper=(following?.time??next.duration)-.1;
    const candidates=starts.filter(t=>t>=lower&&t<=upper).sort((a,b)=>Math.abs(a-f.time)-Math.abs(b-f.time));
    const target=candidates[0];if(target==null||Math.abs(target-f.time)<.001)continue;
    try{next=editTimeline(next,{kind:'formation',id,value:target});moved.push(id);}catch{}
  }
  return {project:next,moved};
}

export interface Section {time:number; end:number; energy:number; level:'calm'|'groove'|'peak'; label:string}

/**
 * Finds song sections: the music's loudness (RMS) is measured per phrase, and a
 * new section starts where loudness jumps or drops sharply between phrases
 * (at least `minPhrases` phrases apart). `samples` is the mono source audio.
 */
export function detectSections(samples:Float32Array,sampleRate:number,project:Project,{counts=8,minPhrases=2,threshold=.32}:{counts?:number;minPhrases?:number;threshold?:number}={}):Section[]{
  const sourceDuration=samples.length/sampleRate,w=musicWindow(project,sourceDuration),length=phraseSeconds(project.bpm,counts);
  const phrases:{time:number;end:number;rms:number}[]=[];
  for(const time of phraseStarts(project,counts)){
    const end=Math.min(time+length,project.duration,w.end),start=Math.max(time,w.start);if(end-start<length*.5)continue;
    const a=Math.max(0,Math.floor((w.sourceStart+start-w.start)*sampleRate)),b=Math.min(samples.length,Math.floor((w.sourceStart+end-w.start)*sampleRate));if(b-a<64)continue;
    let sum=0;const stride=Math.max(1,Math.floor((b-a)/20000));let n=0;for(let i=a;i<b;i+=stride){sum+=samples[i]*samples[i];n++;}
    phrases.push({time,end:time+length,rms:Math.sqrt(sum/Math.max(1,n))});
  }
  if(!phrases.length)return [];
  const loud=(v:number)=>Math.log(Math.max(1e-5,v));
  const boundaries=[0];
  for(let i=1;i<phrases.length;i++){
    const jump=Math.abs(loud(phrases[i].rms)-loud(phrases[i-1].rms));
    if(jump>=threshold&&i-boundaries[boundaries.length-1]>=minPhrases)boundaries.push(i);
  }
  const sections=boundaries.map((first,k)=>{const last=(boundaries[k+1]??phrases.length)-1,slice=phrases.slice(first,last+1),rms=Math.sqrt(slice.reduce((s,p)=>s+p.rms*p.rms,0)/slice.length);return {time:phrases[first].time,end:Math.min(project.duration,phrases[last].end),rms};});
  const sorted=sections.map(s=>s.rms).sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)]||1,top=sorted[sorted.length-1]||1;
  return sections.map((s,k)=>{const level:Section['level']=s.rms<median*.72?'calm':s.rms>=top*.92&&s.rms>median*1.12?'peak':'groove';const name=k===0?'Intro':level==='peak'?'Peak':level==='calm'?'Break':'Section';return {time:s.time,end:s.end,energy:Math.round(s.rms/top*100)/100,level,label:`${name} ${k+1} · ${formatCount(s.time,project.bpm,project.music?.beatOffset||0)}`};});
}

/** Adds a technical cue at each section start (skipping one already within half a second). */
export function addSectionCues(project:Project,sections:Section[]){
  const next=clone(project);let added=0;
  for(const s of sections){if(next.cues.some(c=>Math.abs(c.time-s.time)<.5))continue;if(next.cues.length>=300)break;next.cues.push({id:uid(),time:s.time,label:s.label.slice(0,80)});added++;}
  next.cues.sort((a,b)=>a.time-b.time);return {project:next,added};
}

/**
 * Starts a new formation at each section start that does not already have one
 * (within a count), holding the positions performed there, so each section has
 * its own formation to reshape.
 */
export function addSectionFormations(project:Project,sections:Section[]){
  let next=project;const added:string[]=[],beat=60/project.bpm;
  for(const s of sections){
    if(s.time<=.1||next.formations.some(f=>Math.abs(f.time-s.time)<beat))continue;
    const owner=[...next.formations].reverse().find(f=>f.time<=s.time);if(!owner||owner.status==='approved')continue;
    try{const result=splitTimelineItem(next,'formation',owner.id,s.time),item=result.project.formations.find(f=>f.id===result.item.id)!;item.name=s.label.split(' · ')[0];next=result.project;added.push(item.id);}catch{}
  }
  return {project:next,added};
}
