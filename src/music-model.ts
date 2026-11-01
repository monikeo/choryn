import type {Music} from './types.js';
import type {Project} from './types.js';
import {cloneData} from './compat.js';
export function musicWindow(project: Project,sourceDuration){const m:Partial<Music>=project.music||{},sourceStart=Math.max(0,Math.min(sourceDuration,m.trimStart||0)),sourceEnd=Math.max(sourceStart,Math.min(sourceDuration,m.trimEnd??sourceDuration)),start=m.start||0;return {sourceStart,sourceEnd,start,duration:sourceEnd-sourceStart,end:start+sourceEnd-sourceStart};}
export function editMusicWindow(project: Project,sourceDuration,edge,time){
 if(!Number.isFinite(time)||sourceDuration<=0)throw Error('Load music before trimming.');const next=cloneData(project),w=musicWindow(project,sourceDuration),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),round=v=>Math.round(v*1000)/1000;
 if(edge==='start'){const at=clamp(time,Math.max(0,w.start-w.sourceStart),w.end-.05);next.music.trimStart=round(w.sourceStart+at-w.start);next.music.start=round(at);}
 else if(edge==='end'){const end=clamp(time,w.start+.05,Math.min(project.duration,w.start+sourceDuration-w.sourceStart));next.music.trimEnd=round(w.sourceStart+end-w.start);}
 else if(edge==='move')next.music.start=round(clamp(time,0,Math.max(0,project.duration-w.duration)));else throw Error('Choose a music edge.');return next;
}
export function audioSlice(project: Project,sourceDuration,from,to){const w=musicWindow(project,sourceDuration),start=Math.max(from,w.start),end=Math.min(to,w.end);return end>start?{delay:start-from,offset:w.sourceStart+start-w.start,duration:end-start}:null;}
export const countSeconds=(counts,bpm)=>Math.round(counts*60/bpm*1000)/1000;
export function parseCount(value,bpm,offset=0){const match=String(value).trim().match(/^([1-9]\d*)\.([1-8])(?:\+(0(?:\.\d+)?))?$/);if(!match)throw Error('Use phrase.count, such as 8.1 or 8.2, with +0.5 for a half count.');return Math.round((offset+((Number(match[1])-1)*8+Number(match[2])-1+Number(match[3]||0))*60/bpm)*1000)/1000;}
export function formatCount(time,bpm,offset=0){const ticks=Math.round(Math.max(0,(time-offset)*bpm/60)*1000),beat=Math.floor(ticks/1000),fraction=(ticks%1000)/1000;return `${Math.floor(beat/8)+1}.${beat%8+1}${fraction>0?`+${fraction}`:''}`;}
export function validateMusic(source,audioName){const m=source||{mode:audioName?'file':'demo'},finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;const result={mode:['silent','demo','file'].includes(m.mode)?m.mode:'silent',trimStart:m.trimStart??0,trimEnd:m.trimEnd??null,start:m.start??0,beatOffset:m.beatOffset??0};if(!finite(result.trimStart,0,900)||result.trimEnd!==null&&(!finite(result.trimEnd,.001,900)||result.trimEnd<=result.trimStart)||!finite(result.start,0,3600)||!finite(result.beatOffset,0,3600))throw Error('Invalid music sync settings.');return result;}
