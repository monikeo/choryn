# CHORYN v0.12 navigation and PWA verification — 22 October 2026

200 automated tests pass, including 13 new navigation tests and expanded 3D capture regression checks. All 52 application/script JavaScript syntax checks and the production build pass. All 126 relative module edges resolve. The offline shell has 92 entries: 88 static byte-hashed assets and four matching-build HTML routes. Hosting-injected security scripts are preserved unchanged. Canonical /index.html → / and /offline.html → /offline redirects are accepted only at those exact same-origin targets.

## Navigation

- 3D: mouse wheel / Ctrl-pinch zoom, left drag orbit, right/middle drag pan. The on-stage View controls panel exposes Orbit/Pan modes, pan and tilt/rotate buttons, zoom, fit and focus selected performers. Pan mode supports plain left drag and trackpad scrolling.
- Touch: one finger orbits in 3D; two fingers pan/pinch, and a remaining finger resumes without jumping. A third touch is ignored safely. Pen input uses the same pointer controls.
- 2D: existing performer drag, box selection and editing remain; Pan mode now supports trackpad scrolling, normalized line/page wheel input and the same visible navigation controls. Two-finger navigation rolls back unfinished edits before moving the camera. Manual navigation pauses Follow while retaining its current framing; orbit/zoom retain Follow.
- Pan targets survive playback and re-renders. 3D capture reads current yaw, pitch, zoom and target; camera-only navigation avoids geometry uploads. Export renderers have no navigation UI or input listeners. Keyboard shortcuts remain optional. Cancellation, lost capture, window blur, recovery and hidden documents stop active gestures.

## Evidence

Navigation tests cover finite camera bounds, wheel unit normalization, orbit clamps, distance-scaled screen-axis panning, focus-plane pointer-anchored zoom, ordinary wheel/right-drag input, clickable Pan mode, Ctrl-pinch precedence, two-finger rebasing, third touches, cancellation/lost capture/blur/abort cleanup, reset/keyboard input, real navigation-panel handlers and actual 2D binding execution without project mutation. The real WebGL renderer (with GL/DOM doubles) verifies changed orbit matrices and geometry reuse in captured frames. Existing PWA, editor, timeline, deletion confirmation, MP4, image-preview/batch and error recovery tests remain green.

PWA icon coverage includes Apple 120/152/167/180px with root discovery fallback, Android opaque maskable 192/512px, desktop 96/128/192/256/512/1024px, PNG 16/32/48px favicons and 16/32/48/256px ICO frames. All source artwork remains the unchanged official Figma five-node logo.

## Limits

Live browser UI and physical-device interaction/installation remain unverified following the earlier policy denial. No browser workaround or Lighthouse result is claimed. Automated pointer/capture tests use DOM/WebGL/message/cache doubles. Authenticated HTTP/worker integration is a separate check of production assets and cache behavior, not proof of browser registration or physical OS installation. Older OS/browser versions may lack PWA installation, newer media codecs or some pointer APIs. OS shortcut selection/update timing is controlled by the platform. See PWA.md and BRANDING.md for provenance and compatibility.
