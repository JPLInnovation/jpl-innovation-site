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
| `python scripts/audit-security.py` | code loaded from another site, text run as code, HTML written from script, unsafe new-tab links |

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

## Security rules (checked by `scripts/audit-security.py`)

The site is static files on GitHub Pages: there is no server, database or login to break into. A page can only be
changed by someone who can push to the repository, or by code the pages themselves load. So:

1. **Nothing a visitor types or links to becomes markup.** Write text with `textContent`. Where HTML must be built in
   script (the router console, the Lifetime demo), every value from outside goes through `esc()`.
2. **No code from other sites.** No `<script>`, `<iframe>` or stylesheet from another host, no `fetch` to another
   host, no analytics or widget snippets pasted in. Fonts, models and pictures are served by the site.
3. **Text never becomes code:** no `eval`, `new Function`, `document.write`, string timers.
4. **The address is data:** compare `location.hash` and `location.pathname` to known values; never decode them into
   the page or build selectors or HTML from them. Values from `localStorage` are matched against a fixed list.
5. **Outside links** that open a new tab carry `rel="noopener noreferrer"`.
6. **Dependencies:** none added without need; `package-lock.json` is committed; never run an install script from a
   package that is not already allowed in `package.json` (`allowScripts`).
7. **Secrets:** no tokens, passwords or keys in the repository, the pages or the commit messages.

What protects the live site itself is the GitHub account, not the code: two-factor sign-in on every account that can
push, as few collaborators as possible, and no long-lived access tokens lying about.

## 3. Duplicates

None known (16 Nov 2026). Folded in so far: the decoding headline's letters (one function, `src/lib/look/decode.ts`,
used by both `work/DecodeHeading.astro` and the drone pages' `drone-motion.ts`); the parts total
(`src/lib/look/tally.ts`); the hopper swing's check (a test beside `extension-swing.ts`).

Not duplicates, though their names are close: `work/Plate.astro` is one picture in a frame that opens and lights up;
`drone/SheetPlate.astro` is a whole drawing sheet (picture, notes and title block on the night blueprint). The drone
pages' headline painter (`drone-motion.ts`) and the kit's (`DecodeHeading.astro`) paint differently on purpose (the
3D chapter is skipped on the drone page); they share the letters, and each claims its own attribute
(`data-drone-decode`, `data-decode`).

## 4. What is not in the repo's hands

- `jpl-innovation-site/` and `website-old-main/` (old copies of the site, untracked, about 470 MB) sit in the project
  folder. They are excluded from the type check. Deleting them is the owner's call: they are not in git.
- Removing a dependency changes `package-lock.json`: use `npm uninstall <name> --ignore-scripts` and a build, never a
  hand edit (`tw-animate-css` went this way on 16 Nov 2026: nothing used it).
- Local branches that are merged (`git branch --merged classic-redesign`) can be deleted with `git branch -d`.
