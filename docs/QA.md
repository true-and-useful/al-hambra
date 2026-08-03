# Release verification

## Automated gates

- Strict TypeScript compilation
- 33 unit tests covering graph invariants, translated-neighbor intersections, torus-representative normalization, composed periodic strands, lattice-phase weave doubling, torus wraps, seam/contact classification, alternating weave constraints, recipe compilation, 512-sample topology/clearance sweeps, state/history, URL parsing, SVG serialization, and PNG boundaries
- Chromium browser coverage at desktop and Pixel 7-shaped viewports
- Direct drag, gesture commit, undo, design/palette switching, living URL restore, standalone SVG, PNG, 200% text zoom, overflow, 44 px visible targets, and axe-core accessibility checks
- For every design default and one stressed morph/material/palette/view state, exact live/export visual-structure comparison plus isolated SVG-to-PNG raster comparison at a documented mean antialiasing tolerance
- Refresh-relative render test: first `pattern-ready` mark below 1.5 seconds locally, p95 recorded paint below half the measured idle frame interval, and no recorded paint above 50 ms
- Three generated 101-state morph sheets plus five material anchors per design in `docs/contact-sheets/`

## Automated topology result

Every launch definition completes 512 samples with one deterministic topology signature, no graph-invariant error, no edge below the configured minimum, no nonincident edge-clearance warning across neighboring torus representatives, and no excluded interval. Threshold transitions are bisected to the configured precision. This is the plan's empirical guard, not a proof about arbitrarily narrow between-sample events.

The faint scaffold is a non-woven construction guide: its transverse meetings remain explicit graph contacts but do not receive over/under gaps. Ornament-to-ornament intersections are solved end to end, including lattice-phase doubling when an alternating weave needs a decorated repeat larger than the geometric cell.

## Visual review performed

- Regenerated and reviewed all three contact sheets after the periodic-arrangement and weave-solver rewrite for discontinuities, seam breaks, collapsed paths, sudden jumps, and visibly broken endpoints.
- Rejected the first flagship composition because its scaffold dominated the rosettes; reduced scaffold weight and recentered each design before accepting the current sheets.
- Confirmed the linework-to-band material anchors remain legible without edge clipping in the generated sheets.

## Human gates still open

- Test real current iOS Safari and Android Chrome in portrait and landscape.
- Verify native pinch takes ownership after a second touch without preserving a partial morph or history entry.
- Tune drag distance and endpoint sensitivity with a thumb on both devices; the author must sign off that small adjustments and full-range travel both feel deliberate.
- Complete a specialist provenance review for the `adapted from` Alaeddin and Kharraqan labels. Darb-i Imam is deliberately labelled `inspired by IRA0911`; the app and SVG metadata make no exact-reconstruction claim.
- Repeat the performance recording on the named iPhone, Android phone, and laptop with the documented production profile.

These are release gates, not hidden claims of completion. Touch emulation and local Chromium cannot settle them.
