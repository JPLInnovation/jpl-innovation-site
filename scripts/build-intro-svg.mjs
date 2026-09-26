// Builds src/assets/intro/jpl-logo.svg: the JPL Innovation logo as ONE inline-able SVG in which every
// animated part is its own <path> (13 letters, badge, monitor, stand, 6 waves, wrench group).
//
// Source: the potrace output of D:\Animated logo AE\Scripts\trace_logo.py, which lives inside the After
// Effects builder it writes (build_logo_vector.jsx), plus the measured circles in trace_report.json.
// Those vertices are in AE comp space; this converts them back to pixels of the 770x315 JPL_INNOVATION.png
// (the same file the navbar logo is cropped from), rounds to 0.1 px and writes compact relative path data.
//
// The viewBox (49 40 687 248) is exactly the crop that scripts/make-logo-assets.mjs gives the navbar
// PNG (sharp trim offset), so the SVG and the navbar logo line up pixel for pixel at any size.
//
// Run:  node scripts/build-intro-svg.mjs ["path/to/build_logo_vector.jsx"] ["path/to/trace_report.json"]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { gzipSync } from "node:zlib";

const JSX = process.argv[2] ?? "D:/Animated logo AE/Scripts/build_logo_vector.jsx";
const REPORT = process.argv[3] ?? "D:/Animated logo AE/Previews/trace_report.json";
const OUT = "src/assets/intro/jpl-logo.svg";

// trace_logo.py: comp = OFFSET + SCALE * png
const SCALE = 1.682;
const OFFSET = [946.54 - 385 * SCALE, 460.75 - 157.5 * SCALE];
const VIEWBOX = [49, 40, 687, 248]; // navbar PNG crop (trimOffsetLeft/Top of JPL_INNOVATION.png)

// Colours from trace_report.json's palette, plus the two letter faces the trace measured.
const report = JSON.parse(readFileSync(REPORT, "utf8"));
const C = {
	ring: report.palette.ring, // #109DC0
	dark: report.palette.dark, // #071F23 badge fill
	light: report.palette.bezel, // #ECF5F8 bezel, screen, stand pieces, wrench inner/stripe
	ink: report.palette.ink, // #0D3F4D frame, stand base, waves, wrench
	silver: "#D6D6D6", // "JPL"
	cyan: "#0CBDDC", // "INNOVATION"
	navy: "#0E1B2C", // "JPL" in the light-theme navbar logo (make-logo-assets.mjs INK)
	metal: "#DCE3EA",
};

/* ---------- read the traced layers out of the AE builder ---------- */
const src = readFileSync(JSX, "utf8");
const start = src.indexOf('{"layers"');
let depth = 0;
let end = start;
for (; end < src.length; end++) {
	if (src[end] === "{") depth++;
	else if (src[end] === "}" && --depth === 0) break;
}
const data = JSON.parse(src.slice(start, end + 1));
const layer = (name) => {
	const l = data.layers.find((x) => x.name === name);
	if (!l) throw new Error(`layer "${name}" not in ${JSX}`);
	return l;
};
const toPng = (x, y) => [(x - OFFSET[0]) / SCALE, (y - OFFSET[1]) / SCALE];

/* ---------- compact path data: integer tenths, relative commands ---------- */
const T = (n) => Math.round(n * 10); // px -> tenths
const num = (t) => {
	// tenths -> shortest decimal string: 12 -> "1.2", -5 -> "-.5", 30 -> "3"
	const s = (t / 10).toString();
	return s.replace(/^(-?)0\./, "$1.");
};
const join = (nums) => nums.map(num).join(" ").replace(/ -/g, "-");

