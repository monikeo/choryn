// Camera-only transforms. Choreography stays in canonical stage meters.
export function captureViewport(source,target){
 const width=source?.width>0?source.width:target.width,height=source?.height>0?source.height:target.height,scale=Math.min(target.width/width,target.height/height),w=width*scale,h=height*scale;
 return {x:(target.width-w)/2,y:(target.height-h)/2,width:w,height:h};
}
export function viewVector(x,y,rotation=0,mirror=false,flip=false){
  const a=rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);x*=mirror?-1:1;y*=flip?-1:1;
  return {x:c*x-s*y,y:s*x+c*y};
}
export function worldDelta(x,y,rotation=0,mirror=false,flip=false){
  const a=-rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return {x:(c*x-s*y)*(mirror?-1:1),z:-(s*x+c*y)*(flip?-1:1)};
}
export function stageViewBox(project,rotation=0){
  const a=rotation*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a)),w=project.stage.width*60+110,h=project.stage.depth*60+140;
  const width=w*c+h*s,height=w*s+h*c;
  return {x:project.stage.width*30-width/2,y:project.stage.depth*30-height/2,width,height};
}
export function readableTransform(x,y,rotation=0,mirror=false,flip=false){return `translate(${x} ${y}) scale(${mirror?-1:1} ${flip?-1:1}) rotate(${-rotation}) translate(${-x} ${-y})`;}
export function edgeLabelAngle(baseAngle,rotation=0,mirror=false,flip=false){const a=baseAngle*Math.PI/180,p=viewVector(Math.cos(a),Math.sin(a),rotation,mirror,flip);let angle=Math.atan2(p.y,p.x)*180/Math.PI;if(angle>90)angle-=180;if(angle<-90)angle+=180;return angle;}
export function edgeTextTransform(x,y,baseAngle,rotation=0,mirror=false,flip=false){return `${readableTransform(x,y,rotation,mirror,flip)} rotate(${edgeLabelAngle(baseAngle,rotation,mirror,flip)} ${x} ${y})`;}
export function audienceDirection(rotation=0,mirror=false,flip=false){const p=viewVector(0,1,rotation,mirror,flip);return Math.abs(p.x)>Math.abs(p.y)?p.x>0?'right →':'left ←':p.y>0?'down ↓':'up ↑';}
