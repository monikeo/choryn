const finite=(n,a,b)=>typeof n==='number'&&Number.isFinite(n)&&n>=a&&n<=b;
const text=(s,n=200)=>typeof s==='string'&&s.length<=n;
const id=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(s);
const color=s=>/^#[\da-f]{6}$/i.test(s);
const check=(v,name)=>{if(!v)throw Error(`Invalid ${name} in production workspace.`);};
export const TRACKS=['music','formations','movement','cues','props','lighting','appearance','camera'];
export function validateProduction(source,base){
 const input=source.production||{},people=new Set(base.performers.map(p=>p.id));
 check(typeof input==='object'&&!Array.isArray(input),'production data');
 const list=(key,max,parse)=>{const values=input[key]||[];check(Array.isArray(values)&&values.length<=max,key);const seen=new Set();return values.map(v=>{check(v&&id(v.id)&&!seen.has(v.id),key+' identity');seen.add(v.id);return parse(v);});};
 const stage=input.stage||{},point=p=>p&&finite(p.x,-100,100)&&finite(p.z,-100,100);
 check(!stage.outline||Array.isArray(stage.outline)&&stage.outline.length<=64&&(!stage.outline.length||stage.outline.length>=3)&&stage.outline.every(point),'stage outline');
 check(!stage.lines||Array.isArray(stage.lines)&&stage.lines.length<=2000&&stage.lines.every(l=>point(l.a)&&point(l.b)),'CAD lines');
 const image=stage.image;
 check(!image||text(image.data,1500000)&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image.data)&&finite(image.width,.1,100)&&finite(image.depth,.1,100)&&finite(image.x,-100,100)&&finite(image.z,-100,100)&&finite(image.opacity,0,1),'stage image');
 const zones=list('zones',100,z=>{check(text(z.name)&&['wing','entrance','riser','obstacle','restricted'].includes(z.kind)&&point(z)&&finite(z.width,.1,100)&&finite(z.depth,.1,100)&&finite(z.height,0,20)&&color(z.color),'stage zone');return {id:z.id,name:z.name,kind:z.kind,x:z.x,z:z.z,width:z.width,depth:z.depth,height:z.height,color:z.color};});
 const lights=list('lights',300,v=>{check(text(v.name)&&finite(v.time,0,base.duration)&&point(v)&&finite(v.radius,.1,100)&&finite(v.intensity,0,1)&&color(v.color)&&text(v.fixture,40),'lighting cue');return {id:v.id,name:v.name,time:v.time,fixture:v.fixture||'wash',x:v.x,z:v.z,radius:v.radius,intensity:v.intensity,color:v.color,fade:v.fade!==false};}).sort((a,b)=>a.time-b.time);
 const appearances=list('appearances',1000,v=>{check(people.has(v.performerId)&&finite(v.time,0,base.duration)&&color(v.color)&&text(v.costume,100),'appearance state');return {id:v.id,performerId:v.performerId,time:v.time,color:v.color,costume:v.costume};}).sort((a,b)=>a.time-b.time);
 const cameras=list('cameras',300,v=>{check(finite(v.time,0,base.duration)&&point(v)&&finite(v.zoom,.5,3)&&finite(v.yaw,-6.3,6.3)&&finite(v.pitch,.15,1.4),'camera keyframe');return {id:v.id,time:v.time,x:v.x,z:v.z,zoom:v.zoom,yaw:v.yaw,pitch:v.pitch};}).sort((a,b)=>a.time-b.time);
 for(const [name,values,key] of [['lighting cues',lights,v=>v.fixture+'/'+v.time],['appearance states',appearances,v=>v.performerId+'/'+v.time],['camera keys',cameras,v=>v.time]])check(new Set(values.map(key)).size===values.length,'duplicate '+name);
 const existing=new Set([...base.formations.map(f=>'formation/'+f.id),...(source.actions||[]).map(a=>'movement/'+a.id),...base.cues.map(c=>'cue/'+c.id),...(source.props||[]).flatMap(p=>(p.keyframes||[]).map(f=>'prop/'+p.id+'/'+f.id)),...lights.map(v=>'light/'+v.id),...appearances.map(v=>'appearance/'+v.id),...cameras.map(v=>'camera/'+v.id)]),linked=new Set();
 const links=list('links',100,v=>{check(text(v.name)&&Array.isArray(v.items)&&v.items.length>=2&&v.items.length<=300&&new Set(v.items).size===v.items.length&&v.items.every(k=>existing.has(k)&&!linked.has(k)),'linked clips');v.items.forEach(k=>linked.add(k));return {id:v.id,name:v.name,items:[...v.items]};});
 const layers={};for(const key of TRACKS){const v=input.layers?.[key]||{};layers[key]={hidden:!!v.hidden,locked:!!v.locked,collapsed:!!v.collapsed};}
 return {stage:{outline:(stage.outline||[]).map(p=>({x:p.x,z:p.z})),lines:(stage.lines||[]).map(l=>({a:{x:l.a.x,z:l.a.z},b:{x:l.b.x,z:l.b.z}})),image:image?{data:image.data,x:image.x,z:image.z,width:image.width,depth:image.depth,opacity:image.opacity}:null},zones,lights,appearances,cameras,links,layers,ripple:!!input.ripple,cameraEnabled:!!input.cameraEnabled};
}
export function motionProgress(t,curve){
 if(!curve)return t;
 const [x1,y1,x2,y2]=curve,cubic=(u,a,b)=>3*(1-u)**2*u*a+3*(1-u)*u*u*b+u**3;
 let lo=0,hi=1;for(let i=0;i<20;i++){const mid=(lo+hi)/2;if(cubic(mid,x1,x2)<t)lo=mid;else hi=mid;}
 return t<=0?0:t>=1?1:cubic((lo+hi)/2,y1,y2);
}
