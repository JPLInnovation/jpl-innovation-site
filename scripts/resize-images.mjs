// Makes smaller WebP copies of the large images in public/assets, so pages download the size they show.
// Run with: node scripts/resize-images.mjs   (re-run after replacing one of these images)
// The originals stay: "open full size" links and the 3D textures use them.
// Widths must match src/lib/images.ts (srcset) and src/components/Logo.astro.
import sharp from "sharp";

// The last width of each photo is its full-size WebP copy (used for the largest srcset entry and 3D textures).
const jobs = {
	"FRC.JPG": [640, 1280, 1920],
	"FRCnew.jpg": [640, 1280, 1920],
	"10951.jpg": [160, 400, 764],
	"Jayden_pfp.jpg": [160, 480, 900],
	"jpl-logo-dark.png": [480],
	"jpl-logo-light.png": [480],
};

for (const [file, widths] of Object.entries(jobs)) {
	for (const width of widths) {
		const out = `public/assets/${file.replace(/\.[^.]+$/, "")}-${width}.webp`;
		// Logos keep crisp edges and transparency; photos use normal lossy quality.
		const webp = file.endsWith(".png") ? { quality: 90, alphaQuality: 100 } : { quality: 78 };
		const info = await sharp(`public/assets/${file}`).resize({ width, withoutEnlargement: true }).webp(webp).toFile(out);
		console.log(out, `${info.width}x${info.height}`, `${Math.round(info.size / 1024)} KB`);
	}
}
