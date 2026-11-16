# The cleanup pass

Every change to the site ends with this pass, before it is called done. It keeps the code from piling up: nothing
unused, nothing duplicated, nothing that only an earlier design needed.

## 1. Run the gate

    npm run build
    npm run tidy

`npm run tidy` runs three things and fails if any does:

| Step | What it catches |
|---|---|
| `astro check` | type errors, unused variables and imports (0 errors is the bar) |
| `npm test` | broken logic in `src/lib/` |
| `python scripts/audit-unused.py` | source files nothing imports; files in `public/` nothing references |

Then the page checks for whatever the change touched (`python scripts/check-look.py`, and the page's own
`scripts/check-<page>.py`). They need the build.

## 2. Look at what the change left behind

For the files the change touched, ask each question and act on it in the same change:

1. **Replaced something?** Delete what it replaced: the old component, its styles, its words in `src/text/`, its
   pictures, its checks. A file kept "in case" is deleted; git keeps it.
2. **Wrote something that already exists?** Search first (`src/lib/look/` for logic, `src/components/work/` for the
   shared page pieces, `src/styles/global.css` for classes and tokens). Two copies of one idea become one.
3. **Added a class, a token, a data attribute or a script hook?** Check something uses it, and that no other script
   claims the same name (`data-words`, `data-fit`, `data-decode`, `data-count` are taken: see `src/scripts/motion.ts`).
4. **Added a picture?** WebP, sized for where it shows, and referenced by name (or its folder listed in `DYNAMIC` in
   `scripts/audit-unused.py` when the name is built in code).
5. **Added a listener, a timer, an observer or an animation loop?** It stops when the page is swapped out
   (`astro:before-swap`) and pauses off screen.
6. **Comments still true?** A comment that describes the old behaviour is fixed or removed.

## 3. Known duplicates to fold in when their files are next edited

These work today and don't clash; each is one idea in two places.

| Idea | Copies | Fold into |
|---|---|---|
| The decoding headline | `src/components/drone/decode.ts` + `drone-motion.ts`; `src/lib/look/decode.ts` + `work/DecodeHeading.astro` | `src/lib/look/decode.ts` and `DecodeHeading` |
| The plate that opens | `src/components/drone/Plate.astro`; `src/components/work/Plate.astro` | `work/Plate.astro` |
| The parts total | `src/components/drone/tally.ts` | move beside the other pure logic in `src/lib/look/` |
| A logic check outside the test run | `scripts/check-extension-swing.mjs` | a `*.test.ts` beside `extension-swing.ts` |

## 4. What is not in the repo's hands

- `jpl-innovation-site/` and `website-old-main/` (old copies of the site, untracked, about 470 MB) sit in the project
  folder. They are excluded from the type check. Deleting them is the owner's call: they are not in git.
- `tw-animate-css` is installed and imported but no class of it is used. Removing a dependency changes
  `package-lock.json`, so do it with `npm uninstall tw-animate-css` and a build, not by hand.
- Local branches that are merged (`git branch --merged classic-redesign`) can be deleted with `git branch -d`.
