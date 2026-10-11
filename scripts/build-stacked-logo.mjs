// Draws the stacked JPL Innovation logo for the drone page intro (src/components/DroneSplash.astro) as clean vector
// shapes, so it stays sharp at any size:
//
//   src/assets/intro/jpl-stacked.svg  JPL and INNOVATION, one <path> per letter, plus where the ring sits (data-ring-*)
//   src/assets/intro/jpl-badge.svg    the badge: ring, monitor, signal waves, wrench and stand, with the part ids the
//                                     intro animates. It's in jpl-logo.svg's units (ring centre 610.9, 163.9, radius
//                                     119.6), so its flight lands exactly on the navbar logo's badge.
//
// Every size and place below was measured from public/assets/logo.jpg (1097 × 875; a PNG despite the name), in its
// pixels: the ring's centre and radius by a circle fit, each letter's centre and turn on its circle (JPL round the
// ring's centre, INNOVATION round a centre 3.5 px right and 3 px down, both to within 0.15 px), and the strokes, bowls
// and corners from scans of each letter turned upright.
//
// Run:  node scripts/build-stacked-logo.mjs
import { writeFileSync } from "node:fs";

const OUT = "src/assets/intro";
const f = (n) => String(Math.round(n * 100) / 100);
const pt = ([x, y]) => `${f(x)} ${f(y)}`;

/* ---------- Outlines ---------- */

/**
 * A closed outline: corners are [x, y] or [x, y, r] (rounded to radius r where two straight edges meet), curves are
 * { c: [control 1, control 2, end] }. `map` moves every point (rotation and translation keep corner radii true).
 */
function outline(nodes, map = (p) => p) {
	const pts = nodes.map((n) => (Array.isArray(n) ? { p: map(n), r: n[2] ?? 0 } : { p: map(n.c[2]), c1: map(n.c[0]), c2: map(n.c[1]), r: 0 }));
	const n = pts.length;
	const corner = pts.map((q, i) => {
		const next = pts[(i + 1) % n];
		if (!q.r || q.c1 || next.c1) return null; // only where a straight edge comes in and another goes out
		const A = pts[(i - 1 + n) % n].p, P = q.p, B = next.p;
		const v1 = [A[0] - P[0], A[1] - P[1]], v2 = [B[0] - P[0], B[1] - P[1]];
		const l1 = Math.hypot(...v1), l2 = Math.hypot(...v2);
		const u1 = [v1[0] / l1, v1[1] / l1], u2 = [v2[0] / l2, v2[1] / l2];
		const th = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1])));
		if (th < 1e-3 || Math.PI - th < 1e-3) return null;
		const t = Math.min(q.r / Math.tan(th / 2), 0.45 * l1, 0.45 * l2);
		const turn = (P[0] - A[0]) * (B[1] - P[1]) - (P[1] - A[1]) * (B[0] - P[0]);
		return { T1: [P[0] + u1[0] * t, P[1] + u1[1] * t], T2: [P[0] + u2[0] * t, P[1] + u2[1] * t], r: t * Math.tan(th / 2), sweep: turn > 0 ? 1 : 0 };
	});
	let d = `M${pt(corner[0] ? corner[0].T2 : pts[0].p)}`;
	for (let k = 1; k <= n; k++) {
		const i = k % n, q = pts[i], c = corner[i];
		d += q.c1 ? `C${pt(q.c1)} ${pt(q.c2)} ${pt(q.p)}` : `L${pt(c ? c.T1 : q.p)}`;
		if (c) d += `A${f(c.r)} ${f(c.r)} 0 0 ${c.sweep} ${pt(c.T2)}`;
	}
	return d + "Z";
}

