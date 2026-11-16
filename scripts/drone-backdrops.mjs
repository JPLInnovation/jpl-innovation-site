// Builds the simulated flight's distant ridges and the reflections (src/lib/three/flight-world.ts, used by the drone
// chapter and the studio's simulated flight) into public/chapter/drone/, offline: every ridge is drawn here as SVG
// (seeded, so the same every run), pre-blurred, and saved as WebP. Nothing is blurred live.
//
//   dusk-1..4.webp   four mountain ridges fading into fog, far to near (planes far off in the world's dusk)
//   env.webp         the reflections: Poly Haven's "Kiara 9 Dusk" (CC0, polyhaven.com/a/kiara_9_dusk), its tonemapped
//                    JPG cut to 1024 × 512 (a 256 px cube, as the studio room's: the same reflection shader) and blurred.
//                    The 5 MB original is downloaded to the system's temp folder, never into the repo.
//   flight.webp, flight-800.webp   Classic's still of the flight: not made here but from the 3D itself, by
//                    `python scripts/check-sky.py --still` (after `npm run build`).
//
// Every file must stay under 50 KB (the script stops if one doesn't).
// Run:  node scripts/drone-backdrops.mjs
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const OUT = "public/chapter/drone";
const LIMIT = 50 * 1024;
const ENV_URL = "https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/kiara_9_dusk.jpg";
mkdirSync(OUT, { recursive: true });

/** A seeded random number generator (the same layers every run). */
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const svg = (w, h, body, defs = "") => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`);
const written = [];
async function save(name, image, quality = 72) {
	const path = join(OUT, name);
	await image.webp({ quality, alphaQuality: 70, effort: 6 }).toFile(path);
	const size = statSync(path).size;
	written.push(`${name}: ${(size / 1024).toFixed(1)} KB`);
	if (size > LIMIT) throw new Error(`${name} is ${(size / 1024).toFixed(1)} KB, over the 50 KB limit`);
}

/* ---------- Four ridges into fog ---------- */
const DUSK = { W: 1280, H: 720 };
/** A ridge line: a few sine waves of different lengths, seeded. */
function ridge(i, { base, height, colour, fog }) {
	const rand = seeded(100 + i * 17);
	// Long swells for the shape, shorter ones for the crags.
	const waves = Array.from({ length: 7 }, (_, k) => ({ f: (1.2 + rand() * 2.5) * (k + 1) ** 1.35, p: rand() * Math.PI * 2, a: height / (k + 1.4) ** 1.25 }));
	let d = `M0 ${DUSK.H}`;
	for (let x = 0; x <= DUSK.W; x += 8) {
		const u = x / DUSK.W;
		const y = DUSK.H * base - waves.reduce((s, w) => s + Math.sin(u * w.f * Math.PI + w.p) * w.a, 0) - height * 0.4;
		d += ` L${x} ${y.toFixed(1)}`;
	}
	d += ` L${DUSK.W} ${DUSK.H} Z`;
	// Fog lies in the valley in front of the ridge, below its line.
	return svg(
		DUSK.W,
		DUSK.H,
		`<path d="${d}" fill="${colour}"/><rect y="${(DUSK.H * (base - 0.12)).toFixed(0)}" width="100%" height="${(DUSK.H * (1.12 - base)).toFixed(0)}" fill="url(#fog)"/>`,
		// (soft at both ends: it thickens towards the ridge's foot, then thins out in front of it)
		`<linearGradient id="fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fb4c4" stop-opacity="0"/><stop offset="0.45" stop-color="#9fb4c4" stop-opacity="${fog}"/><stop offset="1" stop-color="#9fb4c4" stop-opacity="0"/></linearGradient>`,
	);
}
const RIDGES = [
	{ base: 0.74, height: 38, colour: "#5a4a63", fog: 0.32, blur: 6 },
	{ base: 0.8, height: 46, colour: "#3a3550", fog: 0.26, blur: 4 },
	{ base: 0.87, height: 52, colour: "#1f2238", fog: 0.2, blur: 2.2 },
	{ base: 0.95, height: 58, colour: "#0b0f1d", fog: 0.12, blur: 0.8 },
];

/* ---------- The reflections: Poly Haven's Kiara 9 Dusk (CC0) ---------- */
async function environment() {
	const cache = join(tmpdir(), "polyhaven-kiara_9_dusk.jpg");
	if (!existsSync(cache)) {
		const res = await fetch(ENV_URL);
		if (!res.ok) throw new Error(`${ENV_URL}: ${res.status}`);
		writeFileSync(cache, Buffer.from(await res.arrayBuffer()));
	}
	await save("env.webp", sharp(cache).resize(1024, 512).blur(3), 70);
}

for (const [i, r] of RIDGES.entries()) await save(`dusk-${i + 1}.webp`, sharp(await sharp(ridge(i, r)).blur(r.blur).png().toBuffer()), 70);
await environment();
console.log(written.join("\n"));
