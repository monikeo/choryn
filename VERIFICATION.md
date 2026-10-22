# CHORYN v0.13 timeline verification — 22 October 2026

222 automated tests pass: the existing 200 checks plus 22 timeline gesture/UI tests. All 53 source/script/worker syntax checks and the production build pass, with 133 relative JavaScript import edges resolved. The offline shell includes the new timeline controller and stylesheet: 94 entries, including 90 byte-hashed static assets and four matching-build HTML routes.

## Design and behavior

The timeline's purpose is precise sequence/timing editing with the stage still visible. The visual direction is restrained utility: existing CHORYN type, neutral chrome and numbered violet sequence blocks. Its primary icon tools, mode/snap choices, music/count/view controls, fine scrubber and zoom share one desktop rail. More tools retains the remaining commands. Phone layouts wrap controls; narrow phones retain Delete in More. The transition strip now reflects each formation's duration override once, instead of overlapping a second default strip.

Mouse/pen drag uses original clip centers, stable grab offsets and destination hysteresis. Animation-frame coalescing avoids project copies for every pointer event. Candidate editing occurs only when the target slot or snapped time changes; release flushes the final position and saves one edit. Peer blocks, order numbers, interval lengths and transition windows preview the candidate. Status explains the destination/time or blocked edit. Gradual edge scrolling continues with a stationary pointer.

Touch bodies preserve native scrolling; explicit grips/handles edit. A second touch cancels an active edit. Pointer identity, Escape, cancellation, lost capture, blur, document hiding, recovery and teardown are handled. Authored changes and off-timeline drops reject stale previews. Approved/opening/shared-boundary protections remain. Sequence reorders that remove custom routes still require review. Delete/Cut always confirm, and a score changed after the prompt cannot be removed from that stale confirmation.

## Automated evidence

- Actual gesture binder: coalescing 120 events into one frame and one commit; a 100-performer/100-formation score with 1,000 pointer events; center/hysteresis logic with uneven slots; grab-offset trimming; last-event flush; movement duration and minimum interval; cue offsets; Alt snap bypass; magnetic exclusion and other movement edges; stationary-pointer auto-scroll; unrelated pointers, touch scroll/grips, second-touch cancellation and all cleanup paths; read-only/approved protection; changed-project/outside-drop rejection; ruler scrubbing and selection.
- Actual timeline UI binding: clip decoration and adaptive ruler initialization; zoom/fitting without stage re-render or project edits; immediate copy/paste availability; sequence movement commands with fixed slots; split/duplicate/trim dialog/cut execution; deletion-confirmation fingerprint protection.
- Existing model/command tests: timestamps, minimum durations, split sampled poses, performer assignments, approved and opening protections, copy/paste boundaries and cast reconciliation, movement row packing, count/music sync, custom routes, confirmation dialogs and undo-compatible complete candidate replacement.
- Existing regression suite: editor playback, undefined-analysis recovery, camera/2D/3D exports, MP4, image previews/batch ZIP, stage navigation, branding icons and PWA worker/client lifecycle.

This is evidence of event/model execution with DOM/WebGL/cache doubles, not measured hardware FPS. Source was reviewed for the existing desktop, tablet, phone, fullscreen, coarse-pointer, reduced-motion and forced-colors rules. Icon controls have accessible names/disabled reasons, native focus and a live drag-status region. No browser screenshots, computed layout, real touch-device, screen-reader or installation results are claimed because browser UI access remains unavailable following the earlier denial. No alternate browser-control path was used.

See TIMELINE.md for workflow details and PWA.md for installation/compatibility.
