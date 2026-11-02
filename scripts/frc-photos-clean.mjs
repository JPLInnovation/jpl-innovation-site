/**
 * Cleans the FRC photos: less noise, larger. Reads assets-src/frc-photos/edited/ (the warm-graded photos), and for each:
 * two light median passes (grain and compression speckle), a 1.8x Lanczos upscale, a gentle sharpen to bring edges back
 * (kept low: the earlier pass's stronger sharpening was what made the grain visible), then WebP q80. Writes the result
 * back to edited/ and to public/assets/frc/ with its 640-wide copy (made from the cleaned photo).
 *
 *   node scripts/frc-photos-clean.mjs
 *
 * Run it ONCE per grade: it reads edited/ and overwrites it, so a second run would denoise twice. To redo from scratch,
 * restore edited/ from git (or re-grade from original/), then run it again.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const EDITED = "assets-src/frc-photos/edited";
const PUBLIC = "public/assets/frc";
const SCALE = 1.8;

const files = (await readdir(EDITED)).filter((f) => f.endsWith(".webp"));
let before = 0;
let after = 0;
for (const file of files) {
	const input = await readFile(`${EDITED}/${file}`);
	const { width } = await sharp(input).metadata();
	const big = await sharp(input)
		.median(3)
		.median(3)
		.resize({ width: Math.round(width * SCALE), kernel: "lanczos3" })
		.sharpen({ sigma: 0.9, m1: 0.6, m2: 0.3 })
		.webp({ quality: 80 })
		.toBuffer();
	const small = await sharp(big).resize({ width: 640, kernel: "lanczos3" }).webp({ quality: 80 }).toBuffer();
	await writeFile(`${EDITED}/${file}`, big);
	await writeFile(`${PUBLIC}/${file}`, big);
	await writeFile(`${PUBLIC}/${file.replace(".webp", "-640.webp")}`, small);
	before += input.length;
	after += big.length;
}
console.log(`${files.length} photos: ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB`);