/** An ellipse as four cubics; k = 0.5523 is a true ellipse, more is fuller (squarer). */
const ellipse = (cx, cy, rx, ry, k = 0.5523) => [
	{ c: [[cx + rx, cy + k * ry], [cx + k * rx, cy + ry], [cx, cy + ry]] },
	{ c: [[cx - k * rx, cy + ry], [cx - rx, cy + k * ry], [cx - rx, cy]] },
	{ c: [[cx - rx, cy - k * ry], [cx - k * rx, cy - ry], [cx, cy - ry]] },
	{ c: [[cx + k * rx, cy - ry], [cx + rx, cy - k * ry], [cx + rx, cy]] },
];
const rect = (x0, y0, x1, y1, r = 0) => [[x0, y0, r], [x1, y0, r], [x1, y1, r], [x0, y1, r]];

/* ---------- Letters ---------- */
// Each glyph is drawn upright about its box centre (u right, v down), in logo.jpg pixels.

const T = -31.75, B = 31.75, RI = 1.6; // INNOVATION's cap top and baseline, and its corner rounding
const GLYPHS = {
	I: () => [rect(-5, T, 5, B, RI)],
	N: () => {
		const L1 = (v) => -4.84 + 0.68 * v, L2 = (v) => 7.66 + 0.68 * v; // the diagonal's left and right edges
		return [[[-26.75, T, RI], [L2(T), T, RI], [16.75, (16.75 - 7.66) / 0.68, 0.8], [16.75, T, RI], [26.75, T, RI], [26.75, B, RI], [L1(B), B, RI], [-16.75, (-16.75 + 4.84) / 0.68, 0.8], [-16.75, B, RI], [-26.75, B, RI]]];
	},
	O: () => [ellipse(0, 0, 30.4, 32.6, 0.62), ellipse(0, 0, 19.9, 23, 0.58)],
	V: () => {
		const o = (v) => 26 - 0.334 * (v - T), i = (v) => 15.5 - 0.344 * (v - T); // outer and inner edges, right leg
		return [[[-26, T, RI], [-i(T), T, RI], [0, T + 15.5 / 0.344, 1.2], [i(T), T, RI], [26, T, RI], [o(B), B, RI], [-o(B), B, RI]]];
	},
	A: () => {
		const o = (v) => 5.3 + 0.3795 * (v - T), i = (v) => 1.75 + 0.344 * (v + 17); // outer and inner edges, right leg
		const bar = [8.4, 17.6]; // the crossbar
		return [
			[[-o(T), T, RI], [o(T), T, RI], [o(B), B, RI], [i(B), B, RI], [i(bar[1]), bar[1], 0.8], [-i(bar[1]), bar[1], 0.8], [-i(B), B, RI], [-o(B), B, RI]],
			[[0, -19.5, 1.5], [i(bar[0]), bar[0], 0.8], [-i(bar[0]), bar[0], 0.8]],
		];
	},
	T: () => [[[-24.6, T, RI], [24.6, T, RI], [24.6, -22.5, RI], [5.1, -22.5, 0.8], [5.1, B, RI], [-5.1, B, RI], [-5.1, -22.5, 0.8], [-24.6, -22.5, RI]]],
	J: () => [[[0, -32.4, 2.4], [16.25, -32.4, 2.4], [16.25, 14], { c: [[16.25, 26.5], [7, 32.5], [-3, 32.5]] }, [-16.5, 32.5, 2.4], [-16.5, 19.6, 2.4], [-2.2, 18.1], { c: [[-0.6, 17.9], [0, 16.8], [0, 15]] }]],
	P: () => {
		const k = 0.58, top = -31.8;
		return [
			[[-26.9, top, 2.2], [5, top], { c: [[5 + k * 22.25, top], [27.25, -11.1 - k * 20.7], [27.25, -11.1]] }, { c: [[27.25, -11.1 + k * 20.7], [5 + k * 22.25, 9.6], [5, 9.6]] }, [-10.9, 9.6, 1], [-10.9, 32, 2.2], [-26.9, 32, 2.2]],
			[[-10.9, -19.1, 1.2], [5, -19.1], { c: [[8.31, -19.1], [11, -15.6], [11, -11.25]] }, { c: [[11, -6.9], [8.31, -3.4], [5, -3.4]] }, [-10.9, -3.4, 1.2]],
		];
	},
	L: () => [[[-20.25, -32.2, 2.2], [-4.25, -32.2, 2.2], [-4.25, 17.4, 1], [20.75, 17.4, 2.2], [20.75, 32.4, 2.2], [-20.25, 32.4, 2.2]]],
};

