# Construction vocabulary

The whole collection is built from two ideas. Nothing else is exposed, and no
part of the kernel branches on a design id.

## 1. The scaffold

A periodic polygon tiling, given as one fundamental domain: a lattice cell plus
the tiles inside it, each listed counter-clockwise with unit-length edges before
scaling. `tilingErrors` rejects a scaffold that is not a genuine fundamental
domain — wrong winding, non-unit edges, or tile areas that do not sum to the cell
area — because a scaffold that is subtly wrong produces a silently ugly pattern
rather than an error.

## 2. The contact angle

Hankin's "polygons in contact" construction, in the form Kaplan describes.

Every scaffold edge carries a contact point at its midpoint. Two rays leave that
point into each adjacent tile, each making the same **contact angle** with the
edge. Inside a tile, the ray leaving edge `i` forwards meets the ray leaving edge
`i+1` backwards; that meeting point is a bend in the strapwork. Walking
alternately — bend, contact point, bend, contact point — traces out continuous
strands.

Two consequences matter:

- **Contact points are crossings, not joints.** Because the angle is equal on
  both sides of an edge, the two rays on opposite sides are collinear. A strand
  runs *straight through* each contact point and two strands cross transversally
  there. So contact points are deliberately not emitted as polyline vertices;
  the arrangement compiler has to discover them as interior crossings in order to
  weave them.
- **The angle is the morph axis.** It is one continuous scalar that moves the
  pattern through a family of coherent states, which is exactly the shape the
  product wants. Each design exposes a curated sub-range of it; see
  [PATTERNS.md](PATTERNS.md).

## What the kernel had to learn

Real strapwork broke three assumptions that a simpler generator had not:

| Assumption | Why it is false | Where it is handled |
|---|---|---|
| A strand never crosses itself | Strapwork strands routinely do | `continuationComponents` orders edges by their position along the source path rather than by walking the graph, which vertex degree cannot recover |
| Two distinct continuations meet at every crossing | A self-crossing puts all four arms in one continuation | Crossings pair opposite arms by cyclic order; the weave identifies each pass by the arm actually taken |
| Geometry stays within one cell of its own | A strand may run for several cells before closing | The intersection search and the render halo both size their lattice window from the actual geometry |

## Interlacing

Over/under comes from checkerboard-colouring the faces of the arrangement. Two
faces sharing an edge get opposite colours, so the four sectors around every
crossing alternate, and picking the over-strand by the colour of one fixed sector
alternates along every strand automatically — the standard construction of an
alternating diagram from a four-valent graph.

Because every vertex has even degree, such a colouring is guaranteed to exist in
the plane. It need not be periodic on the base cell, so the colouring is solved
in the covering space with a lattice parity (`weavePhase`); the four candidate
parities are tried in turn. A failure when all degrees are even is a real defect
and throws. Arrangements with loose ends have no alternating weave to find and
fall back to a stable arbitrary choice.

## Adding a design

Add a scaffold builder to `src/geometry/tiling.ts` and a definition naming it,
its source, and a contact-angle range. If a candidate genuinely needs a
construction idea beyond these two, that is a kernel extension and a scope
decision — not a new branch in the compiler.
