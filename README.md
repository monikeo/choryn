# CHORYN Studio · 0.7.1

A local-first formation and rehearsal studio. The interface keeps CHORYN’s quiet violet workspace, meter-based stage, and visible formation sequence while adapting navigation and controls to desktop, phone, and tablet.

## Run

Node.js 20+; no npm dependencies. Direct Node commands also work if a system npm installation is unavailable: from `studio/`, run `node scripts/serve.mjs`, `node --test`, or `node scripts/build.mjs`. From the workspace root, run `npm run dev`, `npm test`, or `npm run build`. The app lives in `studio/`; its package exposes the same scripts. Preview the production build by running `node scripts/serve.mjs --built` from `studio/`.

## Formation workflow

1. Create or open a project, set the stage size, tempo, duration, and cast.
2. Choose one of 36 shapes, drag performers, enter exact coordinates/facing, or transform a selected group. Presets can apply only to selected performers. Copy/paste positions, rotate, scale, mirror, align, and distribute. Per-formation visibility supports entrances and exits.
3. Add, insert, duplicate, rename, retime, approve, or delete formations. Sequence supports desktop drag/drop and touch/keyboard arrow buttons. Reordering preserves timing slots and removes routes between separated formations. Approved formations must be unlocked before affected edits.
4. Edit the outgoing route for each performer, including waypoints, delay, movement window, easing, and route lock. The 2D stage, real WebGL 3D view, playback, and video all sample the same meter-based performance model.
5. Rehearse with audio, waveform, BPM/counts, speed, loop range, and performer-specific instructions. Check geometric spacing and obstacle notes, add review comments, and export.

## Timeline and stage

Version 0.4 adds a selectable clip editor: click to select, double-click for details, or right-click for Clip tools. Duplicate, split at playhead, copy/cut/paste, trim either edge, and delete are available for the relevant clip type. Every formation delete or cut asks for confirmation; revision restoration also asks when it removes formations; opening/approved protections remain. Formation right edges are shared with the next formation, and the final end controls performance duration without cutting off other authored content. Splitting a formation inserts its sampled pose and rebuilds the transition; route overrides on that interval are removed. Cues are point events and cannot be split.

The timeline has a draggable height separator (keyboard arrows also work), stacked rows for overlapping movement instructions, 100–3200% zoom, auto-scrolling during edge drags, and context-specific shortcuts: Ctrl/Command D duplicates, C/X/V copies/cuts/pastes, S splits, Delete confirms removal, and arrows scrub by beats. Clipboard contents stay inside the current project/session and reconcile stable cast identities on paste. Undo/redo now restores the editor's active formation, playhead, and cast selection as well as authored data.


Drag formation blocks or their left grips to retime within neighboring boundaries. Drag movement clips and technical cues; trim movements from either end. Choose beat, half-beat, second, or exact snapping. Zoom 100–3200% with buttons or Ctrl/Command + wheel; scroll horizontally and use Fit to see the whole performance. Edit timing provides an exact, keyboard-accessible alternative to dragging. Time labels adapt to available width.

The stage supports 25–600% 2D zoom, numeric zoom entry, cursor-anchored mouse wheel zoom, pan, fit, mirrored view, grid/snap, measurement, multi-select, keyboard nudging, 2D pinch zoom/pan, and 3D orbit/pinch. Drag an empty part of the 2D stage to box-select performers; Shift/Ctrl/Command adds and Alt subtracts. Middle-button drag or Space+drag pans; a short Space tap still toggles playback. Double-click empty stage to reset the view, double-click a performer for properties, and right-click for stage/selection tools. Focus selected fits the view to the chosen cast. Group drags and nudges preserve relative spacing at boundaries. Fullscreen stage focus includes previous/play/next controls. Desktop browsers can enter browser fullscreen; smaller devices use a full-window stage view. Press F or the fullscreen button; Escape exits.

