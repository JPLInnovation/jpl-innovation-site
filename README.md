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

## Where things live

- `src/content/work/*.md`, `src/content/members/*.md` — project cards and member profiles (`order` sets project order).
- `src/data/frc.ts`, `src/data/drone.ts` — everything on the FRC and drone pages.
- `src/components/ui/` — shadcn components (add more with `npx shadcn@latest add <name>`) and `glyph-portal.tsx`.
- `src/components/home-portal.tsx` — the home page "JPL" scroll-through hero.
- `src/styles/global.css` — colour tokens (light + dark), fonts, chart colours.
