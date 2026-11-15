/**
 * The JPL Innovation badge, drawn as clean geometry (the round badge: a monitor with signal waves around a wrench, on a
 * stand). The original artwork is a small raster whose traced shapes had soft, broken edges (notches in the monitor's
 * outline, a ragged ring); this draws the same design with exact shapes instead.
 *
 * It rewrites the badge inside the two intro logos, keeping every part's id and class (the intros animate them part by
 * part) and the artwork's own colour codes (the pages map those to the site's palette in CSS):
 *   src/assets/intro/jpl-logo.svg   the JPL intro (ids jl-*), view box 49 40 687 248
 *   src/assets/intro/jpl-badge.svg  the drone intro (ids ds-*), the same coordinates
 * Then run scripts/make-logo-theme.mjs, which renders every logo file from jpl-logo.svg.
 *
 *     node scripts/build-badge.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const C = { x: 610.9, y: 163.9 }; // the badge's centre (as the artwork)
const H = { x: 610.5, y: 147.5 }; // the pivot the intros turn the wrench and waves about (the wrench head's centre)
const f = (n) => Number(n.toFixed(2));

/** A rounded rectangle as a path, clockwise from the top-left corner. */
const rrect = (x0, y0, x1, y1, r) =>
	`M${f(x0 + r)} ${f(y0)}H${f(x1 - r)}A${r} ${r} 0 0 1 ${f(x1)} ${f(y0 + r)}V${f(y1 - r)}A${r} ${r} 0 0 1 ${f(x1 - r)} ${f(y1)}H${f(x0 + r)}A${r} ${r} 0 0 1 ${f(x0)} ${f(y1 - r)}V${f(y0 + r)}A${r} ${r} 0 0 1 ${f(x0 + r)} ${f(y0)}Z`;
/** The same rounded rectangle drawn the other way round (anticlockwise): merges with shapes drawn that way, where a
 * clockwise one would cancel them out and leave a hole where the two overlap. */
const rrectCCW = (x0, y0, x1, y1, r) =>
	`M${f(x0 + r)} ${f(y0)}A${r} ${r} 0 0 0 ${f(x0)} ${f(y0 + r)}V${f(y1 - r)}A${r} ${r} 0 0 0 ${f(x0 + r)} ${f(y1)}H${f(x1 - r)}A${r} ${r} 0 0 0 ${f(x1)} ${f(y1 - r)}V${f(y0 + r)}A${r} ${r} 0 0 0 ${f(x1 - r)} ${f(y0)}Z`;
/** A full circle as a path starting at the top, clockwise (so a dash draw goes round from 12 o'clock). */
const circle = (cx, cy, r) => `M${f(cx)} ${f(cy - r)}A${r} ${r} 0 1 1 ${f(cx)} ${f(cy + r)}A${r} ${r} 0 1 1 ${f(cx)} ${f(cy - r)}Z`;
/** A band along an arc (a signal wave) with round ends: centre, mid radius, half width, from and to angles in degrees. */
function arcBand(cx, cy, r, w, a0, a1) {
	const rad = (a) => (a * Math.PI) / 180;
	const pt = (rr, a) => `${f(cx + rr * Math.cos(rad(a)))} ${f(cy + rr * Math.sin(rad(a)))}`;
	const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
	return `M${pt(r + w, a0)}A${r + w} ${r + w} 0 ${large} 1 ${pt(r + w, a1)}A${w} ${w} 0 0 1 ${pt(r - w, a1)}A${r - w} ${r - w} 0 ${large} 0 ${pt(r - w, a0)}A${w} ${w} 0 0 1 ${pt(r + w, a0)}Z`;
}
/** The wrench's solid shape: the round head and the handle as one outline (both drawn the same way round). */
function wrenchBody() {
	// Both clockwise (circle() and rrect()): drawn opposite ways, their overlap would cancel out into a hole.
	return `${circle(head.x, head.y, head.r)}${rrect(head.x - handle.half, handle.top, head.x + handle.half, handle.bottom, 3)}`;
}
/**
 * Where the head is open, painted in the screen's cream (one path, even-odd): the ring's inside, minus the jaw (two
 * prongs joined by a V), plus the jaw's slot. That leaves what the artwork shows: a thin U-shaped gap around the jaw,
 * widest under its V, and the slot between the prongs.
 */
function wrenchCuts() {
	const top = head.y - head.r - 2;
	const inside = circle(head.x, head.y, rim.inner);
	const dy = Math.sqrt(rim.inner * rim.inner - jaw.half * jaw.half);
	const jawPath = `M${f(head.x - jaw.half)} ${f(head.y - dy)}A${rim.inner} ${rim.inner} 0 0 1 ${f(head.x + jaw.half)} ${f(head.y - dy)}V${jaw.bottom}L${head.x} ${jaw.apex}L${f(head.x - jaw.half)} ${jaw.bottom}Z`;
	const slotPath = `M${f(head.x - slot.half)} ${f(top)}H${f(head.x + slot.half)}V${f(slot.bottom)}L${f(head.x)} ${f(slot.tip)}L${f(head.x - slot.half)} ${f(slot.bottom)}Z`;
	return inside + jawPath + slotPath;
}

