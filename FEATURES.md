# Feature guide

This is a reference for the current CHORYN Studio release. For a complete first session, follow the [tutorial](TUTORIAL.md).

## Workspace and project storage

CHORYN provides an editable stage, formation list, performer roster, inspector and performance timeline. Wide layouts show these together; smaller layouts use drawers, compact controls and scrollable dialogs. Command search finds tools, formations and performers.

Projects autosave locally. Undo/redo restores project edits, while saved revisions provide another way to revisit work. Conflicting collection writes from another tab stop instead of overwriting that tab silently. Recovery can preserve the current work as a separate project.

Uploaded audio and reference media use browser storage. Portable backups include the project and an available uploaded soundtrack. Setlists have their own local collection and are separate from project Undo.

There is no account, billing or cloud-collaboration backend in this release.

## Formation editing

A formation stores each performer's X/Z position, facing and visibility at a timeline time. Coordinates use meters. X increases to audience-right; Z increases upstage; facing 0° looks toward the audience.

Tools include direct dragging, mouse box selection, multi-selection, numeric positioning, keyboard nudging, rotation, scale, mirroring, alignment and distribution.

The template library has 36 layouts across lines, wedges, curves, geometry and dance shapes. Templates can target the full cast or a selection and support scale, rotation, facing and mirroring before Apply.

Approved formations and locked tracks protect editing. Formation Delete/Cut always requires confirmation. The opening remains at time zero.

## Performance timeline

| Tool | Behavior |
| --- | --- |
| Reorder | Moves formations between existing sequence slots. |
| Retime | Changes a formation start within its neighbors. |
| Trim | Changes a clip boundary; neighboring formation clips share boundaries. |
| Split | Adds an authored pose at the playhead, with a minimum 0.1-second interval on each side. |
| Duplicate | Creates a copy where it fits; overlapping movement clips use packed rows. |
| Copy/paste | Reconciles performer identities and uses authored poses when filling missing cast positions. |
| Delete/Cut | Confirms removal and protects the opening, approved content and locked lanes. |
| Snapping | Beat, half-beat, second or Off, with magnetic targets and Alt precision. |
| Zoom | Fits the score or selected clip and supports focused timeline shortcuts. |
| Ripple | Moves downstream content with timing changes and closes a confirmed deleted interval. |
| Linked editing | Preserves offsets between related formations and production events. |
| Track controls | Show, hide, collapse and lock lanes. |

The lanes cover Music, Formations, Movement, Technical cues, Prop poses, Lighting, Appearance and Camera. Production lanes appear as content is added.

Pointer previews are coalesced, edge scrolling is bounded, and gestures cancel on interruption, resize, fullscreen changes or recovery. Touch bodies scroll while dedicated grips and edges edit. Numeric clip tools are available when precise dragging is difficult.

Reordering can invalidate routes tied to a formation pair. Those routes are reviewed before replacement. Locked linked members reject an operation as a group.

## Counts, music and timing

The score works with silent counts, the built-in sketch or uploaded audio. The music editor controls source trim, timeline start, first-downbeat offset and tempo. Its waveform supports visual alignment; it does not automatically detect the tempo.

Count tools accept seconds, phrase.count and fractional counts. Formation intervals include hold time and outgoing movement time. Route-specific duration and delay can override the sequence defaults.

Music source trim does not move the formations. Changing count alignment does not convert the score into an audio-dependent project.

## Performer routes and motion

Each outgoing route can use direct or curved geometry, waypoints, movement duration, departure delay and easing. Stage path handles edit geometry; the motion-curve editor controls progress along it.

Route locks protect custom paths from assignment and replacement. Sampling is shared by playback, ghosts, analysis and exports.

Movement instructions have their own windows and assigned performers. They are rehearsal annotations, not articulated choreography for the 3D avatars.

## Stage views and cameras

**2D** uses SVG for the stage, performers, paths, props and overlays. It supports pan, zoom, rotation, mirror and audience-direction flip without rewriting choreography.

**3D** uses WebGL to review spatial placement, facing, props, stage zones and production states. Mouse, trackpad, keyboard and visible camera controls provide orbit, pan, zoom and Fit. A fallback keeps the 2D editor usable when WebGL is unavailable.

Performer/group follow keeps the chosen subject centered. Authored or automatic camera direction can guide the view over time. Manual navigation can pause saved camera direction.

Fullscreen is a shared stage workspace, with an optional timeline and access to editing dialogs. Browser-native fullscreen is used where available; otherwise the focus layout fills the application window.

Capture preserves the source viewport's camera projection even when encoder dimensions are rounded. Export aspect changes preserve framing with letterboxing.

## Cast & show