The template library offers 36 shapes in Lines, Curves, Wedges, Geometric, and Dance categories: search/filter, preview, compact/balanced/wide spacing, facing direction, and optional application only to selected cast. More → Template library opens it on phone/tablet. It is distinct from the formation navigator for the current project.

## Cast and production

Up to 100 performers and 100 formations, with performances up to one hour. Custom group names, roles, colors, and up to 12 tags per performer; bulk editing and roster search by name/group/role/tag. Stage objects, platforms, restricted areas, choreography sections and reference links, rehearsal scheduling and calendar export, timestamped local review notes, manual showcaller GO confirmations, cue CSV, performer rehearsal cards, and sampled spacing/travel reports are included.

Reports are geometric planning aids, not biomechanical simulation or safety certification. Technical cues do not control real stage equipment. Review authors are local labels, not authenticated identities.

## Exports

- Animated top-down performance video at 480p (854×480), 720p (1280×720), 1080p (1920×1080), or 1440p (2560×1440).
- Compact, standard, or high bitrate; target 24/30/60 fps; full performance or selected range; optional names and music. MP4 and/or WebM are offered according to the browser encoder’s actual capability. Preview before downloading.
- Video recording takes real time and must stay visible. Actual frame rate depends on the device; encoded duration can differ by a small frame/audio padding interval. Estimated exports over 400 MB are rejected; shorter clips or lower quality reduce memory usage. Video is 2D; 3D human views do not export as video in this release.
- PNG, SVG, print/PDF formation sheets, cue CSV, rehearsal ICS, portable `.choryn` backups bundling stored audio with SHA-256 integrity checks, and read-only URL snapshots without music.

## Local storage and installation

Projects save to localStorage, uploaded audio to IndexedDB, and the latest ten changed editor snapshots to a separate IndexedDB history. Undo/redo covers session project edits; replacing music is outside media undo. The editor recovers valid projects from a partially damaged collection, preserves raw recovery data, reports save failures, flushes on page hide, and blocks silent overwrites from competing tabs.

Export a portable backup before changing device, clearing browser data, or moving between localhost and the hosted site. Projects are tied to the current browser and origin; they do not automatically migrate between those addresses. Snapshots copy project data into a URL and are not live collaboration, revocable sharing, or authenticated access control.

The production build includes a manifest, install icons, and a versioned offline shell. Installation is browser/platform dependent; the Install CHORYN tool includes manual iPhone/iPad guidance. Offline reopening works after the production shell has been cached. Updates are explicit to preserve coherent editor versions. System fonts are available offline when the remote Google Fonts are unavailable. This is an installable web app, not a packaged Swift, Android, or Windows executable.

## Architecture and verification

Canonical coordinates: X increases audience-right, Z increases upstage, facing 0° points downstage. `engine.js` validates the versioned model and samples movement. `timeline-model.js` handles immutable timing, clip operations, overlap packing, and waveform scaling. `timeline-ui.js` owns clip gestures, selection, clipboard, confirmations, and resizing. `mouse-model.js` supplies box selection and bounded group translation; `templates.js` defines the shape catalog. Renderers are `stage2d.js`, `stage3d.js`, `exports.js`, and `video.js`. `studio-power.js` integrates timeline gestures, sequence/cast dialogs, fullscreen, and recording. `features.js` implements rehearsal/production/review/report modules. `backups.js`, `revisions.js`, and `pwa.js` handle local durability and installation.

108 automated tests cover canonical sampling, imports, geometry, route timing, backups, production references, timeline constraints/reordering, custom cast metadata, quality settings, encoder detection, rendering, calendar/CSV escaping, text contrast, and offline cache boundaries. Browser checks cover actual recordings at all four resolutions, drag timing/undo, sequence edits, cast/tag workflow, fullscreen, responsive viewports, and offline reopening. See `VERIFICATION.md` in the app and the workspace `docs/verification-v071.md` for current evidence and limits.

This release deliberately remains local-first. Accounts, cloud collaboration, billing, AI generation, full translation, native app binaries, and motion-capture/biomechanics remain outside the implemented release. The original complete specification is retained in the workspace documentation.

