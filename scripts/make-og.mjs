/**
 * The link-preview picture (public/assets/og-studio.jpg, 1200 x 630): the studio from the home page's first scene
 * (public/studio/scenes/title.webp, see scripts/studio-stills.py) under the logo. Run again after the stills change:
 *
 *     node scripts/make-og.mjs
 *
 * Uses sharp, which ships with Astro. No new dependencies.
 */
import sharp from "sharp";

const W = 1200;
const H = 630;
const room = await sharp("public/studio/scenes/title.webp").resize(W, H, { fit: "cover", position: "bottom" }).toBuffer();
const logo = await sharp("public/assets/jpl-logo-dark-480.webp").resize({ width: 700 }).toBuffer();
const logoMeta = await sharp(logo).metadata();
// A navy wash from the top (solid over the wall's own logo), so the big logo reads and the desk shows below it.
const wash = Buffer.from(
	`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050a1f" stop-opacity="1"/><stop offset="0.42" stop-color="#050a1f" stop-opacity="0.98"/><stop offset="0.6" stop-color="#050a1f" stop-opacity="0.55"/><stop offset="1" stop-color="#050a1f" stop-opacity="0"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/></svg>`,
);
await sharp(room)
	.composite([
		{ input: wash },
		{ input: logo, left: Math.round((W - 700) / 2), top: Math.round(150 - (logoMeta.height ?? 200) / 2) },
	])
	.jpeg({ quality: 86, mozjpeg: true })
	.toFile("public/assets/og-studio.jpg");
console.log("public/assets/og-studio.jpg");
