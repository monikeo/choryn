# CHORYN 0.7 verification — 20 October 2026

103 automated tests pass, every application/script JavaScript syntax check passes, and the production build succeeds. Seven new regression tests exercise stable performer/prop DOM updates, unchanged-hold write suppression, shape-keyframe geometry replacement, entrance/exit handling, focused scrubber protection, transport updates, one prop sample per spacing report, and 3D scene invalidation for selection, cast, visibility and animated prop geometry.

## Performance

Playback now samples performers once per visual update and patches cached DOM references. Animated prop objects retain their wrapper nodes; geometry is replaced only when the shape type changes. Repeated holds cause no extra performer transform writes in the 100-performer regression fixture. Formation boundaries update the inspector and active sequence without rebuilding the entire app or recreating the WebGL context. The clock targets 30 visual updates per second and pauses when the page is hidden.

WebGL loads on demand. Camera gestures coalesce to animation frames, reuse geometry and cache camera fitting; unchanged hold scenes skip geometry uploads/redraws. Labels retain their nodes. The core CSS no longer waits on a remote font @import; optional fonts load separately and the system fallback remains usable.

A Node spacing-report benchmark used 100 performers, 12 animated props, 20 poses each, eight warmups and 50 timed runs. Comparing the prior engine routine with this release produced identical reports: median 2.05 → 0.51 ms and p95 3.413 → 1.072 ms. This measures that routine on this machine, not whole-app FPS. Raw results: docs/performance-v07.json.

## Browser observations during implementation

- 1280×720 laptop: stage viewport height increased from 140 to 193 px; default animated-prop timeline decreased from 280 to 240 px. Independent panel toggles hid either sidebar, with both hidden yielding a 1216 px stage viewport. No horizontal document overflow.
- 390×844 phone: larger stage/transport/zoom controls, quick Music and Counts buttons, and explicit Edit/Done timeline controls worked. Expanded editing kept a 220 px stage viewport and a 370 px timeline.
- 320×568 phone: compact mode kept a 172 px stage viewport; expanded mode retained 77 px above a 245 px editable timeline. Clips were 38 px tall. Clip tools opened, Delete requested confirmation, and Keep formation cancelled removal.
- 844×390 landscape: compact mode kept a 206 px stage viewport and a 98 px transport area. A hidden-track CSS conflict was found and fixed. The expanded view then kept a 94 px stage viewport and 96 px of visible timeline tracks in a 210 px timeline.
- 834×1194 tablet: no horizontal document overflow, a 515.6 px stage viewport and a 249 px timeline. Tablet dialog inputs now use 16 px text and at least 44 px height.
- A new local Performance QA 0.7 project with 100 performers played through the 16-second boundary into Open diamond, retaining 100 performer markers.
- Deferred 3D loading produced one WebGL canvas and 12 labels. Keyboard camera rotation worked. Playback advanced from Open diamond at 29 s to Find the light at 36.95 s; canvas count remained one and the inspector followed the active formation. No console errors were observed in that check.
- Mobile fullscreen at 320×568 opened Stage controls, switched to Edit curved paths, closed the dialog and exposed draggable path controls without toolbar overflow. The stage viewport remained 180 px above a 245 px timeline.

## Limits

The browser session was subsequently replaced by a browser error page, and the browser security policy denied access to observe it. No workaround was attempted. Final repeat drag/prop checks, final production offline reload, and hosted visual rechecking could not be completed in that session. The build/cache closure and automated motion/prop tests pass; v0.6 had previously passed production offline reopening and animated-prop MP4 recording. New source is not claimed to have passed those browser checks again.

Viewport tests use Chromium, not physical Safari, iOS, iPadOS or Android hardware. Installability, native fullscreen and recording codecs remain browser-dependent. This is an adaptive installable web app, not native platform binaries. Position, size, height, rotation and colour interpolate; shape changes occur at arrival keyframes. Music is optional. Existing delete confirmations, validation/recovery, local storage and private audience are retained.
