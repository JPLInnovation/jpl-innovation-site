// Builds the drone page intro's footage (src/components/DroneSplash.astro) from a 1920×1080 frame of the drone
// camera's view at dusk, with a HUD burnt in:
//   → src/assets/intro/drone-footage.webp  the view with the HUD painted out (the intro draws its own live HUD)
//   → src/assets/intro/drone-sky.webp      a tiny copy, inlined as the sky behind the flying 3D drone (it shows from
//                                          the very first frame, and upscaling blurs it like a far background)
// The intro's logo is drawn by scripts/build-stacked-logo.mjs.
//
// Run:  node scripts/build-drone-intro.mjs <footage.png> [preview folder]
// The optional preview folder gets the cleaned full-size frame.
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const [footagePath, previewDir] = process.argv.slice(2);
if (!footagePath) {
	console.error("Usage: node scripts/build-drone-intro.mjs <footage.png> [preview folder]");
	process.exit(1);
}
const OUT = "src/assets/intro";
mkdirSync(OUT, { recursive: true });
if (previewDir) mkdirSync(previewDir, { recursive: true });

/* ---------- Footage: paint the burnt-in HUD out ---------- */
// Each box covers one HUD block with a few pixels to spare; it's filled from the same rows `dx` pixels to the side
// (clean sky or ground at the same height, so the vertical gradient carries on), blended in over FEATHER pixels.
const HUD = [
	{ name: "rec + cam", box: [68, 62, 378, 134], dx: 330 },
	{ name: "4G + link", box: [1615, 58, 1852, 163], dx: -260 },
	{ name: "battery", box: [68, 952, 320, 1018], dx: 270 },
	{ name: "speed + altitude", box: [1650, 952, 1852, 1018], dx: -230 },
	{ name: "horizon bracket L", box: [702, 505, 812, 523], dx: -120 },
	{ name: "crosshair", box: [932, 488, 980, 536], dx: -60 },
	{ name: "horizon bracket R", box: [1100, 507, 1211, 524], dx: 120 },
];
const FEATHER = 6;

const footage = await sharp(footagePath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = footage.info;
const px = Buffer.from(footage.data);
const src = footage.data;
for (const { box, dx } of HUD) {
	const [x0, y0, x1, y1] = box;
	for (let y = y0 - FEATHER; y <= y1 + FEATHER; y++) {
		for (let x = x0 - FEATHER; x <= x1 + FEATHER; x++) {
			const out = Math.max(x0 - x, x - x1, y0 - y, y - y1, 0); // pixels outside the box
			const a = 1 - out / (FEATHER + 1);
			const i = (y * W + x) * 3;
			const j = (y * W + x + dx) * 3;
			for (let c = 0; c < 3; c++) px[i + c] = Math.round(px[i + c] * (1 - a) + src[j + c] * a);
		}
	}
}
const clean = sharp(px, { raw: { width: W, height: H, channels: 3 } });
const footageOut = await clean.clone().resize(1600, 900, { kernel: "lanczos3" }).webp({ quality: 58, effort: 6 }).toBuffer();
writeFileSync(`${OUT}/drone-footage.webp`, footageOut);
const skyOut = await clean.clone().resize(320, 180, { kernel: "lanczos3" }).blur(0.8).webp({ quality: 50, effort: 6 }).toBuffer();
writeFileSync(`${OUT}/drone-sky.webp`, skyOut);
if (previewDir) await clean.clone().png().toFile(`${previewDir}/footage-clean.png`);
console.log(`drone-footage.webp ${(footageOut.length / 1024).toFixed(1)} KB, drone-sky.webp ${(skyOut.length / 1024).toFixed(1)} KB`);
