# CHORYN brand identity

Source: [CHORYN — Logo Identity System | Light + Dark](https://www.figma.com/design/wEbeOdaMoUT4dzdugt8RrF/?node-id=3-2). Inspected 21 October 2026 with Figma design context and its reference screenshot. The source Figma document was not modified.

- Mark: five connected formation nodes. Official compact-header assets: nodes 8:93 (light) and 8:100 (dark). Official app-icon mark assets: 8:65 (light) and 8:72 (dark). Local SVG files are unchanged downloads.
- Slogan: **From first count to final cue.**
- Descriptor: **CHOREOGRAPHY · STAGE DESIGN · PERFORMANCE**.
- Purple: **#7C3AED**. Lavender: **#B392FF**. White: **#FFFFFF**. Dark: **#0D0B12**.
- Wordmark: Inter Bold, implemented as text following the Figma design context. Inter is self-hosted with the other studio fonts through next/font (downloaded at build time, cached for offline use), with a size-matched system fallback.

## Application slots

The desktop header pairs the mark with CHORYN and the slogan; tablet/phone headers compact this to the mark and wordmark. The project dashboard displays the mark, wordmark, slogan and descriptor in either theme. The navigation rail uses the app-icon artwork. Offline recovery, browser metadata and installed-app metadata carry the same identity. Existing stage content is not watermarked or changed.

The SVG favicon switches light/dark artwork with the browser color scheme. A 32px PNG favicon is the fallback. Install icons: 192px/512px; Apple touch: 180px; separate opaque 512px maskable icon. The original app-icon arrangement uses a 150px square, background #F1E8FF or #20162F, radius 32px, and an unchanged 98 × 47.04px mark at (26, 52.12). Maskable and Apple variants use an opaque square background so the operating system can apply its own mask.

Regenerate derived icons with: node scripts/brand-icons.ts <installed-sharp-package-directory> (it reads and writes public/icons/). This optional authoring dependency is not shipped as an application runtime dependency. SVGs are embedded unchanged, without redrawing paths. Brand images are local and included in the offline cache; temporary Figma asset URLs are never runtime sources.

## SVG provenance

- choryn-app-mark-dark.svg · 1426 bytes · SHA-256 f2a078408f9c0a8c9c26d75e84fd583832c054b92c81c4f8662eb655d22d724c
- choryn-app-mark-light.svg · 1426 bytes · SHA-256 cfaedba7fb94eacf6485f9b1c7cddf6b4b19f380184995ea6e8dfcdf350b87d2
- choryn-mark-dark.svg · 1483 bytes · SHA-256 4e4af0224dd7b7817d82df5b94e7746aa1854158442e8458e8d0f5e189747092
- choryn-mark-light.svg · 1483 bytes · SHA-256 00d00b7db30c8e391753b9e845c92c91bfe5fae265d768cc1d823bdc56fd1ba5