const RING = { cx: 547.56, cy: 439.72, r: 228.15 }; // the ring's centre line; its band is 9 px wide
const ARC = { cx: 551.04, cy: 442.72 }; // the circle INNOVATION sits on (radius 294.07)
const COLOUR = { jpl: "#F0F9FC", innovation: "#18A2C3" };
// [id, glyph, word, box centre x, y]. Each letter is turned to face its circle's centre: JPL's is the ring's.
const LETTERS = [
	["J", "J", "jpl", 480.52, 145.62], ["P", "P", "jpl", 544.78, 137.73], ["L", "L", "jpl", 611.57, 144.46],
	["I1", "I", "innovation", 289.53, 577.51], ["N1", "N", "innovation", 318.7, 622.79], ["N2", "N", "innovation", 375.45, 678.49],
	["O1", "O", "innovation", 448.07, 718.21], ["V", "V", "innovation", 525.25, 735.76], ["A", "A", "innovation", 589.26, 734.28],
	["T", "T", "innovation", 654.52, 718.08], ["I2", "I", "innovation", 699.83, 696.21], ["O2", "O", "innovation", 746.23, 662.71],
	["N3", "N", "innovation", 799.61, 599.86],
];

const bounds = { x0: RING.cx - RING.r, y0: RING.cy - RING.r, x1: RING.cx + RING.r, y1: RING.cy + RING.r };
const letterPaths = LETTERS.map(([id, glyph, word, bx, by]) => {
	const c = word === "jpl" ? RING : ARC;
	const rot = Math.atan2(bx - c.cx, -(by - c.cy)) + (word === "jpl" ? 0 : Math.PI);
	const cos = Math.cos(rot), sin = Math.sin(rot);
	const map = ([u, v]) => {
		const p = [bx + u * cos - v * sin, by + u * sin + v * cos];
		bounds.x0 = Math.min(bounds.x0, p[0]), bounds.y0 = Math.min(bounds.y0, p[1]), bounds.x1 = Math.max(bounds.x1, p[0]), bounds.y1 = Math.max(bounds.y1, p[1]);
		return p;
	};
	const contours = GLYPHS[glyph]();
	const holes = contours.length > 1 ? ' fill-rule="evenodd"' : "";
	return `<path id="js-${id}" class="js-letter js-${word}" fill="${COLOUR[word]}"${holes} d="${contours.map((n) => outline(n, map)).join("")}"/>`;
});
const M = 24;
const vb = [Math.floor(bounds.x0 - M), Math.floor(bounds.y0 - M)];
vb.push(Math.ceil(bounds.x1 + M) - vb[0], Math.ceil(bounds.y1 + M) - vb[1]);
const stacked = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(" ")}" data-ring-cx="${RING.cx}" data-ring-cy="${RING.cy}" data-ring-r="${RING.r}" aria-hidden="true" focusable="false">
${letterPaths.join("\n")}
</svg>
`;
writeFileSync(`${OUT}/jpl-stacked.svg`, stacked);

/* ---------- Badge ---------- */
// Drawn in logo.jpg pixels, then moved into jpl-logo.svg's units: its ring is centred at 610.9, 163.9, radius 119.6.

const NAV = { cx: 610.9, cy: 163.9, r: 119.6, half: 128 };
const K = NAV.r / RING.r;
const J = ([x, y]) => [NAV.cx + (x - RING.cx) * K, NAV.cy + (y - RING.cy) * K];
const shape = (nodes) => outline(nodes, J);
const circle = ([x, y], r) => {
	const [cx, cy] = J([x, y]), R = r * K;
	return `M${pt([cx, cy - R])}A${f(R)} ${f(R)} 0 1 1 ${pt([cx, cy + R])}A${f(R)} ${f(R)} 0 1 1 ${pt([cx, cy - R])}Z`;
};
const C = { light: "#F0F8FC", dark: "#0D3F4D", navy: "#071F23", teal: "#1AA0C5" };

// Monitor: the bezel, the frame with its two side tabs, the screen. The notch left of the neck cuts both.
const bezel = shape([[379.5, 304.5, 16], [712.5, 304.5, 16], [712.5, 513.5, 16], [524.5, 513.5], [524.5, 483.5], [510.5, 483.5], [510.5, 513.5], [379.5, 513.5, 16]]);
const frame = shape([
	[395.5, 321.5, 5], [696.5, 321.5, 5], [696.5, 401.5], [712.5, 401.5], [712.5, 414.5], [696.5, 414.5], [696.5, 497.5, 5], [524.5, 497.5], [524.5, 483.5], [510.5, 483.5],
	[510.5, 497.5], [395.5, 497.5, 5], [395.5, 410.5], [379.5, 410.5], [379.5, 397.5], [395.5, 397.5],
]);
const screen = shape(rect(409.5, 335.5, 682.5, 483.5, 1));

// Signal waves: three arcs each side round the wrench, from 37° above level to 34.5° below, cut square to the arc.
const WC = [545.75, 410.5];
const wave = (side, r0, r1) => {
	const a0 = (-37 * Math.PI) / 180, a1 = (34.5 * Math.PI) / 180;
	const P = (r, a) => J([WC[0] + side * r * Math.cos(a), WC[1] + r * Math.sin(a)]);
	const s = side < 0 ? 0 : 1;
	return `M${pt(P(r1, a0))}A${f(r1 * K)} ${f(r1 * K)} 0 0 ${s} ${pt(P(r1, a1))}L${pt(P(r0, a1))}A${f(r0 * K)} ${f(r0 * K)} 0 0 ${1 - s} ${pt(P(r0, a0))}Z`;
};
const WAVES = [[52.4, 62.1], [74.4, 84.2], [96.6, 106.2]];

// Wrench: a ring-shaped head (outer 44, inner 30.5) whose open jaw comes down from the top to a V, and a handle with a
// light stripe and a teal tip that runs down into the stand.
const H = [546, 410.5];
const [slotL, slotR] = [534.5, 557.5];
const slotTop = H[1] - Math.sqrt(44 ** 2 - (H[0] - slotL) ** 2);
const slot = (() => {
	const a = J([slotL, slotTop]), b = J([slotR, slotTop]), R = 44 * K;
	return `M${pt(a)}A${f(R)} ${f(R)} 0 0 1 ${pt(b)}L${pt(J([slotR, 384]))}L${pt(J([slotL, 384]))}Z`;
})();
const jaws = shape([[519.75, 380], [slotL, 380], [slotL, 404.75], [546, 410.5], [slotR, 404.75], [slotR, 380], [572.25, 380], [572.25, 412.375], [546, 425.5], [519.75, 412.375]]);
const accent = (() => {
	const R = 7.5 * K;
	return `M${pt(J([538.5, 521.5]))}L${pt(J([553.5, 521.5]))}L${pt(J([553.5, 546]))}A${f(R)} ${f(R)} 0 0 1 ${pt(J([538.5, 546]))}Z`;
})();

const [gx, gy] = J(H);
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${NAV.cx - NAV.half} ${NAV.cy - NAV.half} ${2 * NAV.half} ${2 * NAV.half}" class="ds-badge-svg" aria-hidden="true" focusable="false">
<defs><radialGradient id="ds-glow-grad"><stop offset="0" stop-color="#7fe9ff" stop-opacity=".75"/><stop offset=".6" stop-color="#22d3ee" stop-opacity=".25"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient></defs>
<circle id="ds-badge-fill" class="ds-part" fill="${C.navy}" cx="${NAV.cx}" cy="${NAV.cy}" r="${NAV.r}"/>
<path id="ds-ring-rim" class="ds-part ds-ring" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="${f(0.9)}" pathLength="1" d="${circle([RING.cx, RING.cy], RING.r + 5.4)}"/>
<path id="ds-ring" class="ds-part ds-ring" fill="none" stroke="${C.teal}" stroke-width="${f(9 * K)}" pathLength="1" d="${circle([RING.cx, RING.cy], RING.r)}"/>
<g id="ds-monitor">
<path id="ds-bezel" class="ds-part" fill="${C.light}" d="${bezel}"/>
<path id="ds-bezel-line" class="ds-line" fill="none" stroke="${C.light}" stroke-width="1.2" pathLength="1" d="${bezel}"/>
<path id="ds-frame" class="ds-part" fill="${C.dark}" d="${frame}"/>
<path id="ds-frame-line" class="ds-line" fill="none" stroke="${C.teal}" stroke-width="1" pathLength="1" d="${frame}"/>
<path id="ds-screen" class="ds-part" fill="${C.light}" d="${screen}"/>
<ellipse id="ds-screen-glow" class="ds-part" fill="url(#ds-glow-grad)" cx="${f(gx)}" cy="${f(gy)}" rx="107.5" ry="70.4"/>
</g>
<g id="ds-stand">
<path id="ds-stand-base" class="ds-part ds-stand" fill="${C.dark}" d="${shape(rect(435.5, 554.5, 655.5, 583.5))}"/>
<path id="ds-stand-foot-l" class="ds-part ds-stand" fill="${C.light}" d="${shape([[424.4, 554.5, 1], [435.5, 554.5, 1], [435.5, 583.5, 1], [407.5, 583.5, 1]])}"/>
<path id="ds-stand-block-l" class="ds-part ds-stand" fill="${C.light}" d="${shape(rect(450.5, 554.5, 470.5, 583.5, 1))}"/>
<path id="ds-stand-plate" class="ds-part ds-stand" fill="${C.light}" d="${shape(rect(485.5, 567.5, 605.5, 583.5, 1))}"/>
<path id="ds-stand-block-r" class="ds-part ds-stand" fill="${C.light}" d="${shape(rect(620.5, 554.5, 640.5, 583.5, 1))}"/>
<path id="ds-stand-foot-r" class="ds-part ds-stand" fill="${C.light}" d="${shape([[655.5, 554.5, 1], [667.7, 554.5, 1], [684.5, 583.5, 1], [655.5, 583.5, 1]])}"/>
</g>
<g id="ds-waves">
${[3, 2, 1].map((k) => `<path id="ds-wave-l${k}" class="ds-part ds-wave" fill="${C.dark}" d="${wave(-1, ...WAVES[k - 1])}"/>`).join("\n")}
${[1, 2, 3].map((k) => `<path id="ds-wave-r${k}" class="ds-part ds-wave" fill="${C.dark}" d="${wave(1, ...WAVES[k - 1])}"/>`).join("\n")}
</g>
<g id="ds-wrench-x" class="ds-part"><g id="ds-wrench">
<path id="ds-wrench-body" fill="${C.dark}" d="${circle(H, 44)}${shape(rect(524.5, 440, 567.5, 567.5))}"/>
<path id="ds-wrench-inner" fill="${C.light}" d="${circle(H, 30.5)}${slot}"/>
<path id="ds-wrench-jaws" fill="${C.dark}" d="${jaws}"/>
<path id="ds-wrench-stripe" fill="${C.light}" d="${shape(rect(538.5, 455.5, 553.5, 530))}"/>
<path id="ds-wrench-accent" fill="${C.teal}" d="${accent}"/>
</g></g>
</svg>
`;
writeFileSync(`${OUT}/jpl-badge.svg`, badge);
console.log(`jpl-stacked.svg ${(stacked.length / 1024).toFixed(1)} KB (viewBox ${vb.join(" ")}), jpl-badge.svg ${(badge.length / 1024).toFixed(1)} KB; wrench pivot ${f(gx)} ${f(gy)}`);
