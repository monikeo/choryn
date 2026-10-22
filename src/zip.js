const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=table[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
const header=size=>{const bytes=new Uint8Array(size);return {bytes,view:new DataView(bytes.buffer)};};
export async function imageZip(entries,{signal,onProgress=()=>{},maxBytes=120*1024*1024}={}){
 if(!entries.length||entries.length>301)throw Error('Choose up to 301 files to download.');
 const names=new Set(),chunks=[],directory=[];let offset=0,total=0;
 for(let i=0;i<entries.length;i++){
  if(signal?.aborted)throw Error('ZIP export cancelled.');const {name,blob}=entries[i];if(typeof name!=='string'||!name||/[\\/\u0000]/.test(name)||name==='.'||name==='..'||names.has(name.toLowerCase()))throw Error('Invalid or duplicate ZIP filename.');names.add(name.toLowerCase());
  total+=blob.size;if(total>maxBytes)throw Error('This batch is too large. Download fewer images or lower the image scale.');const filename=new TextEncoder().encode(name);if(filename.length>65535)throw Error('Filename is too long.');
  const bytes=new Uint8Array(await blob.arrayBuffer()),crc=crc32(bytes),local=header(30),central=header(46),l=local.view,c=central.view;
  l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint16(12,33,true);l.setUint32(14,crc,true);l.setUint32(18,bytes.length,true);l.setUint32(22,bytes.length,true);l.setUint16(26,filename.length,true);
  c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);c.setUint32(16,crc,true);c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,filename.length,true);c.setUint32(42,offset,true);
  chunks.push(local.bytes,filename,bytes);directory.push(central.bytes,filename);offset+=30+filename.length+bytes.length;onProgress((i+1)/entries.length);await new Promise(r=>setTimeout(r,0));
 }
 if(signal?.aborted)throw Error('ZIP export cancelled.');const directorySize=directory.reduce((n,b)=>n+b.byteLength,0),end=header(22),e=end.view;e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,directorySize,true);e.setUint32(16,offset,true);return new Blob([...chunks,...directory,end.bytes],{type:'application/zip'});
}