## Device and browser compatibility (0.4.1)

Desktop uses persistent navigation and inspectors; tablet uses a formation strip and drawer inspectors; phones use bottom navigation, compact transport and scrollable clip tools. Touch/pen pointer gestures, mouse controls, keyboard alternatives, portrait/landscape layouts, safe-area spacing, and installable PWA metadata are included. Fullscreen falls back to a full-window stage when the native API is absent or denied. WebGL falls back to the 2D editor.

Dialogs follow the visual viewport so browser chrome and on-screen keyboards can reduce available height without hiding the form. Older viewport implementations use a 100vh/resize fallback. Cloning, stable IDs, backward formation lookup, resize observation and prefixed Web Audio have explicit compatibility paths. If audio cannot initialize, playback continues as a silent visual rehearsal. Export checks both canvas capture and supported encoders; a missing codec does not disable the editor. Device recording availability appears in Studio preferences. High contrast mode retains control outlines.

Targets are current Chrome, Edge, Firefox and Safari, including Android, iOS and iPadOS browsers and compatible installed PWAs. This is an adaptive web application, not separate Windows/macOS/iOS/Android binaries. No claim is made that every historical browser, embedded webview or physical device has been tested. JavaScript, SVG and Pointer Events are required for editing; advanced media, installation and fullscreen depend on actual browser capabilities. Private browsing or device storage policies can restrict persistence; export backups before clearing data or changing devices.

## Workspace editing in 0.5

Stage rotation is a camera setting: quick ±90° turns, exact angles, left/right reflection and audience up/down reflection. Labels stay upright; pointer zoom, performer dragging, group selection and screen-direction keyboard nudges follow the transformed view. The 3D view rotates its orbit camera. View changes do not rewrite performer coordinates or the canonical orientation used in exports.

The timeline's Drag selector defaults to Reorder: dragging a formation body drops it into another sequence slot. Its identity, positions and custom movement settings travel together; time slots stay fixed and disconnected route overrides are removed. Retime moves the start inside neighboring boundaries. Edge handles always trim boundaries. Reorder rejects any affected approved formation. Sequence arrows provide a keyboard/touch alternative, and the timeline retains copy/cut/paste, duplicate, split, trim, snapping, zoom, exact timing and Undo/Redo. Every formation deletion or cut still confirms first.

Each outgoing formation can have an independent movement duration, easing and path style. The movement finishes at the next formation; the remaining interval is a hold. A timing dialog shows seconds, counts and the hold/move breakdown. Existing individual performer routes retain their own overrides. Shortened intervals clamp playback to fit without discarding the saved duration. Reset returns only that formation to project defaults. Settings survive local save, backups and snapshots and drive 2D, 3D, video and analysis consistently. The final formation holds to performance end.

Fullscreen now has Show/Hide timeline. With the timeline visible, the stage resizes above it while clip editing, sequence controls, custom movement timing, playback, zoom, scrolling and timeline height adjustment remain available. Desktop native fullscreen and the mobile full-window fallback share these controls. Escape dismisses a dialog before leaving fullscreen.

The 36-shape library adds 12 Dance templates: Spotlight fan, Infinity flow, Butterfly wings, Four-petal bloom, Starburst, Serpentine, Ripple lines, Layered chevrons, Three dance pods, Orbit rings, Soloist & halo, and Runway reveal. Rotate or mirror a template independently of performer facing; shapes fit the stage automatically. Selected-cast-only application and compact/balanced/wide spacing remain available.


## Motion, music and recovery in 0.6

Props support rectangle, ellipse and triangle shapes, rotation, size, height and colour. Enable animation in the prop editor to set poses at exact times; later poses automatically retain a starting pose. Drag props on the stage at the current playhead to author a pose, or seek/edit poses from the timeline. Position, size, height, rotation and colour interpolate; shape changes at the arrival pose. Animated props render consistently in 2D, 3D, video and sampled formation exports. Locks and Undo protect edits; a project supports up to 100 poses per prop.

