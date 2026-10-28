# Production workspace · v0.16.0

## Cross-view and touch refinements

**Main stage** now opens the designer directly; the same chip stays available in stage fullscreen. A native target selector exposes every outline point and zone move/resize action, including small or overlapping objects. Arrow buttons adjust at 0.1, 0.25 or 1 meter; drag snapping offers 0.25 m, 0.1 m or none. Numeric geometry remains available in collapsible Stage dimensions, Add zone, CAD and Floor plan sections. The established CHORYN type, violet accent, neutral surfaces and native control styling are preserved. Controls wrap at the tablet/phone breakpoint, selects use 16 px text there, and buttons have 44 px targets. These are source rules, not measured physical-device results.

The designer supports 50–400% zoom, Fit, explicit pan mode and two-finger pan/pinch around the gesture center. Tapping a handle selects its target. Moving/reshaping uses the inverse content transform, so meters remain correct after zoom and pan. A second touch cancels an uncommitted geometry preview before navigating, and one-finger navigation can continue after the pinch. Zoom/pan do not change the score; locked/read-only geometry is still protected. Cancellation, lost capture, Escape, blur, resize/orientation, hidden documents and recovery clear active gestures. Scroll the dialog outside the canvas; gestures on the canvas control the designer.

2D warning rings now follow moving performers while fullscreen hides the transport HUD. Warning geometry is reused instead of calculated again for the ring markup. Main playback also reuses one effective view/ghost/analysis result per update and passes the 3D scene's warning result to the HUD. No hardware frame-rate claim is made.

3D playback and matching-view capture now honor performer-name and grid settings. Costume-only state changes invalidate 3D label metadata. Names are captured with the same labels as the scene. When a video aspect ratio differs from the current viewport, both 2D and 3D preserve that viewport's proportions with letterboxing; reference-video placement follows the same fitted rectangle, and 3D label capture clips to it. Capture reads the original camera, and the offscreen 3D renderer starts with the canonical zones, lighting, appearance and the range's start time.

Floor-plan replacement settles obsolete waits and ignores stale image callbacks. Removed/disposed images detach callbacks and release waits. Decode/upload failures or a 12-second timeout leave the live stage usable with a caption and reject an incomplete export explicitly. Export cancellation interrupts a pending 3D texture wait. Real GPU behavior, codecs, browser layout and physical-device gestures still require browser/device testing; automated evidence uses DOM, WebGL, media and timer doubles.

## Visual stage, lighting and wardrobe workflows

The Stage designer now places an interactive stage above the numeric forms. Drag outline circles to reshape the usable polygon, drag named zones to move them, or drag square handles to resize symmetrically about their centers. Empty outlines acquire four rectangle vertices on their first edit. Geometry snaps to 0.25 m; Alt bypasses snapping. Focus a handle and use arrows for 0.1 m, Shift for 1 m, or Alt for 0.01 m. Pointer previews coalesce into animation frames and release commits once. Escape, lost capture, pointer cancellation, blur, hidden documents and recovery cancel; unrelated pointer events cannot end the edit. Changes made elsewhere reject a stale drag. Props-layer locks and read-only snapshots protect the edit. Outline edits update the numeric textarea and zone summaries immediately.

Floor plans support rotation in degrees in addition to their width, depth, position and opacity. Text DXF import supports a rotation and center offset after unit conversion. Both previews show the placed drawing against the real stage before Apply. Changing import settings invalidates Apply; asynchronous reads reject changed settings. The same positive canonical X/Z rotation becomes a negative SVG screen rotation and the corresponding WebGL floor corners, keeping images consistent in playback and capture.

Lighting and Costumes include a stage scrubber with active fixture swatches, performer costume labels and current/next technical cues. Scrubbing the saved score does not write to the project. Editing an add form shows a marked draft at that event's time; **Show saved score** compares against persisted authoring. The draft retains existing event identities for linked-event preview validation, but saving a conflicting timestamp is rejected rather than silently replacing it. Lighting look presets cover warm/cool washes, a spotlight and blackout. **Black out active fixtures at preview time** adds simultaneous intensity-zero cut keys to active saved fixtures. It rejects duplicate timestamps, locks and unsaved lighting drafts; one Undo reverses the complete operation.

