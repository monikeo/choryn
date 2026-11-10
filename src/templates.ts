import type {Point,Pose,Stage} from './types.js';
export const FORMATION_TEMPLATES=[
 ['staggered','Staggered rows','Lines'],['line','Straight line','Lines'],['v','V shape','Wedges'],['circle','Circle','Curves'],['diamond','Diamond','Geometric'],['columns','Columns','Lines'],['arc','Arc','Curves'],['diagonal','Diagonal','Lines'],
 ['double-line','Double line','Lines'],['corridor','Corridor','Lines'],['zigzag','Zigzag','Lines'],['wave','Wave','Curves'],['spiral','Spiral','Curves'],['double-circle','Twin circles','Curves'],['concentric','Concentric rings','Curves'],['semicircle','Semicircle','Curves'],['square','Square outline','Geometric'],['triangle','Triangle outline','Geometric'],['cross','Cross','Geometric'],['x-cross','Diagonal cross','Geometric'],['hourglass','Hourglass','Wedges'],['wedge','Filled wedge','Wedges'],['wings','Open wings','Wedges'],['heart','Heart','Geometric']
 ,['fan','Spotlight fan','Dance'],['infinity','Infinity flow','Dance'],['butterfly','Butterfly wings','Dance'],['petals','Four-petal bloom','Dance'],['starburst','Starburst','Dance'],['snake','Serpentine','Dance'],['ripple','Ripple lines','Dance'],['chevrons','Layered chevrons','Dance'],['three-pods','Three dance pods','Dance'],['offset-rings','Orbit rings','Dance'],['solo-halo','Soloist & halo','Dance'],['runway','Runway reveal','Dance']
].map(([id,name,category])=>({id,name,category}));
export function extraLayout(type:string,n:number):Point[]|null{
  const points:Point[]=[];for(let i=0;i<n;i++){
    const t=n===1?.5:i/(n-1);let x=0,z=0;
    if(type==='double-line'){const row=i%2,k=Math.floor(i/2),count=Math.ceil((n-row)/2);x=count===1?0:k/(count-1)*2-1;z=row?-.5:.5;}
    else if(type==='corridor'){const column=i%2,k=Math.floor(i/2),count=Math.ceil((n-column)/2);x=column?.6:-.6;z=count===1?0:k/(count-1)*2-1;}
    else if(type==='zigzag'){x=t*2-1;z=i%2?.55:-.55;}
    else if(type==='wave'){x=t*2-1;z=Math.sin(t*Math.PI*3)*.65;}
    else if(type==='spiral'){const r=.2+.8*t,a=t*Math.PI*4;x=Math.cos(a)*r;z=Math.sin(a)*r;}
    else if(type==='double-circle'){const side=i%2,k=Math.floor(i/2),count=Math.ceil((n-side)/2),a=k/Math.max(1,count)*Math.PI*2;x=(side?.55:-.55)+Math.cos(a)*.4;z=Math.sin(a)*.8;}
    else if(type==='concentric'){const ring=i%2,k=Math.floor(i/2),count=Math.ceil((n-ring)/2),a=k/Math.max(1,count)*Math.PI*2,r=ring?.5:1;x=Math.cos(a)*r;z=Math.sin(a)*r;}
    else if(type==='semicircle'){x=Math.cos(t*Math.PI);z=Math.sin(t*Math.PI)*1.5-.65;}
    else if(type==='square'||type==='triangle'){const vertices=type==='square'?[[-1,1],[1,1],[1,-1],[-1,-1],[-1,1]]:[[0,1],[1,-1],[-1,-1],[0,1]],at=i/n*(vertices.length-1),k=Math.floor(at),u=at-k;x=vertices[k][0]*(1-u)+vertices[k+1][0]*u;z=vertices[k][1]*(1-u)+vertices[k+1][1]*u;}
    else if(type==='cross'||type==='x-cross'){const arm=i%4,layer=Math.floor(i/4)+1,count=Math.ceil(n/4),a=arm*Math.PI/2+(type==='x-cross'?Math.PI/4:0);x=Math.cos(a)*layer/count;z=Math.sin(a)*layer/count;}
    else if(type==='hourglass'){x=t*2-1;z=(i%2?1:-1)*Math.abs(x);}
    else if(type==='wedge'){const rows=Math.ceil((Math.sqrt(8*n+1)-1)/2);let row=0,remaining=i;while(remaining>row){remaining-=row+1;row++;}z=rows===1?0:1-row/Math.max(1,rows-1)*2;x=row?((remaining/row)*2-1)*(row/Math.max(1,rows-1)):0;}
    else if(type==='wings'){const side=i%2,k=Math.floor(i/2),count=Math.ceil((n-side)/2),u=count===1?.5:k/(count-1);x=(side?1:-1)*(.2+.8*u);z=Math.sin(u*Math.PI)*1.3-.6;}
    else if(type==='heart'){const a=i/n*Math.PI*2;x=Math.sin(a)**3;z=(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))/18;}
    else if(type==='fan'){const a=(.12+.76*t)*Math.PI;x=Math.cos(a);z=Math.sin(a)*1.7-.8;}
    else if(type==='infinity'){const a=(i+.25)/n*Math.PI*2;x=Math.cos(a);z=Math.sin(2*a)*.7;}
    else if(type==='butterfly'){const a=(i+.25)/n*Math.PI*2,r=.45+.5*Math.abs(Math.cos(a));x=Math.cos(a)*r;z=Math.sin(a)*Math.cos(a)*1.7;}
    else if(type==='petals'){const a=(i+.25)/n*Math.PI*2,r=.45+.5*Math.abs(Math.cos(2*a));x=Math.cos(a)*r;z=Math.sin(a)*r;}
    else if(type==='starburst'){const a=i/n*Math.PI*2,r=i%2?.48:1;x=Math.cos(a)*r;z=Math.sin(a)*r;}
    else if(type==='snake'){z=t*2-1;x=Math.sin(t*Math.PI*3)*.75;}
    else if(type==='ripple'){const row=i%3,k=Math.floor(i/3),count=Math.ceil((n-row)/3),u=count===1?.5:k/(count-1);x=u*2-1;z=(row-1)*.65+Math.sin(u*Math.PI*2)*.2;}
    else if(type==='chevrons'){const row=i%3,k=Math.floor(i/3),count=Math.ceil((n-row)/3),u=count===1?.5:k/(count-1);x=u*2-1;z=(row-1)*.55+Math.abs(x)*.4;}
    else if(type==='three-pods'){const pod=i%3,k=Math.floor(i/3),count=Math.ceil((n-pod)/3),a=k/Math.max(1,count)*Math.PI*2;x=(pod-1)*.65+Math.cos(a)*.28;z=(pod===1?.45:-.35)+Math.sin(a)*.4;}
    else if(type==='offset-rings'){const ring=i%2,k=Math.floor(i/2),count=Math.ceil((n-ring)/2),a=k/Math.max(1,count)*Math.PI*2;x=(ring?.25:-.25)+Math.cos(a)*.7;z=(ring?.2:-.2)+Math.sin(a)*.7;}
    else if(type==='solo-halo'){if(i===0){x=0;z=-.75;}else{const a=(i-1)/Math.max(1,n-1)*Math.PI*2;x=Math.cos(a)*.9;z=Math.sin(a)*.65+.25;}}
    else if(type==='runway'){if(i===0){x=0;z=-1;}else{const side=(i-1)%2,k=Math.floor((i-1)/2),count=Math.ceil((n-1-side)/2);x=side?.55:-.55;z=count===1?0:k/(count-1)*1.65-.7;}}
    else return null;
    points.push({x,z});
  }return points;
}
export function customizeLayout(positions:Pose[],stage:Pick<Stage,'width'|'depth'>,{angle=0,scale=1,mirrorX=false,mirrorZ=false,facing=0}={}){
  const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const points=positions.map(p=>{const x=p.x*(mirrorX?-1:1),z=p.z*(mirrorZ?-1:1);return {...p,x:(x*c-z*s)*scale,z:(x*s+z*c)*scale,facing};});
  const maxX=Math.max(.001,...points.map(p=>Math.abs(p.x))),maxZ=Math.max(.001,...points.map(p=>Math.abs(p.z))),fit=Math.min(1,stage.width*.48/maxX,stage.depth*.48/maxZ);
  return points.map(p=>({...p,x:Math.round(p.x*fit*100)/100,z:Math.round(p.z*fit*100)/100}));
}
