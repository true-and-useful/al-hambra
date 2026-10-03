# The space to traverse

Status: design analysis written 2026-09-21 against 2ea77d8, revised after two adversarial reviews; reconciled with codex/v1 at 25ce69d on 2026-10-03. This document answers one question: what is the actual space of Islamic star patterns that a direct-manipulation interface has to move through? It is the foundation for [ux-paradigms.md](ux-paradigms.md). The scalar geometry was checked numerically by two independent passes; the construction claims about the launch references are labelled by evidential strength.

## The short answer

A pattern in the polygons-in-contact tradition (Hankin 1925, Kaplan 2000–2005, Bonner 2017) is determined by, in descending order of how much it changes the picture:

1. **A tiling** of the plane by polygons. Discrete. Fixes the star orders (8, 10, 12...), the repeat, which contacts pair with which, and the support-tiling symmetry.
2. **The contact angle θ.** Continuous, 0° to 90°, measured from the tile edge. Through the midpoint of every tile edge two lines leave at angle θ, like an X, and run until they meet lines from other edges. One global θ moves the design through every historical family Bonner names.
3. **A motif choice** for each regular-polygon class: star or rosette, how many inner layers (Kaplan's s), whether it is extended. Discrete, and each choice changes topology.
4. **Further continuous refinements** that exist in the construction but need not be exposed: the contact split δ (two-point family), the rosette shoulder h and taper φ, contact-position correction, and in principle a different θ per compatible contact class.
5. **Material** (band width, interlace) and **colour** (per face class). These leave the centrelines alone but do constrain which geometry is valid, because bands need clearance.

The full construction space is larger than two dimensions. What this document proposes is a **two-parameter exploration surface** (θ plus one more continuous choice) inside that space, with the discrete motif choice as a stepped control and everything else held at defaults. The user's instinct that "two or three sliders" cover the interesting variety is a product hypothesis this analysis supports, not a theorem. Kaplan's 2005 demonstration app made the same bet: one tiling picker, a θ slider, a δ slider, two checkboxes.

The shipped vocabulary is narrower: a periodic polygon scaffold and one global contact angle, with material and palette controls. The contact backend replaced the radial recipe in 8573574; motif presets, split contacts δ and rosette refinements remain proposals. See [recipe-vocabulary.md](recipe-vocabulary.md) for the construction contract and [PATTERNS.md](PATTERNS.md) for the current collection, ranges and mosaic palettes.

## The layers

| Layer | Parameter | Type and range | What moves | Endpoints | Historical values |
|---|---|---|---|---|---|
| 0 | Tiling | Discrete catalogue | Everything: star orders, repeat, contact pairing | | Octagon–square 4.8², 4.6.12, 3.12², the fivefold girih set, Bonner's fourfold A and B, sixfold, sevenfold, Hankin's pentagon-ringed tilings |
| 1 | Contact angle θ | Continuous, (0°, 90°) | The waist of every star at once (see "Which point moves") | θ → 0: lines collapse onto the tiling edges. θ → 90°: rays run perpendicular to the edges and meet at tile centres; the pattern tends toward the tiling's dual | Classical {n/k} stars sit at θ = kπ/n. See the tick table below |
| 2 | Motif choice | Discrete, per polygon class | Star vs rosette (different generating path), inner layer count s (truncation depth), extension (a transform of the element) | Kaplan's default rule picks s = 2 when n > 6 and θ > 2π/n, else 1; rosettes add one. This is a default heuristic, not a geometric event | Most large historical rosettes have s = 3 |
| 3a | Contact split δ | Continuous, 0 up to the tile edge | Each X splits into two crossings; strands become short loops around tiling vertices | δ = 0 is the one-point family and a distinct topology boundary; larger δ moves ray origins toward the tile vertices | Bonner's two-point family. In fivefold work the lines cross at a 72° sector, which is θ = 54° in this document's convention |
| 3b | Rosette shoulder h, taper φ | Continuous | Petal width; whether petals converge, run parallel or diverge | Lee bounds the shoulder between two constructed points | Parallel-sided petals were preferred in Morocco. In Lee and Soliman's standard linked construction an n-rosette on p-gons is parallel-sided when n = 2p |
| 4 | Material w | Continuous | Band width, interlace gap | Linework to wide bands | Castéra notes some classes have a "correct" width |
| 5 | Colour | One choice per face class | Fill of each class of faces | | Kaplan two-colours the map automatically; tradition leaves one class white and colours the other |
| 6 | View | Continuous | Pan, zoom | | |

Two conventions to fix now, because they caused confusion in review:

- **θ** is the angle between a contact ray and its tile edge. **β = 180° − 2θ** is the sector between the two rays inside the tile. Bonner and most historical sources quote β. So Bonner's "acute 36°" in fivefold work is θ = 72°, and his "72° two-point crossing" is θ = 54°.
- This θ convention agrees with [recipe-vocabulary.md](recipe-vocabulary.md): [src/geometry/hankin.ts](../src/geometry/hankin.ts), `buildContactPaths`, rotates the directed tile edge by θ for the forward ray and by π − θ for the backward ray. `contactAngleDegrees` and the `morph.min`/`morph.max` bounds are degrees; [src/geometry/recipe.ts](../src/geometry/recipe.ts), `mapUserMorph`, maps the stored [0,1] morph linearly to those degrees. β is the sector inside the tile, not a second parameter or the name of the stored angle.
- A "tick" is a construction-specific record (θ, primary polygon order, motif configuration, historical label), not a bare number. The family names are stylistic and system-dependent; Bonner says so himself.

| System | Primary n | θ | β | k in θ = kπ/n | Label |
|---|---|---|---|---|---|
| Octagon–square 4.8² | 8 | 22.5°, 45°, 67.5° | 135°, 90°, 45° | 1, 2, 3 | obtuse, median, acute |
| Fivefold | 10 | 36°, 54°, 72° | 108°, 72°, 36° | 2, 3, 4 | obtuse, median, acute |
| Twelvefold | 12 | 30°, 45°, 60°, 75° | 120°, 90°, 60°, 30° | 2, 3, 4, 5 | curated; 15° also exists |

These lists are curated, not exhaustive (18° and 15° are natural angles too). k = 1 gives a plain polygon rather than a star.

The compact tiling notation 4.8² and 3.12² means 4.8.8 and 3.12.12 respectively, as written in [PATTERNS.md](PATTERNS.md). These are research ticks, not shipped snap points or range endpoints. The app has no tick snapping. The complete scaffold constrains the range: `buildContactPaths` rejects parallel or divergent adjacent contact rays, including singular angles in smaller tiles. The shipped bounds are listed in [PATTERNS.md](PATTERNS.md#construction-matrix); they do not cover the full tick table.

## Which point moves

This matters for handle design and was wrong in the first draft. In the first-intersection star inside a regular n-gon, the **outer points do not move**: they sit at the fixed edge midpoints, at radius cos(π/n) from the centre. What moves with θ is the **inner vertex** where rays from adjacent edges meet: the star's waist. With circumradius 1, α = π/n, c = cos α, s = sin α:

```
r(θ) = c² + c·s·tan(α − θ) = c·cos θ / cos(α − θ)
dr/dθ = −c·s·sec²(α − θ)  < 0 on (0°, 90°)
θ(q) = α − atan((q − c²) / (c·s))            for a waist at signed radius q
```

r runs from 1 (the shared vertex) at θ = 0 to 0 (the centre) at θ = 90°. At θ = α the waist sits on the chord between adjacent midpoints and the star is momentarily a polygon; for θ > α, which is most of the useful range, the waist is re-entrant and the shape reads as a star. The inverse is closed form and monotone, so a drag along the waist's rail has exactly one answer. Both review passes confirmed the formula and the round trip to floating-point noise for n = 8, 10, 12.

Two consequences:

- **q is the signed projection of the finger onto the rail** (the line from tile centre through the waist), normalized by the tile's circumradius. Not the finger's distance from the centre.
- **A rail is one-dimensional.** A point constrained to a rail has a rank-one Jacobian in (θ, δ). One handle cannot determine two parameters, and warm-starting a least-squares solve only chooses among solutions, it does not create uniqueness. Each handle must own exactly one parameter and freeze the others. The first draft's "two unknowns, one dragged point" was wrong.

Sensitivity of the waist radius per degree of θ:

| θ | n = 8 | n = 10 | n = 12 |
|---|---|---|---|
| 20° | −0.0062 | −0.0051 | −0.0044 |
| 45° | −0.0072 | −0.0065 | −0.0058 |
| 70° | −0.0135 | −0.0135 | −0.0133 |
| 85° | −0.0289 | −0.0336 | −0.0373 |

The magnitude is smallest at θ = α and grows with sec²(α − θ). Across Kaplan's octagon–square range (22.5° to 67.5°) it changes by about two times; the dramatic values are at the extremes. Either a pad or a handle can remove this nonuniformity by working in q and using the inverse, so this table is not an argument for handles over pads. It is an argument for using q as the drag coordinate whatever the paradigm.

**How far the waist travels.** Across 22.5° to 67.5° for n = 8, r goes from 0.85 to 0.50: about a third of the circumradius. On a phone where an octagon is 100 px across, that is roughly 17 px of total travel for the whole useful range. A control that glues the waist to the finger therefore cannot support deliberate small changes without zooming in. This single number is why the companion document recommends a gain between finger and waist.

**δ is not a small correction.** With symmetric origins split by δ, the continued adjacent-ray intersection is r(θ, δ) = (c·cos θ − (δ/2)·sin θ) / cos(α − θ). At n = 8, θ = 85°, δ = 0.1 (edge length 0.77) the waist radius drops by 62%. The one-point formula does not survive splitting; δ = 0 is a topology boundary; and a crossing at depth d = (δ/2)·tan θ from the edge cannot tell θ from δ (two different pairs give the same d). δ must be validated jointly with θ, in stated units.

## What the September launch references became

The three names below belong to the old launch set. The candidate support tilings remain historical-reference hypotheses, not descriptions of the five designs shipped at HEAD. Evidential strength is marked: **verified** means the Tiling Search record confirms it; **candidate** means this analysis proposes it and an overlay against the reference has not been made.

| September reference | Verified from the record | Candidate support tiling from the analysis | Star orders | Research ticks | Shipped outcome |
|---|---|---|---|---|---|
| Alaeddin Eight (P222) | p4m; Alaeddin minbar association | 4.8² octagon–square with midpoint contacts | 8, squares inferred | 22.5°, 45°, 67.5° | Eightfold Court (`octagon-eight`) uses octagon–square, but cites Kaplan’s construction rather than P222; [definition](../src/patterns/octagon-eight.ts) |
| Darb-i Imam Ten (IRA0911) | cmm; angles in multiples of 36°; pentagons; ten-point stars with 72° and 108° vertex angles | fivefold system: decagons, pentagons, barrel hexagons, bow-ties. Unverified; the visible faces in the record are not automatically the hidden support tiles | 10, fillers inferred | 36°, 54°, 72° | Tenfold Rose (`decagon-ten`) uses decagons and 72°/108° rhombi, not this candidate girih set; it is inspired by IRA0911, not a reconstruction; [definition](../src/patterns/decagon-ten.ts) |
| Kharraqan Twelve (W85) | p6m; regular twelve-point star; eastern Kharraqan tower | 3.12² or 4.6.12. These are different tilings, not two names for one; which fits is open | 12 with 6 or 3 | 30°, 45°, 60°, 75° | Twelvefold Vault (`dodecagon-twelve`) uses 4.6.12 and is inspired by W85; the launch scaffold is settled, while the reference fit remains unverified; [definition](../src/patterns/dodecagon-twelve.ts) |

"Twelvefold" describes the motif order; p6m has sixfold rotational symmetry. Each candidate stays labelled candidate until an overlay reproduces the reference's contacts, characteristic faces and strand graph. Where the fit is absent the app keeps "inspired by."

The radial implementation described in the September draft is gone. Since 8573574, [src/geometry/recipe.ts](../src/geometry/recipe.ts), `compilePattern` and `compileTiling`, build a scaffold plus one contact angle through `buildContactPaths` and the periodic arrangement compiler. The scalar now maps only to that angle. None of the designs claims to reconstruct these monuments.

The collection now also includes Sixfold Garden (`hexagon-triangle-six`) and Twelvefold Lantern (`dodecagon-triangle-twelve`), added in 23bd928. The five definitions are registered in [src/patterns/registry.ts](../src/patterns/registry.ts). Their construction and provenance belong in [PATTERNS.md](PATTERNS.md), rather than a second collection specification here.

## Where the topology changes, and where it does not

For the plain star in a regular n-gon with one-point contacts, the first-intersection analysis considers θ in (0°, 90°). This is the axis the primary gesture should own, with the motif choice held fixed for the duration of any drag. That analytical interval is not a validity claim for the current backend: `buildContactPaths` uses fixed adjacent-edge pairing and rejects parallel or divergent rays; `compilePeriodicArrangement` and the range sweep impose further constraints on the complete scaffold. See [PATTERNS.md](PATTERNS.md#how-the-ranges-were-chosen).

Events that do exist:

- **Motif choice.** Star vs rosette, s, extension. Each changes faces. These are taps or a chooser, never a side effect of a drag. Kaplan's automatic s rule applies only when picking defaults; the first draft's suggestion that s could flip during a θ drag contradicted the stable-topology requirement.
- **Natural angles** θ = kπ/n. Lines across the tile become collinear and the design snaps into place visually. Worth soft ticks with labels.
- **Extension limit.** An extended rosette is only possible when θ is "sufficiently small," so each motif configuration has its own valid θ interval.
- **Irregular filler tiles.** The real hazard for a broader inference engine. In Kaplan's inference, rays in a pentagon, bow-tie or barrel hexagon are paired greedily by shortest intersection, and as θ sweeps the pairing can flip, leaving unmatched rays or paths that leave the tile. This analysis has not enumerated those angles. Kaplan lets the user hand-edit an inferred motif; Alhambra exposes an "Intersections" spinner. The current app uses neither greedy pairing nor those fillers: `buildContactPaths` pairs adjacent edges in every tile, including the flagship's rhombi. Its curated range excludes the transition near 72°; see [PATTERNS.md](PATTERNS.md#how-the-ranges-were-chosen).
- **δ.** Any δ > 0 is the two-point family, and at small δ the two crossings are close, so band width and δ interact.
- **Material.** Band width changes occupied area, clearances and visible faces, and the crossing-gap length grows like w / sin β as the sector closes. Material does not move centrelines but it does bound valid geometry.

**What validation has to become.** [src/validation.ts](../src/validation.ts), `validatePatternRange`, still checks topology signature, nonincident centreline clearance, edge length and graph invariants over one contact-angle interval, with 512 samples and bisection. Distance thresholds now scale with scaffold edge length. Construction checks also exist: [src/geometry/tiling.ts](../src/geometry/tiling.ts), `tilingErrors`, checks winding, edge length, total area and paired edge midpoints modulo the lattice; `buildContactPaths` rejects parallel/divergent rays and unpaired contacts, visits paired ports and requires strand walks to close. Graph invariants alone still do not certify ray consumption: [src/geometry/kernel.ts](../src/geometry/kernel.ts), `graphInvariantErrors`, has no general loose-end rejection, and the arrangement compiler can assign a non-alternating fallback weave to loose-ended input. The shipped generator avoids that input. Explicit path-in-tile checks, band-width clearance and joint (θ, δ) validation remain absent. So:

- Retain the shipped scaffold pairing and closed port-walk checks before graph diagnostics; add explicit checks that every path is inside its tile and every inference ray is consumed if broader inference is introduced. Joint contact compatibility must be checked again if δ or per-class θ is added.
- Validate each discrete motif configuration separately, at the maximum supported band width, so material can never invalidate a state.
- Keep each exposed continuous region a rectangle in (θ, δ): projection onto a convex set is continuous, so clamping never jumps. Excluded areas shrink the rectangle; they never carve holes.
- When a motif choice's rectangle excludes the current (θ, δ), the change and the clamp happen atomically as one undo entry, and the chooser previews the clamped result.
- Sampling remains a pragmatic guard, not certification. A 2-D grid at 512 per axis is 262,144 evaluations per configuration; budget accordingly (a coarser grid plus bisection along both axes is the likely compromise).

Kaplan's parquet deformations sweep 4.8² from 22.5° to 67.5° and fivefold from 36° to 72° and stay recognizably Islamic throughout. Those are the ranges to expose first.

## The gap between the current kernel and this space

Reviewed against codex/v1 at 25ce69d, not the original plan. “Done” means present in the current implementation; the remaining work belongs to the larger exploration surface proposed above.

| Component | Current status and evidence | Remaining work |
|---|---|---|
| Periodic half-edge graph, torus wraps, faces, strands, weave solver | **Done.** The graph contract remains; strand traversal now follows source-path order, self-crossings pair opposite arms, and the weave uses checkerboard face colouring with lattice parity. [types.ts](../src/geometry/types.ts), [kernel.ts](../src/geometry/kernel.ts) (`graphInvariantErrors`), [arrangement.ts](../src/geometry/arrangement.ts) (`continuationComponents`, `checkerboardWeave`); 8573574 | Carry semantic tile-class, motif and handle ownership if new controls require it. |
| Arrangement compiler | **Done for shipped contact paths.** `buildContactPaths` stitches strands before compilation and omits contact midpoints as polyline vertices, so scaffold contacts become interior woven intersections. `continuationComponents` supports a single source path crossing itself; `splitAtIntersections` sizes its translation window from geometry. [hankin.ts](../src/geometry/hankin.ts), [arrangement.ts](../src/geometry/arrangement.ts); 8573574 | Interior source endpoints still classify as non-woven `contact` joins (with a periodic-seam exception); this no longer blocks Hankin contacts. Collinear coincidences are still ignored by `intersectionParameters`. Multi-path continuations are explicitly rejected, not partially supported (61105b1). |
| Export (standalone SVG, PNG raster) | **Shipped, with a contract gap.** [main.ts](../src/main.ts), `standaloneSvg`, recompiles state and calls the same `renderSceneMarkup` as live rendering; [export.ts](../src/export.ts), `buildStandaloneSvgDocument` and `rasterizeSvgToPng`, serialize and rasterize that body. [QA.md](QA.md) records parity checks. | Use the live SVG as the export source, as [AGENTS.md](../AGENTS.md) requires; filter transient overlays when they exist. |
| Renderer | **Done:** mosaic face fills (`faceMarkup`, `faceClasses`), angle- and width-aware over-strand patches (`crossingPatches`), opaque layers and mitred continuation across the repeat seam (`strokeMarkup`, `drawablePoints`). [render.ts](../src/render.ts); 23bd928, 61050b6, ec8082c, 25ce69d. The under-strand is drawn whole and covered by the over-strand's own outline; no background-coloured eraser or fixed crossing half-span remains. | Semantic overlays for interaction. Patch reach uses a sine floor of 0.2 and stops at neighbouring crossings; this is not general shallow-angle or maximum-band clearance validation. |
| Palettes | **Done:** optional `Palette.faces` glaze colours and three mosaic palettes in [palettes.ts](../src/palettes.ts), applied to classes ranked by vertex count and area in `faceClasses`. [PATTERNS.md](PATTERNS.md#mosaic-palettes); 23bd928 | User-selected per-class fills and stable semantic class identity across motif/topology changes. Automatic palette assignment is not per-class editing. |
| State store, undo, URL codec | **Shipped v1.** [state.ts](../src/state.ts), `AppStateV1`, `normalizeAppState`, `stateEquals`, `cloneState`, `encodeStateHash` and `decodeStateHash`, still use the fixed v1 shape and exactly eight URL keys. `cx`, `cy` and `scale` already exist; morph is [0,1] mapped to θ, not a blend of recipe ranges. | A v2 for explicit θ, δ and class-qualified motif/fill tokens, if those controls ship; migration and semantic class defaults remain undecided. |
| Validation | **Partly done.** [validation.ts](../src/validation.ts), `validatePatternRange`, retains scalar sampling/bisection with scaffold-relative distance thresholds; [tiling.ts](../src/geometry/tiling.ts), `tilingErrors`, and [hankin.ts](../src/geometry/hankin.ts), `buildContactPaths`, add scaffold pairing and construction checks. Stored reports are in `docs/validation/`; [QA.md](QA.md#stored-range-reports); d30fb1f, 61105b1 | Path containment, maximum-material clearance, per-motif regions and joint (θ, δ) validation. |
| Recipe layer | **Done:** polygons-in-contact backend, periodic scaffold catalogue and continuous strand construction behind `compilePattern`/`compileTiling`. [recipe.ts](../src/geometry/recipe.ts), [tiling.ts](../src/geometry/tiling.ts), [hankin.ts](../src/geometry/hankin.ts). Definitions retain provenance, defaults and ranges; no design-specific compiler branch. | Motif catalogue (star, rosette, s, extension), δ, rosette refinements, general irregular-filler inference and semantic output (tile class, motif ownership, handle points with their parameter, symmetry actions). Visible rosette rings currently follow from the scaffold and angle; they are not selectable motif configurations. |
| Interaction | **Shipped horizontal angle scrub and gesture transactions.** [interaction.ts](../src/interaction.ts), `morphFromHorizontalDrag` and `GestureController`, preview relative horizontal motion and commit once on release; second contact and `pointercancel` roll back. [state.ts](../src/state.ts), `AppStateStore`, owns preview/history. | Anchor/handle acquisition, q mapping and chooser. [main.ts](../src/main.ts) still does not route Escape or undo through `GestureController.cancel`: Escape closes More and exits Move view; undo during a drag clears the store preview while the controller remains active, so the next move can throw. Wheel and pointer also share the store's single preview transaction. |

The curated scalar no longer drives the radial star-polygon construction: it is already a linear map to θ. A designed curve t ↦ (θ(t), δ(t), h(t), φ(t)) could still be an optional “tour” mode if those parameters are introduced; it is not needed to adopt the contact construction.

Regular-polygon ray generation, periodic continuation, source-lineage identities, mosaic face rendering and scalar contact-angle validation have shipped. The remaining work is motif and semantic-class support, any state migration, joint validation and the gesture model. That larger exploration surface is still a version, not a patch.

## What this means for the control surface

A starting surface, to be tested rather than assumed:

- **Shape: θ.** Continuous over the configuration's validated interval, driven in the waist coordinate q through the inverse, with soft labelled ticks at kπ/n. The global angle and bounded interval already ship; q mapping and ticks do not. Each tick must also be valid for every tile in the scaffold.
- **Motif: a preset chooser (proposed).** A small catalogue of valid (kind, s, extension) combinations per polygon class, shown as thumbnails computed at the current θ (clamped if needed). Held fixed during drags.
- **Material.** Keep the shipped continuous linework-to-band control and woven crossing treatment; see [recipe-vocabulary.md](recipe-vocabulary.md#interlacing) and `strokeMarkup`/`crossingPatches` in [src/render.ts](../src/render.ts). Maximum-band clearance validation remains open.
- **Split contacts: δ (proposed).** An explicit mode or a second axis, exposed only where jointly validated, because it changes contact topology and interacts with width.
- **Rosette refinement: h, φ (proposed).** Only inside a rosette state, after selecting the motif class. Not a global axis.
- **Colour.** Per face class, from the palette. Automatic class fills already ship for mosaic palettes; selecting a colour for an individual class remains proposed. Current ranking is geometric, not generator-owned semantic identity; see [PATTERNS.md](PATTERNS.md#mosaic-palettes).

Global θ is a defensible default link between polygon classes, not necessarily the right scope for every motif; selective unlinking is a later refinement.

## Scope changes relative to the plan

The construction change has shipped. These September scope questions now have the following status relative to the [plan](../.plans/islamic-pattern-instrument-v1.md):

1. **Flagship coverage: settled for launch.** Tenfold Rose ships a decagon–rhombus scaffold with the same adjacent-edge pairing as the other designs; it does not need the proposed general irregular-filler inference. It preserves the adversarial non-regular supporting tile and oblique repeat while claiming only inspiration from Darb-i Imam. Exact reference reconstruction remains outside the shipped claim. See [PATTERNS.md](PATTERNS.md#tenfold-rose--the-flagship), `decagonRhombusTiling` in [src/geometry/tiling.ts](../src/geometry/tiling.ts), and 8573574.
2. **Class-level editing: still open.** The plan excluded region editing. Per-class motif and colour choices are class-level, not region-level, but they are new user-facing state and new validation surface. Automatic mosaic fills shipped in 23bd928 despite the original mosaic exclusion; this does not settle user-selectable motif, δ or per-class colour scope. `AppStateV1` still has no such fields in [src/state.ts](../src/state.ts).
3. **The curated scalar and gesture: still open.** The single morph axis remains the primary control and now varies only θ (`mapUserMorph` in [src/geometry/recipe.ts](../src/geometry/recipe.ts)). The proposal is to replace its horizontal mapping with a q-based gesture and a chooser; an optional multi-parameter tour remains a separate decision. The P4 recommendation is unchanged in [ux-paradigms.md](ux-paradigms.md).

## Live demonstration

[demos/touch-mappings.html](demos/touch-mappings.html) is a standalone 4.8² construction with θ continuous, ray pairing tappable, band width continuous, and three ways to touch the same geometry: a drag-anywhere pad, literal waist-following, and an anchored drag with gain. It implements the one-point family only, with its own small ray generator rather than the app's kernel. δ, rosettes, interlacing and irregular tiles are described above but not built there, so it demonstrates the scalar geometry and the feel of the three mappings, nothing more. It was published alongside this analysis on 2026-09-21 and copied into the repo on 2026-10-03.

## Sources

Read in full: Kaplan, "Islamic Star Patterns from Polygons in Contact," GI 2005 (https://cs.uwaterloo.ca/~csk/publications/Papers/kaplan_2005.pdf); Kaplan and Salesin, "Islamic Star Patterns in Absolute Geometry," TOG 2004 (https://grail.cs.washington.edu/wp-content/uploads/2015/08/kaplan-2004-isp.pdf); Kaplan's dissertation chapter on star patterns (https://cs.uwaterloo.ca/~csk/other/phd/kaplan_diss_starpatterns_print.pdf); Kaplan, Bridges 2000 (https://archive.bridgesmathart.org/2000/bridges2000-105.pdf); Lee and Soliman, "The Geometric Rosette" (https://tilingsearch.mit.edu/RosetteAnalysis.pdf); Bodner on Hankin's grid, Bridges 2008 (https://archive.bridgesmathart.org/2008/bridges2008-21.pdf); Bonner and Pelletier, Bridges 2012 (https://archive.bridgesmathart.org/2012/bridges2012-141.pdf); Bonner on non-systematic patterns, Bridges 2012 (https://archive.bridgesmathart.org/2012/bridges2012-593.pdf); Eriksson, Bridges 2020 (https://archive.bridgesmathart.org/2020/bridges2020-19.pdf); Lin and Kaplan, "Freeform Islamic Geometric Patterns," 2023 (https://arxiv.org/pdf/2301.01471); Brewer et al., Bridges 2022 (https://archive.bridgesmathart.org/2022/bridges2022-391.pdf); Kaplan's star pattern page (https://cs.uwaterloo.ca/~csk/other/starpatterns/); Taprats (https://sourceforge.net/projects/taprats/); Alhambra (https://github.com/pierrebai/Alhambra); Tiling Search records P222, IRA0911, W85.

Not accessible: Hankin 1925, Lee 1987 and Bonner 2017 directly (all via the papers above), and the original ChatGPT conversation linked from the plan.
