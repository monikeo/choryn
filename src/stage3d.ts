import type {Camera,StageOptions,Project,Pose,StageTarget} from './types.js';
import {safeCamera,bindCameraControls} from './camera-controls.js';
import {mountNavigationDock} from './navigation-dock.js';
import {observeSize} from './compat.js';
import {createStageFloor} from './stage-floor.js';

// ---------------------------------------------------------------------------
// Realistic WebGL stage.
//  - One vertex buffer holds three human body meshes (female, male, not
//    specified) plus markers, beams and the scene (stage set, props,
//    overlays). Performers are placed each frame with uniforms, so playback
//    never re-uploads geometry; the scene uploads only when it changes.
//  - Per-pixel lighting in linear space: hemisphere ambient, a shadowed key
//    light (shadow map with soft PCF), fill and rim lights, up to six stage
//    spotlights (scene lights and highlighted performers), filmic tone mapping.
//  - Two looks: Rehearsal light (bright studio, oak floor) and Show light
//    (dark house, black dance floor, haze, visible beams on featured dancers).
// ---------------------------------------------------------------------------

const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((v,n,i)=>v+n*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
export function multiply(a,b){const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let i=0;i<4;i++)out[c*4+r]+=a[i*4+r]*b[c*4+i];return out;}
export function cameraMatrix(eye,target,aspect){
  const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);
  const view=new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
  const f=1/Math.tan(Math.PI/7),near=.1,far=500;
  const projection=new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
  return multiply(projection,view);
}
export function projectPoint(matrix,p){const v=[...p,1],out=[0,0,0,0];for(let r=0;r<4;r++)for(let i=0;i<4;i++)out[r]+=matrix[i*4+r]*v[i];return out[3]>.01?[out[0]/out[3],out[1]/out[3],out[2]/out[3]]:null;}
/** Inverse of a column-major 4×4 matrix, or null when singular. */
export function invert(m){
  const [a00,a01,a02,a03,a10,a11,a12,a13,a20,a21,a22,a23,a30,a31,a32,a33]=m;
  const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
  let det=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;if(!det)return null;det=1/det;
  return new Float32Array([(a11*b11-a12*b10+a13*b09)*det,(a02*b10-a01*b11-a03*b09)*det,(a31*b05-a32*b04+a33*b03)*det,(a22*b04-a21*b05-a23*b03)*det,(a12*b08-a10*b11-a13*b07)*det,(a00*b11-a02*b08+a03*b07)*det,(a32*b02-a30*b05-a33*b01)*det,(a20*b05-a22*b02+a23*b01)*det,(a10*b10-a11*b08+a13*b06)*det,(a01*b08-a00*b10-a03*b06)*det,(a30*b04-a31*b02+a33*b00)*det,(a21*b02-a20*b04-a23*b00)*det,(a11*b07-a10*b09-a12*b06)*det,(a00*b09-a01*b07+a02*b06)*det,(a31*b01-a30*b03-a32*b00)*det,(a20*b03-a21*b01+a22*b00)*det]);
}
/** World point on the stage floor (y = height) under a screen point in NDC, or null when looking away from it. */
export function floorPointAt(matrix,nx,ny,height=0){
  const inverse=invert(matrix);if(!inverse)return null;
  const unproject=z=>{const v=[nx,ny,z,1],o=[0,0,0,0];for(let r=0;r<4;r++)for(let i=0;i<4;i++)o[r]+=inverse[i*4+r]*v[i];return o[3]?[o[0]/o[3],o[1]/o[3],o[2]/o[3]]:null;};
  const near=unproject(-1),far=unproject(1);if(!near||!far)return null;
  const dy=far[1]-near[1];if(Math.abs(dy)<1e-6)return null;const t=(height-near[1])/dy;if(t<0)return null;
  return {x:near[0]+(far[0]-near[0])*t,z:near[2]+(far[2]-near[2])*t};
}
const rgb=hex=>/^#[\da-f]{6}$/i.test(hex||'')?[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255):[.52,.4,.84];
const stageReferences=new WeakMap();let nextStageReference=0;
const stageReference=value=>{if(!value)return 0;if(!stageReferences.has(value))stageReferences.set(value,++nextStageReference);return stageReferences.get(value);};
export function stageSceneKey(project: Project,positions: Pose[],selected){return JSON.stringify([project.stage.width,project.stage.depth,stageReference(project.production?.stage),project.sceneLights,project.sceneSafety?.map(v=>[v.type,v.ids]),project.performers.map(p=>[p.id,p.number,p.name,p.color,p.costume]),(project.props||[]).map(p=>[p.id,p.x,p.z,p.width,p.depth,p.height,p.rotation,p.shape,p.color]),positions,[...selected].sort()]);}

// ---- Look preference (shared by the live view, exports and the second screen) ----
export type StageLook={look:'rehearsal'|'show';set:boolean};
const LOOK_KEY='choryn.stage3d.v1';
export function stageLookSettings():StageLook{try{const v=JSON.parse(globalThis.localStorage?.getItem(LOOK_KEY)||'{}');return {look:v.look==='show'?'show':'rehearsal',set:v.set!==false};}catch{return {look:'rehearsal',set:true};}}
export function setStageLook(next:Partial<StageLook>):StageLook{const value={...stageLookSettings(),...next};try{globalThis.localStorage?.setItem(LOOK_KEY,JSON.stringify(value));}catch{}return value;}

// ---- Mesh building ----------------------------------------------------------
// Vertex: position(3) normal(3) color(3) material(kind, gloss, emissive) = 12 floats.
export const FLOATS_PER_VERTEX=12;
// Set pieces (velvet, cyclorama, rig) are cut away wherever they would hide the dance area.
const K={plain:0,floor:1,velvet:2,skin:3,costume:4,hair:5,leg:6,glow:7,cyc:8,shoe:9,ring:10,mark:11,beam:12,rig:13,grid:14};
const mat=(kind,gloss=.3,emissive=0)=>[kind,gloss,emissive];
const WHITE=[1,1,1];
function vertex(out,p,n,c,m){out.push(p[0],p[1],p[2],n[0],n[1],n[2],c[0],c[1],c[2],m[0],m[1],m[2]);}
function tri(out,a,b,c,color,m){const n=norm(cross(sub(b,a),sub(c,a)));vertex(out,a,n,color,m);vertex(out,b,n,color,m);vertex(out,c,n,color,m);}
function box(out,x,y,z,w,h,d,color,m=mat(K.plain),rotation=0){
  const points=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(p=>{const a=rotation*Math.PI/180,dx=p[0]*w/2,dz=p[2]*d/2;return [x+dx*Math.cos(a)-dz*Math.sin(a),y+p[1]*h/2,z+dx*Math.sin(a)+dz*Math.cos(a)];});
  for(const [a,b,c,e] of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]){tri(out,points[a],points[b],points[c],color,m);tri(out,points[a],points[c],points[e],color,m);}
}
function cylinder(out,x,y,z,r,h,color,m=mat(K.plain),segments=12){
  for(let i=0;i<segments;i++){
    const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2,p=[x+Math.cos(a)*r,y-h/2,z+Math.sin(a)*r],q=[x+Math.cos(b)*r,y-h/2,z+Math.sin(b)*r],t=[p[0],y+h/2,p[2]],u=[q[0],y+h/2,q[2]];
    tri(out,p,t,u,color,m);tri(out,p,u,q,color,m);tri(out,[x,y+h/2,z],u,t,color,m);tri(out,[x,y-h/2,z],p,q,color,m);
  }
}
function ring(out,x,y,z,inner,outer,color,m,segments=32){for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2,pt=(angle,r)=>[x+Math.cos(angle)*r,y,z+Math.sin(angle)*r],n=[0,1,0];for(const p of [pt(a,inner),pt(b,inner),pt(b,outer),pt(a,inner),pt(b,outer),pt(a,outer)])vertex(out,p,n,color,m);}}
/** Smooth ellipsoid; `keep` (unit-sphere direction) trims it, e.g. to leave the face clear of hair. */
function ellipsoid(out,c,r,color,m,seg=10,rings=7,keep?:(u:number[])=>boolean){
  const at=(t,p)=>{const u=[Math.sin(t)*Math.cos(p),Math.cos(t),Math.sin(t)*Math.sin(p)];return {u,pos:[c[0]+u[0]*r[0],c[1]+u[1]*r[1],c[2]+u[2]*r[2]],n:norm([u[0]/r[0],u[1]/r[1],u[2]/r[2]])};};
  for(let i=0;i<rings;i++)for(let j=0;j<seg;j++){
    const t0=i/rings*Math.PI,t1=(i+1)/rings*Math.PI,p0=j/seg*Math.PI*2,p1=(j+1)/seg*Math.PI*2,a=at(t0,p0),b=at(t1,p0),d=at(t1,p1),e=at(t0,p1);
    if(keep&&!keep(norm([(a.u[0]+d.u[0])/2,(a.u[1]+d.u[1])/2,(a.u[2]+d.u[2])/2])))continue;
    for(const v of [a,b,d,a,d,e])vertex(out,v.pos,v.n,color,m);
  }
}
/** Tapered limb from a to b with a rounded joint at a. */
function limb(out,a,b,ra,rb,color,m,seg=9){
  const axis=sub(b,a),length=Math.hypot(...axis)||1,k=axis.map(v=>v/length),helper=Math.abs(k[1])<.9?[0,1,0]:[1,0,0],e1=norm(cross(k,helper)),e2=cross(k,e1);
  const slope=(ra-rb)/length;
  for(let i=0;i<seg;i++){
    const t0=i/seg*Math.PI*2,t1=(i+1)/seg*Math.PI*2,dir=t=>e1.map((v,n)=>v*Math.cos(t)+e2[n]*Math.sin(t)),d0=dir(t0),d1=dir(t1);
    const p=(d,r,base)=>base.map((v,n)=>v+d[n]*r),nm=d=>norm(d.map((v,n)=>v+k[n]*slope));
    const A0=p(d0,ra,a),A1=p(d1,ra,a),B0=p(d0,rb,b),B1=p(d1,rb,b);
    vertex(out,A0,nm(d0),color,m);vertex(out,B0,nm(d0),color,m);vertex(out,B1,nm(d1),color,m);
    vertex(out,A0,nm(d0),color,m);vertex(out,B1,nm(d1),color,m);vertex(out,A1,nm(d1),color,m);
  }
  ellipsoid(out,a,[ra,ra,ra],color,m,8,5);
}

