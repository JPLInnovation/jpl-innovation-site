// Builds logo variants from public/assets/JPL_INNOVATION.jpg (a transparent PNG despite the name).
// Run with: node scripts/make-logo-assets.mjs
//  - jpl-logo-dark.png: the logo trimmed to its visible edges (for the dark theme)
//  - jpl-logo-light.png: same, with the silver "JPL" letters recoloured navy so they read on the light theme
//  - favicon.png / apple-touch-icon.png: the round emblem on its own
import sharp from "sharp";

const src = "public/assets/JPL_INNOVATION.jpg";
const INK = [14, 27, 44];

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;

// Find where the emblem starts: the first column after the text with solid pixels taller than the text.
const columnHeight = (x) => {
	let n = 0;
	for (let y = 0; y < height; y++) if (data[(y * width + x) * 4 + 3] > 128) n++;
	return n;
};
let emblemLeft = width;
for (let x = Math.round(width * 0.5); x < width; x++) {
	if (columnHeight(x) > height * 0.5) {
		emblemLeft = x;
		break;
	}
}
// That column is inside the circle; walk left to the gap between the wordmark and the emblem.
while (emblemLeft > 0 && columnHeight(emblemLeft - 1) > 0) emblemLeft--;

// Light variant: recolour grey (unsaturated) pixels left of the emblem; the cyan wordmark and the emblem stay as they are.
const light = Buffer.from(data);
for (let y = 0; y < height; y++) {
	for (let x = 0; x < emblemLeft; x++) {
		const i = (y * width + x) * 4;
		const [r, g, b] = [light[i], light[i + 1], light[i + 2]];
		const saturation = Math.max(r, g, b) - Math.min(r, g, b);
		if (light[i + 3] > 0 && saturation < 30) {
			// Keep a hint of the original shading so the 3D bevel still reads.
			const shade = (Math.max(r, g, b) - 215) * 0.35;
			light[i] = Math.max(0, Math.min(255, INK[0] + shade));
			light[i + 1] = Math.max(0, Math.min(255, INK[1] + shade));
			light[i + 2] = Math.max(0, Math.min(255, INK[2] + shade));
		}
	}
}
const lightPng = await sharp(light, { raw: { width, height, channels: 4 } }).png().toBuffer();
await sharp(lightPng).trim().png().toFile("public/assets/jpl-logo-light.png");
await sharp(src).trim().png().toFile("public/assets/jpl-logo-dark.png");

// Emblem crop: bounding box of solid pixels right of emblemLeft.
let top = height, bottom = 0, right = emblemLeft;
for (let y = 0; y < height; y++) {
	for (let x = emblemLeft; x < width; x++) {
		if (data[(y * width + x) * 4 + 3] > 16) {
			top = Math.min(top, y);
			bottom = Math.max(bottom, y);
			right = Math.max(right, x);
		}
	}
}
const size = Math.max(right - emblemLeft, bottom - top) + 1;
const emblem = sharp(src).extract({ left: emblemLeft, top, width: Math.min(size, width - emblemLeft), height: Math.min(size, height - top) });
const buf = await emblem.png().toBuffer();
await sharp(buf).resize(64, 64, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile("public/favicon.png");
await sharp(buf)
	.resize(180, 180, { fit: "contain", background: { r: 11, g: 20, b: 32, alpha: 1 } })
	.flatten({ background: "#0b1420" })
	.png()
	.toFile("public/apple-touch-icon.png");

console.log({ width, height, emblemLeft, emblem: { top, bottom, right, size } });
