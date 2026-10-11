// Builds the drone page intro's artwork (src/components/DroneSplash.astro) from two 1920×1080 frames:
//
//   footage: the drone camera's view at dusk, with a HUD burnt in.
//     → src/assets/intro/drone-footage.webp  the view with the HUD painted out (the intro draws its own live HUD)
//     → src/assets/intro/drone-sky.webp      a tiny copy, inlined as the sky behind the flying 3D drone (it shows
//                                            from the very first frame, and upscaling blurs it like a far background)
//   logo: the stacked JPL Innovation logo (JPL above the badge, INNOVATION round the bottom) glowing on black.
//     → src/assets/intro/jpl-stacked.svg     the traced lettering, one <path> per letter, plus where the ring sits
//                                            (data-ring-*), so DroneSplash places jpl-logo.svg's traced badge on it
//
// Run:  node scripts/build-drone-intro.mjs <footage.png> <logo.png> [preview folder]
// The optional preview folder gets the cleaned full-size frame and a mask check (website-old-main/image/Previews/...).
import { mkdirSync, writeFileSync } from "node:fs";
import potrace from "potrace";
import sharp from "sharp";

const [footagePath, logoPath, previewDir] = process.argv.slice(2);
if (!footagePath || !logoPath) {
	console.error("Usage: node scripts/build-drone-intro.mjs <footage.png> <logo.png> [preview folder]");
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

/* ---------- Logo: find the ring, then trace each letter ---------- */
const logo = await sharp(logoPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: LW, height: LH } = logo.info;
const L = logo.data;
const at = (x, y) => (y * LW + x) * 3;
const isTeal = (i, min = 120) => L[i + 2] > min && L[i + 1] > 0.6 * L[i + 2] && L[i] < 0.6 * L[i + 2];

// Ring: bright teal pixels in a band around a first guess, refined twice (centre = their mean, radius = mean distance).
let ring = { cx: LW / 2, cy: LH / 2, r: 228 };
for (let pass = 0; pass < 3; pass++) {
	let n = 0, sx = 0, sy = 0, sd = 0;
	const lo = ring.r * (pass ? 0.94 : 0.8), hi = ring.r * (pass ? 1.06 : 1.2);
	for (let y = 0; y < LH; y++) {
		for (let x = 0; x < LW; x++) {
			const d = Math.hypot(x - ring.cx, y - ring.cy);
			if (d < lo || d > hi || !isTeal(at(x, y), 150)) continue;
			n++, sx += x, sy += y, sd += d;
		}
	}
	ring = { cx: sx / n, cy: sy / n, r: sd / n };
}
console.log(`ring centre ${ring.cx.toFixed(1)}, ${ring.cy.toFixed(1)}, radius ${ring.r.toFixed(1)}`);

// Letter masks: "JPL" is the white above the ring, "INNOVATION" the teal round the outside of its lower half.
const ink = (x, y) => {
	const i = at(x, y);
	const d = Math.hypot(x - ring.cx, y - ring.cy);
	if (y < ring.cy - ring.r - 12 && Math.min(L[i], L[i + 1], L[i + 2]) > 110) return "jpl";
	if (y > ring.cy && d > ring.r + 22 && isTeal(i, 95)) return "innovation";
	return null;
};
const label = new Int32Array(LW * LH).fill(-1);
const blobs = [];
for (let y = 0; y < LH; y++) {
	for (let x = 0; x < LW; x++) {
		if (label[y * LW + x] !== -1 || !ink(x, y)) continue;
		const word = ink(x, y);
		const blob = { word, x0: x, y0: y, x1: x, y1: y, n: 0, r: 0, g: 0, b: 0 };
		const stack = [[x, y]];
		label[y * LW + x] = blobs.length;
		while (stack.length) {
			const [cx, cy] = stack.pop();
			const i = at(cx, cy);
			blob.n++, blob.r += L[i], blob.g += L[i + 1], blob.b += L[i + 2];
			blob.x0 = Math.min(blob.x0, cx), blob.x1 = Math.max(blob.x1, cx), blob.y0 = Math.min(blob.y0, cy), blob.y1 = Math.max(blob.y1, cy);
			for (let oy = -1; oy <= 1; oy++) {
				for (let ox = -1; ox <= 1; ox++) {
					const nx = cx + ox, ny = cy + oy;
					if (nx < 0 || ny < 0 || nx >= LW || ny >= LH || label[ny * LW + nx] !== -1 || ink(nx, ny) !== word) continue;
					label[ny * LW + nx] = blobs.length;
					stack.push([nx, ny]);
				}
			}
		}
		blobs.push(blob);
	}
}
const letters = blobs.map((b, id) => ({ ...b, id })).filter((b) => b.n > 120);
const words = {
	jpl: letters.filter((b) => b.word === "jpl").sort((a, b) => a.x0 - b.x0),
	innovation: letters.filter((b) => b.word === "innovation").sort((a, b) => a.x0 - b.x0),
};
if (words.jpl.length !== 3 || words.innovation.length !== 10) {
	throw new Error(`expected 3 + 10 letters, found ${words.jpl.length} + ${words.innovation.length}`);
}
const NAMES = { jpl: ["J", "P", "L"], innovation: ["I1", "N1", "N2", "O1", "V", "A", "T", "I2", "O2", "N3"] };
const hex = (b) => "#" + [b.r, b.g, b.b].map((v) => Math.round(v / b.n).toString(16).padStart(2, "0")).join("");

/** Trace one letter: its own pixels (and their anti-aliased edge) as dark on white, at 4× for smooth curves. */
const PAD = 3, UP = 4;
async function trace(b) {
	const w = b.x1 - b.x0 + 1 + 2 * PAD, h = b.y1 - b.y0 + 1 + 2 * PAD;
	const gray = Buffer.alloc(w * h, 255);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const ix = b.x0 - PAD + x, iy = b.y0 - PAD + y;
			if (ix < 0 || iy < 0 || ix >= LW || iy >= LH) continue;
			// Only pixels within 2 px of this letter (a neighbour's corner can poke into the box).
			let near = false;
			for (let oy = -2; oy <= 2 && !near; oy++) for (let ox = -2; ox <= 2 && !near; ox++) near = label[(iy + oy) * LW + ix + ox] === b.id;
			if (!near) continue;
			const i = at(ix, iy);
			const v = b.word === "jpl" ? (L[i] + L[i + 1] + L[i + 2]) / 3 : L[i + 2];
			const full = b.word === "jpl" ? 235 : b.b / b.n; // the letter's own core brightness
			gray[y * w + x] = Math.round(255 * (1 - Math.min(1, v / full)));
		}
	}
	const png = await sharp(gray, { raw: { width: w, height: h, channels: 1 } }).resize(w * UP, h * UP, { kernel: "cubic" }).png().toBuffer();
	const p = new potrace.Potrace({ turdSize: 8, optTolerance: 0.3, threshold: 128 });
	await new Promise((ok, fail) => p.loadImage(png, (e) => (e ? fail(e) : ok())));
	const d = p.getPathTag().match(/\bd="([^"]+)"/)[1];
	// potrace's coordinates are absolute x y pairs: scale back down and move into the frame.
	let k = 0;
	return d.replace(/-?\d+(\.\d+)?/g, (n) => {
		const v = Number(n) / UP + (k++ % 2 === 0 ? b.x0 - PAD : b.y0 - PAD);
		return (Math.round(v * 10) / 10).toString();
	}).replace(/\s*,\s*/g, " ").replace(/\s+/g, " ").trim();
}

