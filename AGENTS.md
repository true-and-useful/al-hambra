# Working agreement

- Keep the application client-only and dependency-light.
- Treat periodic topology, strand continuation, and crossing assignments as geometry contracts, not renderer guesses.
- Use the live SVG as the source for SVG and PNG export.
- Do not add analytics, accounts, random generation, fabrication claims, or design-specific compiler branches.
- Run `npm run typecheck`, `npm test`, `npm run build`, and relevant Playwright tests before committing.
- Preserve mobile browser zoom and 44 px touch targets.