function pathData(l) {
	let d = "";
	for (const p of l.paths) {
		const n = p.v.length;
		const abs = p.v.map(([x, y]) => toPng(l.pos[0] + x, l.pos[1] + y));
		const V = abs.map(([x, y]) => [T(x), T(y)]);
		const I = p.i.map(([x, y], k) => [T(abs[k][0] + x / SCALE), T(abs[k][1] + y / SCALE)]);
		const O = p.o.map(([x, y], k) => [T(abs[k][0] + x / SCALE), T(abs[k][1] + y / SCALE)]);
		const straight = (k, k2) => p.o[k][0] === 0 && p.o[k][1] === 0 && p.i[k2][0] === 0 && p.i[k2][1] === 0;
		d += `M${join(V[0])}`;
		let cur = V[0];
		for (let k = 0; k < n; k++) {
			const k2 = (k + 1) % n;
			const last = k2 === 0;
			if (straight(k, k2)) {
				if (last) break; // "z" draws the closing line
				const dx = V[k2][0] - cur[0];
				const dy = V[k2][1] - cur[1];
				d += dy === 0 ? `h${num(dx)}` : dx === 0 ? `v${num(dy)}` : `l${join([dx, dy])}`;
			} else {
				d += `c${join([O[k][0] - cur[0], O[k][1] - cur[1], I[k2][0] - cur[0], I[k2][1] - cur[1], V[k2][0] - cur[0], V[k2][1] - cur[1]])}`;
			}
			cur = V[k2];
		}
		d += "z";
	}
	return d;
}

/* ---------- measured circles (badge fill + ring) ---------- */
const M = report.measurements;
const f1 = (n) => Math.round(n * 10) / 10;
// The PNG ring's bright band runs r 117.3-121.8 (sampled); r_out (the 0.5-alpha edge) also takes in a dark
// outer rim and soft shadow, so the band is drawn at its sampled centre/width and the rim as a faint dark stroke.
const ringR = 119.6;
const ringW = 4.6;
const rimR = f1(M.r_out);
// Starts at 12 o'clock and runs clockwise, so a stroke-dashoffset draw-on travels round like a clock hand.
const circleD = (r) => `M${f1(M.cx)} ${f1(M.cy - r)}a${r} ${r} 0 1 1 0 ${f1(2 * r)}a${r} ${r} 0 1 1 0-${f1(2 * r)}`;

/* ---------- parts ---------- */
const pivot = toPng(...data.groups["Wrench Group"].pos).map(f1); // wrench head centre
const letters = [
	["J", "Letter J", "silver"],
	["P", "Letter P", "silver"],
	["L", "Letter L", "silver"],
	["I1", "Letter I (1)", "cyan"],
	["N1", "Letter N (1)", "cyan"],
	["N2", "Letter N (2)", "cyan"],
	["O1", "Letter O (1)", "cyan"],
	["V", "Letter V", "cyan"],
	["A", "Letter A", "cyan"],
	["T", "Letter T", "cyan"],
	["I2", "Letter I (2)", "cyan"],
	["O2", "Letter O (2)", "cyan"],
	["N3", "Letter N (3)", "cyan"],
];
const waves = [
	["wave-l3", "Wave L Outer"],
	["wave-l2", "Wave L Middle"],
	["wave-l1", "Wave L Inner"],
	["wave-r1", "Wave R Inner"],
	["wave-r2", "Wave R Middle"],
	["wave-r3", "Wave R Outer"],
];
const stand = [
	["stand-base", "Stand Base", C.ink],
	["stand-foot-l", "Stand Foot L", C.light],
	["stand-block-l", "Stand Block L", C.light],
	["stand-plate", "Stand Plate", C.light],
	["stand-block-r", "Stand Block R", C.light],
	["stand-foot-r", "Stand Foot R", C.light],
];
const P = (id, name, fill, cls, extra = "") => `<path id="jl-${id}" class="${cls}" fill="${fill}"${extra} d="${pathData(layer(name))}"/>`;

