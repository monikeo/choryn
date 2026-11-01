# Cast & show tools · v0.18.3

## Attendance-safe live constraints in 0.18.3

Active attendance protects both the missing role and the cover's original saved pose at each affected formation. New live rules involving either role are rejected. Existing rules cannot move a protected role indirectly through another member. Shared saves also check X/Z position, facing and visibility, so opening the tools from 2D, 3D or fullscreen does not bypass protection. Constraint enforcement plans every formation before applying changes; a rejected operation does not partially update earlier formations.

The initial constraint selection skips active attendance roles and existing rule members. A rejected preview clears any previous Apply action. Unaffected cast and formations outside the attendance range remain editable. To edit an original role, disable its attendance entry, preview and apply that change, then edit the pose. Re-enable attendance to rehearse the cover again. The stage hint identifies attendance protection separately from approval or a track lock.

The 1 November desktop browser check used a separate four-person score. Protected previews were rejected in normal 2D, fullscreen 2D and 3D; an unaffected pair could preview normally. Disabling attendance in preview restored both original positions. Actual silent 2D and fullscreen-source 3D MP4 exports decoded without errors and retained the visible cover. See VERIFICATION.md for evidence and device limits.

## Fullscreen and capture corrections in 0.18.2

Export current view retains the shared attendance, appearance and prop samplers. Automated graphics checks compare the live and exported 3D camera matrix, follow target and covered-performer labels at 1280×800, 1920×1080, 1024×768 and 390×660 source viewports; 2D frames retain the same cast and role appearance. These are explicit viewport fixtures, not computed browser layouts.

Create video accepts one pending/exporting job. Closing or replacing its dialog cancels work immediately; stale probes and render failures cannot overwrite the next tool. Cancel during music preparation returns to settings. Completed previews release their URL when closed or replaced, and an unexpected non-MP4 result cannot be shown as a successful MP4 export. Browser recording avoids rendering on every high-refresh callback when a lower export FPS is selected. Rendered MP4 retains explicit timestamps.

Fullscreen requests cannot overlap, and a rejected native exit retains the focus workspace with a local instruction. Phone focus mode works without a native fullscreen API. Second-screen cameras now preserve the editor's full 0.12–1.45-radian pitch range. A stable 100-person hold performs no repeated label writes or shader-attribute lookups in the regression harness; moving labels and changed names/colors still update.

## Corrections in 0.18.1

Splitting a formation or reconciling a pasted formation stores authored positions, then applies attendance once during playback and export. Covered-role movement paths use the visible cover's identity and retain their original geometry; these overlay paths cannot edit the saved role. Assignment evaluates the actual neighboring attendance endpoints.

Opening Export, Preferences or another editor dialog pauses an intermission. The shared Play control pauses/resumes intermissions in normal and fullscreen workspaces; automatic routine loading and seeking retain their show context. Error recovery disarms the show and cancels pending setlist imports. A late file read cannot overwrite recovered state.

The second screen reconnects after cached-page return, releases hidden-page resources and falls back to 2D after live WebGL interruption. Paused intermissions retain their remaining time. Fullscreen failures stay local to the display. View/camera changes send lightweight transport messages; full scores send after authoring changes, project switches or connection handshakes. Replacing an audience preview releases its renderer immediately, and comparison SVG identities cannot interfere with the main stage. Phone/tablet touch targets and viewport-height fallbacks are retained.

Attendance/prop/appearance sampling reuses role context, validation computes coverage windows once per entry, and backstage suggestions stop inspecting zones after the output budget. These are CPU-work reductions; no physical-device FPS guarantee is made.

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

451 automated tests pass, including 12 attendance-protection regressions added to the previous 439. They cover all four rule types, direct and propagated pose changes, atomic enforcement, shared-save rollback, eligible default selections, stale previews and retained 2D/3D/export identities. The production MP4-loop integration also checks that active attendance and a rejected constraint leave authored poses unchanged. Existing fullscreen, media, timeline, cast, prop/appearance, show and PWA checks remain passing. Interactive desktop evidence is recorded separately in VERIFICATION.md. Physical iPad/phone behavior, every browser's codec/fullscreen support and installed PWA behavior remain unverified.
