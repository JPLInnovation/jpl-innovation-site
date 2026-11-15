"""
The JPL Innovation logo in the site's palette (docs/superpowers/specs/2026-11-15-classic-redesign-design.md, section 4),
re-rendered from the original artwork (public/assets/JPL_INNOVATION.jpg, a transparent PNG despite the name).
When the palette changes, change the colours below and run this again: every logo on the site comes from it.

    python scripts/make-logo-theme.py

Writes public/assets/jpl-logo-{dark,light}.png and their 480 px WebP copies (the header, the studio's wall, the desk
badge, the member badges), public/favicon.png (64) and public/apple-touch-icon.png (180).

    Wordmark  "JPL" and "INNOVATION" in the theme's ink and accent (the artwork's grey and cyan letters).
    Badge     the same in both themes: every pixel of the artwork's badge is a mix of its dark, white and cyan, so it
              is remixed from the disc navy, cream and yellow, which keeps the soft edges.
The intro's vector logo (src/assets/intro/jpl-logo.svg) takes the same colours from CSS in IntroSplash.astro.
"""

from PIL import Image

PALETTE = {
    "dark": {"jpl": (242, 238, 223), "word": (245, 208, 66)},  # paper, brand yellow
    "light": {"jpl": (10, 23, 78), "word": (169, 133, 0)},  # navy, a deep gold that reads on paper
}
DISC = (7, 16, 56)  # #071038
CREAM = (255, 250, 230)
YELLOW = (245, 208, 66)  # #F5D042
BADGE_FROM = 0.635  # the share of the width where the badge starts (src/components/Logo.astro)

clamp = lambda x: min(1.0, max(0.0, x))


def render(theme):
    src = Image.open("public/assets/JPL_INNOVATION.jpg").convert("RGBA")
    # Trimmed to (49, 40, 736, 288), 687 x 248: exactly the intro's vector logo's view box (src/assets/intro/jpl-logo.svg,
    # "49 40 687 248"), so the intro lands on the header's logo without a jump. Alpha above 8 is the visible edge.
    box = src.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    assert box == (49, 40, 736, 288), box
    src = src.crop(box)
    w, h = src.size
    px = src.load()
    assert px is not None
    jpl, word = PALETTE[theme]["jpl"], PALETTE[theme]["word"]
    # "JPL" and "INNOVATION" are told apart by position (the first gap of empty columns after "JPL"), not by colour:
    # the letters' soft edges carry little colour and would otherwise take the other word's ink as a fringe.
    filled = [any(px[x, y][3] > 40 for y in range(h)) for x in range(w)]
    first = filled.index(True)
    x = first
    while x < w and not (not filled[x] and x - first > 60):
        x += 1
    word_from = x
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if not a:
                continue
            if x < w * BADGE_FROM:
                out = jpl if x < word_from else word
            else:
                cyan = clamp((g - r - 70) / 80)
                white = clamp((r - 20) / 210) * (1 - cyan)
                dark = clamp(1 - white - cyan)
                out = tuple(round(DISC[n] * dark + CREAM[n] * white + YELLOW[n] * cyan) for n in range(3))
            px[x, y] = (*out, a)
    return src


for theme in ("dark", "light"):
    im = render(theme)
    im.save(f"public/assets/jpl-logo-{theme}.png", optimize=True)
    small = im.resize((480, round(im.height * 480 / im.width)), Image.Resampling.LANCZOS)
    small.save(f"public/assets/jpl-logo-{theme}-480.webp", "WEBP", quality=92, method=6)
    print("wrote", theme, im.size, small.size)
    if theme == "dark":
        badge = im.crop((round(im.width * BADGE_FROM), 0, im.width, im.height))
        box = badge.getchannel("A").getbbox()
        assert box
        badge = badge.crop(box)
        side = max(badge.size)
        square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        square.paste(badge, ((side - badge.width) // 2, (side - badge.height) // 2))
        square.resize((64, 64), Image.Resampling.LANCZOS).save("public/favicon.png", optimize=True)
        square.resize((180, 180), Image.Resampling.LANCZOS).save("public/apple-touch-icon.png", optimize=True)
        print("wrote favicon.png, apple-touch-icon.png")