// ---- Bodies -------------------------------------------------------------------
// Local metres, feet on y=0, facing +Z (rotated by each performer's facing).
// Proportions follow common adult averages; identity changes height, shoulder
// to hip ratio and hair length only.
export type BodyKind='female'|'male'|'neutral';
const BODIES:Record<BodyKind,{h:number;shoulder:number;hip:number;waist:number;chest:number;limb:number;hair:'long'|'short'|'medium'}>={
  female:{h:1.67,shoulder:.37,hip:.36,waist:.255,chest:.215,limb:.94,hair:'long'},
  male:{h:1.78,shoulder:.45,hip:.33,waist:.295,chest:.24,limb:1.06,hair:'short'},
  neutral:{h:1.72,shoulder:.41,hip:.345,waist:.275,chest:.225,limb:1,hair:'medium'}
};
export const bodyHeight=(kind:BodyKind)=>BODIES[kind].h;
export function bodyMesh(kind:BodyKind):number[]{
  const b=BODIES[kind],h=b.h,out=[],y=f=>f*h,L=b.limb;
  const skin=mat(K.skin,.35),cloth=mat(K.costume,.22),leg=mat(K.leg,.2),hair=mat(K.hair,.55),shoe=mat(K.shoe,.6);
  for(const s of [-1,1]){
    ellipsoid(out,[s*b.hip*.27,.04,.04],[.05,.04,.12],WHITE,shoe);
    const hipJoint=[s*b.hip*.27,y(.49),0],knee=[s*b.hip*.245,y(.275),.014],ankle=[s*b.hip*.26,.085,0];
    limb(out,hipJoint,knee,.074*L,.053*L,WHITE,leg);limb(out,knee,ankle,.051*L,.036*L,WHITE,leg);
  }
  ellipsoid(out,[0,y(.51),0],[b.hip/2,y(.062),b.chest*.5],WHITE,leg);
  ellipsoid(out,[0,y(.605),0],[b.waist/2,y(.085),b.chest*.43],WHITE,cloth);
  ellipsoid(out,[0,y(.705),kind==='female'?.012:0],[b.shoulder*.43,y(.095),b.chest*.5],WHITE,cloth,12,8);
  for(const s of [-1,1]){
    ellipsoid(out,[s*b.shoulder*.42,y(.785),0],[.056,.05,.056],WHITE,cloth,8,6);
    const shoulder=[s*b.shoulder*.47,y(.785),0],elbow=[s*(b.shoulder*.5+.035),y(.615),-.015],wrist=[s*(b.shoulder*.5+.055),y(.47),.035];
    limb(out,shoulder,elbow,.047*L,.039*L,WHITE,cloth);limb(out,elbow,wrist,.037*L,.028*L,WHITE,skin);
    ellipsoid(out,[wrist[0],wrist[1]-.055,wrist[2]+.005],[.027,.06,.04],WHITE,skin,8,5);
  }
  limb(out,[0,y(.83),0],[0,y(.878),.006],.049,.046,WHITE,skin);
  const head=[0,y(.935),.008],hr=kind==='female'?[.08,.106,.095]:[.085,.11,.1];
  ellipsoid(out,head,hr,WHITE,skin,12,9);
  ellipsoid(out,[0,head[1]-.012,head[2]+hr[2]*.94],[.014,.022,.024],WHITE,skin,6,4);// nose: shows facing
  ellipsoid(out,[0,head[1]+.014,head[2]-.008],[hr[0]*1.08,hr[1]*1.04,hr[2]*1.08],WHITE,hair,12,9,u=>u[1]>-.12&&!(u[2]>.3&&u[1]<.58));
  if(b.hair==='long')ellipsoid(out,[0,head[1]-.075,head[2]-.05],[hr[0]*1.14,.135,.072],WHITE,hair,10,7,u=>u[2]<.35);
  else if(b.hair==='medium')ellipsoid(out,[0,head[1]-.035,head[2]-.052],[hr[0]*1.06,.085,.06],WHITE,hair,10,6,u=>u[2]<.25);
  return out;
}
function markerMesh(){const out=[];ring(out,0,.008,0,0,.33,WHITE,mat(K.mark,.1),28);const n=[0,1,0],y=.012;for(const p of [[0,y,.62],[.15,y,.36],[-.15,y,.36]])vertex(out,p,n,WHITE,mat(K.mark,.1,.25));return out;}
function ringMesh(){const out=[];ring(out,0,.016,0,.4,.47,WHITE,mat(K.ring),40);return out;}
function beamMesh(){const out=[],top=7.2,r=.95,seg=28;for(let i=0;i<seg;i++){const a=i/seg*Math.PI*2,b=(i+1)/seg*Math.PI*2,p=[Math.cos(a)*r,0,Math.sin(a)*r],q=[Math.cos(b)*r,0,Math.sin(b)*r],apex=[0,top,0],n=norm([Math.cos((a+b)/2),r/top,Math.sin((a+b)/2)]);for(const v of [apex,p,q])vertex(out,v,n,[1,.93,.78],mat(K.beam));}return out;}

