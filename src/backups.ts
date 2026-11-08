import type {Project} from './types.js';
const MAGIC=new TextEncoder().encode('CHORYN2\n');
const MAX_HEADER=5*1024*1024,MAX_MEDIA=50*1024*1024;
// Damaged or unrelated files must explain themselves instead of surfacing a raw parser error.
const parseJSON=(text:string,message:string)=>{try{return JSON.parse(text);}catch{throw new Error(message);}};
const digest=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
export async function packBackup(project: Project,audio){
  if(audio&&audio.size>MAX_MEDIA)throw new Error('Audio exceeds the 50 MB backup limit.');
  const metadata={format:'choryn-bundle',version:1,project,media:audio?{name:project.audioName,type:audio.type||'application/octet-stream',size:audio.size,sha256:await digest(audio)}:null};
  const header=new TextEncoder().encode(JSON.stringify(metadata));if(header.length>MAX_HEADER)throw new Error('Project data exceeds the backup limit.');
  const size=new Uint8Array(4);new DataView(size.buffer).setUint32(0,header.length,true);
  return new Blob([MAGIC,size,header,...(audio?[audio]:[])],{type:'application/x-choryn'});
}
export async function unpackBackup(file,validate){
  if(file.size>MAX_HEADER+MAX_MEDIA+12)throw new Error('Backup is too large.');
  const prefix=new Uint8Array(await file.slice(0,12).arrayBuffer());
  if(!MAGIC.every((v,i)=>prefix[i]===v)){
    if(file.size>MAX_HEADER)throw new Error('JSON backup is too large.');
    return {project:validate(parseJSON(await file.text(),'This file is not a CHORYN project backup. Choose a .choryn file exported from CHORYN.')),audio:null};
  }
  if(prefix.length<12)throw new Error('Backup header is incomplete.');
  const length=new DataView(prefix.buffer).getUint32(8,true);
  if(length<2||length>MAX_HEADER||12+length>file.size)throw new Error('Backup header is invalid.');
  const header=parseJSON(await file.slice(12,12+length).text(),'Backup header is damaged. Export a new backup from the original device.');
  if(header.format!=='choryn-bundle'||header.version!==1)throw new Error('Unsupported backup version.');
  const project=validate(header.project);
  let audio=null;
  if(header.media){
    if(!Number.isInteger(header.media.size)||header.media.size<0||header.media.size>MAX_MEDIA||file.size!==12+length+header.media.size||!/^[a-f0-9]{64}$/.test(header.media.sha256))throw new Error('Backup audio is incomplete.');
    audio=file.slice(12+length,file.size,typeof header.media.type==='string'?header.media.type:'application/octet-stream');
    if(await digest(audio)!==header.media.sha256)throw new Error('Audio integrity check failed. The backup may be damaged.');
  }else if(file.size!==12+length)throw new Error('Unexpected backup data.');
  return {project,audio};
}
