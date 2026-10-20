# CHORYN v0.8 verification — 20 October 2026

126 automated tests pass (108 existing, 13 rehearsal/model tests and 5 capture/export tests). Application and script JavaScript syntax checks, the production build, source/build coherence and complete service-worker module closure pass before packaging.

## Delivered behavior

- View aids: previous/next formation overlays, saved count checkpoints, count-grid intermediate poses during outgoing movement, selected-cast focus and a 300-position rendering budget. Dots use canonical curved transition sampling and are cached between interval boundaries.
- Reference guide: local upload/decode probe, IndexedDB persistence, source trim, score offset, muted picture-in-picture, shared playback clock/speed, ±1 configured-frame stepping, before/after holds, missing-source guidance and session fallback when storage fails.
- Carrier events: local offset/facing, carry, handoff, floor detachment, continuity with Keep world position, event editing/removal and Undo. Animated size/colour/shape remain independent of ownership. Deleting cast removes invalid carrier references; end trims protect authored events.
- Follow camera: performer/group centroid in 2D and 3D, independent view zoom, manual reset and unchanged choreography coordinates.
- View video: same SVG stage renderer or actual WebGL scene camera, dynamic follow, ghost/prop poses, projected labels, current viewport aspect ratio and optional reference guide. MP4 capability detection is preferred, with supported WebM alternatives, four target heights and three bitrates. The downloaded extension follows the actual MIME type.

## Automated evidence

Rehearsal tests cover validation and bounds, reference trim/delay/FPS mapping, canonical curved ghost positions and count-grid movement windows, rendering bounds/named checkpoint priority, rotated/reflected follow cameras, carrier-facing offsets, continuous handoffs and floor holds, immutable upserts/locks, backup roundtrips, duration-trim protection, shared SVG transforms and even codec sizing.

Capture tests use test doubles for DOM, WebGL, MediaRecorder and media decoding. They verify high-resolution scene surfaces, camera matrix changes, cached geometry, ghost labels, awaited asynchronous frame rendering, actual recorder MIME propagation, capture-track cleanup on render failure, reference seek/end-frame hold without repeated seeks, and cancellation during frame decoding. They do not encode or decode a real video.

All preexisting timeline editing/deletion confirmation, backup, audio trim, pacing, validation and offline cache tests remain green. Static and dynamic module references, stylesheets and offline shell files are checked against the service-worker allowlist. Packaged output is checked byte-for-byte against the source build, including its generated cache hash, and published from the synchronized Git commit.

## Limits and practical use

Live v0.8 browser, physical-device and decoder/encoder verification is incomplete. Browser security policy denied access in the prior verification session; no alternate browser surface or workaround was attempted. Previous releases' responsive and codec checks are historical and do not prove these new capture paths. No universal browser/device support or displayed-FPS guarantee is claimed.

Reference files are local to the browser/origin, capped at 250 MB, and excluded from portable backups (metadata is included). Reattach the source on another device. Frame stepping uses the entered FPS and time seeks; variable-frame-rate files are approximate. Source decoder support and MP4/WebM encoder support depend on the browser. Handoffs switch ownership at the event time and do not simulate limbs or collisions.

Exports preserve stage framing/content rather than editor chrome. 3D uses the actual scene and projected labels; 2D serializes the shared SVG. Font fallback, label shadows and rasterization can differ slightly. Reference audio stays muted; optional music uses the score's trimmed soundtrack. Recording is real-time, requires a visible tab and has device-dependent frame cadence and memory limits. Decode/graphics/cancellation failures clean up and return to export settings.

Use View aids beside the fine scrubber or in the stage menu. In fullscreen the workspace menu keeps these tools reachable. Props → edit object → Attachments & handoffs opens carrier events. Export → Video captures the selected stage view. Existing installs may need **Save and update** to load the coherent new offline shell. The site remains owner-private and local-first.
