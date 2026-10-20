# CHORYN v0.9.1 dialog recovery verification — 21 October 2026

144 automated tests pass. All 43 application/script JavaScript syntax checks, the production build, and complete offline shell closure pass. This is a focused fix for the user-reported blocked controls and “Cannot read properties of undefined (reading analysis)” error.

## Root cause and fix

`openDialog()` calls `pause()` before showing Properties, Preferences, workspace tools and other dialogs. Pause passes only transport information to `createPlaybackView.update()`, deliberately omitting stage state. The v0.9 analysis-layer update read `state.analysis` without checking whether state was present. Because the analysis layer is always in the real 2D DOM, even when overlays are off, pausing threw before the dialog could open. The recovery callback also calls pause, so it encountered the same failure.

The updater now completes any requested transport changes and returns when no stage state was supplied. It preserves existing analysis/ghost layers and accepts the next explicit stage update normally. No project data/schema, storage, media, or choreography migration is involved.

## Regression evidence

The existing playback test fixture now contains the actual analysis and ghost layer containers. Before the fix, both the transport-state test and the new pause regression failed with the exact reported TypeError. The guard makes them pass.

New coverage checks transport-only pause updates with visible/hidden HUD, omitted options, preserved overlay content/node writes, and successful later stage updates. A second test executes the actual pause/openDialog/Properties/Preferences/workspace function bodies from app.js against the initialized playback renderer and a minimal dialog DOM. All three dialog entry paths complete. This uses test doubles, not a browser session. The prior 142 tests remain green.

The generated service-worker shell hash changes with the fixed source. Source/build equality and relative static/dynamic module closure are checked before packaging. Installed clients retain coherent old assets until Save and update; the update action itself does not invoke the failing pause path. Reload once to discover the update, then accept it. Clearing browser data is not required.

## Limits

Live browser access remains unavailable following the prior browser policy denial; no workaround was attempted. No live device or codec test is claimed. The fault was reproduced directly in the playback updater and actual dialog entry functions. Existing v0.9 responsive/capture limitations remain documented in docs/verification-v09.md. The site audience remains owner-private and the release stays local-first.
