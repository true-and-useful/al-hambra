# UX paradigms for touching the pattern

Status: design analysis written 2026-09-21 against 2ea77d8, revised after two adversarial reviews; reconciled with codex/v1 at 25ce69d on 2026-10-03. Companion to [design-space.md](design-space.md), which defines the parameter space this document assumes. The current app ships the revised P0 below: horizontal dragging varies the contact angle of a polygons-in-contact construction. P1–P4 gesture mappings and the motif/colour chooser remain proposals; the contact generator, material control and automatic mosaic fills already ship. The exhaustive gesture inventory, conflict tables and micro-decision checklists for every paradigm are in [ux-gesture-inventory.md](ux-gesture-inventory.md).

## What we are optimizing for

From the plan's product intent, restated as testable properties:

1. **Causal.** The pattern moves under the finger with no easing or lag between input and image.
2. **Direct.** The user acts on the ornament, not on a description of it. "Make the stars fatter" is the intention; "set θ to 42°" is a translation. Hutchins, Hollan and Norman call the distance between them the gulf of execution.
3. **Never broken.** Every reachable state, and every state passed through during a drag, is a valid, seamless, interlaced pattern.
4. **Reversible.** One undo entry per completed, changed edit. None for acquisition, cancellation or a no-op gesture.
5. **Mobile first.** One finger. Native pinch stays native. 44 px targets where a target exists.
6. **Near-zero visible controls.** An instrument has one primary gesture.
7. **Covers the real space.** The gesture reaches the historically meaningful variety, not a one-dimensional curated curve.
8. **Deliberate small changes and full-range travel** in one thumb sweep, without regripping. This is the plan's own U6 sign-off criterion and it turned out to be decisive.

## The candidate paradigms

