/**
 * The photo edit: every photograph on the site, from its untouched source, given one look: a light grade (a little
 * more colour and contrast), a clean resize, and an unsharp mask. No median denoise: it smeared the faces and the
 * small parts into a painted look, which is what made the FRC photos read as blurry.
 *
 *   node scripts/photos-edit.mjs            all of them
 *   node scripts/photos-edit.mjs --frc      only the FRC photos
 *
 * FRC: assets-src/frc-photos/original/<id>.webp (never edited) -> 1.8x -> assets-src/frc-photos/edited/<id>.webp and
 * public/assets/frc/<id>.webp, with its 640-wide copy. Safe to run again: it always starts from original/.
 * Others: the photos in public/assets that src/lib/images.ts lists stay as they are (they are the sources and the
 * "open full size" files); their WebP copies are made from them with the same edit, at the widths images.ts lists.
 * Khoa's portrait: assets-src/members/khoa.jpg -> public/assets/members/khoa-768.webp.
 */
import { readdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const GRADE = { saturation: 1.06, contrast: 1.05 };

/** The edit, at `width` pixels wide. Sharpening is stronger when the photo is made larger than its source. */
async function edit(input, width, quality = 76) {
	const { width: from } = await sharp(input).metadata();
	const up = width > from;
	return sharp(input)
		.resize({ width, kernel: "lanczos3" })
		.modulate({ saturation: GRADE.saturation })
		.linear(GRADE.contrast, -255 * (GRADE.contrast - 1) * 0.1)
		.sharpen(up ? { sigma: 1.1, m1: 0.9, m2: 2.2, x1: 2 } : { sigma: 0.7, m1: 0.6, m2: 1.4, x1: 2 })
		.webp({ quality })
		.toBuffer();
}

const only = process.argv.includes("--frc") ? "frc" : "all";
let bytes = 0;

/* ---------- FRC: from original/, 1.8x, plus a 640-wide copy ---------- */
const ORIGINAL = "assets-src/frc-photos/original";
for (const file of (await readdir(ORIGINAL)).filter((f) => f.endsWith(".webp") && !f.startsWith("mark-"))) {
	const input = `${ORIGINAL}/${file}`;
	const { width } = await sharp(input).metadata();
	const big = await edit(input, Math.round(width * 1.8));
	const small = await edit(input, 640, 76);
	await writeFile(`assets-src/frc-photos/edited/${file}`, big);
	await writeFile(`public/assets/frc/${file}`, big);
	await writeFile(`public/assets/frc/${file.replace(".webp", "-640.webp")}`, small);
	bytes += big.length + small.length;
}
console.log(`FRC photos: ${(bytes / 1e6).toFixed(2)} MB`);

if (only === "all") {
	/* ---------- The other photos: WebP copies at the widths src/lib/images.ts lists ---------- */
	const jobs = {
		"FRC.JPG": [640, 1280, 1920],
		"FRCnew.jpg": [640, 1280, 1920],
		"Jayden_pfp.jpg": [160, 480, 900],
		"kitbot-back.jpg": [480, 1000],
	};
	for (const [file, widths] of Object.entries(jobs)) {
		const { width: from } = await sharp(`public/assets/${file}`).metadata();
		for (const width of widths) {
			const out = await edit(`public/assets/${file}`, Math.min(width, from), 64);
			await writeFile(`public/assets/${file.replace(/\.[^.]+$/, "")}-${width}.webp`, out);
			console.log(file, width, `${Math.round(out.length / 1024)} KB`);
		}
	}
	const khoa = await edit("assets-src/members/khoa.jpg", 768, 74);
	await writeFile("public/assets/members/khoa-768.webp", khoa);
	console.log("khoa-768", `${Math.round(khoa.length / 1024)} KB`);
}
