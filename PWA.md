# CHORYN PWA and shortcut icons

CHORYN is an installable local-first web application. Its stable manifest ID and start URL are /, its display mode is standalone, and it supports unrestricted device rotation. Unsupported PWA APIs leave browser editing available. Installation is offered through All tools → Install & offline, or Preferences → Install & offline.

## Offline and updates

The production build injects a content-derived shell version and SHA-256 hashes for 88 static assets, plus matching build identifiers for all four HTML routes. The service worker fetches at most six assets concurrently and validates assets before installation. Sites/Cloudflare adds request-specific security code to HTML: those responses are preserved unchanged and accepted only with the matching CHORYN build identifier and application marker. Canonical /index.html → / and /offline.html → /offline redirects are supported, including direct offline-page navigation. Authentication pages, third-party requests, query-bearing requests and mutations are never cached/intercepted. A failed install removes only the new incomplete shell. User project, music and reference IndexedDB/localStorage records are outside this cleanup.

Ready offline requires an active worker to report every required cached asset, rather than merely being registered. Prepare / repair offline restores missing assets only when their server bytes match the installed build. If an update is waiting, apply it first; a different online release cannot silently mix into the current cache. Network responses remain usable if a cache write fails.

New workers wait for a user-directed Save and update. The app pauses playback and requires a successful save, while the worker requires other CHORYN windows to close before activation. Update checks retry after reconnection and returning to the app (15-minute visibility throttle). Early boot captures install events. Install prompts are single-use; appinstalled or display-mode changes confirm installed state. Worker status errors/timeouts and failed/redundant installations are surfaced in the panel.

The panel reports storage usage/quota and optionally requests persistent storage on an explicit click. The browser decides whether to grant it. Backups remain necessary, particularly before changing browsers, replacing a home-screen app, or clearing data.

## Logo formats

All icons derive from the unchanged official Figma five-node artwork. No generated replacement mark is used.

- Manifest icons: 96, 128, 192, 256, 512 and full-bleed 1024px PNG.
- Android/adaptive icons: separate opaque 192px and 512px maskable PNG, with all mark pixels inside the central safe circle.
- iPhone/iPad: explicit opaque 120, 152, 167 and 180px Apple touch icons, plus root apple-touch-icon.png discovery fallback.
- Browser/bookmark/desktop shortcut fallback: adaptive light/dark SVG favicon, 16/32/48px PNG and an ICO containing 16/32/48/256px PNG frames.
- Manifest shortcuts: Projects, Rehearsal, Install & offline. Hash-only URLs open real existing views and use the official 96px icon. Shortcuts are exposed only where the OS/browser implements them.

The manifest link uses credentials for this owner-private site. Standard standalone mode retains OS window controls instead of requesting a titlebar overlay that the editor does not implement. Modern Mac dock installations can select the full-bleed 1024px icon; OS/browser selection and update timing remain outside website control.

## Device guidance and limits

| Device | Installation path |
| --- | --- |
| iPhone / iPad | Share → Add to Home Screen; keep Open as Web App enabled where shown. |
| Mac Safari | macOS Sonoma 14 or later: File / Share → Add to Dock. |
| Android | Browser Install app / Add to Home screen, or the captured native install prompt. |
| Windows / macOS / Linux / ChromeOS | A compatible browser's Install app / address-bar menu; otherwise a browser shortcut/bookmark. |

A website cannot guarantee native installation, arbitrary old OS support, or immediate replacement of an OS-cached shortcut icon. The panel explains recovery for a stale icon and advises exporting backups before removing an installed app. Installation may have separate local storage from the originating browser. The site remains private and local-first; push messaging, accounts and cloud collaboration were not added to this release.

## Primary references checked 21 October 2026

- Apple touch sizes: https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html
- WebKit home-screen icons and Apple touch precedence: https://webkit.org/blog/13878/
- Mac Add to Dock: https://support.apple.com/en-gb/104996
- High-resolution full-bleed Mac web-app icons: https://webkit.org/blog/14787/webkit-features-in-safari-17-2/
- Service worker lifecycle: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
- Credentialed manifest links: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest
- Persistent storage: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
- App shortcuts: https://learn.microsoft.com/en-in/microsoft-edge/progressive-web-apps/how-to/shortcuts
