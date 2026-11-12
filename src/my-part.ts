import type {Pose,Project} from './types.js';
import {transitionSettings} from './engine.js';
import {formatCount} from './music-model.js';

/**
 * "My part": one performer's show in plain words. For each formation: when it
 * starts (phrase.count), where to stand (stage area), which way to face, who is
 * beside you and how you travel there. Stage left and right are the performer's
 * own, facing the audience (+x is the audience's right, which is stage left).
 */
export interface PartStep {formationId:string; name:string; time:number; count:string; x:number; z:number; visible:boolean; area:string; facing:string; neighbours:string[]; travel:{distance:number;direction:string;counts:number}|null; notes:string}

export function stageArea(x:number,z:number,stage:{width:number;depth:number}){
  const depth=z< -stage.depth/6?'Downstage':z>stage.depth/6?'Upstage':'Centre stage',side=x>stage.width/6?'left':x< -stage.width/6?'right':'';
  return side?`${depth==='Centre stage'?'Centre':depth} ${side}`:depth==='Centre stage'?'Centre stage':`${depth} centre`;
}
export function facingWords(facing:number){
  const a=((Math.round(facing)%360)+360)%360;
  if(a<=22||a>=338)return 'Face the audience';if(a>=158&&a<=202)return 'Face upstage';
  if(a>22&&a<158)return a>=68&&a<=112?'Face right (90°)':`Face ${a}° (toward the right)`;
  return a>=248&&a<=292?'Face left (270°)':`Face ${a}° (toward the left)`;
}
export function travelDirection(dx:number,dz:number){
  const parts:string[]=[];if(Math.abs(dz)>.25)parts.push(dz<0?'downstage':'upstage');if(Math.abs(dx)>.25)parts.push(dx>0?'stage left':'stage right');
  return parts.length?`toward ${parts.join(' ')}`:'in place';
}

export function myPart(project:Project,performerId:string):PartStep[]{
  const person=project.performers.find(p=>p.id===performerId);if(!person)throw Error('Choose a performer.');
  const names=new Map(project.performers.map(p=>[p.id,p.name])),offset=project.music?.beatOffset||0;
  let previous:Pose|undefined;
  return project.formations.map((f,i)=>{
    const pos=f.positions.find(p=>p.performerId===performerId)!,visible=pos.visible!==false;
    const neighbours=visible?f.positions.filter(p=>p.performerId!==performerId&&p.visible!==false).map(p=>({id:p.performerId,d:Math.hypot(p.x-pos.x,p.z-pos.z)})).sort((a,b)=>a.d-b.d).slice(0,2).filter(n=>n.d<3).map(n=>names.get(n.id)||''):[];
    let travel:PartStep['travel']=null;
    if(previous&&i>0){
      const dx=pos.x-previous.x,dz=pos.z-previous.z,distance=Math.hypot(dx,dz),from=project.formations[i-1],route=(project.routes||[]).find(r=>r.fromId===from.id&&r.toId===f.id&&r.performerId===performerId);
      const window=Math.min(f.time-from.time,route?route.duration:transitionSettings(project,from).duration),seconds=route?Math.max(.1,window-Math.min(route.delay,window)-(route.settle||0)):window;
      if(distance>.05)travel={distance:Math.round(distance*10)/10,direction:travelDirection(dx,dz),counts:Math.max(1,Math.round(seconds*project.bpm/60))};
    }
    previous=pos;
    return {formationId:f.id,name:f.name,time:f.time,count:formatCount(f.time,project.bpm,offset),x:pos.x,z:pos.z,visible,area:visible?stageArea(pos.x,pos.z,project.stage):'Offstage',facing:facingWords(pos.facing),neighbours,travel,notes:f.notes};
  });
}
