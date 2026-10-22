# JPL Innovation website

Astro + React + Tailwind CSS v4 + shadcn/ui. Deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.

Use **npm** (not bun): `package-lock.json` holds the esbuild/rollup overrides.

| Command           | Action                                     |
| :---------------- | :----------------------------------------- |
| `npm install`     | Install dependencies                       |
| `npm run dev`     | Dev server at `localhost:4321`             |
| `npm run build`   | Build the site to `./dist/`                |
| `npm run preview` | Preview the build                          |
| `npx astro check` | Type-check `.astro`, `.ts` and `.tsx` files |

## Changing the words

**All the text on the site is in [`src/text/`](src/text/README.md)**, one file per page (`home.ts`, `work.ts`, `members.ts`, `projects/frc.ts`...). Its README has a table of which file holds which part of the site.

## Where things live

- `src/text/` — every word on the site (see above). Project cards: `src/text/projects/*.md` (`order` sets project order). Member profiles: `src/text/members/*.md`.
- `src/pages/` — page layouts (one file per page); `src/components/` — the building blocks they use.
- `src/components/ui/` — shadcn components (add more with `npx shadcn@latest add <name>`) and `glyph-portal.tsx`.
- **The home page is a 3D studio**: `src/components/Studio.astro` (scroll, text panels, ruler, loop, read mode), `src/lib/studio/` (camera, room, stations, lights, ambience). The Work page is its project wall (`src/components/WorkWall.astro`). How they work, the quality tiers and the dev hooks: [`SHOWCASE.md`](SHOWCASE.md); design direction: [`docs/design/direction.md`](docs/design/direction.md).
- `src/components/home-portal.tsx` — the earlier "JPL" scroll-through hero (no longer used; the studio replaced it).
- `src/components/EmailDialog.astro` + `EmailButton.astro` — the one native email pop-up; `SettingsPanel.astro` — Theme / Motion / Sound / 3D quality (saved in `localStorage`, `src/lib/prefs.ts`).

## Pictures made by scripts (re-run after changing the room)

| Script | Makes |
| :-- | :-- |
| `python scripts/studio-stills.py` | `public/studio/scenes/*.webp`, read mode's picture of each studio scene |
| `python scripts/studio-screens.py` | the build guide and site screenshots shown on the monitor and laptop in the studio |
| `node scripts/make-og.mjs` | `public/assets/og-studio.jpg`, the link-preview picture |
| `python scripts/showcase-stills.py` | the drone and robot showcases' stills |
| `node scripts/measure-contrast.mjs` + `python scripts/measure-contrast.py` | not a picture: measures text contrast over the 3D scene and over photos (how: `SHOWCASE.md`) |

Each needs `npm run build && npx astro preview` running (the scripts say how).
- `src/styles/global.css` — colour tokens (light + dark), fonts, chart colours.
