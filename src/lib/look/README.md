# src/lib/look

The redesign's pure logic: small modules with no imports from Astro, Vite aliases (`@/`) or the DOM, so `npm test`
(Node's own `node --test`, which runs TypeScript directly on Node 24) can test them. Anything that touches the page
lives in `src/scripts/` and calls these.
