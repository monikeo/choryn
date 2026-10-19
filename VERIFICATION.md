# CHORYN 0.5 verification — 20 October 2026

76 automated tests pass. The production build and every JavaScript syntax check pass. New regression tests cover per-sequence hold/move sampling, route timing precedence, persistence and reset of overrides, approval/invalid-duration protection, timing after shortened intervals, inverse rotated/reflected camera math, rotated fitting, upright stage-edge labels, and customized template bounds with stable cast identities. The existing timeline editing, deletion, backup, offline, rendering and export tests remain green; all 36 templates are checked at 1/2/5/12/50/100 performers on small, standard and wide stages.

Local Chromium UI checks used an isolated Dance workspace QA 0.5 project:

- A 90° camera rotation changed the stage viewBox and audience edge while all 12 performer coordinate labels remained identical. Audience up/down reflection changed the camera scale without changing choreography. Exact 45° view rotation applied. Labels remained upright.
- With 90° rotation and vertical reflection, ArrowRight moved Oliver from z −3.44 to −3.54 with screen X increasing and screen Y unchanged. A subsequent 24 px horizontal mouse drag changed Z to −4.54; Undo restored the prior pose. Stage boundaries continued to constrain movement.
- Timeline body drag moved Open diamond from slot 2 at 16s to slot 4 at 48s. The 2.5s outgoing movement setting followed it. Time slots stayed fixed. Undo restored the original order. Retime mode then moved its start from 16s to 20s without changing order.
- Movement timing for Open diamond saved 2.5 seconds, constant-speed easing and curved paths. Opening breath retained 4 seconds. The custom value survived reload and applying a template. Unit sampling verifies the hold before movement and performer-route precedence.
- Cut from fullscreen Clip tools opened the shared confirmation. Keep formation cancelled it without removal. Copy, paste, split, duplicate, trims and exact timing remain available through the same tested clip model.
- Fullscreen Show timeline placed the timeline at Y=585 and the stage bottom at Y=585 on 1440×900. Hide timeline returned the stage to 900 px. On 390×844 and 320×568, stage bottom matched timeline top and the document had no horizontal overflow. A small-phone Clip tools dialog fitted within 304×552 px. Landscape 844×390 kept a 180 px editable timeline and the stage above it.
- The Dance category contained 12 new templates. Butterfly wings applied with 90° shape rotation and mirroring, preserved the outgoing movement timing, and kept the cast inside stage bounds.

- A three-second custom transition exported to MP4 at 1280×720 with music. The preview decoded at readyState 4 with 3.097967 seconds of encoded duration and no media error. A WebM preview also decoded successfully; its browser metadata reported an unbounded duration. No JavaScript errors were logged.
- Escape closed a Clip tools dialog while keeping fullscreen and the timeline open.

- The final production shell activated through Save and update. After stopping the preview server, a reload succeeded and fullscreen timeline Clip tools, including Movement timing, remained usable from cache.

The previous compatibility checks and physical-device/browser testing limits still apply: UI checks use Chromium viewport resizing, not real Safari/Firefox/iOS/Android hardware. Installation, native fullscreen and video encoders depend on browser capabilities. Camera orientation is view-only; exports use canonical stage orientation. Reorder preserves time slots rather than rippling audio, movements or technical cues. Individual performer routes can override sequence defaults.
