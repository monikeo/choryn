import {localId,cloneData} from './compat.js';
export const PROP_SHAPES=['rectangle','ellipse','triangle'];
const numbers={x:[-100,100],z:[-100,100],width:[.1,50],depth:[.1,50],height:[0,20],rotation:[-360,360]};
export function validatePropPose(source){
 const pose={};for(const [key,[min,max]] of Object.entries(numbers)){const v=source[key]??(key==='rotation'?0:undefined);if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('Invalid prop pose.');pose[key]=v;}
 if(!/^#[\da-f]{6}$/i.test(source.color))throw Error('Invalid prop color.');pose.color=source.color;pose.shape=PROP_SHAPES.includes(source.shape)?source.shape:'rectangle';return pose;
}
export function validatePropAnimation(prop,duration){
 const pose=validatePropPose(prop),frames=prop.keyframes??[];if(!Array.isArray(frames)||frames.length>100)throw Error('Use up to 100 keyframes per prop.');const ids=new Set(),times=new Set();
 const keyframes=frames.map(f=>{if(!f||!/^[-\w]{1,100}$/.test(f.id)||ids.has(f.id)||typeof f.time!=='number'||!Number.isFinite(f.time)||f.time<0||f.time>duration||times.has(f.time))throw Error('Invalid prop keyframe.');ids.add(f.id);times.add(f.time);return {id:f.id,time:f.time,...validatePropPose(f),easing:f.easing==='linear'?'linear':'smooth'};}).sort((a,b)=>a.time-b.time);
 return {...pose,keyframes};
}
const mixColor=(a,b,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
export function sampleProp(prop,time){
 if(!prop.keyframes?.length)return {...prop};
 const frames=[{...prop,time:0},...(prop.keyframes||[])].sort((a,b)=>a.time-b.time);let index=0;for(let i=0;i<frames.length;i++)if(frames[i].time<=time)index=i;const from=frames[index],to=frames[index+1];
 if(!to)return {...prop,...validatePropPose(from)};const raw=Math.max(0,Math.min(1,(time-from.time)/Math.max(.001,to.time-from.time))),t=to.easing==='linear'?raw:raw*raw*(3-2*raw),pose={...prop};
 for(const key of Object.keys(numbers))pose[key]=from[key]+(to[key]-from[key])*t;pose.rotation=from.rotation+(((to.rotation-from.rotation+540)%360)-180)*t;if(pose.rotation>360)pose.rotation-=360;if(pose.rotation<-360)pose.rotation+=360;pose.color=mixColor(from.color,to.color,t);pose.shape=from.shape;return pose;
}
export const sampleProps=(project,time)=>(project.props||[]).map(p=>sampleProp(p,time));
export function setPropPose(prop,time,pose,easing='smooth'){
 if(prop.locked)throw Error('Unlock the prop before editing.');if(!Number.isFinite(time)||time<0)throw Error('Choose a valid keyframe time.');const next=cloneData(prop),value=validatePropPose(pose);time=Math.round(time*1000)/1000;
 next.keyframes||=[];if(time===0&&!next.keyframes.length)return {...next,...value};
 if(time>0&&!next.keyframes.some(f=>f.time===0))next.keyframes.push({id:localId(),time:0,...validatePropPose(prop),easing:'smooth'});
 const existing=next.keyframes.find(f=>f.time===time);if(existing)Object.assign(existing,value,{easing});else{if(next.keyframes.length>=100)throw Error('This prop has reached its 100 keyframe limit.');next.keyframes.push({id:localId(),time,...value,easing});}next.keyframes.sort((a,b)=>a.time-b.time);return next;
}
export function propShapeSVG(prop,unit=60){const w=prop.width*unit,d=prop.depth*unit;return prop.shape==='ellipse'?`<ellipse cx="0" cy="0" rx="${w/2}" ry="${d/2}"/>`:prop.shape==='triangle'?`<path d="M0 ${-d/2}L${w/2} ${d/2}H${-w/2}Z"/>`:`<rect x="${-w/2}" y="${-d/2}" width="${w}" height="${d}" rx="${Math.min(4,w/8,d/8)}"/>`;}
