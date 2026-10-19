# CHORYN 0.4.1 verification — 20 October 2026

## Automated checks

67 tests pass with `node --test` from studio/. The static production build succeeds with `node scripts/build.mjs`. The current machine's npm launcher points to a missing global npm installation, so direct Node commands were used; no packages or machine-wide settings were changed.

New regression coverage includes formation/movement/cue duplication, sampled-pose splits, boundary/approval protections, clip limits, project-local clipboard, cast reconciliation on paste, removal/reference cleanup, shared formation trims, final duration constraints, overlap row packing, waveform scaling, box selection (including reversed/add/subtract), shape-preserving group movement and offstage recovery, and all 24 templates at 1/2/5/12/50/100 performers on 2×2 m, 16×10 m, and 100×5 m stages. The prior import, portable media backup, rendering, contrast, calendar/CSV, and offline cache tests remain green.

## Browser checks

An isolated Editor QA 0.4 project was used in the local Chromium-based preview.

- Timeline Duplicate inserted an independent formation at a free midpoint. Delete opened a confirmation with the count unchanged until confirmation. Keep formation cancelled cleanly; confirmed delete reduced the count, and Undo restored it. Inspector-menu deletion, keyboard Delete, and Cut also opened the same confirmation flow. Restoring an older revision with fewer formations asked first and left the count at nine when cancelled.
- A formation split at 28 seconds inserted its sampled pose with a draft status and explicit transition/route notice. Its count increased from seven to eight.
- Movement single click selected without opening a modal; double click opened instructions. Duplication, split at 22 seconds, exact end trim to 23 seconds, cut confirmation, and paste at 40 seconds all produced the expected clip timing.
- Two simultaneous movement instructions rendered in separate rows (tops 5 and 39 px). Dragging the timeline separator enlarged it; Collapse restored the default height. Keyboard Ctrl/Command D duplicated the selected formation.
- Dragging a formation's right edge moved its shared next boundary to 26 seconds; Undo restored it. Extending the final end to 120 seconds displayed the 96-second built-in waveform at 80% width instead of stretching it.
- Mouse box selection selected five performers. Focus selected enabled and fit them at 148%. Mouse wheel zoom changed the view up to the 600% limit. Hand panning changed the SVG camera translation without changing geometry. A numeric zoom value of 175% applied correctly. Right-click opened stage/selection controls.
- Arrow nudging followed by Undo restored both positions and the five-performer selection.
- The template dialog contained 24 choices. Searching Spiral returned one; Wedges returned four. Applying compact Spiral with 90° facing to five selected performers moved only those five.
- No browser JavaScript errors were reported during these checks.
- Phone 390×844 and 320×568: no horizontal page overflow; Clip tools and template dialogs fit, with internal scrolling. Tablet 834×1194: no overflow and a large stage. Landscape 844×390: stage bottom aligned with timeline top at 306 px, with no page overflow.
- A video regression recording with music produced a playable 1280×720 WebM preview, duration 1.072 seconds for a 1-second range, readyState 4 and no video error. Frame rate remains a device-dependent target. The previous release checked all four video resolutions.

The final production shell update was activated on port 4174; the new Clip tools and 24-template catalog were available with the Ready offline indicator. After stopping that server, reload and the clip tools still worked from the cached shell.

## Practical limits

This is a local-first, installable web/PWA studio. Native OS binaries, cloud accounts/collaboration, and a multi-track audio/video editor are outside this release. The clip editing tools operate on formation and movement clips, plus point-event cues. Music stays aligned at performance time zero; its waveform now preserves time scale when the performance is trimmed or extended.

Formation splits preserve the sampled pose, not an exact reconstruction of the former route on both sides. Affected route overrides are removed and subsequent transitions are rebuilt; review the result before rehearsal. The UI states this during the operation. Geometric checks remain planning aids rather than safety certification.

Device checks used browser viewport sizes, not physical iOS/Android hardware. Video encoder availability and sustained frame rate depend on the browser/device. Save portable .choryn backups before changing origins/devices or clearing browser data.

## Additional compatibility pass

Six additional tests exercise independent project copies without structuredClone, UUID generation without randomUUID, backward formation lookup without findLast, prefixed/missing audio constructors, resize fallback cleanup, canvas recording availability and per-codec exceptions.

The local Chromium browser was checked at 1440×900 desktop, 834×1194 tablet portrait, 1194×834 tablet landscape, 390×844 phone, 320×568 small phone and 844×390 landscape. None showed horizontal document overflow. Sequence dialogs fitted the 390×844 and 844×390 viewports with internal scrolling. At 320×568 the stage fullscreen fallback occupied 568 px and exited correctly. Expanded phone timeline retained the stage and navigation. Tablet WebGL preview rendered all 12 labeled performers. A new video export with music decoded at 1280×720, 1.025 seconds for a 1 second range, readyState 4 and no media error. No JavaScript errors were reported.

Screenshots are in the workspace docs/phone-v041.png and docs/tablet-v041.png. Automated fallback tests supplement Chromium checks; physical iOS/iPadOS/Android devices, Safari/WebKit and Firefox/Gecko were not available in this session. On-screen keyboard resizing is implemented through VisualViewport and requires physical-device verification. Installation prompts, native fullscreen, encoder/quality performance and storage retention remain platform dependent.

API references checked: https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport, https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream and https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static.