interface Template {start:number;count:number}
let TEMPLATE_DATA:Float32Array|null=null,TEMPLATES:Record<string,Template>|null=null;
/** Built once per page: all bodies and markers in one block at the start of the buffer. */
export function templateBlock(){
  if(TEMPLATE_DATA)return {data:TEMPLATE_DATA,templates:TEMPLATES};
  const parts:[string,number[]][]=[['female',bodyMesh('female')],['male',bodyMesh('male')],['neutral',bodyMesh('neutral')],['marker',markerMesh()],['ring',ringMesh()],['beam',beamMesh()]];
  const all=[],templates={};for(const [name,data] of parts){templates[name]={start:all.length/FLOATS_PER_VERTEX,count:data.length/FLOATS_PER_VERTEX};for(const v of data)all.push(v);}
  TEMPLATE_DATA=new Float32Array(all);TEMPLATES=templates;return {data:TEMPLATE_DATA,templates:TEMPLATES};
}

// ---- Scene (stage set, props, overlays) -----------------------------------------
function sceneGeometry(project: Project,positions: Pose[],ghosts=[],analysis,showGrid=true,setVisible=true){
  const casters=[],rest=[],cast=new Map(project.performers.map(p=>[p.id,p]));
  const unsafe=new Set((project.sceneSafety||[]).flatMap(v=>v.ids));
  const w=project.stage.width,d=project.stage.depth,deck=1.0;
  // Props cast shadows; everything else is lit only.
  for(const prop of project.props||[]){const h=Math.max(.05,prop.height),color=rgb(prop.color),m=mat(K.plain,.38);if(prop.shape==='rectangle'||!prop.shape){box(casters,prop.x,h/2,-prop.z,prop.width,h,prop.depth,color,m,prop.rotation||0);continue;}const n=prop.shape==='triangle'?3:28,a=(prop.rotation||0)*Math.PI/180,points=Array.from({length:n},(_,i)=>{const angle=i/n*Math.PI*2-Math.PI/2,vertexAt=prop.shape==='triangle'?[[0,-prop.depth/2],[prop.width/2,prop.depth/2],[-prop.width/2,prop.depth/2]][i]:[Math.cos(angle)*prop.width/2,Math.sin(angle)*prop.depth/2],dx=vertexAt[0],dz=vertexAt[1];return [prop.x+dx*Math.cos(a)-dz*Math.sin(a),-prop.z+dx*Math.sin(a)+dz*Math.cos(a)];});for(let i=0;i<n;i++){const p=points[i],q=points[(i+1)%n],b=[p[0],0,p[1]],c=[q[0],0,q[1]],t=[p[0],h,p[1]],u=[q[0],h,q[1]];tri(casters,b,t,u,color,m);tri(casters,b,u,c,color,m);tri(casters,[prop.x,h,-prop.z],u,t,color,m);tri(casters,[prop.x,0,-prop.z],b,c,color,m);}}
  // Stage deck: wood/marley top, black skirting, a light-strip lip on the apron.
  const top=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2]],floorMat=mat(K.floor,.55),n=[0,1,0];
  for(const i of [0,2,1,0,3,2])vertex(rest,top[i],n,[.7,.5,.32],floorMat);
  const skirt=[.03,.028,.035],skirtMat=mat(K.velvet,.05);
  box(rest,0,-deck/2,d/2+.002,w,deck,.004,skirt,skirtMat);box(rest,0,-deck/2,-d/2-.002,w,deck,.004,skirt,skirtMat);box(rest,-w/2-.002,-deck/2,0,.004,deck,d,skirt,skirtMat);box(rest,w/2+.002,-deck/2,0,.004,deck,d,skirt,skirtMat);
  box(rest,0,-.01,d/2+.012,w,.02,.024,[1,.96,.86],mat(K.glow,0,1.2));
  if(showGrid){const g=[.55,.52,.6],gm=mat(K.grid,.1,.15);for(let i=0;i<=w;i++)box(rest,i-w/2,.004,0,.012,.008,d,g,gm);for(let i=0;i<=d;i++)box(rest,0,.004,i-d/2,w,.008,.012,g,gm);}
  const centre=[.5,.42,.66],cm=mat(K.grid,.1,.3);box(rest,0,.007,0,.025,.01,d,centre,cm);box(rest,0,.007,0,w,.01,.025,centre,cm);
  const line=(a,b,color,width=.05)=>{const dx=b.x-a.x,dz=b.z-a.z;box(rest,(a.x+b.x)/2,.03,-(a.z+b.z)/2,Math.hypot(dx,dz),.02,width,color,mat(K.plain,.2,.5),Math.atan2(-dz,dx)*180/Math.PI);};
  for(const item of project.production?.stage.lines||[])line(item.a,item.b,[.5,.35,.75],.035);
  const outline=project.production?.stage.outline||[];outline.forEach((point,i)=>line(point,outline[(i+1)%outline.length],[.5,.35,.75],.06));
  if(setVisible){
    // House floor in front, cyclorama behind, black velvet legs in the wings, a border overhead and a lighting pipe.
    const house=[[-w/2-8,-deck,d/2],[w/2+8,-deck,d/2],[w/2+8,-deck,d/2+14],[-w/2-8,-deck,d/2+14]];for(const i of [0,2,1,0,3,2])vertex(rest,house[i],n,[.07,.065,.075],mat(K.plain,.15));
    const cz=-d/2-1.2,cyc=[[-w/2-3,-deck,cz],[w/2+3,-deck,cz],[w/2+3,7.5,cz],[-w/2-3,7.5,cz]];for(const i of [0,1,2,0,2,3])vertex(rest,cyc[i],[0,0,1],WHITE,mat(K.cyc,0));
    const legs=Math.max(2,Math.round(d/3)),velvet=[.035,.03,.04],vm=mat(K.velvet,.08);
    // Soft pleats: a sine fold with smooth normals so the velvet catches light like fabric.
    for(let i=0;i<legs;i++){const z=-d/2+(i+.5)*d/legs;for(const s of [-1,1]){const x=s*(w/2+.9),width=1.6,folds=5,amplitude=.07,steps=30,k=folds*2*Math.PI/width,at=j=>{const zz=z-width/2+j/steps*width,phase=k*(zz-z+width/2);return {p:x+Math.sin(phase)*amplitude,z:zz,n:norm([1,0,-amplitude*k*Math.cos(phase)])};};for(let j=0;j<steps;j++){const u=at(j),v=at(j+1),a=[u.p,-deck,u.z],b=[v.p,-deck,v.z],c=[v.p,6.4,v.z],e=[u.p,6.4,u.z];vertex(rest,a,u.n,velvet,vm);vertex(rest,b,v.n,velvet,vm);vertex(rest,c,v.n,velvet,vm);vertex(rest,a,u.n,velvet,vm);vertex(rest,c,v.n,velvet,vm);vertex(rest,e,u.n,velvet,vm);}}}
    box(rest,0,7.05,d/2-.4,w+2,.07,.07,[.16,.16,.18],mat(K.rig,.6));
    for(let i=0;i<7;i++){const x=(i-3)*(w+1)/7;box(rest,x,6.85,d/2-.4,.22,.3,.3,[.08,.08,.09],mat(K.rig,.55));box(rest,x,6.68,d/2-.32,.16,.04,.04,[1,.95,.8],mat(K.rig,0,1.2));}
  }
  for(const p of positions){if(p.visible===false||!unsafe.has(p.performerId))continue;ring(rest,p.x,.05,-p.z,.55,.62,[.86,.24,.32],mat(K.glow,0,1),24);}
  for(const cell of analysis?.cells||[])box(rest,cell.x,.04,-cell.z,cell.width,.02,cell.depth,rgb(cell.color),mat(K.plain,0,.6));
  for(const path of analysis?.paths||[])for(let i=1;i<path.points.length;i++)line(path.points[i-1],path.points[i],rgb(path.color),.08);
  for(const item of analysis?.comparison||[])if(item.from&&item.from.visible!==false){cylinder(rest,item.from.x,.055,-item.from.z,.38,.04,[.5,.4,.8],mat(K.plain,.1,.4),18);line(item.from,item.to,[.5,.4,.8]);}
  for(const frame of ghosts)for(const p of frame.positions){const person=cast.get(p.performerId);if(person)cylinder(rest,p.x,.045,-p.z,.34,.05,rgb(person.color).map(v=>v*.35+.6),mat(K.plain,.1,.35),16);}
  return {casters,rest};
}
function geometryKey(project: Project,positions: Pose[],ghosts,showGrid,setVisible){
  const unsafe=new Set((project.sceneSafety||[]).flatMap(v=>v.ids));
  return JSON.stringify([project.stage.width,project.stage.depth,stageReference(project.production?.stage),showGrid,setVisible,project.sceneSafety?.map(v=>[v.type,v.ids]),positions.filter(p=>unsafe.has(p.performerId)).map(p=>[p.performerId,p.x,p.z,p.visible]),(project.props||[]).map(p=>[p.id,p.x,p.z,p.width,p.depth,p.height,p.rotation,p.shape,p.color]),ghosts]);
}