Select a performer and choose the Path tool. Drag the route to add a control, drag round handles to bend it, use arrow keys for fine adjustments, or Delete to remove a saved control. The route dialog provides exact coordinates and a choice of smooth curves or straight waypoint segments. Curve timing, distance analysis and all renderers use the same sampled route. Approved formations and locked routes reject edits.

Music tools chooses Silent, Studio sketch, or an uploaded file. New projects start silent. Uploaded music retains its original source in browser storage and portable backups; source trims and a timeline offset are non-destructive project settings. Drag the music clip to move it, drag its edges to trim, or enter exact seconds in Music tools. The waveform and video soundtrack follow the same source window. Set BPM and first-downbeat position manually for beat snapping. Silent rehearsal needs no audio file, and playback can continue after a trimmed soundtrack ends.

Counts & timing accepts phrase.count notation such as 8.1 and 8.2+0.5, fractional interval lengths and individual movement counts. A fine scrubber previews performers and prop animation continuously. Fullscreen keeps these controls with Show timeline. Exact clip seconds remain available for count-in material before the first downbeat.

Startup recovery offers Reload and a raw project-data copy if the editor cannot load. Runtime error handling pauses playback, cancels active edit gestures and recording, and shows a recovery notice. Preferences → Error recovery lists the latest 20 unexpected diagnostic entries in memory on this device; no telemetry is sent. Invalid form edits preserve the previous validated project. Audio storage has timeout/blocked handling; failed saves, imports and unsupported exports provide actionable messages. The emergency startup copy excludes stored audio; a normal portable backup includes it. These safeguards cannot prevent every browser, storage or hardware failure.


## Performance and adaptive workspace in 0.7

Playback patches existing performer and animated-prop nodes rather than recreating the SVG layers every frame. Holds skip unchanged transform writes. Formation boundaries update the active formation and inspector without rebuilding the whole workspace or recreating the WebGL context. Transport text updates preserve its DOM containers. Playback targets 30 visual updates per second, pauses when the page is hidden, and samples the performance once per update. Audio and export retain their independent timing.

The 3D module loads on demand with a guarded 2D recovery action. Camera gestures coalesce to one animation frame, reuse uploaded geometry and cache stage fitting; performer labels retain their nodes. Spacing reports sample props once for the entire cast and reuse cast lookups. A Node benchmark with 100 performers, 12 animated props and 20 poses per prop produced identical reports, with median report time decreasing from 2.05 ms to 0.51 ms on this machine. This measures the report routine, not whole-app frame rate.

Desktop adds independent formations/inspector panel toggles, readable form controls and a shorter timeline on laptop-height screens. Phone mode prioritizes the stage with larger controls, an explicit Edit/Done timeline button, quick count/music access, and a compact formation track. Expanded editing retains the audio, props, cues and full clip tools; its toolbar scrolls horizontally. Small phones and landscape layouts keep stage and editor space available. Safe-area, keyboard viewport, PWA and fullscreen fallbacks remain in place.

The last selected local project is reopened on the next launch. Web fonts load without blocking the core workspace stylesheet; system fonts remain available offline. Mobile fullscreen Stage controls provides Select, Pan, Edit curved paths and Measure with touch-friendly actions.


## Fullscreen playback in 0.7.1

A phase-aligned scheduler replaces the rounding-sensitive elapsed-time cap. The shared 2D/3D stage loop targets up to 60 updates per second; visible timeline controls update at up to 10, and hidden fullscreen timeline controls stay idle. Automatic quality uses editor/3D CPU update cost to reduce the target to 30 when necessary, then restores it after sustained headroom. Preferences → Playback performance also offers Smooth (60 target), Efficient (30 target), and bounded local diagnostics. Audio and video-export timing are independent. These update targets are not a guarantee of displayed FPS on every device.

Fullscreen hides unused chrome and avoids hidden-inspector rebuilding at formation boundaries. Playback removes only decorative workspace dots and hides curve editing handles until pause; performers, animated props, paths, stage grid and editing data are preserved.
