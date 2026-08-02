# Release verification

## Automated gates

- Strict TypeScript compilation
- 25 unit tests covering graph invariants, torus wraps, crossing continuation, recipe compilation, 512-sample topology/clearance sweeps, state/history, URL parsing, SVG serialization, and PNG boundaries
- Chromium browser coverage at desktop and Pixel 7-shaped viewports
- Direct drag, gesture commit, undo, design/palette switching, living URL restore, standalone SVG, PNG, 200% text zoom, overflow, 44 px visible targets, and axe-core accessibility checks
- Refresh-relative render test: first `pattern-ready` mark below 1.5 seconds locally, p95 recorded paint below half the measured idle frame interval, and no recorded paint above 50 ms
- Three generated 101-state morph sheets plus five material anchors per design in `docs/contact-sheets/`

## Automated topology result

Every launch definition completes 512 samples with one deterministic topology signature, no graph-invariant error, no edge below the configured minimum, no vertex-clearance warning, and no excluded interval. This is the plan's empirical guard, not a proof about arbitrarily narrow between-sample events.

## Visual review performed

- Reviewed all three generated contact sheets for discontinuities, seam breaks, collapsed paths, sudden jumps, and visibly broken endpoints.
- Rejected the first flagship composition because its scaffold dominated the rosettes; reduced scaffold weight and recentered each design before accepting the current sheets.
- Confirmed the linework-to-band material anchors remain legible without edge clipping in the generated sheets.

## Human gates still open

- Test real current iOS Safari and Android Chrome in portrait and landscape.
- Verify native pinch takes ownership after a second touch without preserving a partial morph or history entry.
- Tune drag distance and endpoint sensitivity with a thumb on both devices; the author must sign off that small adjustments and full-range travel both feel deliberate.
- Compare each generated construction against its cited analytic source. In particular, confirm that Darb-i Imam remains an honest `based on IRA0911` interpretation rather than merely a generic ten-point family; downgrade relationship copy if needed.
- Repeat the performance recording on the named iPhone, Android phone, and laptop with the documented production profile.

These are release gates, not hidden claims of completion. Touch emulation and local Chromium cannot settle them.
