// Traces the two logos in the FRC page header into SVGs whose parts can be animated separately:
//   src/assets/intro/frc-badge.svg   Team 10951 dragon badge: disc, gear, dragon, flame
//   src/assets/intro/frc-first.svg   FIRST logo: triangle, circle and square ribbons, and the "FIRST®" wordmark
// Only for the FrcSplash build-up: the splash's final frame shows the original image files themselves
// (public/assets/10951.jpg and the official public/assets/FRC_logo.png, unaltered).
//
// Method (as for the JPL logo): per-part coverage fields, upscaled 4x (bicubic), thresholded at 0.5 and traced
// with potrace (the pure-JS port of the same algorithm). Each traced part is rasterised again and compared with
// its target mask; the worst boundary deviation per part is printed.
//   - Badge disc: the circle the site crops the badge to (the source's own black disc is larger than the image).
//   - Gear: traced as it appears, partly hidden behind the dragon; the splash only shows it once the dragon sits on top.
//   - FIRST knot: its three ribbons touch, so each white pixel goes to the nearest of three template centre-lines
//     (triangle, ellipse, diamond).
//
// Run:  node scripts/build-frc-svg.mjs          (FRC_DEBUG_DIR=some/folder also writes diagnostic images)
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import potrace from "potrace";
import sharp from "sharp";

const K = 4; // trace resolution multiplier
const BADGE_SRC = existsSync("D:/Animated logo AE/Pictures/10951.png") ? "D:/Animated logo AE/Pictures/10951.png" : "public/assets/10951.jpg";
const FIRST_SRC = "public/assets/FRC_logo.png";
const OUT_DIR = "src/assets/intro";
const DEBUG = process.env.FRC_DEBUG_DIR;

/* ------------------------------------------------------------------ */
/* Image helpers                                                       */
/* ------------------------------------------------------------------ */
async function loadLum(file) {
	const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
	const n = info.width * info.height;
	const L = new Float32Array(n);
	const rgb = new Uint8Array(n * 3);
	for (let i = 0; i < n; i++) {
		const r = data[i * info.channels], g = data[i * info.channels + 1], b = data[i * info.channels + 2];
		rgb.set([r, g, b], i * 3);
		L[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	}
	return { W: info.width, H: info.height, L, rgb };
}

/** Bicubic K-times upsample of a [0,1] field (via sharp), returned as a Float32Array. */
async function upsample(field, W, H) {
	const buf = Buffer.alloc(W * H);
	for (let i = 0; i < W * H; i++) buf[i] = Math.max(0, Math.min(255, Math.round(field[i] * 255)));
	// sharp hands single-channel raw input back as 3 channels, so read it by its real stride.
	const { data: out, info } = await sharp(buf, { raw: { width: W, height: H, channels: 1 } }).resize(W * K, H * K, { kernel: "cubic" }).raw().toBuffer({ resolveWithObject: true });
	const f = new Float32Array(W * K * H * K);
	for (let i = 0; i < f.length; i++) f[i] = out[i * info.channels] / 255;
	return f;
}

function erode(mask, W, H, it = 1) {
	let m = mask;
	for (let k = 0; k < it; k++) {
		const o = new Uint8Array(W * H);
		for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; o[i] = m[i] && m[i - 1] && m[i + 1] && m[i - W] && m[i + W] ? 1 : 0; }
		m = o;
	}
	return m;
}
function dilate(mask, W, H, it = 1) {
	let m = mask;
	for (let k = 0; k < it; k++) {
		const o = new Uint8Array(W * H);
		for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; o[i] = m[i] || (x > 0 && m[i - 1]) || (x < W - 1 && m[i + 1]) || (y > 0 && m[i - W]) || (y < H - 1 && m[i + W]) ? 1 : 0; }
		m = o;
	}
	return m;
}
/** 4-connected components: { labels, comps: [{ id, area, bbox }] } sorted largest first. */
function components(mask, W, H) {
	const labels = new Int32Array(W * H);
	const comps = [];
	let n = 0;
	for (let i = 0; i < W * H; i++) {
		if (!mask[i] || labels[i]) continue;
		n++;
		const st = [i];
		labels[i] = n;
		let area = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
		while (st.length) {
			const j = st.pop();
			const x = j % W, y = (j / W) | 0;
			area++;
			if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
			if (x > 0 && mask[j - 1] && !labels[j - 1]) { labels[j - 1] = n; st.push(j - 1); }
			if (x < W - 1 && mask[j + 1] && !labels[j + 1]) { labels[j + 1] = n; st.push(j + 1); }
			if (y > 0 && mask[j - W] && !labels[j - W]) { labels[j - W] = n; st.push(j - W); }
			if (y < H - 1 && mask[j + W] && !labels[j + W]) { labels[j + W] = n; st.push(j + W); }
		}
		comps.push({ id: n, area, bbox: [x0, y0, x1, y1] });
	}
	comps.sort((a, b) => b.area - a.area);
	return { labels, comps };
}
const median = (arr) => {
	const s = [...arr].sort((a, b) => a - b);
	return s.length ? s[s.length >> 1] : 0;
};
const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
function medianColour(img, mask) {
	const r = [], g = [], b = [];
	for (let i = 0; i < mask.length; i++) if (mask[i]) { r.push(img.rgb[i * 3]); g.push(img.rgb[i * 3 + 1]); b.push(img.rgb[i * 3 + 2]); }
	return hex(median(r), median(g), median(b));
}

