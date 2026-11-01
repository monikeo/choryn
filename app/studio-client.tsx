'use client';

import {useEffect} from 'react';

let startup: Promise<void> | undefined;

export default function StudioClient() {
  useEffect(()=>{
    // React owns the stable host. The high-frequency SVG/WebGL workstation
    // owns its descendants, so transport frames do not rerender React.
    startup ??= import('../src/boot.js').then(()=>undefined);
    void startup;
  },[]);
  return <>
    <noscript>CHORYN needs JavaScript enabled to edit and save formations. Enable JavaScript, then reload this page.</noscript>
    <div id="app" suppressHydrationWarning><div className="startup-recovery" role="status">Opening CHORYN Studio…</div></div>
    <div id="toast" role="status" aria-live="polite"/>
    <dialog id="dialog"/>
    <input type="file" id="audio-input" accept="audio/*" hidden/>
    <input type="file" id="backup-input" accept="application/json,.json,.choryn,application/x-choryn" hidden/>
  </>;
}
