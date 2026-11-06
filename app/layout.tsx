import type {Metadata, Viewport} from 'next';
import type {ReactNode} from 'react';
import '../src/styles.css';
import '../src/features.css';
import '../src/native.css';
import '../src/power.css';
import '../src/compat.css';
import '../src/workspace.css';
import '../src/score.css';
import '../src/adaptive.css';
import '../src/rehearsal.css';
import '../src/workbench.css';
import '../src/ensemble.css';
import '../src/timeline.css';
import '../src/image-exports.css';
import '../src/branding.css';
import '../src/pwa.css';
import '../src/navigation.css';
import '../src/production-next.css';
import '../src/responsive.css';

export const metadata: Metadata = {
  title: 'CHORYN Studio — From first count to final cue.',
  description: 'CHORYN Studio — Choreography, stage design and performance. From first count to final cue.',
  applicationName: 'CHORYN',
  appleWebApp: {capable:true,title:'CHORYN',statusBarStyle:'default'},
  icons: {
    icon: [
      {url:'/favicon.ico',sizes:'any'},
      {url:'/favicon.svg',type:'image/svg+xml'},
      ...[16,32,48].map(size=>({url:`/icons/favicon-${size}.png`,sizes:`${size}x${size}`,type:'image/png'}))
    ],
    apple: [120,152,167,180].map(size=>({url:`/icons/apple-touch-icon-${size}.png`,sizes:`${size}x${size}`}))
  },
  other: {'choryn-build':process.env.CHORYN_BUILD || 'development','mobile-web-app-capable':'yes'}
};
export const viewport: Viewport = {width:'device-width',initialScale:1,viewportFit:'cover',interactiveWidget:'resizes-content',themeColor:'#7c3aed'};

export default function RootLayout({children}:{children:ReactNode}) {
  return <html lang="en"><head>
    <link rel="manifest" href="/manifest.json" crossOrigin="use-credentials"/>
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
    <link id="studio-fonts" rel="stylesheet" media="print" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=DM+Sans:wght@400;450;500;550;600;650;700&family=Manrope:wght@400;500;600;650;700;750;800&display=swap"/>
  </head><body>{children}</body></html>;
}
