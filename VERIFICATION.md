# CHORYN v0.10.1 branding verification — 21 October 2026

162 automated tests, all 49 JavaScript/script syntax checks and the production build pass. All 119 relative module edges resolve. All 73 offline shell entries and 26 image/style/manifest references resolve to non-empty local build files.

Official Figma reference: https://www.figma.com/design/wEbeOdaMoUT4dzdugt8RrF/?node-id=3-2 . Logo SVG provenance, geometry, source nodes and implementation slots are documented in BRANDING.md. Four Figma SVGs are downloaded unchanged; no temporary Figma URL is used at runtime.

PNG dimensions verified: favicon 32px; Apple touch 180px; app icons 192px/512px; dark rail icon 192px; opaque maskable icon 512px. Every maskable pixel is opaque. The mark's furthest colored pixel is 177.1px from center, inside the 204.8px maskable safe radius. Light primary-button contrast (white on purple) is 5.70:1; dark primary-button contrast (dark ink on lavender) is 7.89:1.

Generated light and dark app icons were visually inspected and match the Figma five-node mark, colors and proportions. The header compacts at desktop/tablet/mobile breakpoints, preserving aspect ratio; project identity includes the exact slogan and descriptor. Existing editor layout and project data are retained. The build cache hash now includes favicon.svg so future favicon-only changes invalidate the shell.

Live webapp browser/layout verification remains unavailable following the prior policy denial. No browser workaround, physical-device test or installed-OS icon refresh test is claimed. The optional Inter webfont requires a network/cache hit; system fonts remain the offline wordmark fallback. The source Figma file was read only. Existing 0.10 export/MP4 verification limits still apply.