/* ------------------------------------------------------------------ */
/* Tracing, path output, verification                                  */
/* ------------------------------------------------------------------ */
/** Trace a K-scale boolean mask; returns path data in 1x coordinates, rounded to `step` px. */
async function trace(mask, W, H, { step = 0.1, optTolerance = 0.3, turd = 2 } = {}) {
	const buf = Buffer.alloc(W * H);
	for (let i = 0; i < W * H; i++) buf[i] = mask[i] ? 0 : 255; // part = black
	const png = await sharp(buf, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
	const tag = await new Promise((resolve, reject) => {
		const p = new potrace.Potrace({ turdSize: turd * K * K, alphaMax: 1, optCurve: true, optTolerance, threshold: 128, blackOnWhite: true, turnPolicy: potrace.Potrace.TURNPOLICY_MINORITY });
		p.loadImage(png, (err) => (err ? reject(err) : resolve(p.getPathTag())));
	});
	const d = tag.match(/ d="([^"]*)"/)[1];
	return compactPath(d, 1 / K, step);
}

/** Rewrite potrace's absolute M/C/L path, scaled, as compact relative path data rounded to `step` px. */
function compactPath(d, scale, step = 0.1) {
	const tokens = d.match(/[MCLZ]|-?\d*\.?\d+(?:e-?\d+)?/gi);
	const q = Math.round(1 / step); // steps per pixel (10 = tenths, 1 = whole pixels)
	const T = (v) => Math.round(v * scale * q);
	const num = (t) => (t / q).toString().replace(/^(-?)0\./, "$1.");
	const join = (a) => a.map(num).join(" ").replace(/ -/g, "-");
	let out = "", cur = [0, 0], start = [0, 0], i = 0, cmd = "";
	while (i < tokens.length) {
		if (/[MCLZ]/i.test(tokens[i])) cmd = tokens[i++].toUpperCase();
		if (cmd === "Z") { out += "z"; cur = start; continue; }
		const take = (k) => tokens.slice(i, (i += k)).map(Number);
		if (cmd === "M") { const [x, y] = take(2).map(T); out += `M${join([x, y])}`; cur = start = [x, y]; cmd = "L"; }
		else if (cmd === "L") { const [x, y] = take(2).map(T); const dx = x - cur[0], dy = y - cur[1]; out += dy === 0 ? `h${num(dx)}` : dx === 0 ? `v${num(dy)}` : `l${join([dx, dy])}`; cur = [x, y]; }
		else if (cmd === "C") { const v = take(6).map(T); out += `c${join([v[0] - cur[0], v[1] - cur[1], v[2] - cur[0], v[3] - cur[1], v[4] - cur[0], v[5] - cur[1]])}`; cur = [v[4], v[5]]; }
		else throw new Error(`unexpected path command ${cmd}`);
	}
	return out;
}

/** Rasterise a path (1x coordinates) back at K scale (W, H are the K-scale sizes) as a boolean mask. */
async function rasterise(d, W, H) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W / K} ${H / K}"><rect width="100%" height="100%" fill="#000"/><path fill="#fff" fill-rule="evenodd" d="${d}"/></svg>`;
	const { data: raw, info } = await sharp(Buffer.from(svg)).raw().toBuffer({ resolveWithObject: true });
	const m = new Uint8Array(W * H);
	for (let i = 0; i < m.length; i++) m[i] = raw[i * info.channels] > 127 ? 1 : 0;
	return m;
}