// Screen glow ellipse sized to the screen, and the wordmark's vertical band for the cursor.
const scr = { x: f1(M.scr_l), y: f1(M.scr_t), w: f1(M.scr_r - M.scr_l), h: f1(M.scr_b - M.scr_t) };
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX.join(" ")}" class="jl-logo" aria-hidden="true" focusable="false">
<defs>
<linearGradient id="jl-metal-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="${C.metal}"/><stop offset="1" stop-color="#9aa6b2"/></linearGradient>
<radialGradient id="jl-glow-grad"><stop offset="0" stop-color="#7fe9ff" stop-opacity=".75"/><stop offset=".6" stop-color="#22d3ee" stop-opacity=".25"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient>
<linearGradient id="jl-sweep-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<clipPath id="jl-clip">${letters.map(([id]) => `<use href="#jl-${id}"/>`).join("")}<circle cx="${f1(M.cx)}" cy="${f1(M.cy)}" r="${rimR}"/></clipPath>
</defs>
<g id="jl-badge" class="jl-badge">
<circle id="jl-badge-fill" class="jl-part" fill="${C.dark}" cx="${f1(M.cx)}" cy="${f1(M.cy)}" r="${f1(M.r_in + 1.2)}"/>
<path id="jl-ring-rim" class="jl-part jl-ring" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2" pathLength="1" d="${circleD(rimR)}"/>
<path id="jl-ring" class="jl-part jl-ring" fill="none" stroke="${C.ring}" stroke-width="${ringW}" pathLength="1" d="${circleD(ringR)}"/>
<g id="jl-monitor">
${P("bezel", "Monitor Bezel", C.light, "jl-part jl-bezel")}
${P("bezel-line", "Monitor Bezel", "none", "jl-line", ` stroke="${C.light}" stroke-width="2" pathLength="1"`)}
${P("frame", "Monitor Frame", C.ink, "jl-part jl-frame")}
${P("frame-line", "Monitor Frame", "none", "jl-line", ` stroke="${C.ring}" stroke-width="1.6" pathLength="1"`)}
${P("screen", "Monitor Screen", C.light, "jl-part jl-screen")}
<ellipse id="jl-screen-glow" class="jl-part" fill="url(#jl-glow-grad)" cx="${f1(scr.x + scr.w / 2)}" cy="${f1(scr.y + scr.h / 2)}" rx="${f1(scr.w * 0.75)}" ry="${f1(scr.h * 0.9)}"/>
</g>
<g id="jl-stand">
${stand.map(([id, name, fill]) => P(id, name, fill, "jl-part jl-stand")).join("\n")}
</g>
<g id="jl-waves">
${waves.map(([id, name]) => P(id, name, C.ink, "jl-part jl-wave")).join("\n")}
</g>
<g id="jl-wrench-x" class="jl-part"><g id="jl-wrench-y"><g id="jl-wrench" class="jl-wrench" data-pivot="${pivot.join(" ")}">
${P("wrench-body", "Wrench", C.ink, "jl-wrench-piece")}
${P("wrench-inner", "Wrench Inner", C.light, "jl-wrench-piece")}
${P("wrench-stripe", "Wrench Stripe", C.light, "jl-wrench-piece")}
${P("wrench-accent", "Wrench Accent", C.ring, "jl-wrench-piece")}
${P("wrench-metal", "Wrench", "url(#jl-metal-grad)", "jl-metal")}
</g></g></g>
</g>
<g id="jl-letters">
${letters.map(([id, name, face]) => P(id, name, C[face], `jl-part jl-letter jl-${face}`)).join("\n")}
</g>
<g id="jl-jpl-ink" class="jl-jpl-ink">
${letters.slice(0, 3).map(([id, name]) => P(`${id}-ink`, name, C.navy, "jl-ink-letter")).join("\n")}
</g>
<rect id="jl-cursor" class="jl-part jl-cursor" fill="#22d3ee" x="0" y="0" width="3" height="10" rx="1.5"/>
<g clip-path="url(#jl-clip)"><rect id="jl-sweep" class="jl-part jl-sweep" fill="url(#jl-sweep-grad)" x="-200" y="30" width="120" height="270"/></g>
</svg>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg);
const parts = svg.match(/<path /g).length;
console.log(`${OUT}: ${parts} paths, ${svg.length} bytes, ${gzipSync(svg).length} bytes gzipped; wrench pivot ${pivot}`);
