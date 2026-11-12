# Application architecture

CHORYN 0.19 runs on Next.js 16.4.3, React 19.3.1 and TypeScript 5.9.3. The exact dependencies are pinned in `package-lock.json`.

## Routes and rendering

`app/layout.tsx` defines the document, metadata, install icons, authenticated manifest link and global styles. `app/page.tsx` renders the studio client. `app/error.tsx` provides a reload boundary without clearing browser projects.

`app/studio-client.tsx` starts the workstation after hydration. React owns the stable application host; the TypeScript editor owns its descendants. Timeline playback and SVG/WebGL updates do not drive React renders. A shared startup promise prevents Strict Mode effect replay from attaching the editor twice.

The workstation still uses named views and URL hashes within one application route. This keeps rehearsal links, installed shortcuts and the read-only second screen compatible with existing scores. Opening the second-screen hash starts its separate display module rather than the editable studio.

The high-frequency editor has not been rewritten as a tree of React controls. It is part of the Next.js module graph and production bundles, rather than a separate HTML application inside an iframe. The former root HTML document is retained only as an isolated regression fixture under `tests/fixtures/`.

## Form factors

One DOM serves three layouts. `src/responsive.css` is imported last in `app/layout.tsx` and resolves the breakpoint conflicts that earlier per-release stylesheets accumulated:

- **Desktop (≥1200px)**: rail, tabs, three resizable panes and a status bar. The timeline height follows the window height.
- **Tablet (768–1199px)**: rail and tabs with a stage-first canvas. Landscape tablets up to 940px tall use a single-line heading and a height-aware timeline. The inspector opens as a sheet.
- **Phone (<768px)**: compact header, bottom tab bar (More is highlighted for overflow workspaces), and dialogs as bottom sheets anchored to the visible viewport, so they sit above the on-screen keyboard. Drag a sheet's header down to dismiss it (`src/sheet-gesture.ts`). Phones up to 700px tall and feature pages show the timeline transport only; Edit expands the full timeline.
- **Phone landscape (≤500px tall, ≤1023px wide)**: navigation moves to a side rail. The workbench actions move into the canvas toolbar, and the zoom controls dock beside the stage.

## Input

`src/input-gestures.ts` keeps mouse, trackpad, pen and touch behaviour platform-native:

- **Stage (2D and 3D):** a mouse wheel zooms at the pointer. A trackpad two-finger swipe pans, and a pinch zooms. Chromium and Firefox report pinch as Ctrl+wheel; Safari on macOS reports it as gesture events. Detection is automatic, and Settings → This device → Scroll gestures can force Mouse or Trackpad.
- **Timeline:** a mouse wheel over the tracks moves through time, while the track-name column scrolls the tracks vertically. Ctrl/⌘+wheel and pinch (trackpad or two fingers) zoom around the pointer. Touch drags start from clip grips after an 8px slop; clip bodies scroll natively. A long-press opens clip tools, and snapping gives a haptic tick where the device supports it.
- **Hover styles** apply only where a pointer can hover (`any-hover`), so taps never leave "stuck" highlights. Touch presses dim controls instead.

## Native device features

- **Rehearsal playback** (`src/native-playback.ts`): a Screen Wake Lock keeps phones awake while playing, and is re-acquired after the app returns to the foreground. Media Session provides lock-screen, notification, headphone and media-key controls: play/pause, ±5 s, seek, previous/next formation. Browsers attach Media Session only to a media element, so a silent looping `<audio>` runs beside Web Audio during audible playback. On iOS this also lets music play with the silent switch on.
- **Saving files** (`src/native-share.ts`): touch devices send backups, images, ZIPs and videos to the system share sheet; desktops download. If an export outlives the tap that started it, a "ready" sheet offers Share and Save.
- **Tempo & counts** (`src/tempo-tools.ts`): open it from the beat counter, More, or command search. It offers tap tempo (one undoable change), a metronome click accented on each "1", and count vibration on Android. Clicks run on their own timer against the audio clock, so they keep time when the screen locks.
- **Touch and stylus** (`src/input-gestures.ts`): a two-finger tap undoes and a three-finger tap redoes. Palm rejection ignores touches while a stylus is drawing or hovering on the stage.
- **Files in** (`src/file-drop.ts`): drop music or a `.choryn` backup anywhere. Installed Chromium apps open `.choryn` files from the OS through the manifest `file_handlers` and `launchQueue`. Both routes reuse the hidden file inputs and their validation.

## Creative tools

The creative tools write ordinary project data, so playback, analysis, exports, undo and validation treat their results like hand-made edits:

