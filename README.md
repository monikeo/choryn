# CHORYN Studio · 0.3

A local-first formation and rehearsal studio. The interface keeps CHORYN’s quiet violet workspace, meter-based stage, and visible formation sequence while adapting navigation and controls to desktop, phone, and tablet.

## Run

Node.js 20+; no npm dependencies. From the workspace root, run `npm run dev`, `npm test`, or `npm run build`. The app lives in `studio/`; its package exposes the same scripts. Preview the production build by running `node scripts/serve.mjs --built` from `studio/`.

## Formation workflow

1. Create or open a project, set the stage size, tempo, duration, and cast.
2. Choose one of eight shapes, drag performers, enter exact coordinates/facing, or transform a selected group. Presets can apply only to selected performers. Copy/paste positions, rotate, scale, mirror, align, and distribute. Per-formation visibility supports entrances and exits.
3. Add, insert, duplicate, rename, retime, approve, or delete formations. Sequence supports desktop drag/drop and touch/keyboard arrow buttons. Reordering preserves timing slots and removes routes between separated formations. Approved formations must be unlocked before affected edits.
4. Edit the outgoing route for each performer, including waypoints, delay, movement window, easing, and route lock. The 2D stage, real WebGL 3D view, playback, and video all sample the same meter-based performance model.
5. Rehearse with audio, waveform, BPM/counts, speed, loop range, and performer-specific instructions. Check geometric spacing and obstacle notes, add review comments, and export.

## Timeline and stage

Drag formation blocks or their left grips to retime within neighboring boundaries. Drag movement clips and technical cues; trim movements from either end. Choose beat, half-beat, second, or exact snapping. Zoom 100–1600% with buttons or Ctrl/Command + wheel; scroll horizontally and use Fit to see the whole performance. Edit timing provides an exact, keyboard-accessible alternative to dragging. Time labels adapt to available width.

The stage supports zoom, pan, fit, mirrored view, grid/snap, measurement, multi-select, keyboard nudging, 2D pinch zoom/pan, and 3D orbit/pinch. Fullscreen stage focus includes previous/play/next controls. Desktop browsers can enter browser fullscreen; smaller devices use a full-window stage view. Press F or the fullscreen button; Escape exits.

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

Canonical coordinates: X increases audience-right, Z increases upstage, facing 0° points downstage. `engine.js` validates the versioned model and samples movement. `timeline-model.js` handles immutable timing/sequence edits. Renderers are `stage2d.js`, `stage3d.js`, `exports.js`, and `video.js`. `studio-power.js` integrates timeline gestures, sequence/cast dialogs, fullscreen, and recording. `features.js` implements rehearsal/production/review/report modules. `backups.js`, `revisions.js`, and `pwa.js` handle local durability and installation.

44 automated tests cover canonical sampling, imports, geometry, route timing, backups, production references, timeline constraints/reordering, custom cast metadata, quality settings, encoder detection, rendering, calendar/CSV escaping, text contrast, and offline cache boundaries. Browser checks cover actual recordings at all four resolutions, drag timing/undo, sequence edits, cast/tag workflow, fullscreen, responsive viewports, and offline reopening. See the workspace `docs/verification.md` for evidence and limits.

This release deliberately remains local-first. Accounts, cloud collaboration, billing, AI generation, full translation, native app binaries, and motion-capture/biomechanics remain outside the implemented release. The original complete specification is retained in the workspace documentation.