### Smart cast assignment

The assignment solver finds a minimum-cost matching of eligible performers to existing slots. The cost combines incoming distance and an optional outgoing-distance weight. Group and role restrictions can be kept.

Assignment locks, live-constraint members and active attendance participants remain pinned. Preview shows reassigned performers, travel totals and adjacent custom routes that would be replaced.

The solver is bounded to the supported 100-person cast. It optimizes endpoint travel, not complete collision-free paths.

### Attendance and understudies

An attendance entry names a missing performer, optional cover and inclusive first/last formations. It ends at the following formation or performance end.

The missing person becomes invisible. A cover follows that role's sampled pose while its own original role is suspended. Disabling the entry restores the saved roles.

Appearance, carried props and personal instructions follow the performed role. A prop with no available carrier falls back to its authored floor/keyframed pose. Range boundaries may still need a planned entrance or exit.

### Live symmetry and spacing

Mirrored pairs reflect positions and facing. Equally spaced rows/columns maintain member order and spacing. Each performer belongs to at most one live rule in a formation.

Active attendance protects both the missing role and the cover's original saved pose. New constraints cannot include those roles. Existing rules cannot change their saved X/Z, facing or visibility indirectly.

Protection is enforced in the model, constraint propagation and shared save validation. Multi-formation enforcement plans changes before applying them, so a protected result rejects the whole operation. Unaffected cast and formations outside the attendance range remain editable.

The initial member selection skips protected or already-constrained cast. A failed new preview clears the previous Apply action. Disable attendance before editing a protected role.

### Backstage traffic

Named wing/entrance zones support manual entrance/exit reservations. Visibility changes suggest windows near a formation boundary.

The report flags overlapping use, opposing entrance/exit flows and one person booked in two zones. Output is bounded to 600 windows and the first 500 issues. Reservations do not move performers or simulate physical queues.

### Audience sightlines

A fixed outside-stage eye position can be previewed in 3D. The report samples three body heights against simplified performer cylinders and stage-object footprints.

It is approximate. Some prop shapes use conservative boxes, performer dimensions are simplified, and labels do not represent occlusion.

### Second-screen rehearsal

A read-only window follows the editor's stage, camera and count clock. Scores send after committed authoring changes; lightweight transport updates supply the clock. The display briefly interpolates between updates and freezes after heartbeat loss.

The display has local 2D/3D and fullscreen controls and can fall back after a graphics interruption. Music stays in the editor. Reference video and analysis overlays remain there too.

This connects windows in the same browser/origin. It is not remote-device streaming or cloud collaboration.

### Full-show setlists

Shows contain trimmed local routine references and timed intermissions. Entries can be reordered, renamed, relinked, removed with confirmation and imported/exported as manifests.

The runner checks ranges and music, opens each project, seeks to the routine start and advances at its end. Pause/resume, Next and Stop handle rehearsals and intermissions. Editing the setlist or manually changing projects stops the current run.

Setlists support up to 30 shows with 100 entries each. Their manifests do not contain choreography or media. Routine changes are not gapless audio, and there is no merged cross-project video export.

## Stage design and imports

Stage dimensions, preset outlines and custom usable polygons define the performance area. Named wings, entrances, risers, obstacles and restricted zones add production context.

The designer supports draggable vertices and move/resize handles, snapping, keyboard precision and numeric forms. Invalid topology and out-of-bounds geometry are rejected.

Floor-plan images support calibration, position, rotation and opacity. PNG/JPEG/WebP input is limited to 8 MB and downscaled to at most 1600 pixels per edge for project storage.

Text DXF input is limited to 2 MB and 2,000 converted segments. LINE, straight LWPOLYLINE, CIRCLE and ARC are supported. Bulged polyline segments are rejected; unsupported entities are counted. Binary DWG is not imported directly.

Imported drawing lines are references. Explicit obstacle/restricted zones are needed for geometry checks.

## Props and handoffs

Props support rectangle, ellipse and triangle shapes, dimensions, height, position, rotation and color. Pose keys animate their authored state.

Attachment events assign a performer and offset, hand a prop to another performer, or place it on the floor. Rotation can follow the carrier's facing. The current carrier is resolved through attendance.

These are simplified stage objects. There is no rigid-body physics, articulated hand binding or hardware control.

## Lighting and appearance

Lighting keys belong to fixture/wash groups and define color, position, radius and intensity. Fades interpolate between keys; zero intensity creates a blackout. Presets and active-fixture blackout help build rehearsal looks.

Appearance keys set marker color and costume labels for individuals, selections, groups or the full cast. Group edits validate together; conflicting timestamps reject the operation.

Lighting is a visual rehearsal layer. It does not control lighting equipment. Costume states do not provide garment meshes.