// The monitor: a cream bezel, a deep frame band inside it, the pale screen.
const bezel = { x0: 524.5, y0: 92, x1: 697.3, y1: 203, r: 9 };
const frame = { x0: 531.5, y0: 99, x1: 690.3, y1: 196, r: 5 };
const screen = { x0: 537.5, y0: 105, x1: 684.3, y1: 190, r: 3 };
const ring = { r: 120.3, w: 4.6 };
// Measured from the original artwork (public/assets/JPL_INNOVATION.jpg, scanned row by row), so the redraw keeps its
// proportions: a bold open-end wrench whose head is about twice the handle's width.
const wave = { w: 3, span: 36, radii: [30, 41.5, 53] };
const head = { x: 610.5, y: 148, r: 23 }; // the wrench head
const slot = { half: 4, bottom: 144, tip: 147 }; // the jaw's opening at the top (8 wide, between two prongs), its floor a shallow V
const rim = { inner: 15 }; // the head is a ring 8 thick; its inside is open around the jaw
const jaw = { half: 13, bottom: 148, apex: 156 }; // the jaw inside it: two prongs joined by a V, pointing down
const handle = { half: 11, top: 160, bottom: 223 }; // the handle, 22 wide, into the stand
const channel = { half: 3.5, top: 170, bottom: 221, tip: 208 }; // the cream channel down it, a coloured tip at its foot

/** Every part of the badge, ids prefixed (jl or ds), in the artwork's own colours (CSS maps them to the palette). */
function badgeParts(p, col) {
	const waves = (side) =>
		[3, 2, 1].map((n, k) => {
			const r = wave.radii[n - 1];
			const [a0, a1] = side === "l" ? [180 - wave.span, 180 + wave.span] : [-wave.span, wave.span];
			return `<path id="${p}-wave-${side}${n}" class="${p}-part ${p}-wave" fill="${col.deep}" d="${arcBand(H.x, H.y, r, wave.w, a0, a1)}"/>`;
		});
	const wavesR = [1, 2, 3].map((n) => {
		const r = wave.radii[n - 1];
		return `<path id="${p}-wave-r${n}" class="${p}-part ${p}-wave" fill="${col.deep}" d="${arcBand(H.x, H.y, r, wave.w, -wave.span, wave.span)}"/>`;
	});
	const footL = `M535 237L543.5 229H552V237Z`;
	const footR = `M${f(2 * H.x - 535)} 237L${f(2 * H.x - 543.5)} 229H${f(2 * H.x - 552)}V237Z`;
	return [
		`<circle id="${p}-badge-fill" class="${p}-part" fill="${col.disc}" cx="${C.x}" cy="${C.y}" r="118.4"/>`,
		`<path id="${p}-ring-rim" class="${p}-part ${p}-ring" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1.6" pathLength="1" d="${circle(C.x, C.y, ring.r + ring.w / 2 + 0.6)}"/>`,
		`<path id="${p}-ring" class="${p}-part ${p}-ring" fill="none" stroke="${col.accent}" stroke-width="${ring.w}" pathLength="1" d="${circle(C.x, C.y, ring.r)}"/>`,
		`<g id="${p}-monitor">`,
		`<path id="${p}-bezel" class="${p}-part ${p === "jl" ? "jl-bezel" : ""}" fill="${col.light}" fill-rule="evenodd" d="${rrect(bezel.x0, bezel.y0, bezel.x1, bezel.y1, bezel.r)}${rrect(frame.x0, frame.y0, frame.x1, frame.y1, frame.r)}"/>`,
		`<path id="${p}-bezel-line" class="${p}-line" fill="none" stroke="${col.light}" stroke-width="2" pathLength="1" d="${rrect(bezel.x0, bezel.y0, bezel.x1, bezel.y1, bezel.r)}"/>`,
		`<path id="${p}-frame" class="${p}-part ${p === "jl" ? "jl-frame" : ""}" fill="${col.deep}" fill-rule="evenodd" d="${rrect(frame.x0, frame.y0, frame.x1, frame.y1, frame.r)}${rrect(screen.x0, screen.y0, screen.x1, screen.y1, screen.r)}"/>`,
		`<path id="${p}-frame-line" class="${p}-line" fill="none" stroke="${col.accent}" stroke-width="1.4" pathLength="1" d="${rrect(frame.x0, frame.y0, frame.x1, frame.y1, frame.r)}"/>`,
		`<path id="${p}-screen" class="${p}-part ${p === "jl" ? "jl-screen" : ""}" fill="${col.light}" d="${rrect(screen.x0, screen.y0, screen.x1, screen.y1, screen.r)}"/>`,
		`<ellipse id="${p}-screen-glow" class="${p}-part" fill="url(#${p}-glow-grad)" cx="${H.x}" cy="${H.y}" rx="107.5" ry="70.4"/>`,
		`</g>`,
		`<g id="${p}-stand">`,
		`<path id="${p}-stand-base" class="${p}-part ${p}-stand" fill="${col.deep}" d="${rrect(head.x - 15, frame.y1, head.x + 15, 229.5, 1.5)}"/>`,
		`<path id="${p}-stand-foot-l" class="${p}-part ${p}-stand" fill="${col.light}" d="${footL}"/>`,
		`<path id="${p}-stand-block-l" class="${p}-part ${p}-stand" fill="${col.light}" d="${rrect(557, 229, 567, 237, 1)}"/>`,
		`<path id="${p}-stand-plate" class="${p}-part ${p}-stand" fill="${col.light}" d="${rrect(576, 229, f(2 * H.x - 576), 237, 1.5)}"/>`,
		`<path id="${p}-stand-block-r" class="${p}-part ${p}-stand" fill="${col.light}" d="${rrect(f(2 * H.x - 567), 229, f(2 * H.x - 557), 237, 1)}"/>`,
		`<path id="${p}-stand-foot-r" class="${p}-part ${p}-stand" fill="${col.light}" d="${footR}"/>`,
		`</g>`,
		`<g id="${p}-waves">`,
		...waves("l"),
		...wavesR,
		`</g>`,
		p === "jl"
			? `<g id="jl-wrench-x" class="jl-part"><g id="jl-wrench-y"><g id="jl-wrench" class="jl-wrench" data-pivot="${H.x} ${H.y}">`
			: `<g id="ds-wrench-x" class="ds-part"><g id="ds-wrench">`,
		// The wrench: the deep body (head and handle), the cut-outs and the channel in the screen's cream, a coloured tip.
		`<path id="${p}-wrench-body" class="${p}-wrench-piece" fill="${col.deep}" d="${wrenchBody()}"/>`,
		`<path id="${p}-wrench-inner" class="${p}-wrench-piece" fill="${col.light}" fill-rule="evenodd" d="${wrenchCuts()}"/>`,
		p === "ds" ? `<path id="ds-wrench-jaws" fill="${col.deep}" d="M${H.x} ${H.y}Z"/>` : "",
		`<path id="${p}-wrench-stripe" class="${p}-wrench-piece" fill="${col.light}" d="${rrect(head.x - channel.half, channel.top, head.x + channel.half, channel.bottom, channel.half)}"/>`,
		`<path id="${p}-wrench-accent" class="${p}-wrench-piece" fill="${col.accent}" d="M${f(head.x - channel.half)} ${channel.tip}H${f(head.x + channel.half)}V${f(channel.bottom - channel.half)}A${channel.half} ${channel.half} 0 0 1 ${f(head.x - channel.half)} ${f(channel.bottom - channel.half)}Z"/>`,
		p === "jl" ? `<path id="jl-wrench-metal" class="jl-metal" fill="url(#jl-metal-grad)" d="${wrenchBody()}"/>` : "",
		p === "jl" ? `</g></g></g>` : `</g></g>`,
	]
		.filter(Boolean)
		.join("\n");
}

