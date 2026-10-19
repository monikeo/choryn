# CHORYN 0.3 verification — 19 October 2026

## Automated

`npm test`: 44 passing tests. `npm run build`: static production output generated successfully. No external runtime dependencies.

Tests cover presets from 1 to 100 performers; stable identities; exact keyframes and shortest facing; direct/curved/waypoint interpolation; route delay and locking; geometry without mutation; import allowlists and relationship validation; complete media bundle round-trips and corruption/truncation rejection; legacy JSON; SVG escaping and stage proportions; transforms/distribution; 3D projection; CSV formula protection; Unicode calendar folding; marker contrast; timeline snapping, bounds, approvals, clip trimming/movement, sequence slot preservation and route pruning; custom groups/tags; all quality settings and encoder detection; video frame rendering; manifest assets; and authenticated-route/cache exclusions.

The service worker tests install a full shell into an in-memory cache and reopen app HTML and JavaScript with the network unavailable. Login HTML is rejected as an app shell; mutation, cross-origin, query-bearing, and authentication requests are not intercepted.

## Browser observations

The local Chromium-based in-app browser was used. Viewport emulation checks are not physical iOS/Android or Windows packaged-app certification.

- Existing project data, stage object, choreography section, scheduled rehearsal, and review note persisted through reload.
- Actual WebGL 3D stage rendered, including performers, stage and platform. Shared sampled positions drive both views.
- Formation boundary grip drag changed Find the light from 32 to 34.5 seconds. Whole-block drag changed Open diamond from 16 to 18 seconds. Undo restored the authored times.
- Sequence arrow action moved Find the light into slot two while preserving times 0/16/32/48/64/80. Undo restored the sequence. Pointer drag/drop then moved Open diamond from slot two to slot four; Undo restored it.
- Movement end-handle dragging extended the opening section from 20 to 22 seconds; Undo restored it. Exact rehearsal loop 16–20 seconds saved and enabled loop mode.
- Group and tag editing with ordinary keyboard input committed on blur; Tab moved focus to the next field. Searching entrance-left found Sofia. Bulk editing updated two selected profiles, including a custom Front line group.
- Video recordings generated playable previews: 480p WebM + audio, standard, 30 fps target (854×480, 1.554 s for a 1.5 s range); 1080p MP4 + audio, high, 30 fps target (1920×1080, 2.143 s for a 2 s range); 1440p WebM, compact, 24 fps target, no audio (2560×1440, 0.971 s for a 1 s range); and 720p WebM + audio, standard, 60 fps target (1280×720, 1.086 s for a 1 s range). Each preview reached readyState 4 without a video error. These short clips verify output creation and dimensions, not sustained 60 fps performance on all devices.
- Cancelling a full-duration export stopped the recording and returned to settings. No download was forced during this check; the preview exposes an explicit Download video action.
- Fullscreen stage expanded the canvas, kept stage zoom/fit/editing controls available, and could be exited. Phone uses the CSS full-window focus view; desktop can additionally request browser fullscreen.
- Desktop 1440×900: panels, stage and all timeline lanes visible without page overflow. Adaptive ruler and cue-track clipping were corrected.
- Phone 390×844 and 320×568: native bottom navigation, formation strip, accessible dialogs, compact timeline, fullscreen, and tag-based mobile roster search checked. The smallest height collapses timeline lanes while retaining exact timing/sequence controls.
- Tablet 834×1194: large stage, formation strip, drawers and complete timeline. Tablet 1194×834: no horizontal page overflow and cue track stayed inside the timeline.
- Landscape 844×390: compact layout was checked and a CSS specificity issue that had consumed the stage height was repaired; the final recheck showed stage bottom exactly aligned with timeline top (306 px), with no page overflow.
- Production preview on port 4174 cached the shell. After stopping that server, a reload still opened the studio and Production view. The first-install false update banner was repaired. The final 0.3 production update was explicitly activated, the server was stopped, and a reload still opened the new multi-quality video dialog. No browser errors were reported. Offline-cache unit tests also cover all newly added modules.

## Limits

Video export is a real-time browser recording of the 2D stage. Codec availability, memory, sustained frame rate and installation vary by browser/device. Physical Safari/iPhone/iPad and Android hardware were not tested. Long high-resolution exports were not stress tested; memory limits and cancellation are implemented. A preview and download are local browser artifacts, not a hosted video service.

Project data and uploaded music remain tied to browser/origin. Clearing browser data can remove them. Use portable backups. No cloud account, real-time multi-user editing, billing, native executable, full translation, or AI service is connected. Geometric reports sample transitions and cannot guarantee safe paths or dancer biomechanics.
