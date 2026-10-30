// Builds the drone chapter's backdrops (src/components/DroneChapter.astro) into public/chapter/drone/, offline: every
// layer is drawn here as SVG (seeded, so the same every run), pre-blurred, and saved as WebP. Nothing is blurred live.
//
//   city-far.webp, city-near.webp   beat 1: soft city lights low on the horizon (drawn, not a photo of any city), each
//                                   seamless left to right so it can drift
//   streaks.webp                    beat 2: light streaks radiating from the camera lens (the camera's video), on black
//                                   (blended with mix-blend-mode: screen)
//   dusk-sky.webp, dusk-1..4.webp   beat 3: a dusk sky and four mountain ridges fading into fog, far to near
//   skyline.webp                    beat 4, the 4G stop: a faint, generic distant skyline (no real city)
//   classic.webp                    Classic and reduced motion: the dusk, flattened into one still picture
//   env.webp                        the model's reflections: Poly Haven's "Kiara 9 Dusk" (CC0, polyhaven.com/a/kiara_9_dusk),
//                                   its tonemapped JPG cut to 512 × 256 and blurred. The 5 MB original is downloaded
//                                   to the system's temp folder, never into the repo.
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

/* ---------- Beat 1: city lights, seamless left to right ---------- */
// Drawn three times as wide, blurred, then the middle third kept: the blur wraps round, so the edges meet.
async function cityLights(name, { seed, count, rMin, rMax, alpha, blur }) {
	const W = 1280;
	const H = 720;
	const rand = seeded(seed);
	const colours = ["#ffb35c", "#ffd59a", "#ffe9c7", "#7fd6ff", "#a8e6ff", "#ff8f5c"];
	let discs = "";
	for (let i = 0; i < count; i++) {
		const x = rand() * W;
		// A band low on the horizon: most lights near its middle, fewer above and below.
		const y = H * (0.66 + (rand() + rand() + rand() - 1.5) * 0.09);
		const r = rMin + (rMax - rMin) * rand() ** 2;
		const c = colours[Math.floor(rand() * colours.length)];
		const a = (alpha * (0.35 + 0.65 * rand())).toFixed(3);
		for (const dx of [0, W, 2 * W]) discs += `<circle cx="${(x + dx).toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${c}" fill-opacity="${a}"/>`;
	}
	const wide = await sharp(svg(W * 3, H, discs)).blur(blur).png().toBuffer();
	await save(name, sharp(wide).extract({ left: W, top: 0, width: W, height: H }));
}

/* ---------- Beat 2: streaks radiating from the lens ---------- */
async function streaks() {
	// Drawn at 640 px and shown larger: it is soft anyway, and a third of the bytes.
	const S = 640;
	const c = S / 2;
	const rand = seeded(11);
	let lines = "";
	for (let i = 0; i < 90; i++) {
		const angle = rand() * Math.PI * 2;
		const r0 = 44 + rand() * 38;
		const r1 = r0 + 88 + rand() * 206;
		const w = 0.5 + rand() * 1.5;
		const a = (0.25 + rand() * 0.6).toFixed(2);
		const [x0, y0, x1, y1] = [c + Math.cos(angle) * r0, c + Math.sin(angle) * r0, c + Math.cos(angle) * r1, c + Math.sin(angle) * r1];
		lines += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="url(#s)" stroke-width="${w.toFixed(2)}" stroke-opacity="${a}" stroke-linecap="round"/>`;
	}
	// One gradient for every line, bright near the lens and gone at the edge.
	const defs = `<radialGradient id="s" gradientUnits="userSpaceOnUse" cx="${c}" cy="${c}" r="${c}"><stop offset="0.1" stop-color="#e6fbff"/><stop offset="0.35" stop-color="#22d3ee"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient>`;
	// On black, no alpha (the page blends it with mix-blend-mode: screen, so black is see-through): far fewer bytes.
	await save("streaks.webp", sharp(svg(S, S, lines, defs)).blur(2.2).flatten({ background: "#000" }), 62);
}

/* ---------- Beat 3: dusk sky and four ridges into fog ---------- */
const DUSK = { W: 1280, H: 720 };
const skySvg = () =>
	svg(
		DUSK.W,
		DUSK.H,
		`<rect width="100%" height="100%" fill="url(#sky)"/><rect width="100%" height="100%" fill="url(#glow)"/>`,
		`<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050f1c"/><stop offset="0.45" stop-color="#14213f"/><stop offset="0.72" stop-color="#3a3056"/><stop offset="0.86" stop-color="#7a4a58"/><stop offset="1" stop-color="#a8634f"/></linearGradient>` +
			`<radialGradient id="glow" cx="0.68" cy="0.86" r="0.55"><stop offset="0" stop-color="#d98a5a" stop-opacity="0.45"/><stop offset="1" stop-color="#d98a5a" stop-opacity="0"/></radialGradient>`,
	);
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

/* ---------- Beat 4, the 4G stop: a faint, generic skyline ---------- */
async function skyline() {
	const W = 1280;
	const H = 300;
	const rand = seeded(23);
	let blocks = "";
	let x = 0;
	while (x < W) {
		const bw = 18 + rand() * 46;
		const bh = 40 + rand() * 170;
		blocks += `<rect x="${x.toFixed(0)}" y="${(H - bh).toFixed(0)}" width="${bw.toFixed(0)}" height="${bh.toFixed(0)}" fill="#0d2230"/>`;
		for (let wy = H - bh + 8; wy < H - 6; wy += 11)
			for (let wx = x + 4; wx < x + bw - 4; wx += 8) if (rand() < 0.16) blocks += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="3" height="4" fill="#ffd59a" fill-opacity="0.7"/>`;
		x += bw + 2;
	}
	await save("skyline.webp", sharp(svg(W, H, blocks)).blur(1.2), 70);
}

/* ---------- The model's reflections: Poly Haven's Kiara 9 Dusk (CC0) ---------- */
async function environment() {
	const cache = join(tmpdir(), "polyhaven-kiara_9_dusk.jpg");
	if (!existsSync(cache)) {
		const res = await fetch(ENV_URL);
		if (!res.ok) throw new Error(`${ENV_URL}: ${res.status}`);
		writeFileSync(cache, Buffer.from(await res.arrayBuffer()));
	}
	await save("env.webp", sharp(cache).resize(512, 256).blur(3), 70);
}

await cityLights("city-far.webp", { seed: 3, count: 260, rMin: 3, rMax: 10, alpha: 0.75, blur: 5 });
await cityLights("city-near.webp", { seed: 5, count: 46, rMin: 10, rMax: 30, alpha: 0.55, blur: 10 });
await streaks();
await save("dusk-sky.webp", sharp(skySvg()).blur(2), 70);
const ridgeLayers = [];
for (const [i, r] of RIDGES.entries()) {
	const layer = await sharp(ridge(i, r)).blur(r.blur).png().toBuffer();
	ridgeLayers.push(layer);
	await save(`dusk-${i + 1}.webp`, sharp(layer), 70);
}
await skyline();
// Classic: the dusk in one picture, darkened so the words over it keep their contrast.
const flat = await sharp(skySvg())
	.composite(ridgeLayers.map((input) => ({ input })))
	.png()
	.toBuffer();
await save("classic.webp", sharp(flat).modulate({ brightness: 0.55 }).blur(1.5), 62);
await environment();
console.log(written.join("\n"));
