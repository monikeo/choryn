// Drop music or a .choryn backup anywhere on the studio, or open .choryn
// files from the operating system once CHORYN is installed (File Handling
// API). Files are routed into the existing hidden inputs, so they pass through
// exactly the same validation as files chosen with the picker.

export type FileKind='audio'|'backup';
const AUDIO_EXTENSIONS=/\.(mp3|m4a|aac|wav|wave|aif|aiff|ogg|oga|opus|flac|caf)$/i;

export function classifyFile(file:{name?:string;type?:string}):FileKind|null{
 const name=file.name||'',type=(file.type||'').toLowerCase();
 if(/\.(choryn|json)$/i.test(name)||type==='application/x-choryn'||type==='application/json')return 'backup';
 if(type.startsWith('audio/')||AUDIO_EXTENSIONS.test(name))return 'audio';
 return null;
}

/** Hands a file to an <input type=file> and fires its change handler. */
export function feedInput(input:HTMLInputElement|null,file:File,environment:{DataTransfer?:any}=globalThis as any){
 if(!input||!environment.DataTransfer)return false;
 try{const transfer=new environment.DataTransfer();transfer.items.add(file);input.files=transfer.files;}catch{return false;}
 input.dispatchEvent(new Event('change',{bubbles:true}));return true;
}

const carriesFiles=(event:DragEvent)=>Array.from(event.dataTransfer?.types||[]).includes('Files');

export function bindFileDrop({target=document as GlobalEventHandlers,host=document.body as HTMLElement|null,accept}:{target?:GlobalEventHandlers;host?:HTMLElement|null;accept:(files:File[])=>void}){
 let depth=0,overlay:HTMLElement|null=null;
 const show=()=>{
  if(overlay||!host)return;
  overlay=document.createElement('div');overlay.className='file-drop-overlay';overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');
  overlay.innerHTML='<div><strong>Drop to import</strong><span>Music — MP3, WAV, M4A, AAC, OGG or FLAC — or a .choryn project backup</span></div>';
  host.append(overlay);
 };
 const hide=()=>{depth=0;overlay?.remove();overlay=null;};
 target.addEventListener('dragenter',(event:DragEvent)=>{if(!carriesFiles(event))return;event.preventDefault();depth++;show();});
 target.addEventListener('dragover',(event:DragEvent)=>{if(!carriesFiles(event))return;event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';});
 // Enter/leave fire for every child crossed; the window is left when relatedTarget is null.
 target.addEventListener('dragleave',(event:DragEvent)=>{if(!carriesFiles(event))return;depth=Math.max(0,depth-1);if(!depth||!event.relatedTarget)hide();});
 target.addEventListener('drop',(event:DragEvent)=>{if(!carriesFiles(event))return;event.preventDefault();hide();const files=Array.from(event.dataTransfer?.files||[]);if(files.length)accept(files);});
 globalThis.addEventListener?.('blur',hide);
 return hide;
}

/** Installed-app file opening (Chromium desktop). Returns false when unsupported. */
export function consumeLaunchFiles(accept:(files:File[])=>void,environment:{launchQueue?:any}=globalThis as any){
 const queue=environment.launchQueue;if(!queue?.setConsumer)return false;
 queue.setConsumer(async(params:{files?:{getFile:()=>Promise<File>}[]})=>{
  const files:File[]=[];for(const handle of params.files||[])try{files.push(await handle.getFile());}catch{}
  if(files.length)accept(files);
 });
 return true;
}