- **Transition designer** (`src/transition-styles.ts`) turns a style and a canon order into routes: waypoints for the path, `delay` for a later start and the optional `settle` for an early arrival. The engine samples a route over `[next.time − window + delay, next.time − settle]`, so a canon gives every wave the same move length. A gap too long for the time available is shortened so no move is under 0.6 s.
- **Variations** (`src/formation-variations.ts`) and the **Shapes palette** reuse `fitToStage` and the shortest-travel assignment. A drop converts the pointer through `#stage-transform`'s screen matrix, so rotated, mirrored and zoomed views place the shape where the finger lifts.
- **Music structure** (`src/music-structure.ts`) derives 8-count phrases from the tempo and count 1. Song sections compare loudness phrase by phrase; snapping uses the timeline model, so locks and linked events behave as they do for a drag.
- **Problems lane** (`src/problems-model.ts`) groups `evaluateTransition` issues per formation, kind and phase (holding or travelling). Results are cached per transition content, so an edit re-checks only the moves next to the changed formation. The lane updates shortly after edits settle and never during playback.
- **Editing history** labels undo snapshots with `describeChange` and jumps several steps with `undo(redo, steps)`.
- **Simple / Pro** sets `data-level` on the document; Simple hides `.pro-only` controls with CSS, so nothing is removed from the DOM or from keyboard commands. New users start in Simple; existing users keep Pro.

## TypeScript boundaries

Everything authored for this project is TypeScript, apart from the regression tests:

| Code | Language | Checked by |
| --- | --- | --- |
| Next.js routes and config (`app/*.tsx`, `next.config.ts`) | TSX / TS, **strict** | `tsconfig.json` |
| Application modules (`src/*.ts`) | TS, **strict** | `tsconfig.json` |
| Service worker (`sw.ts`) | TS, **strict** | `tsconfig.worker.json` |
| Build, test, preview, benchmark and icon scripts (`scripts/*.ts`) | TS, **strict** | `tsconfig.scripts.json`; run directly by Node's built-in type stripping (Node 22.18+) |
| Regression tests (`tests/*.test.mjs`) | JavaScript | run by `node --test` |

`npm run typecheck` runs all three projects, and `npm run build` refuses to build if any of them fails.

`src/types.ts` holds the shared contracts for performers, poses, formations, props, attendance, tracks, cues, cameras, views and exports. Imported project data still passes through the runtime validators; compile-time types do not replace validation.

**Strictness.** Every project runs with full `strict` (including `noImplicitAny`, `strictNullChecks` and `unknown` catch variables, read with `errorMessage()` from `src/errors.ts`). `tsconfig.json` adds implicit returns, switch fall-through, `override`, file-name casing (Linux CI), erasable-only syntax and verbatim module syntax. The last two keep every file strippable by Node, which is how the tests and scripts run it. Conventions:

- Validators read imported JSON as `Unchecked` (`src/types.ts`, an alias of `any`) until they have checked it; every other value has a real type.
- Element lookups name the element they expect (`$<HTMLInputElement>('#…')`). A non-null `!` marks only lookups the markup guarantees, such as a node rendered in the same function or a `data-*` value read from an element matched by `[data-*]`.
- Feature modules take a typed adapter: `Pick<StudioServices, …>` from `src/types.ts` plus their own callbacks.

**Tests stay JavaScript for now.** They drive the modules through deliberately loose doubles (fake DOM, WebGL and media objects); converting them means typing those doubles, about 760 compiler findings. They import the same type-stripped modules the browser runs.

The unmodified Mediabunny distribution remains JavaScript, with the matching upstream `.d.ts` declarations and license files. Third-party package implementations are also distributed in their upstream formats.

Fonts (DM Sans, Manrope, Inter) are loaded with `next/font/google`. Next.js downloads them at build time and serves them from `/_next/static/media/`, so there is no runtime request to Google and the offline cache includes them. The CSS uses them through `--body-font`, `--display-font` and the branding stack.

Relative `.js` module specifiers in editor source resolve to `.ts` through TypeScript and the explicit Webpack extension aliases. Both development and production use Next.js's Webpack mode. The production browser receives generated `/_next/static/` bundles.

## Build and offline files

`npm run build` performs both type checks and a Next.js static export. The build script copies the export into `dist/`, includes media-library notices, and generates an integrity manifest from the actual output files. It includes initial scripts, lazy 3D and media chunks, CSS, icons, the manifest and the offline page.

The compiled service worker verifies asset hashes and the HTML build marker before caching a release. Installation is atomic, and update activation uses the existing save/update flow. An incomplete or unauthenticated response cannot replace a good cached release. The cache list is generated from Next.js output, so it does not depend on the old standalone module URLs.

Generated 404/not-found documents and their route payloads are served online but excluded from the offline shell. The host canonicalizes their HTML URLs; they are not needed to launch the editor offline. Runtime bundles, including the error boundary, remain cached.

`npm run dev` serves Next.js development output. `npm start` serves the built static export. Test production caching in the built preview, and use a separate origin or port if an older installed worker controls your development URL.

## Performance

A frame at 60 fps has 16.7 ms for JavaScript, style/layout and the GPU together. Measured on an Intel Iris Xe laptop (Chrome, Direct3D through ANGLE) with the 100-performer maximum at 1392×732 px, the 3D view spends roughly 1–2 ms in app and renderer JavaScript, about 3 ms restyling the 100 name labels, and the rest on the GPU. Typical casts cost a fraction of that.

