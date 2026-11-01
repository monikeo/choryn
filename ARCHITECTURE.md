# Application architecture

CHORYN 0.19 runs on Next.js 16.4.3, React 19.3.1 and TypeScript 5.9.3. The exact dependencies are pinned in `package-lock.json`.

## Routes and rendering

`app/layout.tsx` defines the document, metadata, install icons, authenticated manifest link and global styles. `app/page.tsx` renders the studio client. `app/error.tsx` provides a reload boundary without clearing browser projects.

`app/studio-client.tsx` starts the workstation after hydration. React owns the stable application host; the TypeScript editor owns its descendants. Timeline playback and SVG/WebGL updates do not drive React renders. A shared startup promise prevents Strict Mode effect replay from attaching the editor twice.

The workstation still uses named views and URL hashes within one application route. This keeps rehearsal links, installed shortcuts and the read-only second screen compatible with existing scores. Opening the second-screen hash starts its separate display module rather than the editable studio.

The high-frequency editor has not been rewritten as a tree of React controls. It is part of the Next.js module graph and production bundles, rather than a separate HTML application inside an iframe. The former root HTML document is retained only as an isolated regression fixture under `tests/fixtures/`.

## TypeScript boundaries

All 63 application runtime modules under `src/` are TypeScript. `src/types.ts` adds shared contracts for performers, poses, formations, props, attendance, tracks, cues, cameras, views and exports. Browser-only declarations document optional platform APIs. Imported project data continues through the existing runtime validators; compile-time types do not replace validation.

The service worker is authored in `sw.ts` and checked with `tsconfig.worker.json`, using worker libraries separately from the browser DOM. Next.js owns the TSX routes and `next.config.ts`. Build and regression tooling uses Node `.mjs` scripts.

The existing editor is checked with `strict: false`; implicit types remain in portions of its UI adapters. Application and worker checks must pass before the production build, and build errors are not ignored. Stricter UI adapter types can be introduced gradually without hiding compiler failures.

The unmodified Mediabunny distribution remains JavaScript, with the matching upstream `.d.ts` declarations and license files. Third-party package implementations are also distributed in their upstream formats.

Relative `.js` module specifiers in editor source resolve to `.ts` through TypeScript and the explicit Webpack extension aliases. Both development and production use Next.js's Webpack mode. The production browser receives generated `/_next/static/` bundles.

## Build and offline files

`npm run build` performs both type checks and a Next.js static export. The build script copies the export into `dist/`, includes media-library notices, and generates an integrity manifest from the actual output files. It includes initial scripts, lazy 3D and media chunks, CSS, icons, the manifest and the offline page.

The compiled service worker verifies asset hashes and the HTML build marker before caching a release. Installation is atomic, and update activation uses the existing save/update flow. An incomplete or unauthenticated response cannot replace a good cached release. The cache list is generated from Next.js output, so it does not depend on the old standalone module URLs.

`npm run dev` serves Next.js development output. `npm start` serves the built static export. Test production caching in the built preview, and use a separate origin or port if an older installed worker controls your development URL.

## Local data

Project schema, localStorage keys, IndexedDB stores, backups and setlist formats are unchanged by this migration. The server-rendered shell does not read localStorage, decode audio or allocate WebGL. Those operations begin in the client workstation.

There is no account, database or cloud-sync backend. Existing projects remain in the same browser origin. Moving to a different hostname or browser still requires portable backups; setlist routines may need relinking after restoration.

## Verification

The Node runner strips erasable TypeScript into an ignored test directory, where the existing model and VM regression tests execute. The legacy HTML and worker-path fixtures support those regression tests only. Additional framework tests inspect the real Next.js export, verify every offline checksum and execute the generated worker against the exported files with networking disabled after installation.

Interactive browser checks are recorded in [VERIFICATION.md](VERIFICATION.md). They are separate from physical-device, OS-installation and every-browser testing.
