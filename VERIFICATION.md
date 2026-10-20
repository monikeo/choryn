# CHORYN v0.7.1 fullscreen playback verification — 20 October 2026

108 automated tests pass. All application/script JavaScript syntax checks and the production build pass. The user reported that both 2D and 3D fullscreen playback felt slow; this release changes the shared scheduling path and accounts for 3D drawing cost in adaptive quality.

## Identified cause and changes

The prior loop rendered only when elapsed callback time was at least 1000/30 milliseconds, then replaced its previous timestamp with the actual callback time. Floating-point and display scheduling differences could skip another refresh instead of retaining the intended phase. A deterministic 10-second 60Hz simulation yielded only 204 updates. The new scheduler uses an advancing deadline, a small timestamp tolerance, and drops obsolete deadlines after stalls. Smooth mode yields 600 updates in the same simulation. This is a scheduler simulation, not measured device FPS.

The stage targets up to 60 editor updates/s. Automatic mode reduces the target to 30 when the average CPU update cost stays high and returns to 60 after sustained headroom. Smooth fixes the target at 60; Efficient fixes it at 30. WebGL reports its drawing cost back to the shared budget. The existing audio clock remains authoritative and is independent of visual update pacing.

Visible timeline controls update at up to 10/s. Hidden fullscreen timeline controls receive no playback HUD updates. Hidden inspectors are not rebuilt at formation boundaries. Fullscreen chrome is hidden, stage painting is isolated during playback, decorative background dots are removed during playback, and curve handles return when playback pauses. The editable stage, props, paths and geometry are retained.

Preferences → Playback performance includes the quality selector and local measurements from the last 120 editor updates. Measurements cover CPU updates and submitted 3D drawing work, not the screen compositor or GPU completion time.

## Regression coverage

- Intended 60-update cadence on simulated 60/90/120/144Hz refresh callbacks; fixed 30-update Efficient mode.
- Long stalls skip expired deadlines and do not cause catch-up bursts.
- Automatic quality steps down under sustained expensive updates and recovers after stable headroom.
- Bounded timing statistics, invalid-sample protection and per-run reset.
- Hidden HUD stays untouched while performer positions continue to animate, then catches up when visible.
- Existing route, prop, timing, validation, backup, video and offline-shell tests remain green.

## Limits

Live fullscreen profiling is unverified: the browser security policy denied access in the previous verification session, and no workaround was attempted. No claim of 60 displayed FPS on physical hardware is made. Prior responsive and playback checks are recorded in verification-v07.md. The source build and complete static/dynamic module cache closure are checked before packaging. The existing site audience remains owner-private.

Proposed next features are documented separately in docs/feature-roadmap.md; they are not presented as implemented.
