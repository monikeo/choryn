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

## TypeScript boundaries

All 63 application runtime modules under `src/` are TypeScript. `src/types.ts` adds shared contracts for performers, poses, formations, props, attendance, tracks, cues, cameras, views and exports. Browser-only declarations document optional platform APIs. Imported project data continues through the existing runtime validators; compile-time types do not replace validation.

The service worker is authored in `sw.ts` and checked with `tsconfig.worker.json`, using worker libraries separately from the browser DOM. Next.js owns the TSX routes and `next.config.ts`. Build and regression tooling uses Node `.mjs` scripts.

The existing editor is checked with `strict: false`; implicit types remain in portions of its UI adapters. Application and worker checks must pass before the production build, and build errors are not ignored. Stricter UI adapter types can be introduced gradually without hiding compiler failures.

The unmodified Mediabunny distribution remains JavaScript, with the matching upstream `.d.ts` declarations and license files. Third-party package implementations are also distributed in their upstream formats.

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

Measure with `npm run bench` (CPU cost of each per-frame step at 100 performers) and **Playback performance** in the app (update rate, plus the 3D renderer's GPU, resolution and draw calls on this device).

**WebAssembly.** At the supported scale, the per-frame JavaScript work above is about 1–2 ms; the remaining time is GPU work and browser style recalculation, which WebAssembly cannot speed up. Moving the model to Rust/WASM would add a second toolchain, a larger download and a JS↔WASM copy of positions every frame for no measurable gain. Reconsider it only for a new CPU-bound feature, such as physics or crowd simulation, or offline audio analysis, where the numbers can show a benefit.

**Known cost.** Edits re-render the whole workstation: about 24 ms in 3D and 39 ms in 2D with 100 performers on the laptop above. The live 3D stage is kept across these re-renders. Targeted updates of the panels would make edits instant on phones too.

## Local data

Project schema, localStorage keys, IndexedDB stores, backups and setlist formats are unchanged by this migration. The server-rendered shell does not read localStorage, decode audio or allocate WebGL. Those operations begin in the client workstation.

There is no account, database or cloud-sync backend. Existing projects remain in the same browser origin. Moving to a different hostname or browser still requires portable backups; setlist routines may need relinking after restoration.

## Verification

The Node runner strips erasable TypeScript into an ignored test directory, where the existing model and VM regression tests execute. The legacy HTML and worker-path fixtures support those regression tests only. Additional framework tests inspect the real Next.js export, verify every offline checksum and execute the generated worker against the exported files with networking disabled after installation.

Interactive browser checks are recorded in [VERIFICATION.md](VERIFICATION.md). They are separate from physical-device, OS-installation and every-browser testing.