/** Exact Euclidean distance transform (Felzenszwalb) to the set pixels of `mask`. */
function edt(mask, W, H) {
	const INF = 1e20;
	const f = new Float64Array(Math.max(W, H));
	const d = new Float64Array(W * H);
	const v = new Int32Array(Math.max(W, H));
	const z = new Float64Array(Math.max(W, H) + 1);
	const line = (n, get, set) => {
		for (let q = 0; q < n; q++) f[q] = get(q);
		let k = 0;
		v[0] = 0; z[0] = -INF; z[1] = INF;
		for (let q = 1; q < n; q++) {
			let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
			while (s <= z[k]) { k--; s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
			k++; v[k] = q; z[k] = s; z[k + 1] = INF;
		}
		k = 0;
		for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; set(q, (q - v[k]) * (q - v[k]) + f[v[k]]); }
	};
	for (let i = 0; i < W * H; i++) d[i] = mask[i] ? 0 : INF;
	for (let x = 0; x < W; x++) line(H, (y) => d[y * W + x], (y, val) => (d[y * W + x] = val));
	for (let y = 0; y < H; y++) line(W, (x) => d[y * W + x], (x, val) => (d[y * W + x] = val));
	for (let i = 0; i < W * H; i++) d[i] = Math.sqrt(d[i]);
	return d;
}
const boundary = (m, W, H) => { const e = erode(m, W, H); const b = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) b[i] = m[i] && !e[i] ? 1 : 0; return b; };

/** Boundary deviation between a traced part and its target mask (both K-scale), in 1x pixels. */
async function compare(name, d, target, W, H) {
	const got = await rasterise(d, W, H);
	const bG = boundary(got, W, H), bT = boundary(target, W, H);
	const dT = edt(bT, W, H), dG = edt(bG, W, H);
	const devs = [];
	let worst = { dev: -1, at: [0, 0] };
	for (let i = 0; i < W * H; i++) {
		if (bG[i]) { devs.push(dT[i]); if (dT[i] > worst.dev) worst = { dev: dT[i], at: [(i % W) / K, ((i / W) | 0) / K] }; }
		if (bT[i]) { devs.push(dG[i]); if (dG[i] > worst.dev) worst = { dev: dG[i], at: [(i % W) / K, ((i / W) | 0) / K] }; }
	}
	let inter = 0, uni = 0;
	for (let i = 0; i < W * H; i++) { if (got[i] && target[i]) inter++; if (got[i] || target[i]) uni++; }
	devs.sort((a, b) => a - b);
	const r = (x) => Math.round((x / K) * 100) / 100;
	return {
		name,
		max_dev_px: r(worst.dev),
		p99_dev_px: r(devs[Math.floor(devs.length * 0.99)] ?? 0),
		mean_dev_px: r(devs.reduce((s, x) => s + x, 0) / Math.max(devs.length, 1)),
		iou: Math.round((inter / Math.max(uni, 1)) * 10000) / 10000,
		worst_at_px: worst.at.map((v) => Math.round(v * 10) / 10),
	};
}

async function debugImage(name, W, H, paint) {
	if (!DEBUG) return;
	mkdirSync(DEBUG, { recursive: true });
	const img = Buffer.alloc(W * H * 3);
	paint(img);
	await sharp(img, { raw: { width: W, height: H, channels: 3 } }).png().toFile(`${DEBUG}/${name}.png`);
}

