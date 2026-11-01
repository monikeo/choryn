import type {Revision} from './types.js';
import type {Project} from './types.js';
import {localId,cloneData} from './compat.js';
let db;
const recent=new Map();
async function database(){if(db)return db;return new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('choryn-revisions',1);request.onupgradeneeded=()=>{const store=request.result.createObjectStore('snapshots',{keyPath:'id'});store.createIndex('projectId','projectId');};request.onerror=()=>reject(request.error);request.onsuccess=()=>{db=request.result;resolve(db);};});}
export async function listRevisions(projectId){const db=await database();return new Promise<Revision[]>((resolve,reject)=>{const request=db.transaction('snapshots').objectStore('snapshots').index('projectId').getAll(projectId);request.onsuccess=()=>resolve(request.result.sort((a,b)=>b.createdAt-a.createdAt));request.onerror=()=>reject(request.error);});}
export async function recordRevision(project: Project,label='Auto-saved editor snapshot'){
  const content=JSON.stringify({...project,updatedAt:0});if(recent.get(project.id)===content)return;
  const db=await database(),existing=await listRevisions(project.id);
  if(existing[0]&&JSON.stringify({...existing[0].data,updatedAt:0})===content){recent.set(project.id,content);return;}
  const snapshot={id:localId(),projectId:project.id,createdAt:Date.now(),label,data:cloneData(project)};
  await new Promise((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite'),store=tx.objectStore('snapshots');store.put(snapshot);existing.slice(9).forEach(v=>store.delete(v.id));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});recent.set(project.id,content);
}
