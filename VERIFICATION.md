# CHORYN v0.9 workstation verification — 20 October 2026

142 automated tests pass, including 16 new workstation/model/interaction tests. All 43 application and script JavaScript syntax checks and the production build pass. The complete offline module graph has 111 relative static/dynamic import edges; every referenced module/stylesheet is present in the service-worker shell. Packaging checks source/build bytes and generated cache hash against the synchronized source commit.

## Delivered scope

Design direction: a functional violet rehearsal workstation. CHORYN's established typography, palette and stage remain; controls are grouped by task, unused decorative canvas dots are removed, headers are tighter and the stage stays central. Choreograph/Rehearse/Export arrangements remember local panel visibility, preset and timeline expansion. Desktop panel separators support drag, keyboard arrows and Home; widths stay within bounds. Container/media rules wrap narrow stage controls, preserve mobile/tablet drawers and timeline expansion, and expose fullscreen search/analysis.

Timeline editing now uses named SVG icon buttons, disabled-state help, keyboard toolbar navigation and existing context/precision dialogs. Dragging shows a floating preview, insertion/snap guide, neighboring clip movement and affected custom-route count. Touch users swipe a formation body to scroll, drag its dotted grip to reorder/retime, and drag edge handles to trim. Pointer cancel/Escape roll back; stale project changes cannot be overwritten. Time slots remain fixed on reorder. Reorders that remove disconnected route overrides require review in both the timeline and sequence list; autosave timestamp updates do not invalidate that review. Formation cut/delete always requires its existing confirmation.

The three additional requested features are implemented:

- Formation comparison: reference/current endpoints by stable performer ID, displacement, shortest facing delta and visibility changes; overlays in 2D and 3D and a comparison table.
- Travel/spacing heatmaps: canonical curved movement samples across the outgoing movement window; approximate path distance with a cast table, spacing cells/minimum under an adjustable threshold, selected-cast focus and bounded sampling/cells. Results are cached between formation boundaries and reset after score edits.
- Command search: Ctrl/Command K and touch-accessible buttons, ranked title/group/tag search, keyboard selection, direct formation/cast navigation, editing/export commands and read-only/confirmation protections.

PNG/SVG no longer use the fixed formation-sheet layout. Current-view images share the stage/video renderer and exact playhead camera, props, ghosts, analysis and optional reference frame. 2D SVG retains vectors and may embed a reference raster layer; 3D SVG clearly identifies its embedded PNG snapshot. Viewport aspect is preserved with up to 2x capture and 4096 pixels per edge. Printable formation sheets remain separate. MP4/WebM video uses the same stage camera and receives cached analysis per sequence interval. Image decode/encoding/cancellation errors clean up resources and provide a recovery path.

## Evidence

New tests cover stable comparison identities and facing wrap, curved sampled travel, intermediate spacing crossings, hidden cast/focus filters, heat-cell limits, nonmutation, escaped overlays and rotated labels, exact-view SVG analysis/camera state, ranked command search, magnetic grid/checkpoint/playhead snapping, reorder impact, icon accessible labels, bounded portrait/wide image sizing, hybrid SVG layers/raster disclosure, PNG capture/cancellation, cut/delete confirmation, reorder review with autosave/authored-change distinctions, saved panel bounds and keyboard toolbar focus.

Existing 3D capture tests now also verify analysis geometry/legend capture and unchanged-scene reuse. Prior 126 tests for timing, props, reference video, backup, recovery, pacing, media lifecycle and offline boundaries remain green. Tests use DOM/media/WebGL doubles; they do not establish real browser rendering or codec output.

## Verification limits

Live browser access was denied by security policy in the earlier verification session. No alternate surface, raw browser control or workaround was attempted. This release has no new screenshot, live interaction, physical phone/iPad, screen-reader or actual encoder/decoder verification. Source responsiveness is implemented, but universal browser/device compatibility is not claimed. Historical checks in earlier releases are not presented as v0.9 evidence.

Heatmaps use 33 samples and can miss rapid between-sample crossings; travel length is approximate and excludes invisible samples. Colour is supplemented with distances, threshold/minimum text and tables. These tools do not simulate bodies, obstacles or physical safety. Analysis overlays are session view settings. Local workspace arrangements persist on this browser/origin.

Exports capture stage content, excluding editor chrome. Fonts, shadows and rasterization may differ slightly; 3D SVG is a raster container rather than a vectorized scene. Reference originals remain local and are excluded from portable backups. MP4 is offered only when the browser supports encoding it; supported WebM alternatives remain. Real-time video cadence depends on the device, clip decoding load and available memory. The site remains owner-private and local-first.
