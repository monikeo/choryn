# CHORYN Studio

**From first count to final cue.**

CHORYN is a formation and rehearsal studio for choreographers, performers and stage teams. Arrange a cast on a 2D or 3D stage, build a sequence of formations, tune the transitions and rehearse the result with music or silent counts.

Projects stay in the browser. You can export a portable backup, preview images before downloading them, or render a performance video from the stage view you're working with.

The application runs on **Next.js App Router and React**, with TypeScript application modules and a TypeScript service worker. Next.js builds the workstation and its lazy 3D/media bundles into a static export. The current release remains local-first.

## What you can do

- Build formations by hand or start with one of 36 templates.
- Edit the performance timeline with drag and drop, trim, split, duplicate, ripple edits and linked events.
- Draw curved performer routes and adjust movement duration, departure delay and easing.
- Organize performers with names, groups, roles, colors and tags.
- Rehearse with understudies and missing-performer overlays without replacing the original cast.
- Keep mirrored pairs and evenly spaced lines together with live constraints.
- Design a stage, calibrate a floor-plan image or import text DXF reference geometry.
- Animate props, assign carriers, plan handoffs and visualize lighting and appearance changes.
- Review travel, spacing, formation comparisons, backstage reservations and audience sightlines.
- Run local show setlists and open a read-only rehearsal display in another window.
- Preview PNG, JPEG and SVG captures, download image batches, and export MP4 or WebM when the browser supports the required encoders.

CHORYN adapts its workspace to desktop, tablet and phone widths. It is a browser application with PWA installation and offline support, rather than a separate native application for each operating system.

## Start here

- [Step-by-step tutorial](TUTORIAL.md) — create a score, rehearse it and export the result.
- [Feature guide](FEATURES.md) — what each tool does, how the tools interact and their current limits.
- [Cast & show reference](ENSEMBLE.md)
- [Timeline editing reference](TIMELINE.md)
- [Stage and production reference](PRODUCTION.md)
- [Verification record](VERIFICATION.md)
- [Next.js and TypeScript architecture](ARCHITECTURE.md)
- [Suggested repository description](GITHUB_DESCRIPTION.md)

## Run locally

Use Node.js 22.18 or later and npm. Install the versions recorded in the lockfile before starting the Next.js development server.

```sh
git clone https://github.com/monikeo/choryn.git
cd choryn
npm ci
npm run dev
```

Open [localhost:4173](http://127.0.0.1:4173). Keep the terminal open while using the local server.

To build and preview the production files:

```sh
npm run build
npm start
```

Stop the development server before starting the production preview on the same port. Use the production preview to check the generated offline shell. If an earlier CHORYN worker controls that local origin, use its **Save and update** action or use a separate development port.

`npm run build` checks application and worker types, runs `next build`, and prepares `dist/` with checksums for all exported bundles and assets. `npm start` serves that export; it does not require a running Next.js server.

## Check the source

```sh
npm run typecheck
npm run build
npm test
```

The tests exercise formation sampling, attendance protection, editing, persistence, capture and media workflows. The runner creates ignored JavaScript fixtures from the checked TypeScript modules for the existing Node/VM tests; production uses the Next.js bundles. Framework checks verify the actual exported HTML, lazy chunks and offline worker. Build before testing. See [VERIFICATION.md](VERIFICATION.md) for the distinction between controlled doubles and interactive browser evidence.

## A typical session

1. Create a project and choose the cast size, tempo and music mode.
2. Set the stage dimensions and arrange the opening formation.
3. Add or customize the next formations.
4. Set each movement window and inspect the paths between formations.
5. Rehearse with the timeline, count checkpoints and any reference video.
6. Review spacing and production cues.
7. Preview images or create a short video export.
8. Save a portable backup before moving to another browser or device.

## Attendance-safe constraints in 0.18.3

An active attendance overlay protects the saved X/Z position, facing and visibility of both the missing role and the cover's original role. A live constraint cannot silently rewrite either pose. This applies to new rules, changes propagated through existing rules and the shared save path.

Constraint defaults choose available performers. To edit a protected role, open **Attendance active**, disable the relevant entry, preview and apply that change, then edit the saved formation. Unaffected performers remain editable.

## Data and exports

Projects and revisions are saved locally; audio and reference media use browser storage. There is no account or cloud-sync backend in this release. Two tabs editing the same collection can produce a save conflict, which the recovery tools help resolve without silently overwriting another tab.

A portable project backup includes the project and its uploaded soundtrack when available. Reference video is managed separately and may need to be attached again on another device. A setlist manifest contains routine references, not the routine files.

MP4 export depends on H.264 support and, when music is included, a compatible audio encoder or native recorder. Unsupported formats are not offered. Image and video capture use the stage camera and shared performance samplers; export controls themselves are excluded.

## Hosting

Build the project and serve `dist/` from a static host. Use HTTPS for a deployed PWA, serve JavaScript modules with the correct MIME type, and keep `sw.js` at the application root. Localhost is supported for local testing.

The tracked `.openai/hosting.json` belongs to the existing hosted CHORYN deployment. A fork should use its own hosting configuration and identity.

## Source layout

| Path | Purpose |
| --- | --- |
| `app/layout.tsx`, `app/page.tsx`, `app/studio-client.tsx` | Next.js metadata, application route and client host |
| `src/types.ts` | Shared score, pose, production, view and export contracts |
| `src/app.ts` | Editor shell, shared save/undo flow and transport |
| `src/engine.ts` | Project model, validation and performance sampling |
| `src/timeline-*.ts` | Timeline editing, selection, timing and gestures |
| `src/ensemble-*.ts` | Cast assignment, attendance, constraints and show tools |
| `src/stage2d.ts`, `src/stage3d.ts` | SVG and WebGL stage renderers |
| `src/production-*.ts` | Stage, lighting, appearance, camera and production tools |
| `src/view-video.ts`, `src/mp4-export.ts` | Matching-view capture and MP4 export |
| `src/image-exports.ts` | Image previews and batch downloads |
| `src/pwa.ts`, `sw.ts` | Installation, updates and offline files |
| `tests/` | Model, workflow and regression checks |
| `scripts/` | Local server and static build |

## Current boundaries

Sightline, spacing and health reports are planning aids. They do not certify physical safety or guarantee collision-free movement. Lighting is a stage visualization, not a hardware control system, and appearance states are colors and labels rather than modeled costumes.

Second-screen rehearsal connects windows in the same browser and origin. It does not cast to a remote phone or tablet. Setlists advance between local projects; they do not create gapless audio or a single merged show video.

Browser capabilities vary. Physical iPad and phone testing requires access to those devices; desktop viewport checks alone do not establish their touch, graphics or codec behavior.

## Third-party code

The bundled Mediabunny JavaScript distribution is unmodified and licensed under MPL-2.0; its matching upstream TypeScript declarations are included. Its [notice](src/mediabunny.NOTICE.txt) and [license](src/mediabunny.LICENSE.txt) are included with the source and deployment. Framework packages retain their own licenses. No project-wide license has been declared.
