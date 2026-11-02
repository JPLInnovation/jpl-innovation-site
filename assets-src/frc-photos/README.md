# FRC Team 10951 photos

All 64 images from the team's season page (Jayden's FRC artifact, claude.ai/artifact/UXN3oc6qFvieyViYq9dwuj),
exactly as published there: WebP, no EXIF/XMP/IPTC metadata. Captions and alt text live in
`src/text/projects/frc.ts` (`frcPhotos`).

## Folders

- `original/` – the 64 untouched images, exactly as published. Never edited; keep as the source of truth.
- `edited/` – the 62 photos after the warm colour grade, denoise, clarity, texture and sharpening
  (the two `mark-*` logos are not edited, so they exist only in `original/`).

**The website uses the edited versions.** `public/assets/frc/` holds the files the site serves: each `edited/` photo
(identical copy, WebP q80) plus a 640-wide `-640.webp` of it. The two `mark-*` logos are not used, since the page
already has the team logo. To change the look, re-run the grade from `original/` and overwrite `edited/` and
`public/assets/frc/` – never edit `original/`.

| Prefix | What |
|---|---|
| `b0`–`b6` | Build season, Sept 2025 – Feb 2026 |
| `ev-van`, `ev-ist`, `h1`, `h3`, `h4`, `g1`–`g10` | The two 2026 regionals (Vancouver, Istanbul) and the pits |
| `robot`, `ws` | The swerve chassis; safety glasses on |
| `st0`–`st6` | The workshop |
| `rk0`–`rk5` | RoboKids (young children's faces are covered by the team) |
| `w1-*`–`w7-*` | Preseason 2026, week by week |
| `team` | The 2026–27 team |
| `mark-560`, `mark-96` | The team mark |
