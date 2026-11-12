import type {Metadata, Viewport} from 'next';
import type {ReactNode} from 'react';
import {DM_Sans, Inter, Manrope} from 'next/font/google';
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
import '../src/creative.css';
import '../src/responsive.css';

// next/font downloads these at build time and serves them from the app itself: no request to Google
// at runtime, no layout shift (size-adjusted fallbacks), and the fonts are part of the offline app.
// The CSS reads them through --body-font, --display-font and the branding font stack.
const dmSans = DM_Sans({subsets: ['latin'], display: 'swap', variable: '--font-dm-sans'});
const manrope = Manrope({subsets: ['latin'], display: 'swap', variable: '--font-manrope'});
const inter = Inter({subsets: ['latin'], display: 'swap', variable: '--font-inter'});

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

// Applies the saved or system theme before first paint, so dark-mode users
// never see a light flash while the studio loads. Mirrors resolvedTheme() in src/app.ts.
const themeBootstrap=`try{var t=localStorage.getItem('choryn.theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({children}:{children:ReactNode}) {
  return <html lang="en" className={`${dmSans.variable} ${manrope.variable} ${inter.variable}`} suppressHydrationWarning><head>
    <script dangerouslySetInnerHTML={{__html:themeBootstrap}}/>
    <link rel="manifest" href="/manifest.json" crossOrigin="use-credentials"/>
  </head><body>{children}</body></html>;
}
