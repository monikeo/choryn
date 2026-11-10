import type {MediaOptions,VideoSettings} from './types.js';
import type {Project} from './types.js';
import type {AudioBufferSource,CanvasSource} from './mediabunny.js';
import {supportedVideoFormats} from './video.js';
import {audioSlice} from './music-model.js';
export const RENDERED_MP4='video/mp4;choryn=auto';
let mediaPromise:Promise<typeof import('./mediabunny.js')>|null|undefined;
export const loadMedia=()=>mediaPromise||=(import('./mediabunny.js').catch(error=>{mediaPromise=null;throw error;}));
export async function videoExportFormats(settings:VideoSettings,{environment=globalThis,media}:MediaOptions={}){
 const native=supportedVideoFormats(environment.MediaRecorder),formats=native.filter(([mime])=>!mime.includes('mp4'));let mp4=native.some(([mime])=>mime.includes('mp4'));
 if(environment.VideoEncoder&&environment.VideoFrame){try{const lib=media||await loadMedia();if(await lib.canEncodeVideo('avc',{width:settings.width,height:settings.height,frameRate:settings.fps,quality:new lib.Quality({bitrate:settings.bitrate})}))mp4=true;}catch{}}
 if(mp4)formats.unshift([RENDERED_MP4,'MP4 · H.264','mp4']);return formats;
}
export async function chooseMP4Route(settings:VideoSettings,audioBuffer:AudioBuffer|null|undefined,{environment=globalThis,media}:MediaOptions={}):Promise<{rendered:boolean;mime?:string}>{
 let avc=false,aac=!audioBuffer;
 if(environment.VideoEncoder&&environment.VideoFrame){try{const lib=media||await loadMedia();avc=await lib.canEncodeVideo('avc',{width:settings.width,height:settings.height,frameRate:settings.fps,quality:new lib.Quality({bitrate:settings.bitrate})});if(audioBuffer)aac=await lib.canEncodeAudio('aac',{numberOfChannels:Math.min(2,audioBuffer.numberOfChannels),sampleRate:audioBuffer.sampleRate});}catch{}}
 if(avc&&aac)return {rendered:true};const nativeFormats=supportedVideoFormats(environment.MediaRecorder),native=nativeFormats.find(([mime])=>mime==='video/mp4')||nativeFormats.find(([mime])=>mime.includes('mp4'));if(native)return {rendered:false,mime:native[0]};
 throw Error(avc&&!aac?'MP4 with AAC music is unavailable on this device. Turn off music for silent MP4, or choose WebM.':'H.264 MP4 encoding is unavailable at this quality. Try 720p or a current Chrome, Edge or Safari browser.');
}
export function clipAudioChunk(project: Project,buffer:AudioBuffer,settings:Pick<VideoSettings,'start'|'end'>,from:number,duration:number,AudioBufferClass=globalThis.AudioBuffer){
 const sampleRate=buffer.sampleRate,channels=Math.min(2,buffer.numberOfChannels),length=Math.max(1,Math.round(duration*sampleRate)),out=new AudioBufferClass({numberOfChannels:channels,length,sampleRate}),slice=audioSlice(project,buffer.duration,settings.start,settings.end);
 if(!slice)return out;
 for(let channel=0;channel<channels;channel++){const source=buffer.getChannelData(channel),target=out.getChannelData(channel);for(let i=0;i<length;i++){const t=from+i/sampleRate;if(t<slice.delay||t>=slice.delay+slice.duration)continue;const index=Math.round((slice.offset+t-slice.delay)*sampleRate);if(index>=0&&index<source.length)target[i]=source[index]*.65;}}
 return out;
}
export async function renderMP4(project: Project,settings:VideoSettings,{frameRenderer,canvas,audioBuffer,signal,onProgress=()=>{},media,yieldTask=()=>new Promise(r=>setTimeout(r,0)),environment=globalThis}:MediaOptions={}){
 if(!frameRenderer)throw Error('The stage renderer is unavailable.');
 const lib=media||await loadMedia(),quality=new lib.Quality({bitrate:settings.bitrate});
 if(signal?.aborted)throw Error('Video export cancelled.');
 if(!await lib.canEncodeVideo('avc',{width:settings.width,height:settings.height,frameRate:settings.fps,quality}))throw Error('H.264 MP4 encoding is unavailable at this quality. Try 720p, MP4 browser recording, or another browser.');
 if(audioBuffer&&!await lib.canEncodeAudio('aac',{numberOfChannels:Math.min(2,audioBuffer.numberOfChannels),sampleRate:audioBuffer.sampleRate}))throw Error('AAC music encoding is unavailable here. Choose MP4 browser recording, or turn off music for a silent MP4.');
 canvas||=document.createElement('canvas');canvas.width=settings.width;canvas.height=settings.height;const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('The video canvas could not be allocated. Try lower quality.');
 const target=new lib.BufferTarget(),output=new lib.Output({format:new lib.Mp4OutputFormat({fastStart:'in-memory'}),target});
 let video:CanvasSource|undefined,audio:AudioBufferSource|null|undefined,finalized=false,cancelling:Promise<void>|undefined;
 const abort=()=>{cancelling||=output.cancel().catch(()=>{});},check=()=>{if(signal?.aborted)throw Error('Video export cancelled.');if(environment.document?.hidden)throw Error('Export stopped because the studio was hidden. Keep this tab visible.');};
 try{
  video=new lib.CanvasSource(canvas,{codec:'avc',quality});audio=audioBuffer?new lib.AudioBufferSource({codec:'aac',quality:new lib.Quality({bitrate:192000})}):null;
  output.addVideoTrack(video,{frameRate:settings.fps});if(audio)output.addAudioTrack(audio);signal?.addEventListener('abort',abort,{once:true});check();await output.start();
  const duration=settings.end-settings.start,frames=Math.ceil(duration*settings.fps);let audioUntil=0;
  for(let i=0;i<frames;i++){
   check();const at=i/settings.fps,frameDuration=Math.min(1/settings.fps,duration-at);
   if(audio&&at>=audioUntil-1e-7){const chunkDuration=Math.min(1,duration-audioUntil);await audio.add(clipAudioChunk(project,audioBuffer!,settings,audioUntil,chunkDuration,environment.AudioBuffer));audioUntil+=chunkDuration;}
   await frameRenderer.draw(ctx,settings.start+at);check();await video.add(at,frameDuration,{keyFrame:i%(settings.fps*2)===0});
   if(i%Math.max(1,Math.floor(settings.fps/10))===0||i===frames-1){onProgress((i+1)/frames,canvas);await yieldTask();}
  }
  video.close();audio?.close();check();await output.finalize();finalized=true;check();
  if(!target.buffer?.byteLength)throw Error('MP4 encoding returned an empty file.');if(target.buffer.byteLength>450*1024*1024)throw Error('The MP4 exceeded the memory limit. Export a shorter clip.');
  return new Blob([target.buffer],{type:'video/mp4'});
 }catch(error){if(signal?.aborted)throw Error('Video export cancelled.');throw error;}
 finally{signal?.removeEventListener('abort',abort);if(!finalized)await (cancelling||output.cancel().catch(()=>{}));}
}