// ---- Shaders -----------------------------------------------------------------------
const VERTEX=`attribute vec3 position;attribute vec3 normal;attribute vec3 color;attribute vec3 material;
uniform mat4 matrix;uniform mat4 lightMatrix;uniform vec4 figure;
varying vec3 vWorld;varying vec3 vNormal;varying vec3 vColor;varying vec3 vMaterial;varying vec4 vLightPos;
void main(){vec3 p=position;vec3 n=normal;if(figure.w>0.){float c=cos(figure.z),s=sin(figure.z);p=vec3(p.x*c-p.z*s,p.y,p.x*s+p.z*c)*figure.w+vec3(figure.x,0.,figure.y);n=vec3(n.x*c-n.z*s,n.y,n.x*s+n.z*c);}
vWorld=p;vNormal=n;vColor=color;vMaterial=material;vLightPos=lightMatrix*vec4(p,1.);gl_Position=matrix*vec4(p,1.);}`;
const fragment=(full:boolean)=>`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vWorld;varying vec3 vNormal;varying vec3 vColor;varying vec3 vMaterial;varying vec4 vLightPos;
uniform vec3 eye;uniform vec3 costume;uniform vec3 skin;uniform vec3 hair;uniform vec3 marker;
uniform vec4 state;uniform vec4 look;uniform vec3 stageBox;
uniform vec3 keyDir;uniform vec3 keyColor;uniform vec3 fillColor;uniform vec3 rimColor;uniform vec3 skyColor;uniform vec3 groundColor;uniform vec3 fogColor;
${full?'uniform vec4 spots[6];uniform vec3 spotColors[6];uniform float spotCount;uniform sampler2D shadowMap;uniform vec2 shadowTexel;':''}
vec3 lin(vec3 c){return pow(max(c,vec3(0.)),vec3(2.2));}
float hash(float n){return fract(sin(n)*43758.5453);}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
// True when the performance volume lies behind this point as seen from the camera.
bool hidesStage(vec3 p){vec3 inv=1./(p-eye+vec3(1e-5)),a=(vec3(-stageBox.x,0.,-stageBox.z)-eye)*inv,b=(stageBox-eye)*inv,lo=min(a,b),hi=max(a,b);float near=max(max(lo.x,lo.y),lo.z),far=min(min(hi.x,hi.y),hi.z);return far>max(near,1.);}
${full?`float unpack(vec4 c){return dot(c,vec4(1.,1./255.,1./65025.,1./16581375.));}
float shadowAt(vec3 N){if(look.w<.5)return 1.;vec3 p=vLightPos.xyz/vLightPos.w*.5+.5;if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.)return 1.;float bias=.0012+.003*(1.-max(dot(N,keyDir),0.));float s=0.;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){s+=step(p.z-bias,unpack(texture2D(shadowMap,p.xy+vec2(float(x),float(y))*shadowTexel)));}return s/9.;}`:'float shadowAt(vec3 N){return 1.;}'}
void main(){
 float kind=floor(vMaterial.x+.5),gloss=vMaterial.y,emissive=vMaterial.z;bool show=look.x>.5;
 if((kind==2.||kind==8.||kind==13.)&&vWorld.y>0.&&hidesStage(vWorld))discard;
 vec3 V=normalize(eye-vWorld);
 if(kind==10.){gl_FragColor=vec4(pow(aces(lin(marker)*1.3),vec3(1./2.2)),1.);return;}
 if(kind==12.){float h=clamp(vWorld.y/7.2,0.,1.);float edge=abs(dot(normalize(vNormal),V));float a=(1.-h)*smoothstep(0.,.06,vWorld.y)*(.22+.55*edge)*look.y;gl_FragColor=vec4(lin(vColor)*a*.32,1.);return;}
 vec3 base=lin(vColor);
 if(kind==3.)base=lin(skin);else if(kind==4.)base=lin(costume)*(1.-state.y*.6);else if(kind==5.)base=lin(hair);else if(kind==6.)base=lin(costume)*.3*(1.-state.y*.6)+vec3(.012);else if(kind==9.)base=vec3(.018,.016,.02);else if(kind==11.){base=mix(lin(costume),vec3(.25),.35);}else if(kind==14.&&show)base*=.22;
 if(kind==1.){
  if(show){base=vec3(.016,.015,.019);gloss=.42;}
  else{float plank=floor(vWorld.z/.15),off=hash(plank)*2.4,run=floor((vWorld.x+off+12.)/2.4),tone=hash(plank*7.13+run*3.71),grain=.5+.5*sin((vWorld.x+off)*41.+sin(vWorld.z*13.+plank*1.7)*2.5);
   base=lin(mix(vec3(.6,.42,.26),vec3(.77,.57,.37),tone)*(.86+.14*grain));float seam=max(step(.985,fract(vWorld.z/.15)),step(.996,fract((vWorld.x+off+12.)/2.4)));base*=1.-.4*seam;}
 }
 if(kind==8.){if(dot(normalize(vNormal),V)<0.)discard;float g=clamp((vWorld.y+1.)/8.5,0.,1.);base=show?mix(lin(vec3(.12,.07,.32)),lin(vec3(.015,.015,.04)),g):mix(lin(vec3(.86,.85,.9)),lin(vec3(.66,.66,.74)),g);emissive=show?.85:.55;}
 vec3 N=normalize(vNormal);if(dot(N,V)<0.)N=-N;
 float shin=mix(6.,90.,gloss),fres=pow(1.-max(dot(N,V),0.),5.);
 vec3 color=base*mix(groundColor,skyColor,N.y*.5+.5);
 float nl=max(dot(N,keyDir),0.),sh=shadowAt(N);
 color+=(base*nl+pow(max(dot(N,normalize(keyDir+V)),0.),shin)*gloss*vec3(.9))*keyColor*sh;
 color+=base*max(dot(N,normalize(vec3(.6,.45,.35))),0.)*fillColor;
 vec3 rimDir=normalize(vec3(-.15,.55,-.82));color+=base*max(dot(N,rimDir),0.)*rimColor;if(kind>=3.&&kind<=6.)color+=rimColor*fres*.45;
 ${full?`for(int i=0;i<6;i++){if(float(i)>=spotCount)break;vec4 s=spots[i];vec3 lp=vec3(s.x,6.6,s.y),L=normalize(lp-vWorld);float r=s.z*max(.12,(6.6-vWorld.y)/6.6),dist=length(vWorld.xz-s.xy),cone=1.-smoothstep(r*.72,r*1.04,dist);if(cone<=0.)continue;float lam=max(dot(N,L),0.),sp=pow(max(dot(N,normalize(L+V)),0.),shin)*gloss;color+=(base*lam+sp)*lin(spotColors[i])*s.w*cone;}`:''}
 if(state.x>.5&&kind>=3.&&kind<=6.)color+=lin(vec3(1.,.8,.42))*(fres*.7+.06);
 if(kind==1.)color+=skyColor*fres*(show?.05:.1);
 if(kind==2.)color=color*.55+base*fres*.6;
 color+=base*emissive;
 float dist=length(eye-vWorld),fog=show?(1.-exp(-dist*.014))*.42:(1.-exp(-dist*.006))*.22;color=mix(color,fogColor,fog);
 gl_FragColor=vec4(pow(aces(color*look.z),vec3(1./2.2)),1.);
}`;
const DEPTH_FRAGMENT=`precision mediump float;void main(){vec4 e=fract(vec4(1.,255.,65025.,16581375.)*gl_FragCoord.z);e-=e.yzww*vec4(1./255.,1./255.,1./255.,0.);gl_FragColor=e;}`;

