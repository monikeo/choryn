let pending:Promise<IDBDatabase>|null=null;
/** The reference-video database (opened once; reopened after a version change elsewhere). */
export function referenceDB(environment:{indexedDB:IDBFactory}=globalThis):Promise<IDBDatabase>{
 if(pending)return pending;
 pending=new Promise<IDBDatabase>((resolve,reject)=>{let settled=false;const request=environment.indexedDB.open('choryn-reference-media',1),timer=setTimeout(()=>fail(Error('Reference video storage timed out.')),10000);function fail(error:unknown){if(settled)return;settled=true;clearTimeout(timer);reject(error);}
 request.onupgradeneeded=()=>request.result.createObjectStore('videos');request.onerror=()=>fail(request.error);request.onblocked=()=>fail(Error('Close other CHORYN tabs to use video storage.'));request.onsuccess=()=>{if(settled){request.result.close();return;}settled=true;clearTimeout(timer);const db=request.result;db.onversionchange=()=>{db.close();pending=null;};resolve(db);};
 }).catch((error:unknown)=>{pending=null;throw error;});return pending;
}
export async function saveReference(id:string,blob:Blob){const db=await referenceDB();return new Promise((resolve,reject)=>{const tx=db.transaction('videos','readwrite');tx.objectStore('videos').put(blob,id);tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||Error('Reference video storage failed.'));});}
export async function loadReference(id:string):Promise<Blob|null>{const db=await referenceDB();return new Promise((resolve,reject)=>{const req=db.transaction('videos').objectStore('videos').get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});}
/** The video's duration in seconds, or a clear error when the browser cannot read it. */
export function probeReference(blob:Blob):Promise<number>{return new Promise((resolve,reject)=>{const video=document.createElement('video'),url=URL.createObjectURL(blob);let done=false;const timer=setTimeout(()=>finish(Error('Video metadata could not be read. Try a supported MP4 or WebM.')),15000);function finish(error:Error|null){if(done)return;done=true;clearTimeout(timer);const duration=video.duration;video.removeAttribute('src');video.load();URL.revokeObjectURL(url);error?reject(error):resolve(duration);}
 video.preload='metadata';video.onloadedmetadata=()=>finish(Number.isFinite(video.duration)&&video.duration>0&&video.duration<=14400?null:Error('Use a reference video up to four hours long.'));video.onerror=()=>finish(Error('This browser cannot decode the selected reference video.'));video.src=url;
 });}
