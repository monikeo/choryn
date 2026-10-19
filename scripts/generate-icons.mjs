import {mkdir,writeFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc=buffer=>{let c=0xffffffff;for(const b of buffer)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
function chunk(type,body){const t=Buffer.from(type),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(body.length);checksum.writeUInt32BE(crc(Buffer.concat([t,body])));return Buffer.concat([length,t,body,checksum]);}
function icon(size){
  const pixels=Buffer.alloc(size*(size*4+1));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let alpha=0,white=0;
    for(let a=0;a<2;a++)for(let b=0;b<2;b++){
      const nx=(x+(a+.5)/2)/size,ny=(y+(b+.5)/2)/size;
      const radius=.22,rx=Math.max(radius-nx,0,nx-(1-radius)),ry=Math.max(radius-ny,0,ny-(1-radius));
      if(rx*rx+ry*ry>radius*radius)continue;alpha++;
      const dx=nx-.51,dy=ny-.5,r=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
      if(Math.abs(angle)>.72 && ((r>.235&&r<.292)||(r>.103&&r<.16)))white++;
      for(const rad of [.264,.132])for(const sign of [-1,1])if(Math.hypot(dx-Math.cos(.72)*rad,dy-sign*Math.sin(.72)*rad)<.028)white++;
    }
    const i=y*(size*4+1)+1+x*4,mix=Math.min(1,white/Math.max(1,alpha));
    pixels[i]=Math.round(124+(255-124)*mix);pixels[i+1]=Math.round(96+(255-96)*mix);pixels[i+2]=Math.round(199+(255-199)*mix);pixels[i+3]=Math.round(alpha/4*255);
  }
  const head=Buffer.alloc(13);head.writeUInt32BE(size);head.writeUInt32BE(size,4);head[8]=8;head[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
await mkdir(new URL('../icons',import.meta.url),{recursive:true});
for(const [name,size] of [['icon-192.png',192],['icon-512.png',512],['apple-touch-icon.png',180]])await writeFile(new URL(`../icons/${name}`,import.meta.url),icon(size));
console.log('Generated CHORYN app icons.');
