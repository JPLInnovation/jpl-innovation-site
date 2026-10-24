# JPL Innovation website

Astro 6 + React islands + Tailwind CSS v4 + three.js. The home page is a 3D studio; every other page is ordinary HTML
with a little 3D where it helps. Deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`
(only in the repository named `*.github.io`; copies of the code elsewhere just build).

Use **npm** (not bun): `package-lock.json` holds the esbuild/rollup overrides.

| Command           | Action                                      |
| :---------------- | :------------------------------------------ |
| `npm install`     | Install dependencies                        |
| `npm run dev`     | Dev server at `localhost:4321`              |
| `npm run build`   | Build the site to `./dist/`                 |
| `npm run preview` | Preview the build                           |
| `npx astro check` | Type-check `.astro`, `.ts` and `.tsx` files |

## Changing the words

**All the text on the site is in [`src/text/`](src/text/README.md)**, one file per page (`home.ts`, `work.ts`,
`members.ts`, `projects/frc.ts`...). Its README has a table of which file holds which part of the site.

## Where things live

```
src/
  text/         every word on the site (+ projects/*.md, members/*.md: the cards and the people)
  pages/        one file per page (index.astro is the studio; work.astro the project wall)
  components/   the building blocks (Studio.astro, WorkWall.astro, SiteHeader, EmailDialog, ...); ui/ = shadcn parts
  layouts/      BaseLayout.astro (head, header, footer, intro splash, the email pop-up)
  lib/
    studio/     the home page's 3D room: engine (camera), room, stations, props, ambience, lights, scenes (shots), panels
    three/      the shared 3D stage (stage.ts: tiers, safety nets), models/ (drone, KitBot, badges, network, work wall)
    prefs.ts    Settings: theme, motion, sound, 3D quality (saved in localStorage)
  scripts/      starfield background and the page intros
  styles/       global.css: colour tokens (light + dark), glass, fonts
public/         files served as they are: assets/ (photos, logos), fonts/ (the sketchbook's handwriting), studio/ (scene renders,
                screens), showcase/,
                work/drone/ (the build guide, 3D layout and camera POV pages, each a single HTML file)
scripts/        tools that make files (below); nothing here runs in the browser
docs/           SHOWCASE.md (how the 3D works, tiers, safety nets, accessibility checks), DEMO.md (a checklist for
                presenting the site), design/direction.md, audits/ (the September 2026 audit and its screenshots)
```

The Work page is the studio's project wall at full size (`WorkWall.astro` + `lib/three/models/work-wall.ts`); read mode
(phones, reduced motion, no WebGL, no JavaScript, or Settings) is the same words as one ordinary page. More in
[`docs/SHOWCASE.md`](docs/SHOWCASE.md); design direction and its honesty rules in
[`docs/design/direction.md`](docs/design/direction.md).

## Tools in `scripts/`

Run from the repo root. The ones marked * need `npm run build && npx astro preview` running (they say how).

| Script | Does |
| :-- | :-- |
| `python scripts/studio-stills.py` * | `public/studio/scenes/*.webp`: read mode's picture of each studio scene |
| `python scripts/studio-screens.py` * | `public/studio/screens/` and `src/lib/studio/screens.json`: the scrollable pages on the studio's monitor, laptop and phone |
| `node scripts/make-og.mjs` | `public/assets/og-studio.jpg`: the link-preview picture (from the first scene's still) |
| `python scripts/showcase-stills.py` * | the drone and robot showcases' stills |
| `node scripts/measure-contrast.mjs` + `python scripts/measure-contrast.py` * | measures text contrast over the 3D scene and photos |
| `node scripts/resize-images.mjs` | WebP copies of the big photos (widths match `src/lib/images.ts`) |
| `node scripts/make-logo-assets.mjs` | logo variants, favicon and touch icon from `public/assets/JPL_INNOVATION.jpg` |
| `node scripts/build-*.mjs` | the animated logo SVGs for the page intros |
| `python scripts/kitbot-cad.py`, `node scripts/f450-cad.mjs` | reduce the CAD exports to the files the 3D models load |
| `node scripts/import-drone-pages.mjs`, `import-camera-pov.mjs` | bring the build guide, 3D layout and Camera POV pages in as single HTML files |

## Deploying, and going back

`main` deploys itself. Branches worth knowing: `documentary/phase-*` (the redesign, phase by phase),
`rollback/known-good-2026-10-22` (the last state tested before the final optimisation pass) and
`archive/old-bootstrap-site` (the folder `website-old-main/`, an earlier Bootstrap site, kept out of `main`).
To undo a change: `git revert <commit>` and push; to see an old file: `git show rollback/known-good-2026-10-22:<path>`.
