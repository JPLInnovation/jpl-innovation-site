/**
 * Every logo file on the site, rendered from the vector logo (src/assets/intro/jpl-logo.svg: the traced wordmark and the
 * badge drawn as clean geometry by scripts/build-badge.mjs) in the site's palette (the redesign spec, section 4).
 * When the palette changes, change PALETTE below and run this again: every logo follows.
 *
 *     node scripts/make-logo-theme.mjs
 *
 * Writes public/assets/jpl-logo-{dark,light}.png (2x, 1374 x 496) and -480.webp (the header, the studio's wall, the
 * desk badge, the member badges), public/favicon.png (64) and public/apple-touch-icon.png (180).
 *   Wordmark  dark: "JPL" paper, "INNOVATION" yellow; light: navy and a deep gold that reads on paper.
 *   Badge     the same in both: a navy disc, cream monitor and stand, deep navy waves and wrench, a yellow ring.
 * The intros take the same colours from CSS (IntroSplash.astro, DroneSplash.astro).
 */
import { readFileSync } from "node:fs";
import sharp from "sharp";

const BADGE = { disc: "#071038", deep: "#1B2D6E", light: "#FFFAE6", accent: "#F5D042" };
const PALETTE = {
	dark: { jpl: "#F2EEDF", word: "#F5D042", ...BADGE },
	light: { jpl: "#0A174E", word: "#A98500", ...BADGE },
};
// The artwork's colour codes in the vector file, and which role each one plays.
const ROLES = { "#D6D6D6": "jpl", "#0E1B2C": "jpl", "#0CBDDC": "word", "#071F23": "disc", "#0D3F4D": "deep", "#ECF5F8": "light", "#109DC0": "accent" };
// Parts that only exist for the intro's animation (glows, outlines being drawn, the light sweep): left out of the stills.
const ANIMATION_ONLY = ["jl-screen-glow", "jl-bezel-line", "jl-frame-line", "jl-wrench-metal", "jl-cursor", "jl-sweep", "jl-jpl-ink"];

const source = readFileSync("src/assets/intro/jpl-logo.svg", "utf8");
const [vx, vy, vw, vh] = source.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);

function still(theme) {
	let svg = source;
	for (const id of ANIMATION_ONLY) svg = svg.replace(new RegExp(`(<[a-z]+ id="${id}")`), '$1 opacity="0"');
	for (const [code, role] of Object.entries(ROLES)) svg = svg.split(code).join(PALETTE[theme][role]);
	return Buffer.from(svg);
}

for (const theme of ["dark", "light"]) {
	const png = await sharp(still(theme), { density: 72 * 4 }).resize(vw * 2, vh * 2).png().toBuffer();
	await sharp(png).toFile(`public/assets/jpl-logo-${theme}.png`);
	await sharp(png).resize(480).webp({ quality: 92 }).toFile(`public/assets/jpl-logo-${theme}-480.webp`);
	console.log(`jpl-logo-${theme}: ${vw * 2} x ${vh * 2}, and 480 wide`);
}

// The badge alone: its ring's box, centred on the badge (610.9, 163.9 in the logo's coordinates, outer radius ~123).
const scale = 4;
const big = await sharp(still("dark"), { density: 72 * scale }).resize(vw * scale, vh * scale).png().toBuffer();
const r = 124;
const box = { left: Math.round((610.9 - r - vx) * scale), top: Math.round((163.9 - r - vy) * scale), width: 2 * r * scale, height: 2 * r * scale };
const badge = await sharp(big).extract(box).png().toBuffer();
await sharp(badge).resize(64, 64).png().toFile("public/favicon.png");
await sharp(badge).resize(180, 180).png().toFile("public/apple-touch-icon.png");
console.log("favicon.png 64, apple-touch-icon.png 180");