/** Replaces the element that starts at `startTag` (and everything nested in it) with `replacement`. */
function replaceElement(svg, startTag, replacement) {
	const start = svg.indexOf(startTag);
	if (start < 0) throw new Error(`not found: ${startTag}`);
	let depth = 0;
	const re = /<(\/?)g\b[^>]*?(\/?)>/g;
	re.lastIndex = start;
	let m;
	while ((m = re.exec(svg))) {
		if (m[2] === "/") continue;
		depth += m[1] ? -1 : 1;
		if (depth === 0) return svg.slice(0, start) + replacement + svg.slice(m.index + m[0].length);
	}
	throw new Error("unbalanced <g>");
}

// The JPL intro's logo: the badge group, colours as the artwork's (IntroSplash.astro maps them).
const jl = { disc: "#071F23", deep: "#0D3F4D", light: "#ECF5F8", accent: "#109DC0" };
const logoPath = "src/assets/intro/jpl-logo.svg";
const logo = readFileSync(logoPath, "utf8");
writeFileSync(logoPath, replaceElement(logo, '<g id="jl-badge" class="jl-badge">', `<g id="jl-badge" class="jl-badge">\n${badgeParts("jl", jl)}\n</g>`));

// The drone intro's badge: everything after its <defs>, colours as its own artwork codes (DroneSplash.astro maps them).
const ds = { disc: "#071F23", deep: "#0D3F4D", light: "#F0F8FC", accent: "#1AA0C5" };
const badgePath = "src/assets/intro/jpl-badge.svg";
const badge = readFileSync(badgePath, "utf8");
const defsHead = badge.slice(0, badge.indexOf("</defs>") + "</defs>".length);
writeFileSync(badgePath, `${head}\n${badgeParts("ds", ds)}\n</svg>\n`);
console.log("badge redrawn in", logoPath, "and", badgePath);
