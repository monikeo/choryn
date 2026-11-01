# CHORYN Studio tutorial

This guide follows a complete rehearsal workflow: create a project, arrange a cast, edit transitions, add production details, rehearse and export. You can use a hosted CHORYN installation or the local server described in the [README](README.md).

For a local checkout, install dependencies with `npm ci`, then use `npm run dev`. To rehearse against the production PWA, run `npm run build` followed by `npm start`. Existing project and backup formats are unchanged in the Next.js release.

## Contents

1. [Create a project](#1-create-a-project)
2. [Learn the workspace](#2-learn-the-workspace)
3. [Set the stage](#3-set-the-stage)
4. [Arrange performers](#4-arrange-performers)
5. [Build a formation sequence](#5-build-a-formation-sequence)
6. [Set counts and movement timing](#6-set-counts-and-movement-timing)
7. [Edit the timeline](#7-edit-the-timeline)
8. [Shape curved transitions](#8-shape-curved-transitions)
9. [Add music or rehearse silently](#9-add-music-or-rehearse-silently)
10. [Use ghosts, checkpoints and reference video](#10-use-ghosts-checkpoints-and-reference-video)
11. [Work in 2D, 3D and fullscreen](#11-work-in-2d-3d-and-fullscreen)
12. [Assign a cast and handle absences](#12-assign-a-cast-and-handle-absences)
13. [Add live constraints](#13-add-live-constraints)
14. [Animate props and plan handoffs](#14-animate-props-and-plan-handoffs)
15. [Add lighting, costumes and camera direction](#15-add-lighting-costumes-and-camera-direction)
16. [Review formations and transitions](#16-review-formations-and-transitions)
17. [Plan backstage traffic and sightlines](#17-plan-backstage-traffic-and-sightlines)
18. [Run a show and a second screen](#18-run-a-show-and-a-second-screen)
19. [Preview and download images](#19-preview-and-download-images)
20. [Export a performance video](#20-export-a-performance-video)
21. [Prepare performer packs](#21-prepare-performer-packs)
22. [Back up, restore and update](#22-back-up-restore-and-update)
23. [Use smaller screens](#23-use-smaller-screens)
24. [Troubleshoot common problems](#24-troubleshoot-common-problems)

## 1. Create a project

1. Click the CHORYN wordmark to open Projects.
2. Choose **Create a project**.
3. Enter a name you will recognize in backups and exports.
4. Choose a discipline, performer count and tempo.
5. Choose **Silent formation rehearsal** or the built-in studio sketch.
6. Create the project.

A new score starts with a 16 × 10 m stage and six editable formations over 96 seconds. These are starting values; you can change the stage, score and cast.

For this walkthrough, keep 12 performers, 120 BPM and Silent mode. You can add music later without rebuilding the formations.

## 2. Learn the workspace

On a wide desktop, the formation list sits beside the stage, the inspector sits on the other side, and the performance timeline is below. Tablet and phone layouts move some of those tools into drawers or dialogs.

Use the formation list to choose a saved formation. Use the timeline scrubber to see an intermediate time. The inspector edits the current formation or selected performers.

The stage toolbar provides selection, pan, path editing, view orientation, 2D/3D and **Cast & show**. **Main stage** opens the stage designer.

Command search is often the quickest route to a tool. Open it with its search button or **Ctrl/Command K**, type part of a tool name, then choose the result.

## 3. Set the stage

Open **Main stage** or **Production → Stage designer**.

1. Enter the physical stage width and depth in meters.
2. Choose an outline preset or edit the usable outline.
3. Add named wings, entrances, risers, obstacles or restricted zones as needed.
4. Check the stage preview before saving.

X increases to audience-right; Z increases upstage. Facing 0° points toward the audience.

In the visual designer, select an outline vertex or a zone move/resize handle. Drag it, or use the precision buttons. Keyboard handles support small adjustments; Alt bypasses snapping during applicable drags.

### Use a floor plan

Import a PNG, JPEG or WebP image. Preview it, set its physical width and depth, then adjust its position, rotation and opacity. Treat calibration as a measurement task: a drawing that looks centered is not necessarily at the right scale.

### Use a CAD drawing

Import text DXF and enter the meters-per-CAD-unit scale. Preview the converted lines and bounds before applying. Binary DWG must be converted first. Imported lines are visual references; add explicit zones where you need obstacle or restricted-area checks.

## 4. Arrange performers

In 2D, select a performer and drag it to the intended position. Use the inspector for exact X, Z and facing values.

Drag an empty area of the stage to draw a selection box. Shift adds to a selection; Alt removes. Use **Select multiple performers** when working with several people through the roster or stage controls.

For an existing selection:

- Drag to move the group together.
- Use arrow keys for small position changes; Shift increases the step.
- Open Transform for rotation, scale, mirroring or distribution.
- Use the alignment tools for a row, column, circle or fixed spacing.

Check the coordinate fields when precision matters. If a performer is protected by attendance, an approved formation or a locked track, resolve that protection before trying to move it.

### Organize the cast

Open the performer roster or **Customize selected cast**. Assign names, roles, groups, marker colors and tags. Search can find performers by those fields.

Groups help when selecting sections of a cast and restricting smart assignment. A role describes the performer's assignment; it does not add articulated dance animation to the 3D figure.

## 5. Build a formation sequence

Choose a formation from the list and arrange its performers. To start from a shape, open the template library.

The library includes lines, wedges, geometric shapes, curves and dance layouts. Search or filter it, choose the whole cast or selected performers, then adjust scale, angle, facing and mirroring before applying.

Add a formation when you need a new destination. Duplicate one when you want to keep most of its arrangement. Give formations short, useful names such as “Opening line,” “Solo reveal” or “Final circle.”

Keep the opening formation at time zero. The final formation holds through the end of the performance.

## 6. Set counts and movement timing

Open **Counts and exact timing** for the selected sequence. You can work in seconds or phrase.count notation.

At 120 BPM, one count lasts 0.5 seconds. With a zero downbeat offset, 8.1 is 28 seconds and 8.2 is 28.5 seconds. Fractional counts such as `8.2+0.5` allow finer placement.

A formation interval includes its hold and its outgoing movement. For example, if the opening begins at 0 and the next formation begins at 16:

- A 4-second movement gives a 12-second hold, then movement from 12 to 16.
- A 6-second movement gives a 10-second hold, then movement from 10 to 16.

Use **Movement timing & hold** to change the sequence's movement duration, path style and easing. Individual performer routes can retain their own timing overrides, so inspect those routes if one person moves differently from the group.

## 7. Edit the timeline

Select a timeline clip before using Duplicate, Split, Copy, Paste, Cut or Delete. The primary commands use icons; **More timeline tools** contains the rest and the precise clip inspector.

### Reorder and retime

**Reorder** changes which formation occupies each existing sequence slot. Drag a formation body with a mouse or pen. Review the destination guide before releasing.

**Retime** changes a formation's start within its neighbors. Choose Drag → Retime first.

Reordering can break the adjacency required by a custom performer route. CHORYN asks you to review affected routes rather than quietly keeping an invalid connection.

### Trim, split and duplicate

Drag a clip edge to trim its boundary. Neighboring formation clips share a boundary. The last formation's end controls performance length and protects content placed later in the score.

To split, place the playhead inside the clip, at least 0.1 seconds from either edge, then choose Split. A formation split samples the authored pose at that time. Active attendance is applied afterward during playback, so the cover is not baked into the saved formation.

Duplicate adds a copy where it can fit. Movement clips may occupy separate packed rows when intervals overlap.

Delete and Cut ask for confirmation. Read the confirmation carefully, especially with Ripple enabled.

### Snap and zoom

Choose Beat, ½ beat, Second or Off. Hold Alt for precise dragging without changing the selected snap mode.

Zoom the timeline with its controls. **More → Zoom to selected clip** frames one clip. While the timeline has focus, Ctrl/Command +, − and 0 zoom or fit it.

If touch edges are hard to grab, open Clip inspector and enter the boundary or playhead numerically.

### Ripple, links and track locks

In **Production workspace → Tracks & links**, show, hide, collapse or lock lanes.

Ripple moves downstream content when a formation boundary changes. Ripple deletion can remove enclosed events and shorten the show; its confirmation describes that result.

Linked groups preserve offsets between chosen formations and production events. A locked or approved linked member can reject the entire edit. Unlink a group before making a change that should affect only one member.

## 8. Shape curved transitions

Choose the earlier formation of a transition and turn on movement paths. Enter path editing and select a performer.

Drag the path handle or waypoint to curve the route. Use **Motion & alignment** for exact route timing, departure delay and the movement curve.

The timing-curve editor changes progress along a route. It does not change the route's geometry. Try a gentle arrival or delayed departure, then scrub through the transition and check spacing.

A route lock protects custom work from assignment or replacement tools. Disable attendance before editing a protected role.

## 9. Add music or rehearse silently

Open **Music trim and sync**.

1. Choose Silent, the built-in sketch or an uploaded soundtrack.
2. Set the source trim start and end.
3. Set when that trimmed audio starts on the performance timeline.
4. Set the first downbeat and tempo.
5. Save, then play from a known point.

Source trim changes the audio window, not formation times. The downbeat offset aligns count labels and beat snapping; it is separate from the soundtrack start.

The waveform helps place events visually. Tempo is entered manually. Silent mode still supports counts, transitions, images and video export.

## 10. Use ghosts, checkpoints and reference video

Open the rehearsal view aids.

- Show previous and next formations as ghost positions.
- Add named checkpoints at useful counts or exact times.
- Show intermediate count ghosts to inspect how a transition develops.
- Limit ghosts to selected performers when the stage gets crowded.
- Follow a performer or group with the camera.

For reference video, upload a local file, set its source trim, timeline start and frame rate, then use frame stepping to inspect the rehearsal. Show or hide the reference dock as needed.

The visible reference can be included in matching-view exports when its media is available on the device. Keep a separate copy of the reference file when moving projects between devices.

## 11. Work in 2D, 3D and fullscreen

Use 2D for direct formation editing and path work. Use 3D to review depth, facing, props, risers and the camera.

In 3D:

- Drag to orbit.
- Right- or middle-drag to pan.
- Wheel or pinch to zoom.
- Open **View controls** for pan, orbit, zoom and Fit buttons.
- In Pan mode, trackpad scrolling moves the view.

Use **Stage rotation and audience orientation** for the 2D stage's rotation, mirroring and audience direction. These view changes do not rewrite the choreography.

Open **Fullscreen stage** to focus on the stage. **Show timeline** reveals the editing timeline while you stay in that workspace. Command search and Cast & show remain available.

Where browser-native fullscreen is unavailable, CHORYN uses its stage focus layout. A browser can reserve Escape for leaving native fullscreen.

Before exporting, set the camera, grid, names, ghosts and analysis overlays the way you want them to appear.

## 12. Assign a cast and handle absences

Open **Cast & show → Smart cast**.

Choose a target after the opening. Keep group and role restrictions when they matter, choose the outgoing-travel weight and preview the assignment. Review the current/proposed diagrams and affected custom routes before applying.

Assignment changes who occupies existing slots. It minimizes the chosen endpoint travel objective; it does not find a complete collision-free route plan. Assignment locks, live-rule members and active attendance participants stay pinned.

### Add an attendance overlay

Open **Attendance** and choose:

1. The missing performer.
2. An existing understudy, or No cover.
3. The first and last formations, inclusive.
4. Preview, then Apply.

The overlay lasts until the next formation after the selected last one, or through performance end. A cover follows the missing role's sampled position, facing and visibility. Its own role is suspended during that interval.

The roster stays intact. With one missing person covered by another person already in a 12-person cast, you normally see 11 people on stage, not a thirteenth person.

Carried props, appearance states and personal instructions follow the performed role. Review the boundaries: changing a cover between distant roles can still create an abrupt positional jump.

## 13. Add live constraints

Open **Cast & show → Live constraints**.

1. Choose a formation.
2. Choose a mirrored pair, an evenly spaced row or an evenly spaced column.
3. Select the members and enter the axis or spacing value in meters.
4. Preview the result.
5. Apply if the result is correct.

Either member can drive a mirrored pair. For an evenly spaced line, the first moved member drives its companions. One performer can belong to one live rule per formation.

### Attendance protection

While attendance is active at the target formation, the missing role and the cover's original role retain their saved X/Z position, facing and visibility.

You cannot add a rule involving either role, or use an existing rule to move it indirectly. A failed operation leaves the saved poses unchanged. The form's initial selection skips unavailable members, and the stage hint explains attendance protection separately from an approved-formation lock.

To change the underlying choreography:

1. Open **Attendance active**.
2. Disable the relevant attendance entry.
3. Preview and apply that change.
4. Edit the saved roles or constraints.
5. Re-enable attendance when you are ready to review the cover again.

Other cast members remain available for editing. Formations outside the active attendance range are also editable.

## 14. Animate props and plan handoffs

Add a stage prop and set its shape, size, color, position, height and rotation.

Add pose keys at the times where the prop changes. Scrub between them to inspect movement and appearance changes.

Attach a prop to a performer with an offset. Add another attachment event for a handoff, or place it on the floor with a floor-pose event. These are stage-relative carrier relationships, not articulated hand or physics simulation.

An active cover carries the original role's assigned prop. A role with no available carrier falls back to the prop's authored floor/keyframed pose. Review that fallback before rehearsal.

## 15. Add lighting, costumes and camera direction

Open the appropriate Production workspace panel.

**Lighting:** choose a fixture/wash group, time, color, position, radius and intensity. Use fade keys for a gradual change or intensity zero for blackout. Scrub the preview before saving.

**Costumes:** apply a color and costume label to one performer, a selection, a group or the cast. A timestamp conflict rejects the whole group change.

**Camera:** author camera keys or generate automatic camera direction. Rehearsal follow can take precedence, and manual navigation can pause saved direction.

These states feed the same stage samplers used in matching-view capture. Lighting does not send DMX or control physical equipment; costume states do not replace the simple 3D avatars with garment models.

## 16. Review formations and transitions

Use **Compare & heatmaps** to compare formations, inspect travel traces or review sampled spacing.

Use **Health & transitions** for stage-boundary, obstacle, spacing and speed review. Seek to an issue to inspect it in context.

Transition suggestions compare a small set of direct, curved and staggered candidates. Preview the suggestion and scrub it before Apply.

A better score is a useful lead, not a guarantee of a safe physical performance. Review stage measurements, props and the actual dancers' routes during rehearsal.

## 17. Plan backstage traffic and sightlines

### Backstage

Create named wing or entrance zones in Stage designer first. Then reserve a performer, direction and start/end window in **Backstage**.

Review shared-zone queues, opposing traffic and one person reserved in two zones. Visibility changes can suggest entrance/exit windows. Reservations are planning records; they do not move performers.

### Sightlines

Choose an outside-stage audience seat and eye height. Preview a time in the performance. Compare the fixed-eye 3D view with the sampled body-point report.

The report uses simplified performer bodies and conservative prop footprints. Treat it as an approximation; visible labels alone do not prove that a body is unobstructed.

## 18. Run a show and a second screen

### Setlists

Open **Setlists**, create a named show and add local routine references. Trim each routine's start/end range and add timed intermissions.

Use the move arrows to order entries. Start show opens each project, seeks to its range and advances at the end. Use Pause, Resume, Next or Stop when needed.

Opening an editor dialog during an intermission pauses it. The shared Play control can resume a paused intermission. Manually changing projects or editing the setlist disarms the current run.

Export the setlist manifest when you need its order and ranges elsewhere. Restore the individual project backups on the other device, then relink the routine references.

### Second screen

Open the read-only rehearsal display and move it to another monitor or projector. It follows the editor's stage, camera and count clock, with its own 2D/3D and fullscreen controls.

Keep the editor visible. Music plays in the editor, and browsers can suspend hidden windows. This is a connection between windows in the same browser and origin, not a remote casting service.

## 19. Preview and download images

Open an image export command or **Batch images and timeline captures**.

Choose Current playhead, Selected formations or Timeline range. For a range, choose the interval in counts or seconds. Start and end samples are included.

Select PNG, JPEG or SVG and 1× or 2× scale. Generate previews first. Inspect the gallery, then download individual images or a selected ZIP batch.

A batch supports up to 100 images, and each image is capped at 4096 pixels per edge. A 2D SVG retains vector stage content. A 3D SVG contains an embedded raster snapshot.

## 20. Export a performance video

Set the stage view first. Use command search for **Export performance video**, including from fullscreen.

1. Choose 480p, 720p, 1080p or 1440p.
2. Choose Compact, Standard or High bitrate.
3. Choose 24, 30 or 60 FPS.
4. Choose an offered format.
5. Enter the exact From/To range.
6. Choose whether to include music, performer names and a visible reference video.
7. Create the video.
8. Play the preview, then download it before closing the dialog.

The output width follows the stage viewport's proportions. A portrait stage therefore produces a portrait video; the resolution preset describes its height, subject to encoder limits.

MP4 chooses rendered H.264/AAC or native browser recording according to available support. WebM is offered where supported. Rendered MP4 uses explicit frame timestamps; native recording runs in real time and its delivered frame rate depends on the device.

Keep the tab visible and the device awake. Start with a short 720p clip on a device you have not used before. If an encoder or memory limit rejects the job, shorten the range or lower the quality. If AAC is unavailable, try silent MP4 or an offered WebM format.

The stage renderers and performance sampler provide the cast, props, lighting, appearance, overlays and camera. The editing controls are excluded. Attendance protection remains an authoring rule; exporting does not change the saved poses.

## 21. Prepare performer packs

Use personalized performer exports for one person or a group.

A pack can include formation/checkpoint diagrams, coordinates, facing, visibility, costume labels, instructions, cues and prop responsibilities. Turn off detailed production events for a compact rehearsal book.

For a follow-camera performer video, choose the performer, prepare its view and review the camera before creating the video.

An understudy's instructions describe the performed role and its attendance range. Check those notes when a cover has more than one responsibility in the score.

## 22. Back up, restore and update

Use **Export** for a portable project backup. Keep the original soundtrack and reference video files as well.

Projects belong to this browser's storage. Signing into another browser or visiting the same URL on another device does not synchronize them.

To restore, open Projects and choose **Restore a backup**. If a setlist references an older project ID, use Edit in Setlists to relink the restored project.

### Save conflicts

If two tabs change the same collection, CHORYN stops a conflicting save. Open **Review & recover** and preserve the current tab as a separate project if you need both versions. Inspect the saved copies before discarding anything.

### Offline and updates

On a built HTTPS or localhost installation, open **Install & offline** and check its offline status. Verify readiness while online before relying on an offline session.

When an update is prepared, save your work and use **Save and update**. Close other CHORYN editor/display windows if activation asks you to. Export a backup before clearing browser data or moving devices.

Installation depends on the browser and operating system. Use the offered installation flow or the platform's Add to Home Screen/Add to Dock option.

## 23. Use smaller screens

On a tablet or phone, open the formation drawer and inspector when needed instead of keeping every panel visible. Cast & show tabs scroll horizontally, and long forms scroll within the dialog.

Use dedicated timeline grips and edges for touch edits; use the clip inspector for precise values. Keep room for the stage by collapsing the timeline or using fullscreen, then reveal the timeline when you need it.

Use View controls for camera adjustments that are awkward with a gesture. A two-finger gesture cancels an unfinished stage edit before navigating.

A desktop browser resized to phone dimensions is useful for checking layout. It does not reproduce mobile Safari, a phone's graphics limits or physical touch input.

## 24. Troubleshoot common problems

| Symptom | What to try |
| --- | --- |
| A covered performer will not move | Disable the relevant attendance entry, preview/apply, then edit the saved role. |
| A constraint preview is rejected | Check attendance, existing rules, stage bounds, approval and track locks. A rejected preview does not change saved poses. |
| Split is unavailable | Move the playhead inside the clip, at least 0.1 seconds from either edge. |
| A drag will not land where expected | Check Reorder/Retime, snapping, linked members and locks; use Clip inspector for exact values. |
| The stage feels slow | Open Playback performance, try Efficient mode, reduce visible aids and inspect a short rehearsal segment. The displayed cost is not GPU FPS. |
| 3D is unavailable or interrupted | Continue in 2D; close unnecessary graphics-heavy tabs and retry on a WebGL-capable device. |
| MP4 is not offered | Try a lower resolution or a browser with H.264 support. Unsupported codecs cannot be enabled by renaming a file. |
| Music is missing after restoring | Restore a portable backup with its audio or attach the original soundtrack again. |
| Reference video is missing | Attach the original reference file on this device. |
| Export stops when changing tabs | Keep CHORYN visible until the job finishes. |
| A second screen freezes | Keep the editor visible, then reconnect the display from Cast & show. |
| A setlist routine is unavailable | Restore its project and media, then edit the entry to relink and review the trim range. |
| Saving needs attention | Open recovery, preserve separate versions and resolve the conflict before continuing. |

For exact editing semantics and implementation limits, see [FEATURES.md](FEATURES.md), [TIMELINE.md](TIMELINE.md), [PRODUCTION.md](PRODUCTION.md) and [ENSEMBLE.md](ENSEMBLE.md).