## Analysis and transition review

| Tool | Output and limits |
| --- | --- |
| Formation comparison | Reference/current displacement, facing and visibility changes. |
| Travel heatmap | Sampled routes and distance distribution over a transition. |
| Spacing heatmap | Sampled proximity regions at a chosen threshold. |
| Collision/spacing warnings | Stage, obstacle, prop and pair-spacing review points. |
| Formation health | A weighted heuristic for spacing, usable stage and sampled speed. |
| Transition suggestions | Ranked direct, arc and staggered candidates with a preview before Apply. |
| Alignment/distribution | Editable arrangements for selected cast. |

The reports use simplified geometry and finite sampling. They are rehearsal aids, not a safety certification or proof of continuous collision-free motion.

## Rehearsal aids

Previous/next ghosts, count-step ghosts and named checkpoints show intermediate positions. Selected-only ghosts reduce visual clutter.

Reference video can be trimmed, positioned on the timeline, stepped by frame and shown alongside the stage. Follow camera can track a performer or group.

Playback performance offers Automatic, Smooth and Efficient modes. The editor can reduce stage-update work on slower devices while preserving the soundtrack clock. The performance panel reports editor update cost, not measured GPU presentation FPS.

## Images, video and performer exports

### Images

PNG, JPEG and SVG support the current viewport, selected formations or timeline samples. Previews appear before download. Individual files and selected ZIP batches are available.

There is a 100-image batch limit and a 4096-pixel edge cap. A 2D SVG retains vectors; a 3D SVG embeds a raster snapshot. Camera, role overlays, production states and an available reference video follow the captured time.

### Video

The export panel offers 480p, 720p, 1080p and 1440p, three bitrate presets, and 24/30/60 FPS. Output width follows the stage viewport, within encoder limits.

MP4 uses H.264 through frame rendering when available, with AAC for music, or a compatible native recorder. WebM can use supported VP9/VP8 recording. Unsupported formats are not offered, and a returned non-MP4 result is not accepted as a successful MP4 job.

The frame-rendered route uses explicit timestamps. Native recording is real-time and paced to the selected target FPS, but its delivered frame rate depends on browser/device performance. Exports stop safely when interrupted or hidden. Shorter clips and lower resolutions reduce memory use.

The estimated in-memory limit is 400 MB; oversized results are also rejected. There is no server conversion fallback or guarantee that every browser can encode every quality.

### Performer packs

Personal rehearsal material includes sampled positions, facing, visibility, formation/checkpoint diagrams, costume labels, instructions, cues and prop responsibilities. CSV and printable rehearsal material support practical handoff. Detailed-event and compact options control the size of a pack.

A performer export supports up to 1,000 checkpoints; batches are bounded to 100 MB. Follow-camera video uses the same view-export workflow.

## Offline operation and installation

The built app includes a manifest, shortcut/icon assets and an integrity-checked offline shell. Installation depends on the browser and operating system. Secure hosting or localhost is required for service-worker use.

Offline readiness, update preparation, cache repair and storage status are exposed in Install & offline. Update activation protects open editor work and can ask for other CHORYN windows to be closed.

Project backups remain important because browser storage is local and can be cleared or evicted. Offline caching is not cloud backup.

## Implementation map

| Area | Main modules |
| --- | --- |
| Project validation and sampling | `engine.js`, `ensemble-schema.js`, `prop-motion.js` |
| Shared authoring boundary | `app.js`, `ensemble-model.js`, `production-timing.js` |
| Timeline commands and gestures | `timeline-model.js`, `timeline-ui.js`, `timeline-gesture.js` |
| Cast and shows | `ensemble-tools.js`, `setlists.js`, `presentation.js`, `rehearsal-display.js` |
| Stage views | `stage2d.js`, `stage3d.js`, `playback-view.js` |
| Stage and production data | `production-model.js`, `production-next-model.js`, `production-next.js` |
| Capture and media | `view-video.js`, `view-image.js`, `mp4-export.js`, `video.js` |
| Persistence and recovery | `backups.js`, `revisions.js`, `reference-store.js`, `errors.js` |
| Offline app shell | `pwa.js`, `pwa-ui.js`, `sw.js` |

All module names in this table are under `src/`, except the root service worker.

## Verification

Automated tests cover model invariants, shared saves, UI event adapters, gestures, capture data and lifecycle failures. Controlled graphics and encoder doubles are used for some integration checks.

Interactive desktop H.264 exports and browser-size layout checks are recorded separately in [VERIFICATION.md](VERIFICATION.md). They do not establish physical iPad/phone behavior, every browser's native fullscreen support, or all device codecs.
