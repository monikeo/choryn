# CHORYN v0.11 PWA verification — 21 October 2026

184 automated tests pass, including 22 additional PWA tests. All 50 application/script syntax checks and the production build pass. All 122 relative module edges resolve. All 88 built shell asset hashes match the exact output bytes. Manifest icon sizes and shortcut targets, Apple touch sizes, ICO entry offsets/PNG frames, and opaque maskable safe areas were verified.

Worker execution tests cover complete offline loading, auth/query/mutation/third-party exclusion, bounded installation fetches, failed-install cleanup preserving old releases, SHA-256 mixed-release rejection, missing-asset status and repair, repair refusal for changed server assets, quota failures, usable network responses on failed cache writes, mismatched module refusal, old-shell-only activation cleanup and multi-window activation gating.

Client execution tests cover Apple/Android/Mac guidance, legacy/modern standalone detection, cache-readiness status, repair, registration retries, one-use install prompts and appinstalled confirmation, install failures, activation refusal/retry, RPC timeouts, opt-in persistent storage, unsupported/insecure environments, safe shortcut allowlists and the actual app save-before-update function. Existing formation/editor, export, MP4, recovery and dialog regression tests remain green.

Icon checks cover manifest PNG 96/128/192/256/512/1024; maskable PNG 192/512; Apple 120/152/167/180; PNG favicon 16/32/48; ICO PNG frames 16/32/48/256. Maskable colored pixels stay within 65.84px / 76.8px at 192px and 177.06px / 204.8px at 512px, with opaque backgrounds. Root Apple icon and favicon discovery fallbacks are included.

Browser/physical-device install, OS icon refresh and live offline launch remain unverified following the prior browser-access policy denial; no browser workaround or Lighthouse result is claimed. Automated execution uses worker/cache/message/media doubles and actual generated build bytes. Installation and cached-icon refresh are controlled by the browser/OS. See PWA.md for platform guidance, primary references and limits, and BRANDING.md for the unchanged source artwork.
