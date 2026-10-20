import {sampleProps} from './prop-motion.js';
import {audioSlice} from './music-model.js';
import {lastMatch,createAudioContext} from './compat.js';
import {samplePerformance,timecode,beatAt,clamp} from './engine.js';
import {contrastText} from './colors.js';

export const RESOLUTIONS={480:[854,480],720:[1280,720],1080:[1920,1080],1440:[2560,1440]};
export function videoSettings(duration,input={}){
  const resolution=Number(input.resolution||720),fps=Number(input.fps||30),quality=input.quality||'standard';
  if(!RESOLUTIONS[resolution]||![24,30,60].includes(fps)||!['compact','standard','high'].includes(quality))throw Error('Choose a supported video quality.');
  const start=Number(input.start??0),end=Number(input.end??duration);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>duration||end-start<.25)throw Error('Choose a clip of at least 0.25 seconds inside the performance.');
  let [width,height]=RESOLUTIONS[resolution];if(input.aspect!=null){const aspect=Number(input.aspect);if(!Number.isFinite(aspect)||aspect<.1||aspect>20)throw Error('The stage viewport cannot be exported at this aspect ratio.');width=Math.max(2,Math.round(height*aspect/2)*2);if(width>4096){width=4096;height=Math.max(2,Math.round(width/aspect/2)*2);}}
  const bitrate=Math.round(width*height*fps*.08*({compact:.55,standard:1,high:1.8}[quality]));
  const estimatedBytes=(bitrate+192000)*(end-start)/8;
  if(estimatedBytes>400*1024*1024)throw Error('This clip is too large for an in-memory export. Choose a shorter range or lower quality (estimated limit 400 MB).');
  return {width,height,fps,quality,start,end,bitrate,estimatedBytes,labels:input.labels!==false};
}
export function supportedVideoFormats(Recorder=globalThis.MediaRecorder){
  if(!Recorder?.isTypeSupported)return [];
  return [['video/mp4;codecs=avc1.42E01E,mp4a.40.2','MP4 · H.264','mp4'],['video/mp4','MP4','mp4'],['video/webm;codecs=vp9,opus','WebM · VP9','webm'],['video/webm;codecs=vp8,opus','WebM · VP8','webm']].filter(([mime])=>(()=>{try{return Recorder.isTypeSupported(mime);}catch{return false;}})());
}
export function drawVideoFrame(ctx,project,time,settings){
  const {width:w,height:h}=settings,s=h/720;
  ctx.fillStyle='#f5f3f8';ctx.fillRect(0,0,w,h);ctx.save();ctx.scale(s,s);
  const W=w/s,H=720,margin=68,top=112,areaH=H-top-95;
  const unit=Math.min((W-margin*2)/project.stage.width,areaH/project.stage.depth),sw=unit*project.stage.width,sh=unit*project.stage.depth,left=(W-sw)/2,y=top+(areaH-sh)/2;
  ctx.fillStyle='#332b46';ctx.font='bold 19px system-ui';ctx.fillText('CHORYN / PERFORMANCE',margin,38);
  ctx.font='24px system-ui';ctx.fillText(project.name.slice(0,75),margin,76,W-margin*2);
  ctx.fillStyle='#ffffff';ctx.fillRect(left,y,sw,sh);ctx.strokeStyle='#d9d4e3';ctx.lineWidth=1;
  for(let x=-Math.floor(project.stage.width/2);x<=project.stage.width/2;x++){const px=left+sw/2+x*unit;ctx.beginPath();ctx.moveTo(px,y);ctx.lineTo(px,y+sh);ctx.stroke();}
  for(let z=-Math.floor(project.stage.depth/2);z<=project.stage.depth/2;z++){const py=y+sh/2-z*unit;ctx.beginPath();ctx.moveTo(left,py);ctx.lineTo(left+sw,py);ctx.stroke();}
  ctx.strokeStyle='#8e829f';ctx.strokeRect(left,y,sw,sh);
  const point=p=>({x:left+sw/2+p.x*unit,y:y+sh/2-p.z*unit});
  for(const prop of sampleProps(project,time,samplePerformance(project,time))){const p=point(prop),w=prop.width*unit,d=prop.depth*unit;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(prop.rotation*Math.PI/180);ctx.globalAlpha=.35;ctx.fillStyle=prop.color;ctx.beginPath();if(prop.shape==='ellipse')ctx.ellipse(0,0,w/2,d/2,0,0,Math.PI*2);else if(prop.shape==='triangle'){ctx.moveTo(0,-d/2);ctx.lineTo(w/2,d/2);ctx.lineTo(-w/2,d/2);ctx.closePath();}else ctx.rect(-w/2,-d/2,w,d);ctx.fill();ctx.restore();}
  ctx.save();ctx.beginPath();ctx.rect(left-26,y-26,sw+52,sh+52);ctx.clip();
  for(const position of samplePerformance(project,time)){
    if(position.visible===false)continue;const person=project.performers.find(p=>p.id===position.performerId),p=point(position),radius=clamp(unit*.29,6,18);
    ctx.fillStyle=person.color;ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(position.facing*Math.PI/180);ctx.beginPath();ctx.moveTo(-4,radius+3);ctx.lineTo(0,radius+8);ctx.lineTo(4,radius+3);ctx.fill();ctx.restore();
    ctx.fillStyle=contrastText(person.color);ctx.font=`bold ${Math.max(9,radius)}px system-ui`;ctx.textAlign='center';ctx.fillText(String(person.number),p.x,p.y+radius*.35);
    if(settings.labels){ctx.font='12px system-ui';ctx.strokeStyle='#ffffff';ctx.lineWidth=3;ctx.strokeText(person.name.slice(0,30),p.x,p.y-radius-7);ctx.fillStyle='#332b46';ctx.fillText(person.name.slice(0,30),p.x,p.y-radius-7);}
  }ctx.restore();ctx.textAlign='center';ctx.fillStyle='#776a87';ctx.font='11px system-ui';ctx.fillText('AUDIENCE / DOWNSTAGE',W/2,y+sh+28);
  const formation=lastMatch(project.formations,f=>f.time<=time)||project.formations[0],beat=beatAt(project,time);
  ctx.textAlign='left';ctx.fillStyle='#332b46';ctx.font='bold 16px system-ui';ctx.fillText(formation.name.slice(0,70),margin,H-43,W-margin*2-180);ctx.textAlign='right';ctx.fillText(`${timecode(time)}  ·  ${beat.phrase}.${beat.beat} / 8`,W-margin,H-43);
  ctx.fillStyle='#ded8e8';ctx.fillRect(margin,H-22,W-margin*2,3);ctx.fillStyle='#8465d6';ctx.fillRect(margin,H-22,(W-margin*2)*time/project.duration,3);ctx.restore();
}

