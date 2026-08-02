# Pattern Instrument

A quiet, tactile web instrument for exploring curated Islamic geometric ornament. It opens on a finished pattern; drag the artwork to move through a deliberately bounded family of coherent states.

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

## What v1 promises

- Three or more source-documented starting designs
- Seamless periodic SVG geometry with consistent interlacing
- Curated morph and material controls
- Mobile, pointer, and keyboard interaction
- Living URL state plus appearance-grade SVG and PNG export

SVG output is intended for visual use. It is not a fabrication-ready cut file.

The automated suite covers Chromium desktop and Android-shaped mobile viewports. Physical iOS Safari and Android Chrome gesture-feel checks remain required before calling the release final; see [docs/QA.md](docs/QA.md).
