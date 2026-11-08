// Saving files the way each platform expects: phones and tablets open the
// system share sheet (AirDrop, Files, Drive, Messages…); desktops download.
// navigator.share() must run soon after a tap. Exports that take a while
// (ZIPs, large backups) can outlive that window, so the caller is offered a
// "ready" sheet whose Share button supplies a fresh tap.

export type SaveOutcome='shared'|'downloaded'|'cancelled'|'offered';
type Environment={navigator?:any;matchMedia?:(query:string)=>{matches:boolean};File?:any};

/** Touch-first devices (no hovering pointer, coarse primary pointer). */
export function prefersShareSheet(environment:Environment=globalThis as Environment){
 return !!environment.matchMedia?.('(any-hover: none) and (pointer: coarse)')?.matches;
}

export function shareableFile(blob:Blob,name:string,type:string|undefined,environment:Environment=globalThis as Environment){
 const FileCtor=environment.File;if(!FileCtor||!environment.navigator?.share||!environment.navigator?.canShare)return null;
 try{const file=new FileCtor([blob],name,{type:type||blob.type||'application/octet-stream'});return environment.navigator.canShare({files:[file]})?file:null;}catch{return null;}
}

export async function shareFile(file:File,environment:Environment=globalThis as Environment):Promise<'shared'|'cancelled'|'blocked'|'failed'>{
 try{await environment.navigator.share({files:[file],title:file.name});return 'shared';}
 catch(error){
  if(error?.name==='AbortError')return 'cancelled';      // The person closed the sheet.
  if(error?.name==='NotAllowedError')return 'blocked';   // The tap that started the export expired.
  return 'failed';
 }
}

export async function saveFile(blob:Blob,name:string,{type,download,offer}:{type?:string;download:(blob:Blob,name:string)=>void;offer?:(file:File)=>void},environment:Environment=globalThis as Environment):Promise<SaveOutcome>{
 const file=prefersShareSheet(environment)?shareableFile(blob,name,type,environment):null;
 if(!file){download(blob,name);return 'downloaded';}
 const result=await shareFile(file,environment);
 if(result==='shared')return 'shared';
 if(result==='cancelled')return 'cancelled';
 if(result==='blocked'&&offer){offer(file);return 'offered';}
 download(blob,name);return 'downloaded';
}