- **3D draw calls.** Performer meshes (female, male, not specified), markers, rings and beams are each drawn with one instanced call (`ANGLE_instanced_arrays`); position, facing, colour and highlight state are per-instance data. A frame is about four GPU calls whatever the cast size. Without the extension each instance is drawn alone with constant attributes.
- **Vertices.** Body meshes are indexed (`drawElements`), so each shared vertex is shaded once rather than six times.
- **Shadows.** The shadow map is redrawn only when performers, props or the stage change; orbiting and zooming reuse it.
- **Pixels.** Lighting cost grows with pixels, so live views render at most about 2.4 megapixels and, where the browser exposes GPU timer queries, adapt the scale. The adaptation is conservative because Direct3D timings include browser compositing. Exports use their exact pixel ratio.
- **Scene uploads.** Spacing warnings are drawn as per-instance rings, so playback never rebuilds stage geometry.
- **Labels.** Name labels move with `transform` inside a `contain: strict` layer, so they never re-lay out the page.
- **Pairwise checks.** Spacing warnings and the spacing heat map sort performers by x and stop scanning once the gap exceeds the threshold (sweep and prune). Results match a full pairwise scan, and the tests check that.

- **On-demand tools.** These run on a click, not per frame. At 100 performers: shortest-travel assignment about 1.5 ms (Hungarian algorithm); fix spacing about 17 ms. The collision-free planner takes about 0.26 s in the worst case of everyone crossing; it samples routes with the engine's own interpolation, checks the exact closest approach between samples, and skips performers already clear. Tempo detection takes about 0.1 s for a 3-minute song and is loaded only when used.
- **Demo music.** The generated demo track renders with per-beat envelope tables and rotating phasors: the same signal (within float rounding) in about 0.1 s instead of 0.7–2.4 s on first play.

Measure with `npm run bench` (CPU cost of each per-frame step at 100 performers) and **Playback performance** in the app (update rate, plus the 3D renderer's GPU, resolution and draw calls on this device).

**WebAssembly.** At the supported scale, the per-frame JavaScript work above is about 1–2 ms; the remaining time is GPU work and browser style recalculation, which WebAssembly cannot speed up. Moving the model to Rust/WASM would add a second toolchain, a larger download and a JS↔WASM copy of positions every frame for no measurable gain. Reconsider it only for a new CPU-bound feature, such as physics or crowd simulation, or offline audio analysis, where the numbers can show a benefit.

**Edits.** A committed edit refreshes only the workstation regions it changes (`refresh(parts)` in `app.ts`): the inspector, the active formation card or the roster, the canvas heading, the formation strip, the timeline and the stage. Rebuilding the whole page cost most of its time in style and layout of the new DOM, not in building HTML. The 2D stage is patched in place from `stageLayers2D`: markers are keyed by performer and only changed ones are replaced, the props and paths layers are rewritten when their markup changes, and grid, transform and label are attributes. The live 3D stage gets one `update`. Undo and redo compare the restored project with the current one to choose regions. Mode, view, layout, project, formation list, timing and stage-size changes still use the full `render()`, which is also the fallback outside the formation editor; a refresh requested while a pointer is held waits for its release, like `render()`.

Per-edit time with 100 performers in the built preview (Chrome on the laptop above, JavaScript plus forced style and layout, median of 9 runs, before and after builds measured alternately; GPU drawing excluded):

| Edit | 2D before | 2D after | 3D before | 3D after |
|---|---|---|---|---|
| Inspector field (position, name, identity) | 21–23 ms | 3–5 ms | 13–15 ms | 2–4 ms |
| Highlight, grid, snap toggles | 20–22 ms | 0.5–5 ms | 13 ms | 0.4–3 ms |
| Performer names toggle (every marker changes) | 20 ms | 9 ms | 12 ms | 2 ms |
| Undo / redo of a move | 21–22 ms | 5 ms | 14 ms | 3.5 ms |
| Approve / unlock formation | 20 ms | 11 ms | 14 ms | 8.5 ms |
| Remove / add performer | 21 / 34 ms | 13 / 21 ms | 14 / 23 ms | 5 / 15 ms |
| Phone layout (375×812), inspector edits | 66–76 ms | 3–13 ms | 23–55 ms | 3–5 ms |

Approving rebuilds the timeline (about 5 ms) because several modules decorate it after rendering; adding or removing a performer does too when it reopens approved formations. Removing a performer renumbers the later markers, and adding one opens the Performers tab, so both still replace many nodes.

## Local data

Project schema, localStorage keys, IndexedDB stores, backups and setlist formats are unchanged by this migration. The server-rendered shell does not read localStorage, decode audio or allocate WebGL. Those operations begin in the client workstation.

There is no account, database or cloud-sync backend. Existing projects remain in the same browser origin. Moving to a different hostname or browser still requires portable backups; setlist routines may need relinking after restoration.

## Verification

The Node runner strips erasable TypeScript into an ignored test directory, where the existing model and VM regression tests execute. The legacy HTML and worker-path fixtures support those regression tests only. Additional framework tests inspect the real Next.js export, verify every offline checksum and execute the generated worker against the exported files with networking disabled after installation.

Interactive browser checks are recorded in [VERIFICATION.md](VERIFICATION.md). They are separate from physical-device, OS-installation and every-browser testing.
