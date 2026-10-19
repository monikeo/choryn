let entries=[],notify=()=>{},recover=()=>{},lastNotice=0;
export function errorHistory(){return entries.map(entry=>({...entry}));}
export function configureErrorRecovery(callback){recover=callback;}
export function reportError(error,context='Studio operation'){
 const message=String(error?.message||error||'Unknown error').replace(/https?:\/\/\S+/g,'[resource]').slice(0,500),now=Date.now(),last=entries[entries.length-1];
 if(last?.message===message&&last.context===context&&now-last.at<2000)last.count++;else entries.push({at:now,context,message,count:1});entries=entries.slice(-20);
 try{recover();}catch{}if(now-lastNotice>1500){lastNotice=now;try{notify('An operation stopped safely. Retry it, or open Preferences → Error recovery for details.');}catch{}}
}
export function installErrorHandling(environment=window,options={}){
 notify=options.notify||(()=>{});const onError=event=>reportError(event.error||event.message||'An application resource could not load.','Unexpected browser error'),onRejection=event=>reportError(event.reason,'Interrupted async operation');
 environment.addEventListener('error',onError);environment.addEventListener('unhandledrejection',onRejection);return ()=>{environment.removeEventListener('error',onError);environment.removeEventListener('unhandledrejection',onRejection);};
}
