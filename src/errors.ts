export type ErrorEntry={at:number;context:string;message:string;count:number};
/** A readable message from anything thrown: an Error's message, a thrown string, or the fallback. */
export function errorMessage(error:unknown,fallback='Something went wrong. Try again.'):string{
 if(error instanceof Error)return error.message||fallback;
 if(typeof error==='string')return error||fallback;
 const message=(error as {message?:unknown}|null)?.message;return typeof message==='string'&&message?message:fallback;
}
let entries:ErrorEntry[]=[],notify:(message:string)=>void=()=>{},recover:()=>void=()=>{},lastNotice=0;
export function errorHistory(){return entries.map(entry=>({...entry}));}
export function configureErrorRecovery(callback:()=>void){recover=callback;}
export function reportError(error:unknown,context='Studio operation'){
 const message=String((error as {message?:unknown}|null)?.message||error||'Unknown error').replace(/https?:\/\/\S+/g,'[resource]').slice(0,500),now=Date.now(),last=entries[entries.length-1];
 if(last?.message===message&&last.context===context&&now-last.at<2000)last.count++;else entries.push({at:now,context,message,count:1});entries=entries.slice(-20);
 try{recover();}catch{}if(now-lastNotice>1500){lastNotice=now;try{notify('An operation stopped safely. Retry it, or open Preferences → Error recovery for details.');}catch{}}
}
export function installErrorHandling(environment:Pick<Window,'addEventListener'|'removeEventListener'>=window,options:{notify?:(message:string)=>void}={}){
 notify=options.notify||(()=>{});const onError=(event:ErrorEvent)=>reportError(event.error||event.message||'An application resource could not load.','Unexpected browser error'),onRejection=(event:PromiseRejectionEvent)=>reportError(event.reason,'Interrupted async operation');
 environment.addEventListener('error',onError);environment.addEventListener('unhandledrejection',onRejection);return ()=>{environment.removeEventListener('error',onError);environment.removeEventListener('unhandledrejection',onRejection);};
}