/* ------------------------------------------------------------------ */
/* 1. Dragon badge                                                     */
/* ------------------------------------------------------------------ */
async function buildBadge() {
	const img = await loadLum(BADGE_SRC);
	const { W, H, L } = img;
	const CX = W / 2, CY = H / 2, CR = W / 2; // the site crops the badge to this circle (rounded-full)
	const inside = (x, y, pad = 0) => Math.hypot(x + 0.5 - CX, y + 0.5 - CY) < CR - pad;

	// Dragon (with its flame) = everything bright inside the crop circle.
	const dragonField = new Float32Array(W * H);
	for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) dragonField[y * W + x] = inside(x, y, 1) ? L[y * W + x] : 0;
	const dragonUp = await upsample(dragonField, W, H);
	const dragonMask = new Uint8Array(dragonUp.length);
	for (let i = 0; i < dragonUp.length; i++) dragonMask[i] = dragonUp[i] > 0.5 ? 1 : 0;

	// Flame: the light-grey shape at the mouth (between the dragon's white and the dark background).
	const grey = new Uint8Array(W * H);
	for (let i = 0; i < W * H; i++) grey[i] = L[i] > 0.78 && L[i] < 0.93 ? 1 : 0;
	const opened = dilate(erode(grey, W, H, 2), W, H, 2);
	const greyComps = components(opened, W, H);
	const flameId = greyComps.comps[0].id;
	let flameRegion = new Uint8Array(W * H);
	for (let i = 0; i < W * H; i++) flameRegion[i] = greyComps.labels[i] === flameId ? 1 : 0;
	flameRegion = dilate(flameRegion, W, H, 2);
	const flameField = new Float32Array(W * H);
	for (let i = 0; i < W * H; i++) flameField[i] = flameRegion[i] && L[i] < 0.935 ? Math.min(1, L[i] / 0.86) : 0;
	const flameUp = await upsample(flameField, W, H);
	const flameMask = new Uint8Array(flameUp.length);
	for (let i = 0; i < flameUp.length; i++) flameMask[i] = flameUp[i] > 0.5 ? 1 : 0;

	// Gear: the dark-grey shape as it appears (antialiased dragon edges removed by an opening). Where it meets the
	// dragon it continues a little way underneath, so no hairline shows between them; the splash only shows the
	// gear once the dragon sits on top of it.
	let gearPx = new Uint8Array(W * H);
	for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const l = L[y * W + x]; gearPx[y * W + x] = inside(x, y, 3) && l > 0.1 && l < 0.45 ? 1 : 0; }
	gearPx = dilate(erode(gearPx, W, H, 1), W, H, 1);
	const gc = components(gearPx, W, H);
	const keep = new Set(gc.comps.filter((c) => c.area > 300).map((c) => c.id));
	for (let i = 0; i < W * H; i++) gearPx[i] = keep.has(gc.labels[i]) ? 1 : 0;
	const near = dilate(gearPx, W, H, 2);
	const gearField = new Float32Array(W * H);
	for (let i = 0; i < W * H; i++) {
		if (!near[i]) continue;
		gearField[i] = L[i] > 0.45 ? 1 : Math.min(1, L[i] / 0.18); // over black: coverage = L / gear grey; under the dragon: 1
	}
	const gearUp = await upsample(gearField, W, H);
	const gearMask = new Uint8Array(gearUp.length);
	for (let i = 0; i < gearUp.length; i++) gearMask[i] = gearUp[i] > 0.5 ? 1 : 0;

	const colours = {
		disc: "#000000",
		gear: medianColour(img, erode(gearPx, W, H, 2)),
		dragon: (() => { const m = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) m[i] = L[i] > 0.94 ? 1 : 0; return medianColour(img, erode(m, W, H, 1)); })(),
		flame: medianColour(img, erode(flameRegion, W, H, 3)),
	};

	const BADGE = { step: 1, optTolerance: 0.4, turd: 4 }; // shown at ~140 px: whole-pixel coordinates are plenty
	const dDragon = await trace(dragonMask, W * K, H * K, BADGE);
	const dFlame = await trace(flameMask, W * K, H * K, BADGE);
	const dGear = await trace(gearMask, W * K, H * K, BADGE);

	// Gear check where it's visible (the part under the dragon is hidden in the logo and in the splash).
	const vis = new Uint8Array(gearMask.length);
	for (let i = 0; i < vis.length; i++) vis[i] = dragonMask[i] ? 0 : 1;
	const report = [
		await compare("Dragon (with flame)", dDragon, dragonMask, W * K, H * K),
		await compare("Flame", dFlame, flameMask, W * K, H * K),
		await compareMasked("Gear (visible part)", dGear, gearMask, dilate(vis, W * K, H * K, 0), W * K, H * K),
	];

	await debugImage("badge-parts", W, H, (buf) => {
		for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
			const j = ((y * K + 2) * W * K + x * K + 2);
			let c = inside(x, y) ? [0, 0, 0] : [50, 0, 50];
			if (gearMask[j]) c = [0, 140, 255];
			if (dragonMask[j]) c = [245, 245, 245];
			if (flameMask[j]) c = [255, 170, 0];
			buf.set(c, (y * W + x) * 3);
		}
	});

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="fb-logo" aria-hidden="true" focusable="false">
<circle id="fb-disc" class="fb-part" fill="${colours.disc}" cx="${CX}" cy="${CY}" r="${CR}"/>
<path id="fb-gear" class="fb-part" fill="${colours.gear}" d="${dGear}"/>
<path id="fb-dragon" class="fb-part" fill="${colours.dragon}" fill-rule="evenodd" d="${dDragon}"/>
<path id="fb-flame" class="fb-part" fill="${colours.flame}" fill-rule="evenodd" d="${dFlame}"/>
</svg>
`;
	return { svg, report, colours };
}

/** Compare only inside `region` (for a part the original partly hides). */
async function compareMasked(name, d, target, region, W, H) {
	const got = await rasterise(d, W, H);
	for (let i = 0; i < W * H; i++) if (!region[i]) got[i] = 0;
	const t = Uint8Array.from(target);
	for (let i = 0; i < W * H; i++) if (!region[i]) t[i] = 0;
	// Reuse compare() on the restricted masks by tracing-free comparison.
	const bG = boundary(got, W, H), bT = boundary(t, W, H);
	const reg = erode(region, W, H, 2); // ignore the artificial cut at the region's edge
	const dT = edt(bT, W, H), dG = edt(bG, W, H);
	const devs = [];
	let worst = { dev: -1, at: [0, 0] };
	for (let i = 0; i < W * H; i++) {
		if (!reg[i]) continue;
		if (bG[i]) { devs.push(dT[i]); if (dT[i] > worst.dev) worst = { dev: dT[i], at: [(i % W) / K, ((i / W) | 0) / K] }; }
		if (bT[i]) { devs.push(dG[i]); if (dG[i] > worst.dev) worst = { dev: dG[i], at: [(i % W) / K, ((i / W) | 0) / K] }; }
	}
	let inter = 0, uni = 0;
	for (let i = 0; i < W * H; i++) { if (got[i] && t[i]) inter++; if (got[i] || t[i]) uni++; }
	devs.sort((a, b) => a - b);
	const r = (x) => Math.round((x / K) * 100) / 100;
	return { name, max_dev_px: r(worst.dev), p99_dev_px: r(devs[Math.floor(devs.length * 0.99)] ?? 0), mean_dev_px: r(devs.reduce((s, x) => s + x, 0) / Math.max(devs.length, 1)), iou: Math.round((inter / Math.max(uni, 1)) * 10000) / 10000, worst_at_px: worst.at.map((v) => Math.round(v * 10) / 10) };
}

/* ------------------------------------------------------------------ */
/* 2. FIRST logo                                                       */
/* ------------------------------------------------------------------ */
// Centre-lines of the three ribbons in the knot (logo pixels), read off the artwork.
const TEMPLATES = {
	triangle: { poly: [[31, 13], [14, 98], [86, 66]] },
	circle: { ellipse: { cx: 93, cy: 59, rx: 50, ry: 38 } },
	square: { poly: [[137, 11], [181, 51], [141, 98], [106, 55]] },
};
function distToPoly(px, py, pts) {
	let best = Infinity;
	for (let i = 0; i < pts.length; i++) {
		const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
		const dx = bx - ax, dy = by - ay;
		const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
		best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
	}
	return best;
}
function distToEllipse(px, py, { cx, cy, rx, ry }) {
	const t = Math.atan2((py - cy) / ry, (px - cx) / rx);
	return Math.hypot(px - cx - rx * Math.cos(t), py - cy - ry * Math.sin(t));
}

/** The label of the nearest labelled pixel (searching outward a few pixels). */
function nearestLabel(labels, W, H, x, y) {
	for (let r = 0; r <= 3; r++) {
		for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
			const xx = x + dx, yy = y + dy;
			if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
			const l = labels[yy * W + xx];
			if (l) return l;
		}
	}
	return 0;
}

async function buildFirst() {
	const img = await loadLum(FIRST_SRC);
	const { W, H, L } = img;
	const white = new Uint8Array(W * H);
	for (let i = 0; i < W * H; i++) white[i] = L[i] > 0.5 ? 1 : 0;
	const { labels, comps } = components(white, W, H);
	const knot = comps.find((c) => c.bbox[0] < 20);
	const up = await upsample(L, W, H);
	const WK = W * K, HK = H * K;
	const parts = { triangle: new Uint8Array(WK * HK), circle: new Uint8Array(WK * HK), square: new Uint8Array(WK * HK), wordmark: new Uint8Array(WK * HK) };
	for (let y = 0; y < HK; y++) for (let x = 0; x < WK; x++) {
		const i = y * WK + x;
		if (up[i] <= 0.5) continue;
		const px = (x + 0.5) / K, py = (y + 0.5) / K;
		// Antialiased edge pixels can sit just outside a 1x component: use the nearest labelled pixel.
		const lab = nearestLabel(labels, W, H, Math.min(W - 1, px | 0), Math.min(H - 1, py | 0));
		const inKnot = lab === knot.id;
		if (!inKnot) { parts.wordmark[i] = 1; continue; }
		const dT = distToPoly(px, py, TEMPLATES.triangle.poly);
		const dC = distToEllipse(px, py, TEMPLATES.circle.ellipse);
		const dS = distToPoly(px, py, TEMPLATES.square.poly);
		const m = Math.min(dT, dC, dS);
		(m === dT ? parts.triangle : m === dC ? parts.circle : parts.square)[i] = 1;
	}
	await debugImage("first-parts", WK, HK, (buf) => {
		for (let i = 0; i < WK * HK; i++) {
			const c = parts.triangle[i] ? [237, 28, 36] : parts.circle[i] ? [255, 255, 255] : parts.square[i] ? [0, 102, 179] : parts.wordmark[i] ? [200, 200, 200] : [10, 26, 58];
			buf.set(c, i * 3);
		}
	});
	const d = {};
	const report = [];
	for (const name of Object.keys(parts)) {
		d[name] = await trace(parts[name], WK, HK);
		report.push(await compare(`FIRST ${name}`, d[name], parts[name], WK, HK));
	}
	// Whole-logo check against the original artwork (all parts together).
	const all = new Uint8Array(WK * HK);
	for (let i = 0; i < WK * HK; i++) all[i] = up[i] > 0.5 ? 1 : 0;
	report.push(await compare("FIRST whole logo", Object.values(d).join(""), all, WK, HK));
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="ff-logo" aria-hidden="true" focusable="false">
<path id="ff-triangle" class="ff-part ff-knot" fill="#ED1C24" fill-rule="evenodd" d="${d.triangle}"/>
<path id="ff-circle" class="ff-part ff-knot" fill="#FFFFFF" fill-rule="evenodd" d="${d.circle}"/>
<path id="ff-square" class="ff-part ff-knot" fill="#0066B3" fill-rule="evenodd" d="${d.square}"/>
<path id="ff-wordmark" class="ff-part" fill="#FFFFFF" fill-rule="evenodd" d="${d.wordmark}"/>
</svg>
`;
	return { svg, report };
}

