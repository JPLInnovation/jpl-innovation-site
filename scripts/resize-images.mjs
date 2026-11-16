// Makes smaller WebP copies of the team logo and the JPL logos in public/assets, so pages download the size they show.
// Run with: node scripts/resize-images.mjs   (re-run after replacing one of these images)
// The photographs' copies (FRC.JPG, FRCnew.jpg, Jayden_pfp.jpg, kitbot-back.jpg) are made with the photo edit by
// scripts/photos-edit.mjs.
// The originals stay for "open full size" links; pages and the 3D textures use the copies.
// Widths must match src/lib/images.ts (srcset), src/components/Logo.astro and the texture paths in
// src/lib/three/models/badges.ts and frc-robot.ts. (sharp comes with Astro.)
import sharp from "sharp";

// The last width of each photo is its full-size WebP copy (used for the largest srcset entry and 3D textures).
const jobs = {
	"10951.jpg": [160, 400, 764],
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