const paths = [];
for (const word of ["jpl", "innovation"]) {
	for (const [k, b] of words[word].entries()) paths.push({ name: NAMES[word][k], word, d: await trace(b), colour: hex(b), box: b });
}
const all = paths.map((p) => p.box);
const margin = 40;
const vb = {
	x: Math.floor(Math.min(ring.cx - ring.r, ...all.map((b) => b.x0)) - margin),
	y: Math.floor(Math.min(ring.cy - ring.r, ...all.map((b) => b.y0)) - margin),
};
vb.w = Math.ceil(Math.max(ring.cx + ring.r, ...all.map((b) => b.x1)) + margin - vb.x);
vb.h = Math.ceil(Math.max(ring.cy + ring.r, ...all.map((b) => b.y1)) + margin - vb.y);
const colour = { jpl: "#F2F6F7", innovation: hex(words.innovation.reduce((s, b) => ({ n: s.n + b.n, r: s.r + b.r, g: s.g + b.g, b: s.b + b.b }), { n: 0, r: 0, g: 0, b: 0 })) };
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" data-ring-cx="${ring.cx.toFixed(1)}" data-ring-cy="${ring.cy.toFixed(1)}" data-ring-r="${ring.r.toFixed(1)}" aria-hidden="true" focusable="false">
${paths.map((p) => `<path id="js-${p.name}" class="js-letter js-${p.word}" fill="${colour[p.word]}" d="${p.d}"/>`).join("\n")}
</svg>
`;
writeFileSync(`${OUT}/jpl-stacked.svg`, svg);
console.log(`jpl-stacked.svg: ${paths.length} letters, ${(svg.length / 1024).toFixed(1)} KB, INNOVATION ${colour.innovation}`);

if (previewDir) {
	// Mask check: the traced letters drawn over the original frame, in red.
	const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${LW}" height="${LH}" viewBox="0 0 ${LW} ${LH}">${paths.map((p) => `<path d="${p.d}" fill="none" stroke="#ff3355" stroke-width="1.2"/>`).join("")}<circle cx="${ring.cx}" cy="${ring.cy}" r="${ring.r}" fill="none" stroke="#ffcc00" stroke-width="1"/></svg>`);
	const marked = await sharp(logoPath).composite([{ input: overlay }]).png().toBuffer(); // sharp crops before compositing, so two steps
	await sharp(marked).extract({ left: vb.x, top: vb.y, width: vb.w, height: vb.h }).toFile(`${previewDir}/logo-trace-check.png`);
}
