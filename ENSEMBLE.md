# Cast & show tools · v0.18.0

Open **Cast & show** in the stage toolbar, including fullscreen, or use any of the seven named commands in command search. Production workspace also links to every panel. These tools keep the existing violet stage workstation, typography, neutral surfaces and native form controls. Tabs scroll horizontally; cast pickers and lists scroll within bounded panels; comparison cards stack on narrow screens. New compact controls have explicit names, status feedback and touch target rules. Physical-device layout remains unverified.

## Smart cast assignment

Choose a formation after the opening and optimize either all eligible performers or those selected on stage. Group and role restrictions are enabled initially. Assignment locks pin chosen people to their current slots; attendance participants and live-constraint members are also pinned. The minimum-cost perfect matching algorithm is bounded to 100 people. It minimizes incoming endpoint distance plus the selected 0–1 weight times outgoing endpoint distance. It preserves the destination shape, cast identities and roster order. It does not optimize collision-free paths.

Review the current/proposed diagrams, reassignment count, weighted travel and number of adjacent custom routes to replace. Apply creates one project Undo entry. Locked custom routes and the movement-track lock reject destructive route replacement. Approved target formations and locked formation tracks reject assignment. Changed scores invalidate previews; autosave timestamps alone do not. Review collision/health tools after applying.

## Understudy and missing-performer mode

Choose the missing person, an optional existing cover, and first/last formations inclusive. The overlay applies from the first formation until the next formation after the last, or performance end. An absent person becomes invisible; a cover follows the absent role’s complete sampled route, visibility and facing, replacing their own role during that range. Disabling/removing the overlay restores the saved roles without rewriting positions or routes. Overlapping use of the same person in two active attendance entries is rejected. Approved formations and track locks protect attendance edits.

Cover appearance states, personal movement instructions, rehearsal sheets and carried props follow the performed role. Props assigned to a missing role without a cover, including a cover’s suspended original role, fall back to their authored floor/keyframed pose. Review props and range boundaries: switching a visible cover between distant roles can introduce an abrupt positional change. This is a rehearsal overlay, not automatic route generation at its boundaries.

The active-attendance badge opens its settings. Covered/missing selections show their sampled positions and prevent direct stage pose edits; disable the overlay to edit those original role positions. Other cast can still be selected and edited. Current-view 2D/3D playback, image/video capture and printable formation diagrams sample the same overlay. Personal exports include attendance start/end notes.

## Live symmetry and equal spacing

Add a left/right or upstage/downstage mirrored pair, specifying the axis in meters. Either edited dancer drives its partner, including reflected facing. Add a row or column with fixed spacing; member order is captured from their coordinates. The first moved member drives the line. A performer belongs to at most one live constraint per formation, avoiding circular constraint chains.

Preview before Apply. Rules persist with the formation and act on 2D pointer movement, keyboard nudges, numeric edits and shared replacement operations used in either stage view. Results outside the rectangular/usable stage are rejected. Invalid pointer releases roll back the gesture; invalid committed edits restore the previous snapshot and retain the error message. Removing a rule requires confirmation, retains its current pose and supports Undo. Deleting a referenced person/formation cleans dependent rules. Rules constrain authored formation poses, not every intermediate transition sample.

## Backstage traffic planner

Create named wing/entrance zones in Stage designer, then reserve a person, direction and start/end window. Overlapping windows in one zone, opposing entrances/exits and one person booked in two zones create review points. Click a window or review point to seek. Visibility changes suggest the nearest zone and a ±1-second window; manual reservations supersede matching suggestions. The diagram distinguishes manual and suggested windows; the list gives exact times. Reservations do not move performers or simulate physical queues. Review cover changes against manual reservations.

The planner bounds output to 600 windows and the first 500 issues and explicitly reports when limited. Reservations are validated, saved with the project and undoable; removal confirms first. Formation duration changes cannot silently leave reservations outside the score.

## Audience sightline preview

Choose Front/Left/Right/Rear or enter an outside-stage seat and eye height. Preview a performance timestamp. The existing WebGL stage renderer uses that exact eye position, rather than approximating it with orbit zoom. A top-down diagram and per-person report test body points at 0.65, 1.15 and 1.5 meters against rotated bounding boxes for props/raised zones and simplified performer cylinders. Hidden performers do not obstruct the report. The report is approximate: oval/triangular props use conservative box footprints, and labels do not represent occlusion. Performer dimensions follow simplified stage avatars, not measured bodies.

Remember this seat saves only the viewpoint with Undo. Unsupported WebGL leaves the report and diagram usable. The main stage camera and matching-view export camera remain independently controlled.

## Second-screen rehearsal display

Open a read-only window and move it to a second monitor/projector. It follows the editor’s view, camera, counts, committed project edits, props and appearance. The display can follow the editor or choose 2D/3D locally and enter fullscreen. Music remains in the visible editor; reference video and analysis overlays remain there too. Channels use a unique session token and the same browser/origin. This is not remote-device casting or network collaboration.

Scores send after authoring changes, not every animation frame; transport is throttled with immediate transport updates and a heartbeat. The display interpolates the clock up to two seconds, freezes after heartbeat loss and explains disconnection. Reconnect by reopening from the editor. Popup refusal, unavailable channels, score-clone failure, closed windows and unavailable WebGL fail locally. The display starts through a separate boot path and has no project storage or editing adapter. Page hide closes channels/timers/renderers. Keep the editor visible: browsers can suspend hidden windows, and opening another tab on a phone may pause it.

## Full-show setlists

Create a named show; add trimmed routine references and timed intermissions. Move entries with accessible arrows, edit names/ranges, relink restored projects, remove after confirmation, and import/export `.choryn-setlist.json` manifests. Up to 30 shows with 100 entries each are stored separately under `choryn.setlists.v1`. Writes detect competing tabs and preserve damaged data. These changes are separate from project Undo. Editing a setlist stops the active run; restart to use the new order.

Start opens each local project, checks its saved range and music, seeks to its start and advances at its end. Each routine keeps its own stage, cast, cues and soundtrack. Intermissions hold the last stage while counting down. Pause/resume, Next and Stop are available; hidden editors pause intermission timers. Pausing/stopping during loading prevents a late automatic start. Missing projects/music, shortened ranges and playback failures stop with an explanation. Manually switching projects disarms the run.

Routine changes load/decode locally; this is not gapless show audio or a merged cross-project timeline/video. Manifests contain references and ranges, not choreography/media. When moving devices, restore the individual portable backups and use Edit to relink their new project IDs. The second-screen footer follows setlist entry/countdown state.

## Verification

400 automated tests pass, including 49 additions covering these workflows, real event/save handlers in DOM/VM doubles, matching against exhaustive small assignments, 100-person matching, cache invalidation, protected edits, bounded busy wings, canonical video-frame data, explicit-eye WebGL calls, second-screen protocol/error cleanup and setlist lifecycle. These checks do not establish computed layout, physical touch, native popup/fullscreen/monitor behavior, real GPU occlusion/frame rate, actual MP4 codec output or PWA installation. Browser UI remains unavailable after the earlier denial; no workaround was attempted.
