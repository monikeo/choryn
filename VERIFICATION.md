# CHORYN v0.10 export studio verification — 21 October 2026

162 automated tests pass (144 existing and 18 export-studio tests). All 48 application/script JavaScript syntax checks and the production build pass. Complete relative static/dynamic module closure has 119 edges; modules, image styles and the pinned media bundle/license are in the offline shell. Packaging verifies source/build byte equality and the generated cache hash from the synchronized commit.

## Delivered workflows

- Current-view PNG/SVG exports now open a preview gallery rather than downloading immediately. JPEG is available from image settings and command search. Preview enlargement, per-image download and selected-image ZIP download use explicit user actions.
- Batch export supports selected formations in sequence order or a selected/default timeline range sampled every count/second interval. The camera icon in the timeline opens those range defaults. The start and end are included; up to 100 images per batch. Current playhead capture remains available.
- PNG/JPEG/SVG, 1x/2x scale, JPEG quality, current 2D/3D camera, prop animation, ghosts, heatmaps, follow camera and visible reference guide are retained. The batch reuses one renderer/context/decoded reference instead of mounting it for every image. Each edge is capped at 4096 pixels; batch blobs are limited to 100 MB. 3D SVG discloses its embedded raster snapshot.
- ZIP exports store actual image files with CRC32, UTF-8 names, central directory records and an images.json manifest of capture times. One ZIP avoids repeated browser download prompts. Preview creation does not initiate download. Cancellation, errors, close/replacement guards and object-URL cleanup preserve responsiveness and release transient resources.
- MP4 automatically chooses supported H.264 frame rendering with AAC music, or native MP4 recording when the WebCodecs/audio configuration is unavailable. WebM alternatives remain. Capability checks use the selected size/FPS; unsupported configurations produce actionable guidance. Rendered frames use explicit timestamps and the same view renderer. Audio follows source trims, timeline offset, selected range and gain, and is supplied in bounded chunks. Encoding honors backpressure, yields to controls, stops on hidden/cancelled/error states, and finalizes an actual MP4 buffer before preview/download.

## Responsive export layouts

Export forms and previews adapt to desktop, tablet and phone widths. Coarse pointers receive 44px touch targets and larger selection boxes, narrow phones stack form fields and download actions, and short landscape screens constrain preview height. Single-image layout uses an explicit class rather than requiring the :has selector. Keyboard focus outlines and labeled rendering progress are included. These are code-level checks; physical-device and live layout verification remain unavailable.

## Automated and independent evidence

The 18 new tests cover formation order/nonmutation, timeline interval/end sampling and limits, selected clip defaults, Unicode-safe filenames, ZIP CRC/header/directory integrity, path/duplicate/size/cancel rejection, H.264 availability with WebM-only MediaRecorder, automatic MP4/AAC/native fallback, exact trimmed audio chunks, frame timestamps/keyframes, encoder cleanup on cancel/render failures, AAC preflight, JPEG quality and renderer reuse, preview-first explicit downloads, delegated Select all/Clear controls, encoder-probe failure fallback and hidden-document cleanup.

A real bundled Mediabunny MP4 muxer receives a synthetic encoded AVC fixture, finalizes an ISO-BMFF file with ftyp/avcC boxes, and its separate input parser recognizes AVC, dimensions and duration. This verifies muxing/container structure, not decoding/playability of that synthetic packet. Encoder orchestration tests use doubles; they do not claim real hardware H.264/AAC output.

An independently generated ZIP was checked using Python zipfile: UTF-8 filename lookup, CRC validation and extracted bytes all pass. Gallery tests execute the actual module, proving no automatic download after preview generation and explicit image/ZIP download actions. The prior dialog regression, properties/preferences entry, playback, timeline, reference, backup and recovery tests remain green.

## Dependency provenance

Mediabunny 1.62.0 is an unmodified browser bundle, pinned from the official npm distribution after verifying SHA-512 integrity. It is distributed locally with MPL-2.0 license and upstream source notice. Bundle use is lazy and cached offline. No project media is uploaded to a server or CDN. Official documentation: https://mediabunny.dev/guide/quick-start and https://mediabunny.dev/guide/media-sources . Source: https://github.com/Vanilagy/mediabunny/tree/v1.62.0 .

## Limits

Live browser/device access remains unavailable following the prior policy denial; no workaround was attempted. No new live browser screenshot, physical-device touch check or real encoder/decoder playback result is claimed. Actual MP4/video/music encoder support and throughput depend on device/browser. If H.264 is available but AAC and native MP4 recording are unavailable, silent MP4 is offered through the music toggle; audio is never silently dropped. Native recorder output is real-time and may miss target frames; rendered MP4 follows frame timestamps with normal codec/container padding.

Memory limits and cached offline assets remain device-dependent. Large batches may require fewer images or 1x scale. SVG font/rasterization differences and 3D raster-container limitations remain. Reference originals remain local and excluded from portable backups. The prior undefined-analysis dialog fix is retained; local projects/media require no migration. The site remains owner-private.
