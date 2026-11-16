"""
The arena behind the KitBot in the FRC chapter (src/lib/three/models/frc-chapter.ts): the team's own photograph of the
Pacific Coliseum in Vancouver (public/assets/frc/g7.webp: the stands, the black drapes, the teams at the field's edge),
blurred soft and darkened toward the edition's near-black, as a strip that wraps round the field.

    python scripts/bake-stands.py        writes public/chapter/frc/stands.webp

The strip, bottom to top (the chapter maps it onto a cylinder 6 m tall): the drape at the field's edge, the people and
the banners, the lower stands, then (above the lamps the chapter draws) a fade into the page's own near-black (#070b12) so the strip's top meets the page.
"""
import os
from PIL import Image, ImageEnhance, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public", "assets", "frc", "g7.webp")
OUT = os.path.join(ROOT, "public", "chapter", "frc", "stands.webp")

W, H = 1024, 384
BG = (7, 11, 18)  # the edition's near-black, --frc-k
# Where the photograph sits in the strip (rows, from the top; 64 rows a metre): from 3.1 m down to 0.8 m, the arena's
# lamps (drawn in 3D) just above it, the fade to BG above them, the drape below.
TOP, BOTTOM = 186, 333
CROP = (0, 300, 2520, 1250)  # the lower stands, the banners and the people at the field's edge (original pixels)

photo = Image.open(SRC).convert("RGB").crop(CROP).resize((W, BOTTOM - TOP), Image.LANCZOS)
photo = photo.filter(ImageFilter.GaussianBlur(6))
photo = ImageEnhance.Color(photo).enhance(0.7)
photo = ImageEnhance.Brightness(photo).enhance(0.55)

strip = Image.new("RGB", (W, H), BG)
strip.paste(photo, (0, TOP))
# The drape along the bottom: the photograph's own dark, a little darker still toward the floor.
drape = Image.new("RGB", (W, H - BOTTOM), (10, 13, 19))
strip.paste(drape, (0, BOTTOM))
# Soft joins: the top of the photograph fades into BG, its bottom into the drape.
mask = Image.new("L", (W, H), 0)
px = mask.load()
for y in range(H):
	if y < TOP:
		a = 0
	elif y < TOP + 40:
		a = int(255 * ((y - TOP) / 40) ** 1.4)
	elif y < BOTTOM - 26:
		a = 255
	elif y < BOTTOM:
		a = int(255 * (BOTTOM - y) / 26)
	else:
		a = 0
	for x in range(W):
		px[x, y] = a
base = Image.new("RGB", (W, H), BG)
base.paste(drape, (0, BOTTOM))
out = Image.composite(strip, base, mask)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
out.save(OUT, "WEBP", quality=72, method=6)
print(OUT, os.path.getsize(OUT), "bytes")
