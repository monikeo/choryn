'use client';

export default function StudioError() {
  return <main className="startup-recovery"><h1>The studio could not finish loading.</h1><p>Your browser projects have not been cleared. Reload to retry.</p><button className="button primary" onClick={()=>window.location.reload()}>Reload studio</button></main>;
}
