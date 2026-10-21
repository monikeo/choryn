export const MAX_IMAGES=100;
export function planImages(project,{mode='current',ids=[],time=0,start=0,end=project.duration,every=8,unit='counts'}={}){
 const valid=t=>typeof t==='number'&&Number.isFinite(t)&&t>=0&&t<=project.duration;
 if(mode==='current'){if(!valid(time))throw Error('Choose a time inside the performance.');const f=[...project.formations].reverse().find(f=>f.time<=time)||project.formations[0];return [{time,label:f.name,formationId:f.id}];}
 if(mode==='formations'){const wanted=new Set(ids),frames=project.formations.filter(f=>wanted.has(f.id)).map(f=>({time:f.time,label:f.name,formationId:f.id}));if(!frames.length)throw Error('Select at least one formation.');return frames;}
 if(mode!=='timeline'||!valid(start)||!valid(end)||end<start)throw Error('Choose a timeline range inside the performance.');
 if(!['counts','seconds'].includes(unit)||!Number.isFinite(every)||every<=0)throw Error('Enter a positive count or second interval.');
 const step=unit==='counts'?every*60/project.bpm:every;if(step<.001)throw Error('Use an interval of at least 0.001 seconds.');const count=Math.floor((end-start)/step+1e-8)+1;
 if(count>MAX_IMAGES)throw Error(`This range creates more than ${MAX_IMAGES} images. Increase the interval or shorten the range.`);
 const result=Array.from({length:count},(_,i)=>({time:Math.min(end,Math.round((start+i*step)*1e6)/1e6),label:'Timeline sample'}));
 if(end-result[result.length-1].time>1e-6)result.push({time:end,label:'Timeline end'});if(result.length>MAX_IMAGES)throw Error(`Use up to ${MAX_IMAGES} images per batch.`);return result;
}
export function safeImageName(value){return String(value||'formation').normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/[. ]+$/g,'').slice(0,100)||'formation';}
export function imageFilename(frame,index,format){const extension={png:'png',jpeg:'jpg',svg:'svg'}[format];if(!extension)throw Error('Choose PNG, JPEG or SVG.');return `${String(index+1).padStart(3,'0')}-${safeImageName(frame.label)}-${frame.time.toFixed(3)}s.${extension}`;}
export function selectedClipRange(project,selection){
 const {kind,id}=selection||{};if(kind==='formation'){const i=project.formations.findIndex(f=>f.id===id);if(i>=0)return {start:project.formations[i].time,end:project.formations[i+1]?.time??project.duration};}
 if(kind==='movement'){const a=project.actions.find(a=>a.id===id);if(a)return {start:a.start,end:a.end};}
 if(kind==='cue'){const c=project.cues.find(c=>c.id===id);if(c)return {start:c.time,end:Math.min(project.duration,c.time+8*60/project.bpm)};}
 return {start:0,end:project.duration};
}
