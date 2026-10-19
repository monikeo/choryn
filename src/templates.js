export const FORMATION_TEMPLATES=[
 ['staggered','Staggered rows','Lines'],['line','Straight line','Lines'],['v','V shape','Wedges'],['circle','Circle','Curves'],['diamond','Diamond','Geometric'],['columns','Columns','Lines'],['arc','Arc','Curves'],['diagonal','Diagonal','Lines'],
 ['double-line','Double line','Lines'],['corridor','Corridor','Lines'],['zigzag','Zigzag','Lines'],['wave','Wave','Curves'],['spiral','Spiral','Curves'],['double-circle','Twin circles','Curves'],['concentric','Concentric rings','Curves'],['semicircle','Semicircle','Curves'],['square','Square outline','Geometric'],['triangle','Triangle outline','Geometric'],['cross','Cross','Geometric'],['x-cross','Diagonal cross','Geometric'],['hourglass','Hourglass','Wedges'],['wedge','Filled wedge','Wedges'],['wings','Open wings','Wedges'],['heart','Heart','Geometric']
].map(([id,name,category])=>({id,name,category}));
export function extraLayout(type,n){
  const points=[];for(let i=0;i<n;i++){
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
    else return null;
    points.push({x,z});
  }return points;
}
