# JPL Innovation website

Astro 6 + React islands + Tailwind 4 + three.js. Branch `classic-redesign` holds the redesign.

- **Every change ends with the cleanup pass** in `docs/CLEANUP.md`: `npm run build`, `npm run tidy` (type check, tests,
  unused-file audit), the page checks for what changed, then remove what the change replaced. Report its result with
  the change.
- All wording lives in `src/text/` (one file per page). Never drop content or features; facts only.
- Design rules: `docs/superpowers/specs/2026-11-15-classic-redesign-design.md` and the owner's unslop list (glass,
  fades and gradients in moderation; no pills above headings, no monospace labels, no glows).
- Never push or deploy anywhere without asking.
