# Pattern corpus

Every design in the collection is built the same way: a periodic polygon
**scaffold** plus a single **contact angle**. The scaffold says which polygons
meet and along which edges; the contact angle says how the strapwork leaves each
shared edge. Star points, rosette rings, and interlacing all follow from those
two facts, so nothing in the kernel knows which design it is drawing. See
[recipe-vocabulary.md](recipe-vocabulary.md) for the construction itself.

The collection is deliberately structurally mixed. The elementary case proves the
path end to end, the flagship breaks any abstraction fitted only to a single
regular-polygon family, and the companion proves the kernel is not square-grid
software.

## Provenance policy

None of these is a reconstruction of a specific monument, and the app must not
imply otherwise. Each is a polygons-in-contact construction in the *family* of a
documented pattern, so each is labelled `inspired by` and links to the record it
is answering to. Source photography is reference-only and is never bundled; the
geometry is generated independently.

## Launch collection

### Tenfold Rose — the flagship

- **Relationship:** inspired by Darb-i Imam pattern IRA0911
- **Scaffold:** regular decagons in edge-sharing rows, with the residual gaps
  filled by 72°/108° rhombi. One decagon and four rhombi per cell.
- **Lattice:** centred rectangular, `a = (2r, 0)` and `b = (r, 2φ + φ·sin 18°)`
  where `r` is the decagon inradius. Successive rows are offset by half a period;
  the packing only closes because the next row's decagon tops land exactly on
  this row's rhombus tips.
- **Why it is adversarial:** the supporting tile is irregular relative to the
  decagon and the repeat is oblique, so the design cannot be expressed as the
  single regular-polygon family the elementary case uses.
- **Validated contact-angle range:** 57°–70°
- **Honest limits:** this is *not* the shrine's own tiling, which uses seven
  irregular tile types, and it is not the famous quasiperiodic spandrel. It
  shares the decagonal family and nothing more.
- **Source:** [MIT Tiling Search IRA0911](https://tilingsearch.mit.edu/HTML/data189/IRA0911.html)

### Eightfold Court — the elementary case

- **Relationship:** inspired by the polygons-in-contact construction itself
- **Scaffold:** the truncated square tiling (4.8.8) — regular octagons and
  squares on a square lattice, one of each per cell.
- **Why it is elementary:** one regular-polygon scaffold, one contact angle, an
  orthogonal repeat. Anything the flagship needs beyond this shows up as an
  addition rather than a rewrite.
- **Validated contact-angle range:** 46°–86°, the widest in the collection
- **Source:** [Kaplan, *Islamic Star Patterns from Polygons in Contact*](https://cs.uwaterloo.ca/~csk/publications/Papers/kaplan_2005.pdf)

### Twelvefold Vault — the companion

- **Relationship:** inspired by the Kharraqan–W85 pattern family
- **Scaffold:** the rhombitrihexagonal tiling (4.6.12) — regular dodecagons,
  hexagons, and squares on a hexagonal lattice; one dodecagon, two hexagons, and
  three squares per cell.
- **Distinctness:** three tile families on a hexagonal repeat put the twelve-point
  centres in a field of smaller rosettes rather than a plain ground, which reads
  differently from either of the others rather than being another preset.
- **Validated contact-angle range:** 61°–84°
- **Honest limits:** it shares the twelvefold family of the Kharraqan towers; it
  does not reconstruct their brickwork.
- **Source:** [MIT Tiling Search W85](https://tilingsearch.mit.edu/HTML/data18/W85.html)

## Construction matrix

| Design | Scaffold | Tiles per cell | Lattice | Contact range | Strands per cell |
|---|---|---|---|---|---|
| Tenfold Rose | decagon + rhombus | 1 + 4 | oblique, centred rectangular | 57°–70° | 3 |
| Eightfold Court | octagon + square | 1 + 1 | square | 46°–86° | 2 |
| Twelvefold Vault | dodecagon + hexagon + square | 1 + 2 + 3 | hexagonal | 61°–84° | 6 |

## How the ranges were chosen

The contact angle can be pushed well past these bounds and still compile, so the
range is a curation decision, not just a validity one. Three things bound it:

1. **Singular angles.** At angles commensurate with the tile geometry (22.5°,
   30°, 36°, 45°, 54°, 90°) contact rays become parallel and the construction is
   rejected outright. Ranges exclude them.
2. **Topology transitions.** The flagship changes topology near 72°, so its range
   stops below that; each design exposes one connected validated range.
3. **Human review.** Past roughly 90° every design degenerates into
   self-intersecting spikes *without any change in topology signature*. Signature
   stability alone would have accepted those states, which is exactly why the
   contact-sheet review in [QA.md](QA.md) remains a required gate.

`validatePatternRange` samples each range 512 times, comparing a normalized
topology signature plus minimum clearances, and bisects any suspect neighbourhood.
Distance thresholds are fractions of the scaffold edge length, so a design stays
equally well validated whatever world scale it is drawn at.
