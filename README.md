# CHORYN Studio · 0.10.0

A local-first formation and rehearsal studio. The interface keeps CHORYN’s quiet violet workspace, meter-based stage, and visible formation sequence while adapting navigation and controls to desktop, phone, and tablet.

## Run

Node.js 20+; no npm dependencies. Direct Node commands also work if a system npm installation is unavailable: from `studio/`, run `node scripts/serve.mjs`, `node --test`, or `node scripts/build.mjs`. From the workspace root, run `npm run dev`, `npm test`, or `npm run build`. The app lives in `studio/`; its package exposes the same scripts. Preview the production build by running `node scripts/serve.mjs --built` from `studio/`.

## Image export studio and MP4 in 0.10

**Export → Preview stage image** shows the current PNG before downloading. SVG previews use the same workflow. **Export → Batch images & timeline captures** opens the image export studio: capture the current playhead, select formations, or sample a timeline range every chosen number of counts/seconds. The timeline toolbar's camera icon defaults to the selected clip's range. Start/end samples are included, formation selections keep sequence order, and up to 100 images can be prepared per batch.

Choose PNG, JPEG (50–100% quality), or SVG; 1x/2x viewport scale; each edge remains capped at 4096 pixels. The preview gallery supports enlargement, individual download, selection and one ZIP download containing the selected images plus `images.json` with capture times. Generating previews never downloads automatically. Batches reuse one stage renderer and are bounded to 100 MB; lower the scale or select fewer images when needed. Closing/cancelling releases temporary media and preview URLs. JPEG/SVG/PNG preserve the selected stage view and exact sampled positions; 3D SVG is an embedded raster snapshot.

**MP4** now automatically chooses either browser MP4 recording or a bundled H.264 WebCodecs encoder/muxer. The latter renders individual frames with explicit timestamps, retaining the same stage renderer/camera and trimmed soundtrack. AAC music support is checked; when unavailable, native MP4 recording is used if supported. If neither route can encode the selected quality, the UI offers compatible formats or guides the user to reduce quality, export silent MP4, or use another browser. MP4 support depends on device/browser encoders; WebM remains available where supported. Files are actual MP4 containers, never renamed WebM. Video preview still comes before download.