// Lighting per look (linear RGB intensities).
const LIGHTING={
  rehearsal:{clear:[.93,.92,.95],sky:[.62,.62,.68],ground:[.32,.29,.27],key:[1.05,1,.94],fill:[.28,.3,.36],rim:[.22,.22,.28],fog:[.85,.84,.88],exposure:1.05,beam:0,spot:.9},
  show:{clear:[.012,.01,.018],sky:[.05,.045,.08],ground:[.012,.01,.012],key:[.42,.4,.38],fill:[.05,.05,.08],rim:[.34,.24,.62],fog:[.006,.005,.012],exposure:1.18,beam:1,spot:2.4}
};
const KEY_DIR=norm([-.32,.84,.44]);

export function mountStage3D(host,project: Project,positions: Pose[],options:StageOptions={}){
  host.classList.add('webgl-stage');host.classList.remove('spatial');host.replaceChildren();
  const interactive=options.interactive!==false,dragEnabled=interactive&&typeof options.onDragStart==='function';
  const canvas=document.createElement('canvas');canvas.tabIndex=interactive?0:-1;canvas.setAttribute('aria-label',interactive?`3D stage. Drag to orbit${dragEnabled?'; drag a performer or prop to move it':''}; right or middle drag pans. Wheel or pinch zooms. Open View controls for camera buttons.`:'3D stage preview');
  host.append(canvas);
  const gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:false});
  const fallback=()=>{host.innerHTML='<div class="stage3d-fallback"><strong>3D is unavailable on this device.</strong><p>You can keep editing and rehearsing in 2D.</p><button class="button" data-view="2d">Return to 2D</button></div>';};
  if(!gl){fallback();return {camera:options.camera||safeCamera({}),available:false,update(){},dispose(){}};}
  const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);throw Error('Shader compilation failed');}return shader;};
  const link=(vsSource,fsSource)=>{const vs=compile(gl.VERTEX_SHADER,vsSource),fs=compile(gl.FRAGMENT_SHADER,fsSource),program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);throw Error('3D program failed');}return {program,vs,fs};};
  // Full lighting first; a lighter shader keeps 3D available on very limited GPUs.
  let main,full=true,buffer;
  try{try{main=link(VERTEX,fragment(true));}catch{full=false;main=link(VERTEX,fragment(false));}buffer=gl.createBuffer();}catch{if(buffer)gl.deleteBuffer(buffer);fallback();return {camera:options.camera||safeCamera({}),available:false,update(){},dispose(){}};}
  const program=main.program;
  const controller=new AbortController(),signal=controller.signal;
  const floor=createStageFloor(gl,()=>requestDraw());floor.load(project.production?.stage.image?.data||'');
  const camera=(options.camera||{}) as Camera;Object.assign(camera,safeCamera(camera));let yaw=camera.yaw,pitch=camera.pitch,disposed=false,contextLost=false;
  let currentShowGrid=options.showGrid!==false,currentLabels=options.labels===true,looks=stageLookSettings();
  let current=project,currentPositions=positions,currentGhosts=options.ghosts||[],currentAnalysis=options.analysis,dirty=true,frame=0,fitKey='',fitDistance=0;
  let sceneKey=geometryKey(project,positions,currentGhosts,currentShowGrid,looks.set),sceneCounts={casters:0,rest:0},capacity=0,lastMatrix=null,lastRect=null;
  let cast=new Map(project.performers.map(p=>[p.id,p]));const labelNodes=new Map(),labelColors=new Map(),ghostNodes=new Map();
  const {data:templateData,templates}=templateBlock(),templateVertices=templateData.length/FLOATS_PER_VERTEX;
  const uniform=name=>gl.getUniformLocation(program,name);
  const U={matrix:uniform('matrix'),lightMatrix:uniform('lightMatrix'),figure:uniform('figure'),eye:uniform('eye'),costume:uniform('costume'),skin:uniform('skin'),hair:uniform('hair'),marker:uniform('marker'),state:uniform('state'),look:uniform('look'),stageBox:uniform('stageBox'),keyDir:uniform('keyDir'),keyColor:uniform('keyColor'),fillColor:uniform('fillColor'),rimColor:uniform('rimColor'),skyColor:uniform('skyColor'),groundColor:uniform('groundColor'),fogColor:uniform('fogColor'),spots:uniform('spots'),spotColors:uniform('spotColors'),spotCount:uniform('spotCount'),shadowMap:uniform('shadowMap'),shadowTexel:uniform('shadowTexel')};
  const attributes:{location:number;offset:number}[]=([['position',0],['normal',12],['color',24],['material',36]] as [string,number][]).map(([name,offset])=>({location:gl.getAttribLocation(program,name),offset})).filter(a=>a.location>=0);
  const STRIDE=FLOATS_PER_VERTEX*4;
  const bindMain=()=>{gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(const {location,offset} of attributes){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,STRIDE,offset);}};
  // Shadow map (needs framebuffers; quietly skipped where they are unavailable).
  let shadow=null;
  const setupShadows=()=>{
    if(!full||typeof gl.createFramebuffer!=='function'||typeof gl.createTexture!=='function'||typeof gl.createRenderbuffer!=='function')return null;
    try{
      const depth=link(VERTEX,DEPTH_FRAGMENT),size=matchMedia('(pointer: coarse)').matches?1024:2048,texture=gl.createTexture(),fbo=gl.createFramebuffer(),rb=gl.createRenderbuffer();
      gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
      gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);gl.bindRenderbuffer(gl.RENDERBUFFER,rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,size,size);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,rb);
      const ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      if(!ok){gl.deleteFramebuffer(fbo);gl.deleteRenderbuffer(rb);gl.deleteTexture(texture);gl.deleteProgram(depth.program);gl.deleteShader(depth.vs);gl.deleteShader(depth.fs);return null;}
      return {...depth,size,texture,fbo,rb,position:gl.getAttribLocation(depth.program,'position'),matrix:gl.getUniformLocation(depth.program,'matrix'),figure:gl.getUniformLocation(depth.program,'figure')};
    }catch{return null;}
  };
  shadow=setupShadows();
  const ghostLabels=document.createElement('div');ghostLabels.className='stage3d-labels stage3d-ghosts';host.append(ghostLabels);
  const analysisLabels=document.createElement('div');analysisLabels.className='stage3d-labels analysis-labels';host.append(analysisLabels);const analysisLabel=document.createElement('span');analysisLabels.append(analysisLabel);
  const labels=document.createElement('div');labels.className='stage3d-labels';host.append(labels);
  const captionDefault=dragEnabled?'Drag a performer or prop to move it · Drag the stage to orbit · Wheel/pinch zoom':'Drag orbit · Right/middle drag pan · Wheel/pinch zoom · View controls above';
  const caption=document.createElement('p');caption.className='stage3d-caption';caption.textContent=captionDefault;host.append(caption);
  // Look controls (interactive views only; exports and displays follow the saved look).
  let lookBar=null;
  if(interactive){
    lookBar=document.createElement('div');lookBar.className='stage3d-look';lookBar.setAttribute('role','group');lookBar.setAttribute('aria-label','3D lighting and set');
    lookBar.innerHTML='<button type="button" data-stage-look="rehearsal" aria-label="Rehearsal light">Rehearsal<span> light</span></button><button type="button" data-stage-look="show" aria-label="Show light">Show<span> light</span></button><button type="button" data-stage-set aria-label="Stage set: curtains, cyclorama and lighting rig" title="Curtains, cyclorama and lighting rig">Set</button>';
    const syncLook=()=>{for(const button of lookBar.querySelectorAll('[data-stage-look]'))button.setAttribute('aria-pressed',String(button.dataset.stageLook===looks.look));lookBar.querySelector('[data-stage-set]').setAttribute('aria-pressed',String(looks.set));host.dataset.look=looks.look;};
    lookBar.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest?.('button') as HTMLElement|null;if(!button)return;event.stopPropagation();if(button.dataset.stageLook)looks=setStageLook({look:button.dataset.stageLook==='show'?'show':'rehearsal'});else if(button.hasAttribute('data-stage-set'))looks=setStageLook({set:!looks.set});syncLook();dirty=true;sceneKey='';requestDraw();},{signal});
    syncLook();host.append(lookBar);
  }else host.dataset.look=looks.look;
  function requestDraw(){if(!disposed&&!frame)frame=requestAnimationFrame(()=>{frame=0;draw();});}
  function upload(scene:Float32Array){
    const total=templateData.length+scene.length;
    // Real GPUs keep the bodies resident and replace only the scene part.
    if(typeof gl.bufferSubData==='function'){if(total>capacity){capacity=Math.ceil(total*1.25);gl.bufferData(gl.ARRAY_BUFFER,capacity*4,gl.DYNAMIC_DRAW);gl.bufferSubData(gl.ARRAY_BUFFER,0,templateData);}gl.bufferSubData(gl.ARRAY_BUFFER,templateData.length*4,scene);}
    else{const all=new Float32Array(total);all.set(templateData);all.set(scene,templateData.length);gl.bufferData(gl.ARRAY_BUFFER,all,gl.DYNAMIC_DRAW);}
  }
  const visibleFigures=()=>{const out=[];for(const p of currentPositions){if(p.visible===false)continue;const person=cast.get(p.performerId);if(!person)continue;const body=person.identity==='female'?'female':person.identity==='male'?'male':'neutral';out.push({p,person,body});}return out;};
  const u3=(location,v)=>gl.uniform3f?.(location,v[0],v[1],v[2]),u4=(location,a,b,c,d)=>gl.uniform4f?.(location,a,b,c,d);
  const drawTemplate=(name)=>{const t=templates[name];gl.drawArrays(gl.TRIANGLES,t.start,t.count);};
  function lightMatrixFor(){const w=current.stage.width,d=current.stage.depth,radius=Math.hypot(w,d)/2+2.5,centre=[0,.8,0],eye=centre.map((v,i)=>v+KEY_DIR[i]*40),z=norm(sub(eye,centre)),x=norm(cross([0,1,0],z)),y=cross(z,x);const view=new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]),near=20,far=62;const ortho=new Float32Array([1/radius,0,0,0,0,1/radius,0,0,0,0,-2/(far-near),0,0,0,-(far+near)/(far-near),1]);return multiply(ortho,view);}
  function draw(){
    if(disposed||contextLost)return;
    const captionText=floor.error?'Floor plan unavailable · the 3D stage remains usable. Reimport the image to include it in exports.':captionDefault;if(caption.textContent!==captionText)caption.textContent=captionText;
    yaw=camera.yaw;pitch=camera.pitch;const started=performance.now();
    const rect=host.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
    const dpr=options.pixelRatio?Math.max(.25,Math.min(32,options.pixelRatio)):Math.min(window.devicePixelRatio||1,matchMedia('(pointer: coarse)').matches?1.5:2);
    const width=Math.max(1,Math.floor(rect.width*dpr)),height=Math.max(1,Math.floor(rect.height*dpr));if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
    const aspect=rect.width/rect.height;
    const key=[current.stage.width,current.stage.depth,aspect,yaw,pitch].join('/');
    if(key!==fitKey){
      const horizontal=current.stage.width*Math.abs(Math.cos(yaw))+current.stage.depth*Math.abs(Math.sin(yaw));
      const vertical=(current.stage.depth*Math.abs(Math.cos(yaw))+current.stage.width*Math.abs(Math.sin(yaw)))*Math.sin(pitch)+2.5;
      let fitted=Math.max(horizontal/(2*Math.tan(Math.PI/7)*aspect),vertical/(2*Math.tan(Math.PI/7)))*1.18;
      const corners=[];for(const x of [-current.stage.width/2,current.stage.width/2])for(const z of [-current.stage.depth/2,current.stage.depth/2])for(const y of [0,1.8])corners.push([x,y,z]);
      for(let step=0;step<16;step++){const eye=[Math.sin(yaw)*Math.cos(pitch)*fitted,Math.sin(pitch)*fitted,Math.cos(yaw)*Math.cos(pitch)*fitted],matrix=cameraMatrix(eye,[0,.2,0],aspect);if(corners.every(p=>{const q=projectPoint(matrix,p);return q&&Math.abs(q[0])<.91&&Math.abs(q[1])<.87;}))break;fitted*=1.08;}
      fitKey=key;fitDistance=fitted;
    }
    const distance=fitDistance/camera.zoom,target=camera.target||[0,.2,0];
    const eye=Array.isArray(options.eye)&&options.eye.length===3&&options.eye.every(Number.isFinite)?options.eye:[target[0]+Math.sin(yaw)*Math.cos(pitch)*distance,target[1]+Math.sin(pitch)*distance,target[2]+Math.cos(yaw)*Math.cos(pitch)*distance];
    const matrix=cameraMatrix(eye,target,aspect),light=LIGHTING[looks.look],lightMatrix=lightMatrixFor();
    lastMatrix=matrix;lastRect=rect;
    // Release attribute arrays left enabled by other programs (the floor-plan overlay).
    for(let i=0;i<8;i++)gl.disableVertexAttribArray?.(i);
    bindMain();
    if(dirty){const scene=sceneGeometry(current,currentPositions,currentGhosts,currentAnalysis,currentShowGrid,looks.set);sceneCounts={casters:scene.casters.length/FLOATS_PER_VERTEX,rest:scene.rest.length/FLOATS_PER_VERTEX};const block=new Float32Array(scene.casters.length+scene.rest.length);block.set(scene.casters);block.set(scene.rest,scene.casters.length);upload(block);dirty=false;}
    const figures=visibleFigures(),featured=new Set(current.sceneHighlights||[]),anyFeatured=figures.some(f=>featured.has(f.p.performerId));
    // 1. Shadow pass from the key light: performers and props.
    if(shadow){
      gl.bindFramebuffer(gl.FRAMEBUFFER,shadow.fbo);gl.viewport(0,0,shadow.size,shadow.size);gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.useProgram(shadow.program);
      for(const {location} of attributes)gl.disableVertexAttribArray?.(location);gl.enableVertexAttribArray(shadow.position);gl.vertexAttribPointer(shadow.position,3,gl.FLOAT,false,STRIDE,0);
      gl.uniformMatrix4fv(shadow.matrix,false,lightMatrix);
      u4(shadow.figure,0,0,0,0);if(sceneCounts.casters)gl.drawArrays(gl.TRIANGLES,templateVertices,sceneCounts.casters);
      for(const f of figures){u4(shadow.figure,f.p.x,-f.p.z,f.p.facing*Math.PI/180,1);drawTemplate(f.body);}
      gl.disableVertexAttribArray?.(shadow.position);gl.bindFramebuffer(gl.FRAMEBUFFER,null);bindMain();
    }
    // 2. Main pass.
    gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(light.clear[0],light.clear[1],light.clear[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.useProgram(program);
    u3(U.eye,eye);u3(U.stageBox,[current.stage.width/2+.3,2.3,current.stage.depth/2+.3]);u3(U.keyDir,KEY_DIR);u3(U.keyColor,light.key);u3(U.fillColor,light.fill);u3(U.rimColor,light.rim);u3(U.skyColor,light.sky);u3(U.groundColor,light.ground);u3(U.fogColor,light.fog);u3(U.skin,[.87,.7,.58]);u3(U.hair,[.16,.11,.09]);
    u4(U.look,looks.look==='show'?1:0,light.beam,light.exposure,shadow?1:0);
    if(full){
      // Stage lights at this moment, then follow spots on featured performers (six in total).
      const spots=[],colors=[];
      for(const l of current.sceneLights||[]){if(spots.length>=24||!(l.intensity>0))continue;spots.push(l.x,-l.z,Math.max(.4,l.radius),l.intensity*light.spot);colors.push(...rgb(l.color));}
      for(const f of figures){if(spots.length>=24)break;if(featured.has(f.p.performerId)){spots.push(f.p.x,-f.p.z,1.05,light.spot*1.15);colors.push(1,.94,.8);}}
      while(spots.length<24){spots.push(0,0,0,0);colors.push(0,0,0);}
      gl.uniform4fv?.(U.spots,new Float32Array(spots));gl.uniform3fv?.(U.spotColors,new Float32Array(colors));gl.uniform1f?.(U.spotCount,spots.filter((_,i)=>i%4===3).filter(v=>v>0).length);
      if(shadow){gl.activeTexture?.(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,shadow.texture);gl.uniform1i?.(U.shadowMap,1);gl.uniform2f?.(U.shadowTexel,1/shadow.size,1/shadow.size);}
    }
    // Light-space matrix first: the camera matrix is always the last matrix set in a frame.
    gl.uniformMatrix4fv(U.lightMatrix,false,lightMatrix);
    gl.uniformMatrix4fv(U.matrix,false,matrix);
    u4(U.figure,0,0,0,0);u4(U.state,0,0,0,0);u3(U.costume,[.5,.5,.5]);
    if(sceneCounts.casters+sceneCounts.rest)gl.drawArrays(gl.TRIANGLES,templateVertices,sceneCounts.casters+sceneCounts.rest);
    const selection=options.selected?.()||new Set();
    for(const f of figures){
      const lit=featured.has(f.p.performerId),dim=looks.look==='show'&&anyFeatured&&!lit?1:0;
      u4(U.figure,f.p.x,-f.p.z,f.p.facing*Math.PI/180,1);u3(U.costume,rgb(f.person.color));u4(U.state,lit?1:0,dim,0,0);
      drawTemplate(f.body);drawTemplate('marker');
      if(selection.has(f.p.performerId)){u3(U.marker,[.55,.38,.95]);drawTemplate('ring');}
      if(lit){u4(U.figure,f.p.x,-f.p.z,0,1.16);u3(U.marker,[1,.78,.3]);drawTemplate('ring');}
    }
    // 3. Visible beams over featured performers (Show light).
    if(light.beam>0&&anyFeatured&&typeof gl.blendFunc==='function'){
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.depthMask?.(false);
      for(const f of figures)if(featured.has(f.p.performerId)){u4(U.figure,f.p.x,-f.p.z,0,1);drawTemplate('beam');}
      gl.depthMask?.(true);gl.disable?.(gl.BLEND);
    }
    u4(U.figure,0,0,0,0);
    floor.draw(matrix,current.production?.stage.image);
    // Labels.
    const visibleLabels=new Set();
    for(const f of figures){
      const p=f.p,pos=projectPoint(matrix,[p.x,bodyHeight(f.body)+.24,-p.z]);if(!pos||Math.abs(pos[0])>1||Math.abs(pos[1])>1)continue;
      const person=f.person;let label=labelNodes.get(p.performerId);if(!label){label=document.createElement('button');label.onclick=interactive?event=>options.onSelect?.(p.performerId,!!(event?.shiftKey||event?.metaKey||event?.ctrlKey)):null;label.tabIndex=interactive?0:-1;label.setAttribute('role',interactive?'button':'img');label.style.color='var(--text)';labels.append(label);labelNodes.set(p.performerId,label);}
      visibleLabels.add(p.performerId);if(label.hidden)label.hidden=false;
      // A narrow live stage shows numbers only so labels do not bury the dancers (names stay in the tooltip); exports always keep names.
      const text=String(person.number).padStart(2,'0')+(currentLabels&&(!interactive||rect.width>=520)?' · '+person.name:''),title=person.name+(person.costume?' · '+person.costume:''),aria=`${interactive?'Select':'Performer'} ${person.name} in 3D`,left=`${(pos[0]*.5+.5)*100}%`,top=`${(-pos[1]*.5+.5)*100}%`;
      if(label.textContent!==text)label.textContent=text;if(label.title!==title){label.title=title;label.setAttribute('aria-label',aria);}if(label.style.left!==left)label.style.left=left;if(label.style.top!==top)label.style.top=top;if(labelColors.get(p.performerId)!==person.color){label.style.borderColor=person.color;labelColors.set(p.performerId,person.color);}
    }
    for(const [id,node] of labelNodes)if(!visibleLabels.has(id)&&!node.hidden)node.hidden=true;
    const liveGhosts=new Set();for(const ghost of currentGhosts)for(const p of ghost.positions){const pos=projectPoint(matrix,[p.x,.2,-p.z]);if(!pos||Math.abs(pos[0])>1||Math.abs(pos[1])>1)continue;const person=cast.get(p.performerId),key=`${ghost.time}/${p.performerId}`;liveGhosts.add(key);let label=ghostNodes.get(key);if(!label){label=document.createElement('span');ghostLabels.append(label);ghostNodes.set(key,label);}const text=`${ghost.label} · ${person?.number||''}`;if(label.textContent!==text)label.textContent=text;label.style.left=`${(pos[0]*.5+.5)*100}%`;label.style.top=`${(-pos[1]*.5+.5)*100}%`;}
    for(const [key,label] of ghostNodes)if(!liveGhosts.has(key)){label.remove();ghostNodes.delete(key);}
    const summary=currentAnalysis?.summary||'',hideSummary=!summary;if(analysisLabel.hidden!==hideSummary)analysisLabel.hidden=hideSummary;if(analysisLabel.textContent!==summary)analysisLabel.textContent=summary;
    options.onRenderCost?.(performance.now()-started);
  }
  let navigation=options.navigationMode==='pan'?'pan':'orbit';host.dataset.navigation=navigation;
  // Direct manipulation: press a performer or prop to select and drag it on the floor.
  // Registered before the camera controls so a hit never also orbits the camera.
  let drag:{target:StageTarget;pointerId:number;x:number;y:number;origin:{x:number;z:number};moved:boolean}|null=null;
  // Read the rectangle fresh: the page may have scrolled since the last frame.
  const ndc=(clientX,clientY)=>{const r=host.getBoundingClientRect();return [((clientX-r.left)/r.width)*2-1,1-((clientY-r.top)/r.height)*2];};
  const pick=(clientX,clientY):StageTarget|null=>{
    if(!lastMatrix||!lastRect)return null;
    const r=host.getBoundingClientRect(),px=clientX-r.left,py=clientY-r.top,toScreen=q=>q?[(q[0]*.5+.5)*r.width,(-q[1]*.5+.5)*r.height,q[2]]:null;
    let best=null,bestScore=Infinity;
    for(const f of visibleFigures()){const feet=toScreen(projectPoint(lastMatrix,[f.p.x,.05,-f.p.z])),head=toScreen(projectPoint(lastMatrix,[f.p.x,bodyHeight(f.body)*.95,-f.p.z]));if(!feet||!head)continue;const vx=head[0]-feet[0],vy=head[1]-feet[1],len=vx*vx+vy*vy||1,t=Math.max(0,Math.min(1,((px-feet[0])*vx+(py-feet[1])*vy)/len)),dx=px-(feet[0]+vx*t),dy=py-(feet[1]+vy*t),dist=Math.hypot(dx,dy),reach=Math.max(16,Math.sqrt(len)*.22);if(dist<reach&&dist+feet[2]*5<bestScore){bestScore=dist+feet[2]*5;best={kind:'performer',id:f.p.performerId};}}
    if(best)return best;
    const [nx,ny]=ndc(clientX,clientY),hit=floorPointAt(lastMatrix,nx,ny,0);if(!hit)return null;
    for(const prop of current.props||[]){if(!prop.id||(current.production?.zones||[]).some(z=>z.id===prop.id))continue;const a=-(prop.rotation||0)*Math.PI/180,dx=hit.x-prop.x,dz=-hit.z-prop.z,lx=dx*Math.cos(a)-dz*Math.sin(a),lz=dx*Math.sin(a)+dz*Math.cos(a);if(Math.abs(lx)<=prop.width/2+.1&&Math.abs(lz)<=prop.depth/2+.1)return {kind:'prop',id:prop.id};}
    return null;
  };
  const floorAt=(clientX,clientY)=>{if(!lastMatrix)return null;const [nx,ny]=ndc(clientX,clientY),hit=floorPointAt(lastMatrix,nx,ny,0);return hit?{x:hit.x,z:-hit.z}:null;};
  const endDrag=(commit:boolean)=>{const d=drag;if(!d)return;drag=null;try{if(canvas.hasPointerCapture?.(d.pointerId))canvas.releasePointerCapture(d.pointerId);}catch{}canvas.classList?.remove('stage-dragging');options.onDragEnd?.(d.target,commit&&d.moved);};
  if(dragEnabled){
    canvas.addEventListener('pointerdown',event=>{
      if(drag){endDrag(false);return;}// A second finger cancels the move and leaves gestures to the camera.
      if(event.button!==0||navigation==='pan'||!event.isPrimary)return;
      const target=pick(event.clientX,event.clientY);if(!target)return;
      event.preventDefault();event.stopImmediatePropagation();canvas.focus({preventScroll:true});
      if(target.kind==='performer')options.onSelect?.(target.id,event.shiftKey||event.metaKey||event.ctrlKey);
      if(!options.onDragStart(target))return;
      const origin=floorAt(event.clientX,event.clientY);if(!origin){options.onDragEnd?.(target,false);return;}
      drag={target,pointerId:event.pointerId,x:event.clientX,y:event.clientY,origin,moved:false};try{canvas.setPointerCapture(event.pointerId);}catch{}canvas.classList?.add('stage-dragging');
    },{signal});
    canvas.addEventListener('pointermove',event=>{
      if(drag&&event.pointerId===drag.pointerId){event.stopImmediatePropagation();if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<(event.pointerType==='touch'?8:4))return;drag.moved=true;const p=floorAt(event.clientX,event.clientY);if(p)options.onDragMove?.(drag.target,p.x-drag.origin.x,p.z-drag.origin.z);return;}
      if(!drag&&event.pointerType==='mouse'&&event.buttons===0&&navigation!=='pan')canvas.style.cursor=pick(event.clientX,event.clientY)?'grab':'';
    },{signal});
    canvas.addEventListener('pointerup',event=>{if(drag&&event.pointerId===drag.pointerId){event.stopImmediatePropagation();endDrag(true);}},{signal});
    for(const type of ['pointercancel','lostpointercapture'])canvas.addEventListener(type,(event:PointerEvent)=>{if(drag&&event.pointerId===drag.pointerId)endDrag(false);},{signal});
    canvas.addEventListener('keydown',event=>{if(event.key==='Escape'&&drag){event.preventDefault();event.stopImmediatePropagation();endDrag(false);}},{signal});
  }
  const metrics=()=>{const rect=host.getBoundingClientRect();return {width:rect.width,height:rect.height,distance:(fitDistance||Math.max(current.stage.width,current.stage.depth)*1.4)/camera.zoom};};
  const changed=()=>{options.onCameraChange?.(camera);requestDraw();};
  const reset=()=>{options.onManualPan?.();Object.assign(camera,{yaw:.15,pitch:.68,zoom:1,target:[0,.2,0]});changed();};
  const controls=interactive?bindCameraControls(canvas,{camera,metrics,changed,mode:()=>navigation,manualPan:()=>options.onManualPan?.(),following:()=>options.following?.()||false,reset,signal}):null;
  const dock=interactive?mountNavigationDock(host,{kind:'spatial',getMode:()=>navigation,mode:value=>{navigation=value;host.dataset.navigation=value;options.onNavigationMode?.(value);},pan:controls.pan,orbit:controls.orbit,zoom:controls.zoom,fit:reset,focus:()=>options.onFocus?.(),signal}):null;
  canvas.addEventListener('webglcontextlost',event=>{if(!disposed){event.preventDefault();contextLost=true;fallback();}},{signal});
  const resize=observeSize(host,requestDraw);requestDraw();
  return {camera,get available(){return !disposed&&!contextLost;},get ready(){return floor.ready;},
   update(project: Project,positions: Pose[],extras:StageOptions={}){
    if(disposed||contextLost)return;
    const grid=extras.showGrid??currentShowGrid;if(grid!==currentShowGrid){currentShowGrid=grid;dirty=true;}currentLabels=extras.labels??currentLabels;
    if(interactive&&extras.navigationMode){const next=extras.navigationMode==='pan'?'pan':'orbit';if(next!==navigation){navigation=next;host.dataset.navigation=next;dock?.sync();}}
    const ghosts=extras.ghosts||currentGhosts;floor.load(project.production?.stage.image?.data||'');
    // Positions, colours, identities and highlights draw from uniforms; only scene changes re-upload.
    current=project;currentPositions=positions;cast=new Map(project.performers.map(p=>[p.id,p]));
    const key=geometryKey(project,positions,ghosts,currentShowGrid,looks.set);
    if(key!==sceneKey||extras.analysis!==currentAnalysis){sceneKey=key;currentAnalysis=extras.analysis;currentGhosts=ghosts;dirty=true;}
    requestDraw();
   },
   capture(ctx,width,height){if(contextLost)throw Error('3D graphics were interrupted. Reload the studio or export the 2D view.');cancelAnimationFrame(frame);frame=0;draw();const rect=host.getBoundingClientRect(),scale=Math.min(width/rect.width,height/rect.height),captureWidth=rect.width*scale,captureHeight=rect.height*scale,offsetX=(width-captureWidth)/2,offsetY=(height-captureHeight)/2,bg=LIGHTING[looks.look].clear;ctx.fillStyle=`rgb(${bg.map(v=>Math.round(v*255)).join(',')})`;ctx.fillRect(0,0,width,height);ctx.drawImage(canvas,offsetX,offsetY,captureWidth,captureHeight);ctx.save();ctx.beginPath();ctx.rect(offsetX,offsetY,captureWidth,captureHeight);ctx.clip();for(const label of [...ghostLabels.children,...analysisLabels.children,...labels.children]){if((label as HTMLElement).hidden)continue;const box=label.getBoundingClientRect(),style=getComputedStyle(label),x=offsetX+(box.left-rect.left)/rect.width*captureWidth,y=offsetY+(box.top-rect.top)/rect.height*captureHeight,w=box.width/rect.width*captureWidth,h=box.height/rect.height*captureHeight;ctx.save();ctx.globalAlpha=ghostLabels.contains(label) ? .45 : 1;ctx.fillStyle=style.backgroundColor;const r=Math.min(w/2,h/2,(parseFloat(style.borderRadius)||0)*captureHeight/rect.height);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();ctx.fill();if(parseFloat(style.borderTopWidth)>0){ctx.strokeStyle=style.borderColor;ctx.lineWidth=parseFloat(style.borderTopWidth)*captureHeight/rect.height;ctx.stroke();}ctx.fillStyle=style.color;ctx.font=`${style.fontWeight||'normal'} ${parseFloat(style.fontSize)*captureHeight/rect.height}px ${style.fontFamily}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label.textContent,x+w/2,y+h/2);ctx.restore();}ctx.restore();},
   dispose(){disposed=true;if(drag)endDrag(false);floor.dispose();dock?.dispose();cancelAnimationFrame(frame);controller.abort();resize.disconnect();gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(main.vs);gl.deleteShader(main.fs);if(shadow){gl.deleteFramebuffer?.(shadow.fbo);gl.deleteRenderbuffer?.(shadow.rb);gl.deleteTexture?.(shadow.texture);gl.deleteProgram(shadow.program);gl.deleteShader(shadow.vs);gl.deleteShader(shadow.fs);}gl.getExtension('WEBGL_lose_context')?.loseContext();}};
}