| | Name | One line | Continuous | Discrete |
|---|---|---|---|---|
| P0 | Contact-angle scrub (shipped) | Horizontal drag anywhere varies [0,1] morph, mapped linearly to one global contact angle in the selected design’s curated range | 1 (θ) | design and whole palette in the dock; no motif or per-class choice |
| P1 | Latent pad | Drag anywhere; x drives θ, y drives a second parameter. Nothing under the finger is special | 2 | none |
| P2 | Grab a handle | Touch a moving point of the pattern (a star's waist) and drag it; the app solves the one parameter that point owns | 1 per handle | none |
| P3 | Region taps | Tap a face to change a discrete property of its class; continuous parameters in a dock | 0 | motif, colour |
| P4 | Anchored drag + chooser | Press near a star to anchor it; drag with gain in the waist coordinate; tap opens a small chooser; dock for the rest | 1 (2 if δ is added) | motif, colour |

P4 is the recommendation. It is not the hybrid of the first draft. It merges what survived review from P1 and P2 and drops the mutation-on-tap idea.

## What the review changed

The first draft argued for literal handles ("the tip follows the finger") on three grounds: uniform gain, locality, and material resistance at range ends. Two of the three did not survive.

**Uniform gain is not a handle property.** A pad can map drag distance to the waist coordinate q and use the same closed-form inverse for θ. Both paradigms get constant gain for free by working in q. The sensitivity table in design-space.md is an argument for q as the drag coordinate, not for handles.

**Literal following has no travel.** Across the useful octagon–square range the waist moves about a third of the tile's circumradius, roughly 17 px on a phone. A thumb cannot make deliberate small changes inside 17 px. Gluing the pattern to the finger fails criterion 8 unless the user zooms in first. A gain between finger and waist is mandatory, and once there is a gain the point is no longer under the finger, so "literal directness" is gone anyway.

**Handles cannot own two parameters.** A waist sits on a one-dimensional rail, so its Jacobian in (θ, δ) is rank one. A least-squares solve from one dragged point cannot recover both. Each handle owns one parameter. The δ handles proposed in the first draft (edge crossings) have the same problem and are invariant under θ at δ = 0, so they are not a viable second axis either.

**Locality survives, as a hypothesis.** The felt difference between "the pattern breathes" and "I am pulling this star" is real in the demo but it is a user-behaviour claim, and the only way to settle it is the device test described at the end.

**Taps must not mutate.** With press-anywhere acquisition, every press begins as both a potential drag and a potential tap. A 6 px adjustment that fails to consummate must not silently change a motif or a colour. A tap opens a chooser; a choice commits. This also answers the owner's original hunch that a tap on open space should bring up a small selector.

**The 44 px target is a diameter.** The first draft said "44 px radius." Stars sit 30 to 60 px apart at phone zoom, so target circles overlap and nearest-point arbitration decides. Anchoring on the nearest star centre, with a relative drag, removes both the overlap problem and the acquisition jump (finger 40 px from a handle, pattern leaps to meet it).

## P4 in detail

**Acquisition.** Press anywhere on the artwork. The nearest star centre becomes the anchor. Its waist vertices, and those of its symmetry copies at reduced opacity, light up. Nothing moves yet. Anchoring by tile centre rather than by handle means every press succeeds and no two targets compete.

**Drag.** The finger's displacement is projected onto the anchor's radial direction through the press point. That radial component, times a gain g, moves the waist coordinate q, and θ = θ(q) through the closed-form inverse. The star under the finger pinches or fattens; every copy answers because θ is global. The tangential component does nothing in the first release. Feedback is visible outside the thumb's occlusion because the copies move too.

**Gain.** g is the tunable that decides the feel. g = 1 is literal following (the failed case). The demo uses g = 0.35, which puts the octagon–square range inside about 120 px of finger travel. The device test tries at least two values.

**Range ends.** The waist stops at the interval boundary. Whether that reads as resistance or as breakage is a hypothesis; add a static end-of-range cue (a brief scale pulse on the waist ring; a static ring change under reduced motion) and test.

**Ticks.** Soft magnetic snap within ±1° of each construction tick (kπ/n), with the label ("median") flashed near the anchor. Snapping is disabled while the finger is moving faster than a threshold so it never fights travel.

**Tap.** A release before consummation (8 px on touch, 3 px on mouse, no time limit) opens a chooser anchored at the pressed tile class:

- Motif presets for that polygon class: thumbnails of the valid (kind, s, extension) combinations at the current θ, clamped where a preset's interval excludes it, so the thumbnail shows what will actually appear.
- Colour for the face class under the press, from the palette.
- Current values marked. Escape, outside tap or focus loss closes without change. A choice commits one undo entry, atomically with any θ clamp it forces.

The chooser replaces the first draft's "tap star interior for motif, tap background for colour" rule, which review showed to be an implementation convenience rather than something a user could predict, and which broke on designs where a star is several faces or an interstitial face is too small to hit.

**Second continuous axis.** Not in the first release. δ is a family change with its own validation and it interacts with band width; it belongs behind an explicit "split contacts" choice in the chooser, with the same anchored drag then driving δ within its validated interval. The tangential component of the drag is reserved for it if the device test shows people expect sideways motion to do something.

**Dock.** Design, material, palette, undo, share, zoom, and Move view. Move view is retained. Review is right that periodicity does not make every crop equivalent: users want a star centred, a handle clear of the dock, an export framed. The mobile zoom buttons cannot reposition the view centre. Pan stays until framing tests justify removing it.

**Accessibility route.** A labelled native range for θ stays in the DOM (visually quiet, as the current morph range is), plus native selectors for motif per polygon class and colour per face class. These are the proposed keyboard and screen-reader route; the anchored drag is an additional route, not the only one. The current native range stores normalized morph at step 0.001, not degrees; motif and per-class colour selectors are absent ([src/main.ts](../src/main.ts)). Committed changes are announced; focus is preserved across a motif change by class identity, not by face id.

**First touch.** The proposal dismisses the "drag to reshape" hint after the first committed edit. Today the artwork `pointerdown` handler sets `data-touched` immediately, and [src/style.css](../src/style.css) hides the hint before any edit commits ([src/main.ts](../src/main.ts)). The hint text names the two verbs: "Drag a star to reshape. Tap a star to choose its motif."

## Where each paradigm breaks

### P0 Contact-angle scrub

- `morphFromHorizontalDrag` in [src/interaction.ts](../src/interaction.ts) adds horizontal CSS-pixel displacement divided by `pixelsPerMorphRange` to the pointer-down morph, then clamps to [0,1]. There is no slop threshold, easing, q inverse, anchor or tick snap. Vertical motion has no effect in morph mode. [src/main.ts](../src/main.ts) sets the full-range travel to `clamp(window.innerWidth × 0.72, 280, 560)` pixels at startup; [src/geometry/recipe.ts](../src/geometry/recipe.ts), `mapUserMorph`, maps that scalar linearly to θ in degrees. The radial multi-range blend was removed in 8573574.
- `GestureController` starts a store preview on pointer-down, previews relative motion, and commits once on pointer-up. [src/state.ts](../src/state.ts), `AppStateStore.commitPreview`, adds no history for a no-op or a return to the starting state. A second contact or `pointercancel` rolls back; the controller ignores remaining contacts until all have lifted after a second-contact cancellation. A tap has no chooser or motif action. Move view or Space selects pan instead of morph; native pinch is preserved by `touch-action: pinch-zoom` in [src/style.css](../src/style.css).
- The scalar now is the real contact-angle axis, so users can make distinct angle states within each shipped range. It still cannot reach motif choices, δ or rosette refinements. The horizontal mapping does not refer to a particular star's waist, and it does not compensate for the waist's nonuniform sensitivity.
- P0 already survived the move to the contact construction as its primary control. The remaining comparison is this horizontal θ scrub versus q-based pad or anchored drag. An optional tour t ↦ (θ, δ, h, φ) would become a separate feature if those parameters ship.

### P1 Latent pad

- Discovery of the primary gesture is perfect: any touch anywhere works. This is its real strength and P4 keeps it.
- The second axis is invisible until used. Nothing about up–down means "split contacts."
- No locality: the finger is in one place and the change appears everywhere. Whether that matters is the hypothesis under test.
- It is the smallest change from the shipped controller. The proposed P1 and P4 would share the q coordinate, inverse, validation and URL format; the current controller has none of that q mapping or extended state. P1 remains the fallback if anchoring shows no advantage.

### P2 Literal handle

- Fails travel (17 px) without zoom. Not viable as the primary gesture on phones.
- Target competition at phone zoom; acquisition jump when the press is off the handle.
- One handle owns one parameter, which is fine, but the visible handle classes (waist ring vs edge crossing) teach nothing before the first touch.
- Kept in the demo as the failed control condition, because feeling it fail is instructive.

### P3 Region taps

- Discovery is the worst of the four; nothing suggests a face is tappable. Mitigated by the pressed-face highlight and the chooser, which at least shows what a tap does once it happens.
- Cycling hides the choices and forces users through unwanted states; a topology change can move the region under the next tap. Hence the chooser, not cycling.
- Symmetry: a tap acts on the class, never on one face. Which class a face belongs to must come from the generator (tile class, motif ownership), not from anonymous graph faces, because a richness change splits faces and the mapping must survive it. Current mosaic fills use geometric ranking by vertex count and area (`faceClasses` in [src/render.ts](../src/render.ts)); that already colours classes automatically, but supplies neither tap editing nor semantic identity across motif changes.

### P4 Anchored drag + chooser

- Inherits P1's discovery and P2's locality; the drag is relative, so no jump.
- The gain is a new thing to learn: the waist is near, not under, the finger. The copies moving together is what makes that acceptable, and that is the untested part.
- The chooser is a modal moment inside an instrument. Keep it tiny, anchored, and dismissable by any outside touch.
- The scaffold/contact generator and mosaic rendering in [design-space.md](design-space.md#the-gap-between-the-current-kernel-and-this-space) have shipped. P4 still needs semantic anchors/handles carried through compilation, the q drag mapping, chooser, and any chosen motif/δ/per-class colour extensions.

## Gestures that were considered and set aside

- **Two-finger stretch a star.** Conflicts with native pinch, which the plan keeps native. Excluded unless it demonstrably coexists.
- **Radial drag from the star centre** (start at the centre, pull outward). Same math as P4 but forces a precise press; P4's "press anywhere near" is the forgiving version.
- **Drag a star edge rather than a vertex.** Edges are the fixed midpoint-to-waist segments; dragging them has no single natural parameter.
- **Long-press to scrub.** Adds a timing mode with no gain over the drag.
- **Mutant shopping** (thumbnails of nearby variants). Kept, in a narrow form: the motif chooser shows thumbnails at the current θ. Random generation stays out.
- **Drag between tiles to change the tiling.** Tiling is the outer discrete selector and changes everything; it stays in the dock.

## Gesture inventory for P4

| Intent | Mouse | Touch | Keyboard and assistive |
|---|---|---|---|
| Contact angle θ | Press near a star, drag along its radial with gain | Same; anchor and copies light on touch-down | Native θ range: ← → 0.5°, Shift 5°, Home/End |
| Motif per polygon class | Click a star, choose in the chooser | Tap a star, choose | Native select per class |
| Colour per face class | Click a face, choose | Tap a face, choose | Native select per class |
| Split contacts δ (later) | Chooser enables; same drag then drives δ | Same | Native δ range |
| Material | Dock slider | Dock slider | [ ] |
| Palette | Dock swatches | More-menu | P |
| Design | Dock select | More-menu | D |
| Zoom | Wheel around pointer, dock ± | Native pinch, dock ± | + − |
| Pan | Space + drag, Move view | Move view toggle | Arrows with Move view |
| Undo | Cmd/Ctrl+Z, dock | Dock | Cmd/Ctrl+Z |
| Cancel gesture | Esc during drag | Second finger, or pointercancel | Esc |
| Share | Dock | Dock | S |

Trackpad: wheel events without Ctrl currently zoom around the pointer using `deltaY`; Ctrl-modified events are left to the browser ([src/main.ts](../src/main.ts), artwork `wheel` handler). Thus two-finger scroll reported as ordinary wheel input zooms the app, while pinch reported as Ctrl-wheel stays native. Decide separately whether scroll should pan and pinch should zoom on trackpads; the current behaviour will surprise people trying to reposition the ornament.

## Undo, cancellation, and state

- One history entry per completed, changed edit: a drag that moved θ, a chooser choice, a dock change. No entry for a press without movement, a cancelled gesture, or a drag that returned to its start value.
- One owner for the active edit transaction. Escape, undo, reset, design change and conflicting input all route through the gesture controller's cancel and release capture. Today Escape closes More and exits Move view; it does not cancel a drag. Undo rolls back the store preview but leaves the controller active, so the next move can throw. Wheel and pointer share the same preview transaction. These remain open in [src/main.ts](../src/main.ts), the keydown/undo/wheel handlers, [src/interaction.ts](../src/interaction.ts), `GestureController.pointerMove`, and [src/state.ts](../src/state.ts), `AppStateStore.undo`/`preview`; fixing them belongs to the proposed work.
- A second finger during a drag rolls back the preview, appends nothing, and yields to native pinch. Whether a fresh one-finger drag after a pinch reliably reaches the app on iOS Safari is an open device question, not a settled fact; it is a named gate below.
- **URL v2 (proposed).** Keys: version, design, θ, δ, one class-qualified motif token per polygon class, one class-qualified fill token per face class, material, palette, cx, cy, scale. The decoder clamps θ and δ into the validated rectangle for the decoded motif configuration, defaults unknown class tokens, and rejects unknown versions. Class identity is stable across topology changes because it comes from the generator. At HEAD, v1 already stores a [0,1] morph that maps exactly to θ, so its angle, material, palette and view can be carried forward for a known design; new motif and δ fields would need defaults. The September assumption that every v1 link must fall back to a design default came from the removed radial recipe. A v2 migration policy is still open, and no v2 decoder ships. The current eight-key decoder rejects unsupported versions and defaults unknown design IDs ([src/state.ts](../src/state.ts), `decodeStateHash`/`normalizeAppState`).
- Export uses the live SVG with transient overlays (anchor ring, copies, ticks, chooser) excluded. The current `standaloneSvg` in [src/main.ts](../src/main.ts) recompiles state and calls the shared `renderSceneMarkup`, then [src/export.ts](../src/export.ts), `buildStandaloneSvgDocument`, wraps that body; PNG rasterizes the same document. Export parity is tested, but the live SVG is still not the source as [AGENTS.md](../AGENTS.md) requires. This remains open before adding overlay layers.

## Micro-decisions that determine feel

Each needs a device test, not a discussion.

1. **Gain g.** 0.35 in the demo. Test 0.35 and 0.6, and 1.0 as the control.
2. **Anchor selection.** Nearest star centre. Whether squares (or other minor polygons) can be anchors, or only the primary stars.
3. **What lights on touch-down.** Anchor waist ring at 90%, copies at 40%. Test whether copies help or clutter.
4. **Rail hint.** A faint radial line while dragging; static under reduced motion, never removed.
5. **Range-end cue.** Scale pulse on the ring; static ring change under reduced motion; light haptic where supported.
6. **Consummation threshold.** 8 px touch, 3 px mouse. Release before it is a tap, regardless of duration.
7. **Tick magnetism.** ±1° capture, disabled above a velocity threshold.
8. **Chooser size and placement.** Anchored to the pressed tile, clamped inside the viewport and away from the dock; three to five thumbnails plus swatches.
9. **Hint dismissal.** After the first committed edit.
10. **Cursor.** `grab` over the artwork, `grabbing` while dragging.
11. **Move view.** Keep in the dock; measure how often it is used before deciding its fate.
12. **Handle-free framing.** At high zoom a face can fill the viewport with no star centre in reach; define what a press does then (anchor the nearest off-screen star, or nothing).

## The device test that decides it

The first draft claimed no prototype was needed. That was too strong. A monotone formula does not tell us whether an uncoached thumb can make a small deliberate change, cross the range, discover the chooser, and come back cleanly after a native pinch. The honest position:

- **No throwaway prototype.** Build a retained slice of the real product using the already-shipped contact generator (octagon–square first), periodic graph, live SVG and transactional store; add drag mappings switchable at runtime between anchored (two gains), pad, and literal. The generator no longer needs a replacement; the mappings and chooser are the unbuilt slice.
- **What it tests on real phones**, uncoached, with a fresh shared link: deliberate 1° change; full-range travel without regrip; reversal without overshoot; discovery of the tap chooser; pinch, lift both fingers, then drag; pinch, lift one finger, keep moving; whether copies lighting helps.
- **What it cannot test yet**, and must not be claimed: two-parameter feel, δ = 0 transitions, irregular-tile inference, motif transitions on the fivefold design.
- **Gate.** If anchored shows no advantage over pad, ship pad (P1) with the chooser. If literal (g = 1) somehow wins, the travel analysis was wrong and the plan's zoom model needs revisiting. This is the plan's U2 stop gate, applied to the new gesture model.

The standalone demo in [demos/touch-mappings.html](demos/touch-mappings.html) runs all three mappings on the same geometry and is the fastest way to feel the difference. It uses its own small ray generator, not the app's kernel, and the shipped app has only P0, so the device test still needs the retained product slice described above.