Mediabunny 1.62.0 is bundled locally under MPL-2.0 with its license and pinned source notice. The npm package SHA-512 was verified. No video or image data is sent to a conversion server, and no CDN is needed at export time. See the [official media-writing guide](https://mediabunny.dev/guide/writing-media-files) and [source](https://github.com/Vanilagy/mediabunny/tree/v1.62.0). No npm install is required to run CHORYN.

## Recovery fix in 0.9.1

Opening Properties, Preferences, workspace tools or other dialogs pauses playback. That transport-only update deliberately omits stage state. The updater now leaves the stage/analysis layers alone when state is absent, preventing the undefined `analysis` error that blocked dialogs in 0.9.0. Existing overlays remain intact and normal stage updates still work. No project reset or storage migration is required. Reload the site and accept Save and update to replace an installed offline shell.

## Workstation and analysis

The violet workstation keeps the stage central with Choreograph, Rehearse and Export arrangements. Panel visibility, preset selection, timeline expansion and desktop panel widths are saved locally. Desktop separators support pointer dragging and keyboard arrows/Home. Tablet and phone retain touch navigation, properties sheets and expandable timelines; compact controls scroll within their toolbar, and narrow stage panels wrap their controls. Fullscreen retains command search and analysis access alongside the show/hide timeline control.

The timeline toolbar uses icons for duplicate, split, copy/paste, cut, trim and delete, with accessible names, shortcut help and disabled-state guidance. Arrow keys move between toolbar buttons. Dragging shows a floating clip, insertion guide, affected route count and snapping feedback. Formation bodies can be swiped to scroll on touch; use the dotted grip to drag and the edge handles to trim. Reorder changes sequence order in fixed time slots; Retime changes timing. Beat/half-beat/second snapping also attracts nearby formation boundaries, checkpoints, cues and the playhead; Off keeps precise timing. Every formation deletion/cut asks first. Reorders that disconnect custom routes show a review before applying, including in the sequence list; Undo restores the previous score. Escape/pointer cancellation rolls back unfinished gestures.

**Compare & heatmaps** compares the active formation with a reference formation using stable performer identities, displacement, shortest facing-angle change and visibility changes. Ghost positions and connecting lines overlay either 2D or 3D. Travel heatmaps show approximate curved path length per performer, with a distance table. Spacing heatmaps mark the closest sampled approaches below an adjustable 0.2–5 m threshold; selected-cast focus is optional. The outgoing movement window uses 33 samples and is cached between formation boundaries. Fast crossings between samples can be missed. These are geometric planning aids, not collision avoidance or safety certification. Analysis is view state and does not edit choreography.

**Command search** (Ctrl/Command K, or the search button) finds editing tools, exports, formations and performers, including cast groups/roles/tags. Type to filter, use Up/Down and Enter, or click/tap a result. Read-only restrictions, Undo and deletion confirmations still apply. Closing search keeps cast selection.

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

## Rehearsal views

Open **View aids** beside the fine scrubber, or from the stage workspace menu (also available in fullscreen). Show previous/next formation ghosts, saved named checkpoints, or intermediate dots every 1/2/4/8 counts during the outgoing movement. Dots use the same curved path and timing sampler as playback, align to the music count grid, and can focus on selected cast. Rendering is bounded to 300 ghost positions. Named checkpoints are saved in the project, can seek the playhead, and support Undo. View overlays and follow selection are session camera settings.

Follow a performer or named group in either 2D or 3D. The camera tracks its visible centroid; view zoom remains editable and choreography coordinates stay unchanged. Fit stage, Ctrl/Command 0, or disabling Follow restores manual framing. Disable Follow to pan manually.

**View aids → Synced reference video** accepts a local video up to 250 MB that the browser can decode. Trim the source, set its performance start time, set the source FPS, and show/hide a muted picture-in-picture guide. Scrubbing, playback speed, pause and ±1 frame stepping share the performance clock. Stepping seeks by the entered FPS; variable-frame-rate material does not provide guaranteed frame-index precision. Before/after the clip the guide holds its first/last frame. Reference source files stay in a separate local IndexedDB store; portable backups carry their settings, but do not bundle the original video. Attach it again on a different browser/device. Replacing or hiding a guide retains its earlier local source for revisions.

Open a stage object's **Attachments & handoffs** to attach it at a count/time to a performer, hand it to another performer, or detach it to the floor. Offsets may rotate with performer facing. Keep world position calculates offsets to avoid a jump at the transfer. Click an existing event to seek and edit it; saving at the same time replaces that event. Later carrier events take over location/orientation, while existing keyframes continue to animate size, shape and colour. Handoffs are instantaneous ownership changes, not simulated arm motion. All authored events are validated, backed up, and undoable; duration trims protect them.

## Exports

- Current 2D or 3D stage video at 480p, 720p, 1080p, or 1440p target height, keeping the stage viewport aspect ratio (even codec dimensions; width capped at 4096).
- Current zoom, rotation/reflection, grid/paths, ghosts, cast selection, animated props and follow camera are retained as applicable to the selected view. 2D uses the same SVG renderer; 3D captures the same WebGL scene and projected labels. Optional reference video keeps its visible placement. Editor controls, panels, and timeline chrome are excluded. Fonts/shadows can differ slightly in raster output.
- Compact, standard, or high bitrate; target 24/30/60 fps; full performance or selected range; optional names and music. MP4 is preferred when either H.264 frame rendering or native MP4 recording is supported; WebM alternatives are offered. There is no server transcoding or falsely renamed file. Preview before downloading.
- Recording takes real time and must stay visible. Actual frame rate depends on the device and decoding load; encoded duration can differ by a small frame/audio padding interval. Estimated exports over 400 MB are rejected. Decode, cancellation, hidden-tab, memory, and graphics errors stop recording with recovery guidance. Try a shorter range or lower quality on mobile.
- PNG and SVG now capture the current stage camera, exact playhead, analysis overlays and optional reference guide using the same renderer as video. PNG supports 2D/3D. SVG keeps 2D vectors and embeds reference frames; a 3D SVG is explicitly identified as an embedded raster snapshot. Images scale with the viewport and are capped at 4096 pixels per edge. Printable formation sheets remain a separate format.
- Print/PDF formation sheets, cue CSV, rehearsal ICS, portable `.choryn` backups bundling stored audio with SHA-256 integrity checks, and read-only URL snapshots without media source files.

## Local storage and installation

Projects save to localStorage, uploaded audio and reference video to IndexedDB, and the latest ten changed editor snapshots to a separate IndexedDB history. Undo/redo covers session project edits; replacing music is outside media undo. The editor recovers valid projects from a partially damaged collection, preserves raw recovery data, reports save failures, flushes on page hide, and blocks silent overwrites from competing tabs.

Export a portable backup before changing device, clearing browser data, or moving between localhost and the hosted site. Projects are tied to the current browser and origin; they do not automatically migrate between those addresses. Snapshots copy project data into a URL and are not live collaboration, revocable sharing, or authenticated access control.

The production build includes a manifest, install icons, and a versioned offline shell. Installation is browser/platform dependent; the Install CHORYN tool includes manual iPhone/iPad guidance. Offline reopening works after the production shell has been cached. Updates are explicit to preserve coherent editor versions. System fonts are available offline when the remote Google Fonts are unavailable. This is an installable web app, not a packaged Swift, Android, or Windows executable.

## Architecture and verification

Canonical coordinates: X increases audience-right, Z increases upstage, facing 0° points downstage. `engine.js` validates the versioned model and samples movement. `timeline-model.js` handles immutable timing, clip operations, overlap packing, and waveform scaling. `timeline-ui.js` owns clip gestures, selection, clipboard, confirmations, and resizing. `mouse-model.js` supplies box selection and bounded group translation; `templates.js` defines the shape catalog. Renderers are `stage2d.js`, `stage3d.js`, `exports.js`, and `video.js`. `studio-power.js` integrates timeline gestures, sequence/cast dialogs, fullscreen, and recording. `features.js` implements rehearsal/production/review/report modules. `backups.js`, `revisions.js`, and `pwa.js` handle local durability and installation.

162 automated tests cover canonical sampling, imports, geometry, routes, backups, timeline operations, cast metadata, offline boundaries, checkpoint ghosts, reference time mapping, carrier handoffs, camera transforms, viewport sizing, capture lifecycle and export error cleanup. Test doubles exercise media/WebGL orchestration; they are not evidence of actual browser codec output. Syntax checks, production build, source/build equality and complete static/dynamic module cache closure are verified before packaging. Live browser/decoder testing for v0.9 remains unavailable because browser access was denied by policy; no workaround was attempted. Prior releases' browser checks are historical evidence only. See `VERIFICATION.md` and workspace `docs/verification-v010.md` for the current evidence and limits.
