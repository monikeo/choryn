'use client';

import {useEffect,useState} from 'react';

let startup: Promise<void> | undefined;

export default function StudioClient() {
  const [startupFailed,setStartupFailed]=useState(false);
  useEffect(()=>{
    // React owns the stable host. The high-frequency SVG/WebGL workstation
    // owns its descendants, so transport frames do not rerender React.
    startup ??= import('../src/boot.js').then(()=>undefined);
    let mounted=true;
    void startup.catch(()=>{if(mounted)setStartupFailed(true);});
    return ()=>{mounted=false;};
  },[]);
  return <>
    <noscript>CHORYN needs JavaScript enabled to edit and save formations. Enable JavaScript, then reload this page.</noscript>
    <div id="app" suppressHydrationWarning>{startupFailed?<section className="startup-recovery" role="alert"><h1>The studio could not finish loading.</h1><p>Your browser data has not been cleared. Check your connection and reload to retry.</p><button className="button primary" onClick={()=>location.reload()}>Reload studio</button></section>:<div className="startup-recovery" role="status">Opening CHORYN Studio…</div>}</div>
    <div id="toast" role="status" aria-live="polite"/>
    <dialog id="dialog"/>
    <input type="file" id="audio-input" accept="audio/*" hidden/>
    <input type="file" id="backup-input" accept="application/json,.json,.choryn,application/x-choryn" hidden/>
  </>;
}