Costume changes can target one performer, selected stage performers, a named performer group or the whole cast. Recipients are deduplicated, all states validate together, and a timestamp conflict rejects the entire operation. Event rows identify the performer. Appearance states remain marker color and costume labels, not modeled garments. Lighting remains rehearsal visualization without hardware/DMX output. Both use the canonical stage sampler and matching-view export renderers. CAD remains text DXF reference geometry, not native DWG or automatically detected obstacles.

The visual direction preserves the existing quiet utility workspace: system/product type, violet accent, neutral surfaces, native form controls and the established spacing rhythm. Previews resize within their panel and field grids retain phone/tablet breakpoints; actual device rendering and touch behavior remain unverified because browser UI access is unavailable.

## Earlier production workflows

The Production page now includes a direct workspace button. Workflow refinements in this release:

- Suggestions include current-route metrics and a side-by-side scrubber. It shows all performers and at most 12 path traces, with isolated noninteractive SVG identities. Previewing does not alter the score; Apply still checks freshness.
- Lighting, appearance, camera and prop-pose dragging uses the chosen timeline snap mode and magnetic boundaries, Alt precision, gradual edge scrolling, coalesced previews, stable grab offsets and linked-event previews. Keyboard Left/Right nudges by the selected step, Shift multiplies it by eight, and Alt uses 0.01 seconds. Locked props and linked content reject the complete edit. Drops outside the viewport cancel.
- 3D playback and matching-view capture include warning rings. Both views update geometry warning status; lighting interpolates independently of the slower transport HUD. Clearance checks follow rotated rectangles, triangles and the true distance to elliptical props.
- Personal packs include intermediate costume changes, technical/lighting cues, movement starts/ends and that person's prop pickups/handoffs. Turn off detailed events for a compact formation/checkpoint book. Exports use a coherent snapshot, cached outgoing paths, per-person progress, a 100 MB batch limit and a 1,000-checkpoint limit per performer. Closing the dialog cancels packaging and prevents a late download. Geometry edits invalidate cached paths.
- End trims retain later production events. Ripple trims move events on the old endpoint with the new endpoint. Imported stage outlines reject crossings, touching nonadjacent edges, repeated vertices and out-of-stage coordinates; a repeated closing vertex is accepted as a closed polygon.

Open **All tools → Production workspace**, **Timeline → More → Production workspace**, or find it in command search. Eight panels keep advanced authoring out of the primary timeline rail. The workspace preserves CHORYN's existing typography, violet accent, neutral surfaces and accessible native forms. Panels scroll and use two-column fields, collapsing to one column on very narrow phones; fullscreen uses the same tools.

## Analysis and transitions

**Health & transitions** checks the current formation and its outgoing movement, or reviews the complete score. Checks include minimum spacing, usable-stage boundaries, rotated prop footprints and restricted/obstacle zones. Attached props exempt their current carrier. Visible 2D warning rings and status updates use the same geometry checks; reports also use them.

Transition review uses 49 time samples and closest relative approach between consecutive samples to catch fast pair crossings. It reports per-performer travel and sampled speed, with a 3 m/s review threshold. The health heuristic weights spacing 45%, usable stage 35%, and speed 20%; component scores and issue timestamps are visible. It is a geometric rehearsal aid, not a safety certification or continuous proof of collision-free motion.

**Suggest transition paths** compares direct, left arc, right arc and staggered departure candidates. Each displays its score, issue count, travel and speed before Apply. Candidates are ranked by measured score, warning count and travel. Applying replaces the outgoing route set; approved formations and locked routes are protected. Changed scores invalidate stale previews. Suggestions do not solve every obstacle or optimize a global collision-free route assignment.

## Motion and alignment

Select performers on stage, then use **Motion & alignment** for rows, columns, distribution over the existing span, fixed horizontal/vertical spacing, or a circle at the chosen adjacent spacing. Unselected performers remain in place. Out-of-stage results remain editable and are flagged by geometry checks.

Choose a performer to edit its outgoing route: travel window, departure delay, smooth/linear path controls, and a monotone cubic Bézier time-to-distance graph. Drag the graph handles or enter the four coordinates; presets cover linear, gentle, slow arrival and slow departure. Existing stage path handles remain available. Timing curves affect the canonical sampler, so playback and every sampled export use them.

## Tracks, ripple and links

**Tracks & links** controls Music, Formations, Movement, Technical cues, Prop poses, Lighting, Appearance and Camera. Hide removes a lane, Collapse reduces its height, and Lock protects authoring. Lighting/appearance/camera lanes appear when their first event exists. Their event buttons open full parameters and exact timing; drag with a mouse/pen or the touch grip to move, snap to the beat, and hold Alt for precision. Release commits once. Cancellation restores the previous score.

