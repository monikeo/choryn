# Timeline editing · v0.17.0

## Precision and input refinements

Magnetic targets are prepared once per gesture, with linked partners excluded because they move together. A captured magnet holds through a 13 px release radius instead of switching between nearby targets inside the 9 px acquisition radius. Off/Alt precision bypasses magnets. Horizontal motion starts a timing edit; purely vertical grip motion does not retime. Native scrolling refreshes the held preview. Edge scrolling stops scheduling work at its limit. Gesture previews remain immutable and a successful drop creates one history edit; returning a production key to its original time creates none.

Select a clip and choose **More → Zoom to selected clip** to center and enlarge its interval. Ctrl/⌘ +/−/0 zooms/fits the timeline while it has focus; stage zoom retains those shortcuts outside the timeline. Zoom does not rerender the stage or edit project data. Clip inspector remains the precise alternative to small edges on a zoomed-out phone timeline. Touch bodies scroll, and grips/edges edit.

Resize previews coalesce into animation frames and save the final matching pointer release once. Pointer cancellation, capture loss, Escape, resize/orientation, fullscreen changes, hidden documents and teardown restore the original height. Arrow Up/Down adjusts height by 30 px, Page Up/Down by 90 px, Home or double-click resets it. Rebinding removes prior controls/listeners, including production/prop drags, to avoid stale frames after 2D/3D/fullscreen changes.

Timeline shortcuts cannot reach stage performer deletion, translation, selection tools or stage zoom. Native Space activation remains available to focused buttons. Focused production keys retain their own nudging; Delete on lighting, appearance or camera keys opens a removal confirmation, and prop-pose removal stays in its details. Escape cancels the application's active gesture before its fullscreen handler. A browser may reserve Escape for native fullscreen exit; fullscreen/resize events also cancel safely.

Coarse-pointer formation clips and movement rows have more room; production labels match their lanes, including collapsed packed movements. Hidden/collapsed layers stay respected in fullscreen. More tools uses a viewport-positioned menu, and short landscape fullscreen uses a scrollable compact rail with visible track space. CSS review is not computed-layout or physical-device verification. The same command/gesture path serves both stage views.

## Retained editing behavior

Production workspace adds hide/collapse/lock controls for eight lanes, ripple retiming/trimming/deletion, linked event groups, and editable lighting/appearance/camera events. See PRODUCTION.md. The behavior below describes default editing with Ripple off and unlinked events; linked events follow their sequence during reorder. Ripple deletion explicitly confirms enclosed-event removal and the shortened performance.

Production events and prop-pose keys now share selected snapping, magnetic targets, Alt precision, linked timing previews, gradual edge scrolling, pointer cancellation and keyboard nudging. Touch edits use dedicated grips. End trims protect lighting, costume and camera events; ripple endpoint trims move events on the old endpoint. Linked editing keeps approved formations and locked props/tracks protected.

The performance timeline uses CHORYN's existing system typography, neutral surfaces and violet sequence blocks. Duplicate, Split and Delete remain icon actions; More tools exposes the clip inspector, copy/paste/cut, trim dialogs, move earlier/later, formation sequence, image previews and loop range. Narrow phone layouts keep Delete inside More tools. Music, exact counts, rehearsal view aids and the fine scrubber share the editing rail. Desktop uses one row; phone editing wraps below its main tools. Fullscreen keeps the same controls. Timeline height can be resized, with a minimum that preserves usable track space.

## Drag and drop

- **Reorder:** drag a formation body with a mouse or pen. Its original center determines the destination, regardless of where it was grabbed. Other blocks preview the candidate order, with a destination guide and sequence/time feedback. Existing sequence start slots stay fixed. Checkpoints, cues, music and prop events keep their authored times. A reorder that invalidates custom performer routes requires review before it is saved.
- **Retime:** choose Drag → Retime and move a formation start within its neighbors. The opening stays at zero. Approved formations and shared approved boundaries are protected.
- **Trim:** drag either visible clip edge. The pointer offset is preserved, so grabbing a thick handle does not jump the boundary. Formation edges share their neighbor's boundary. The last edge changes performance length without discarding later timestamped content.
- **Movement / cues:** drag to move; movement edge handles preserve a minimum duration. Movement tracks pack overlaps into separate rows. Cues remain point events. On touch, bodies scroll the timeline and dedicated grips/edges start edits.
- **Snap:** beat, half-beat, second or Off. Magnetic targets include formation starts, other movement edges, checkpoints, cues, the stationary playhead and performance end. The edited boundary is excluded. Hold Alt for unsnapped precision without changing the chosen snapping mode.
- **Auto-scroll:** hold near a horizontal viewport edge. Speed increases progressively toward that edge and continues with a stationary pointer. Scrolling updates the candidate using original content coordinates.

Pointer movement is coalesced to one animation-frame preview. A candidate is rebuilt only when its snapped time or destination changes, and project history receives one edit on a successful drop. Escape, pointer cancellation, lost capture, window blur, document hiding, recovery or teardown restore the original layout. A second touch cancels a grip gesture. Unrelated pointer releases cannot finish it. A changed score or a drop well outside the track viewport is rejected.

## Commands and navigation

Select a clip, then use the icons or More → Clip inspector. Double-click opens details. Right-click opens the inspector. Ctrl/Command D duplicates; C/X/V copies/cuts/pastes in the current project; S splits at the playhead. Alt Left/Right moves a formation one sequence slot. Opening/approved protections apply to commands and gestures. Delete and Cut always require confirmation; a score edited after the prompt must be reviewed again. Exact timing is available through the inspector and Counts tool.

Timeline zoom buttons and Ctrl/Command wheel or trackpad pinch preserve the viewport anchor without re-rendering the stage. Shift-wheel scrolls horizontally. Ordinary touch and trackpad scrolling remain available. The ruler and fine scrubber preview the performance; timeline arrow keys navigate counts. Reduced-motion users receive immediate sequence positioning. Tools retain accessible names, disabled reasons and native keyboard focus, and drag feedback uses a live status region.

## Verification limits

Automated checks exercise the actual pointer binder and timeline UI with DOM/event/cache doubles, plus the existing editor model tests. Browser rendering, real touch hardware, screen-reader announcements and physical-device responsiveness remain unverified following the earlier browser-access denial. The responsive styles were reviewed for the existing desktop, tablet, phone, fullscreen, coarse-pointer, reduced-motion and forced-colors rules; no screenshots or measured frame-rate claims are made.
