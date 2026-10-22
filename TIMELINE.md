# Timeline editing · v0.13

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
