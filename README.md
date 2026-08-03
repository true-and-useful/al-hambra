# Pattern Instrument

A quiet, tactile web instrument for exploring curated Islamic geometric ornament. It opens on a finished pattern; drag the artwork to move through a deliberately bounded family of coherent states.

## How the patterns are made

Each design is a periodic polygon **scaffold** plus one **contact angle**, using
Hankin's polygons-in-contact construction. The scaffold says which polygons meet;
the contact angle says how the strapwork leaves each shared edge. Dragging varies
that angle across a curated, validated range. Star points, rosette rings, and
interlacing all fall out of those two facts — no part of the kernel knows which
design it is drawing.

See [docs/recipe-vocabulary.md](docs/recipe-vocabulary.md) for the construction
and [docs/PATTERNS.md](docs/PATTERNS.md) for the collection and its provenance.

## Development

```sh
npm install
npm run dev
```

Before committing:

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Run `npm run build` before `npm run test:e2e` — the e2e suite previews the built
output rather than the dev server.

## What v1 promises

- Three or more source-documented starting designs
- Seamless periodic SVG geometry with consistent interlacing
- Curated morph and material controls
- Mobile, pointer, and keyboard interaction
- Living URL state plus appearance-grade SVG and PNG export

SVG output is intended for visual use. It is not a fabrication-ready cut file.

The automated suite covers Chromium desktop and Android-shaped mobile viewports. Physical iOS Safari and Android Chrome gesture-feel checks remain required before calling the release final; see [docs/QA.md](docs/QA.md).
