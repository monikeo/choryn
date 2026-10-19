import {uid,clone,transitionSettings} from './engine.js';
import {getRoute} from './production-model.js';
export function updatedCurveRoute(project,formationId,performerId,index,point){
 const at=project.formations.findIndex(f=>f.id===formationId),from=project.formations[at],to=project.formations[at+1],original=getRoute(project,formationId,to?.id,performerId);
 if(!to||from.status==='approved'||original?.locked)throw Error('Unlock the formation and route before shaping this curve.');
 if(!project.performers.some(p=>p.id===performerId))throw Error('Choose a performer on this stage.');
 const settings=transitionSettings(project,from),route=original?clone(original):{id:uid(),fromId:formationId,toId:to.id,performerId,duration:Math.min(settings.duration,to.time-from.time),delay:0,easing:settings.easing,locked:false,waypoints:[]};
 if(!Number.isInteger(index)||index<0||index>route.waypoints.length||index>=12)throw Error('Use up to 12 curve controls per route.');
 if(point===null){if(index>=route.waypoints.length)throw Error('This automatic control has no saved point to remove.');route.waypoints.splice(index,1);}
 else{if(!Number.isFinite(point.x)||!Number.isFinite(point.z)||Math.abs(point.x)>100||Math.abs(point.z)>100)throw Error('Keep curve controls within 100 meters.');route.waypoints[index]={x:Math.round(point.x*1000)/1000,z:Math.round(point.z*1000)/1000};}
 route.curve='smooth';return route;
}
