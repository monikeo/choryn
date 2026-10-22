# Production workspace · v0.14.1

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
