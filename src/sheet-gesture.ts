// Native bottom-sheet behaviour for phone dialogs: drag the handle or header
// down to dismiss. Dismissal presses the sheet's own close button, so each
// dialog keeps its normal close path (cleanup, pending-work guards). Sheets
// without a close button never auto-dismiss.

type SheetEnvironment={matchMedia:(query:string)=>MediaQueryList;performance:{now:()=>number}};

const DRAG_VAR='--sheet-drag';
const CONTROLS='button,a,input,select,textarea,summary,label,[contenteditable],[role=slider]';

/** Pixel distance (or a quick flick) that dismisses a sheet of the given height. */
export function shouldDismiss(offset:number,elapsedMs:number,sheetHeight:number){
 if(offset<=0)return false;
 const velocity=offset/Math.max(1,elapsedMs);
 return offset>Math.min(140,sheetHeight*.3)||velocity>.6&&offset>40;
}

export function bindSheetGesture(dialog:HTMLDialogElement|null,environment:SheetEnvironment=window){
 if(!dialog)return ()=>{};
 const phone=environment.matchMedia('(max-width:767px)');
 const closeButton=()=>dialog.querySelector<HTMLElement>('[data-action="close-dialog"]');
 let drag:{id:number,y:number,t:number}|null=null,offset=0;

 const settle=()=>{dialog.style.removeProperty(DRAG_VAR);dialog.style.removeProperty('transition');dialog.classList.remove('sheet-dragging');};
 const startsDrag=(event:PointerEvent)=>{
  const target=event.target as HTMLElement,rect=dialog.getBoundingClientRect();
  if(event.clientY<rect.top||event.clientY>rect.bottom||event.clientX<rect.left||event.clientX>rect.right)return false;
  if(target.closest(CONTROLS))return false;
  // The handle (dialog padding above the header) or the header itself.
  return target===dialog?event.clientY<=rect.top+40:!!target.closest('.modal-header');
 };

 // (Backdrop taps are already handled by app.ts for every form factor.)
 dialog.addEventListener('pointerdown',event=>{
  if(!phone.matches||!dialog.open||event.button!==0)return;
  if(dialog.scrollTop>0||!closeButton()||!startsDrag(event))return;
  drag={id:event.pointerId,y:event.clientY,t:environment.performance.now()};offset=0;
  try{dialog.setPointerCapture(event.pointerId);}catch{}
 });
 dialog.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  offset=Math.max(0,event.clientY-drag.y);
  dialog.classList.add('sheet-dragging');dialog.style.transition='none';dialog.style.setProperty(DRAG_VAR,offset+'px');
 });
 const finish=(event:PointerEvent,cancelled=false)=>{
  if(!drag||event.pointerId!==drag.id)return;
  const elapsed=environment.performance.now()-drag.t;drag=null;
  try{dialog.releasePointerCapture(event.pointerId);}catch{}
  if(!cancelled&&shouldDismiss(offset,elapsed,dialog.offsetHeight)){settle();closeButton()?.click();offset=0;return;}
  // Spring back to the resting position.
  dialog.style.transition='transform .18s ease-out';dialog.style.setProperty(DRAG_VAR,'0px');offset=0;
  setTimeout(settle,200);
 };
 dialog.addEventListener('pointerup',event=>finish(event));
 dialog.addEventListener('pointercancel',event=>finish(event,true));
 dialog.addEventListener('close',()=>{drag=null;offset=0;settle();});
 return settle;
}
