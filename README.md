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
- `src/components/home-portal.tsx` — the home page "JPL" scroll-through hero.
- `src/styles/global.css` — colour tokens (light + dark), fonts, chart colours.