/**
 * The official white FIRST logo with its black background turned into transparency (alpha = brightness).
 * Same artwork and colour: on a dark background it looks exactly like the header's screen-blended copy, but it
 * also works inside the splash's transformed layers, where a blend mode can't reach the background.
 */
async function writeTransparentFirst() {
	const { data, info } = await sharp(FIRST_SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
	const out = Buffer.alloc(info.width * info.height * 4);
	for (let i = 0; i < info.width * info.height; i++) {
		const r = data[i * info.channels], g = data[i * info.channels + 1], b = data[i * info.channels + 2];
		out.set([255, 255, 255, Math.round((r + g + b) / 3)], i * 4);
	}
	await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toFile("public/assets/FRC_logo-white.png");
}

/* ------------------------------------------------------------------ */
await writeTransparentFirst();
const badge = await buildBadge();
const first = await buildFirst();
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/frc-badge.svg`, badge.svg);
writeFileSync(`${OUT_DIR}/frc-first.svg`, first.svg);
const all = [...badge.report, ...first.report];
const worst = all.filter((r) => !r.name.includes("whole")).reduce((a, b) => (b.max_dev_px > a.max_dev_px ? b : a));
console.log(JSON.stringify({ badgeSource: BADGE_SRC, colours: badge.colours, parts: all, worst }, null, 1));
for (const [f, s] of [["frc-badge.svg", badge.svg], ["frc-first.svg", first.svg]]) console.log(`${OUT_DIR}/${f}: ${s.length} bytes, ${gzipSync(s).length} gzipped`);