// MediaRecorder records in real time. A separate audio graph shares its clock with drawing.
export async function recordVideo(project,settings,{mime,audioBuffer,signal,frameRenderer,onProgress=()=>{},canvas=document.createElement('canvas')}={}){
  if(!globalThis.MediaRecorder||!canvas.captureStream)throw Error('Video recording is unavailable in this browser. Try a current Chromium or Safari browser.');
  canvas.width=settings.width;canvas.height=settings.height;
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('The device could not allocate the video canvas. Try a lower resolution.');
  let stream,audioContext,source,recorder,frame,timer,visibilityHandler,aborted=false,stopReason='',bytes=0;
  const chunks=[];
  const cleanup=()=>{cancelAnimationFrame(frame);clearTimeout(timer);document.removeEventListener('visibilitychange',visibilityHandler);signal?.removeEventListener('abort',abort);try{source?.stop();}catch{}source?.disconnect();stream?.getTracks().forEach(track=>track.stop());audioContext?.close().catch(()=>{});};
  const stop=reason=>{stopReason=reason;aborted=!!reason;if(recorder?.state==='recording')recorder.stop();};
  const abort=()=>stop('Video export cancelled.');
  try{
    if(signal?.aborted)throw Error('Video export cancelled.');
    if(frameRenderer)await frameRenderer.draw(ctx,settings.start);else drawVideoFrame(ctx,project,settings.start,settings);stream=canvas.captureStream(settings.fps);
    if(audioBuffer){audioContext=createAudioContext();await audioContext.resume();const destination=audioContext.createMediaStreamDestination(),gain=audioContext.createGain();gain.gain.value=.65;gain.connect(destination);source=audioContext.createBufferSource();source.buffer=audioBuffer;source.connect(gain);destination.stream.getAudioTracks().forEach(track=>stream.addTrack(track));}
    if(signal?.aborted)throw Error('Video export cancelled.');
    recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:settings.bitrate,audioBitsPerSecond:192000});
    const result=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>450*1024*1024)stop('The recording exceeded the device memory limit. Export a shorter clip.');}};recorder.onerror=e=>reject(e.error||Error('The video encoder failed. Try a lower quality.'));recorder.onstop=()=>aborted?reject(Error(stopReason)):resolve(new Blob(chunks,{type:recorder.mimeType}));});
    visibilityHandler=()=>{if(document.hidden)stop('Export stopped because the studio was hidden. Keep this tab visible while recording.');};document.addEventListener('visibilitychange',visibilityHandler);signal?.addEventListener('abort',abort,{once:true});
    const duration=settings.end-settings.start,clock=()=>audioContext?audioContext.currentTime:performance.now()/1000;
    recorder.start(500);const started=clock();if(source){const slice=audioSlice(project,audioBuffer.duration,settings.start,settings.end);if(slice)source.start(audioContext.currentTime+slice.delay,slice.offset,slice.duration);}
    const draw=async()=>{try{const elapsed=Math.max(0,clock()-started);if(frameRenderer)await frameRenderer.draw(ctx,Math.min(settings.end,settings.start+elapsed));else drawVideoFrame(ctx,project,Math.min(settings.end,settings.start+elapsed),settings);if(aborted)return;onProgress(Math.min(1,elapsed/duration),canvas);if(elapsed>=duration){stop('');return;}frame=requestAnimationFrame(draw);}catch(error){stop(error.message||'Video rendering failed.');}};
    draw();timer=setTimeout(()=>{if(recorder.state==='recording')stop('Recording stalled. Keep this tab active and try a lower resolution.');},(duration+15)*1000);

    const blob=await result;if(!blob.size)throw Error('The video encoder returned an empty file.');return blob;
  }finally{cleanup();}
}