With **Ripple** enabled, formation retiming and shared-boundary trims move downstream events and the performance end by the same amount. Spanning movement instructions grow or shrink. Prop poses/handoffs, checkpoints, notes and reference-video starts follow; the music source remains anchored. Opening, approved formations, locked affected lanes and invalid ranges reject the entire edit.

Ripple Delete/Cut removes the selected formation interval, removes events enclosed by that interval, trims overlapping movement instructions, closes the gap, and shortens the performance. The confirmation explicitly describes these effects. Linked groups spanning different parts of the removed interval must be unlinked first. Delete/Cut still always confirm, with authored-state freshness checks and Undo.

Create named linked groups from formations, movement starts, cues, prop poses, lighting, appearance and camera keys. Start-time changes preserve member offsets; each event belongs to one group. Formation reorders preserve existing sequence slots while related events follow their linked sequence. Conflicting linked displacements, opening movement and protected content are rejected atomically. Links cleaned by deletion are pruned. Reordering still reviews custom routes that lose adjacency.

## Stage design and imports

Set stage dimensions, use rectangle/thrust/L-shaped presets, or enter 3–64 usable-outline vertices in canonical X/Z meters. Add and edit named wings, entrances, risers, obstacles and restricted zones with position, dimensions, height and color. All zones appear in both stage views; obstacle/restricted areas participate in warnings.

Import PNG/JPEG/WebP floor plans up to 8 MB, preview first, then calibrate width/depth, position and opacity. Images are downscaled to at most 1600 pixels per edge and stored locally inside project data. The same calibrated image renders as an SVG floor layer in 2D and a textured WebGL floor in 3D, including view exports.

Import **text DXF** up to 2 MB with an explicit meters-per-CAD-unit scale. LINE, straight LWPOLYLINE, CIRCLE and ARC geometry are supported, centered and limited to 2,000 segments. Curved polyline bulges are rejected; other unsupported entities are counted. Preview geometry and measured bounds before applying. Convert binary DWG to text DXF first. Imported lines are visual references; create explicit zones for collision checks. Clear/import removals confirm and support Undo.

## Lighting, costume and camera authoring

Lighting cues belong to fixture/wash groups and control color, focus position, beam radius and intensity. A cue can fade from its predecessor; zero intensity produces a blackout for that fixture. Stage views show colored floor illumination. It is visualization, without lighting equipment output or photometric simulation.

Appearance keys assign a performer color and a named costume at a timestamp. Changes update 2D markers, 3D bodies and matching images/videos. Costume names travel with personalized sheets/CSV; they do not create garment meshes or clothing physics.

Automatic camera direction generates a framing key for each formation using the visible cast's center and extent. Review before replacing existing camera keys. Individual keys edit target, zoom, yaw and pitch; smooth interpolation drives both views and their exports. Performer follow takes priority. Explicit Pause/Enable controls and manual stage navigation let the user regain the camera.

## Personalized exports

Select performers to download one ZIP with a separate self-contained, printable HTML rehearsal book and CSV per person. It includes formations and checkpoints, coordinates, counts, visibility, facing, costume labels, instructions, notes and outgoing path diagrams. HTML is escaped and spreadsheet formulas are neutralized. Use browser Print to save PDF.

Choose a performer and **Export performer follow video** to set a personal follow camera and open the existing MP4/WebM quality and preview workflow. That video preserves the current stage view and surrounding cast. Printable canonical diagrams are intentionally distinct from camera captures; existing image/video exports retain their matching-view workflow. Media encoding remains subject to the browser's actual encoder capabilities.

## Verification and limits

280 automated tests pass, including the earlier 34 production checks and 24 integration/refinement checks. Tests cover schema migration, atomic linked/ripple changes and deletion, locks, Bézier sampling, crossings, suggestion candidates/previews, alignment, DXF/topology validation, live/export state sharing and 3D warning geometry, detailed personal packages and cancellation, actual form/click/keyboard handlers, coalesced snapping/edge-scrolling event gestures, stale confirmations and textured-floor resources. Production build, syntax checks and offline asset hashes pass. Browser screenshots, computed responsive layout, real GPU presentation, physical touch devices and installation were not verified because browser UI access remains unavailable. No alternate browser-control path was used.
