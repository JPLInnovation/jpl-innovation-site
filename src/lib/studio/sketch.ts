/**
 * The sketchbook on the desk (the second scene): the F450 drone's design page, drawn by hand-style strokes as the camera
 * comes to it. The left page is what it has to do (a list of goals, not ticked) with a sketch of the camera's tilt mount
 * and of the flight controller; the right page is the drone from above, how it fits together underneath, and the
 * roadmap with "we are here". In graphite, blue and red pen, in Caveat (public/fonts).
 *
 * Words: src/text/studio.ts (`sketchText`); the facts in them are the drone page's (src/text/projects/drone.ts).
 *
 * How it is drawn: the page is built once as a list of marks in drawing order (short pen segments, words, a few
 * highlighter bars). Showing it up to some share of that list only draws the marks added since last time onto the
 * canvas that is already there, so revealing it costs a few strokes, not a repaint of the page.
 */
import type { SketchText } from "../../text/studio";

export const SKETCH_WIDTH = 2048;
export const SKETCH_HEIGHT = 732;

type Ink = "graphite" | "blue" | "red" | "marker" | "pale";
const INK: Record<Ink, string> = {
	graphite: "#252a36",
	blue: "#1d4fc0",
	red: "#c4312b",
	marker: "rgba(255, 207, 40, 0.55)",
	pale: "rgba(37, 42, 54, 0.5)",
};

interface Seg {
	k: 0;
	x0: number;
	y0: number;
	x1: number;
	y1: number;
	w: number;
	ink: Ink;
}
interface Word {
	k: 1;
	text: string;
	x: number;
	y: number;
	size: number;
	ink: Ink;
	rot: number;
}
interface Bar {
	k: 2;
	x: number;
	y: number;
	w: number;
	h: number;
	ink: Ink;
}
type Mark = Seg | Word | Bar;
type Pt = [number, number];

export interface SketchSteps {
	/** "done" | "current" | "upcoming", in the roadmap's order (src/text/projects/drone.ts). */
	states: readonly string[];
}

const FONT = '"Caveat", "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
const font = (size: number) => `600 ${size}px ${FONT}`;

/** The page, laid out: every mark in the order it is drawn. */
function layout(text: SketchText, steps: SketchSteps, g: CanvasRenderingContext2D): Mark[] {
	const marks: Mark[] = [];
	let seed = 29;
	const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	const jit = (amount: number) => (rand() - 0.5) * amount;

	/* ---------- Pen ---------- */
	const stroke = (pts: Pt[], w = 2.6, ink: Ink = "graphite") => {
		for (let i = 1; i < pts.length; i++) marks.push({ k: 0, x0: pts[i - 1][0], y0: pts[i - 1][1], x1: pts[i][0], y1: pts[i][1], w: w * (0.86 + rand() * 0.28), ink });
	};
	const line = (x0: number, y0: number, x1: number, y1: number, w = 2.6, ink: Ink = "graphite") => {
		const len = Math.hypot(x1 - x0, y1 - y0) || 1;
		const n = Math.max(2, Math.round(len / 24));
		const nx = -(y1 - y0) / len;
		const ny = (x1 - x0) / len;
		const bow = jit(len * 0.014);
		const pts: Pt[] = [];
		for (let i = 0; i <= n; i++) {
			const t = i / n;
			const off = Math.sin(t * Math.PI) * bow + jit(0.9);
			pts.push([x0 + (x1 - x0) * t + nx * off, y0 + (y1 - y0) * t + ny * off]);
		}
		stroke(pts, w, ink);
	};
	const dashed = (x0: number, y0: number, x1: number, y1: number, w = 1.8, ink: Ink = "graphite", dash = 14, gap = 9) => {
		const len = Math.hypot(x1 - x0, y1 - y0) || 1;
		const ux = (x1 - x0) / len;
		const uy = (y1 - y0) / len;
		for (let d = 0; d < len; d += dash + gap) {
			const e = Math.min(len, d + dash);
			line(x0 + ux * d, y0 + uy * d, x0 + ux * e, y0 + uy * e, w, ink);
		}
	};
	/** An arc (or circle) round (cx, cy); angles in radians, 0 to the right, clockwise on the page. */
	const arc = (cx: number, cy: number, rx: number, ry: number, from = 0, to = Math.PI * 2, w = 2.4, ink: Ink = "graphite") => {
		const len = Math.abs(to - from) * Math.max(rx, ry);
		const n = Math.max(10, Math.round(len / 15));
		const pts: Pt[] = [];
		for (let i = 0; i <= n; i++) {
			const a = from + ((to - from) * i) / n;
			const wob = 1 + jit(0.014) + (to - from > 6 ? (i / n) * 0.02 : 0);
			pts.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob]);
		}
		stroke(pts, w, ink);
	};
	const rect = (x: number, y: number, w: number, h: number, sw = 2.6, ink: Ink = "graphite") => {
		line(x - 3, y + jit(2), x + w + 4, y + jit(2), sw, ink);
		line(x + w + jit(2), y - 3, x + w + jit(2), y + h + 4, sw, ink);
		line(x + w + 3, y + h + jit(2), x - 4, y + h + jit(2), sw, ink);
		line(x + jit(2), y + h + 3, x + jit(2), y - 4, sw, ink);
	};
	const head = (x0: number, y0: number, x1: number, y1: number, ink: Ink, size = 15) => {
		const a = Math.atan2(y1 - y0, x1 - x0);
		for (const s of [-1, 1]) line(x1, y1, x1 - Math.cos(a + s * 0.5) * size, y1 - Math.sin(a + s * 0.5) * size, 2.4, ink);
	};
	const arrow = (x0: number, y0: number, x1: number, y1: number, w = 2.4, ink: Ink = "graphite") => {
		line(x0, y0, x1, y1, w, ink);
		head(x0, y0, x1, y1, ink);
	};
	const squiggle = (x0: number, x1: number, y: number, ink: Ink = "graphite", w = 2.2) => {
		const pts: Pt[] = [];
		for (let x = x0; x <= x1; x += 9) pts.push([x, y + Math.sin((x - x0) / 7) * 2.4 + jit(0.8)]);
		stroke(pts, w, ink);
	};
	const loop = (cx: number, cy: number, rx: number, ry: number, ink: Ink = "red", w = 2.6) => {
		const pts: Pt[] = [];
		const turns = 1.12;
		const n = 46;
		for (let i = 0; i <= n; i++) {
			const t = -0.5 + (i / n) * Math.PI * 2 * turns;
			const grow = 1 + 0.07 * (i / n);
			pts.push([cx + Math.cos(t) * rx * grow, cy + Math.sin(t) * ry * grow]);
		}
		stroke(pts, w, ink);
	};
	const highlight = (x: number, y: number, w: number, h: number) => marks.push({ k: 2, x, y, w, h, ink: "marker" });

	/* ---------- Handwriting ---------- */
	/** Writes `str` word by word from (x, y) (the baseline); wraps at `maxW`. Returns the width of the longest line and the last baseline. */
	const write = (str: string, x: number, y: number, size: number, ink: Ink = "graphite", maxW = Infinity, rot = 0) => {
		g.font = font(size);
		const space = size * 0.27;
		let cx = x;
		let cy = y;
		let widest = 0;
		for (const word of str.split(" ")) {
			const ww = g.measureText(word).width;
			if (cx > x && cx + ww - x > maxW) {
				cx = x;
				cy += size * 1.02;
			}
			marks.push({ k: 1, text: word, x: cx, y: cy + jit(1.6) + (cx - x) * Math.sin(rot), size, ink, rot: rot + jit(0.03) });
			cx += ww + space;
			widest = Math.max(widest, cx - space - x);
		}
		return { w: widest, y: cy };
	};
	const width = (str: string, size: number) => {
		g.font = font(size);
		return g.measureText(str).width;
	};

	const left = 96;
	const rightPage = 1090;

	/* ================= Left page ================= */
	// Title, underlined twice, and the honest tag.
	const title = write(text.title, left, 118, 76, "blue");
	squiggle(left, left + title.w, 136, "blue");
	squiggle(left + 6, left + title.w - 10, 144, "blue", 1.8);
	const statusW = width(text.status, 36);
	const statusX = 972 - statusW - 26;
	write(text.status, statusX, 108, 36, "red", Infinity, -0.03);
	loop(statusX + statusW / 2, 97, statusW / 2 + 24, 28, "red");

	// What it has to do: goals in boxes (nothing ticked: none of it is done yet).
	const headW = width(text.criteriaHeading, 44);
	highlight(left - 8, 166, headW + 18, 36);
	write(text.criteriaHeading, left, 196, 44);
	line(left, 207, left + headW, 206, 2.4);
	text.criteria.forEach((item, i) => {
		const y = 250 + i * 46;
		rect(left + 4, y - 24, 25, 25, 2.4, "blue");
		write(item, left + 50, y - 2, 35, "graphite", 820);
	});
	line(left, 458, 968, 455, 1.6, "pale");

	// Camera: the tilt mount from the side, the angle, the ribbon.
	{
		const x0 = left;
		write(text.camera.heading, x0, 496, 40, "blue");
		squiggle(x0, x0 + width(text.camera.heading, 40), 505, "blue", 1.8);
		const plateY = 545;
		line(x0 + 4, plateY, x0 + 236, plateY, 3.8); // the frame's underside
		line(x0 + 38, plateY, x0 + 38, plateY + 14, 2.4);
		line(x0 + 54, plateY, x0 + 54, plateY + 14, 2.4);
		const hx = x0 + 66;
		const hy = plateY + 36; // the hinge
		line(x0 + 38, plateY + 14, hx - 2, hy - 4, 2.4);
		line(x0 + 54, plateY + 14, hx + 6, hy - 6, 2.4);
		arc(hx, hy, 7, 7, 0, Math.PI * 2, 2.4);
		dashed(hx, hy, hx + 112, hy, 1.8, "pale", 10, 8); // level: 0°
		const tilt = (45 * Math.PI) / 180;
		const ux = Math.cos(tilt);
		const uy = Math.sin(tilt);
		const px = -uy;
		const py = ux;
		const corner = (a: number, b: number): Pt => [hx + ux * a + px * b, hy + uy * a + py * b];
		stroke([corner(6, -17), corner(66, -17), corner(66, 17), corner(6, 17), corner(6, -17)], 2.8); // the camera
		arc(...corner(66, 0), 9, 9, 0, Math.PI * 2, 2.4); // the lens
		for (const side of [-1, 1]) line(...corner(76, 0), ...corner(128, side * 28), 1.4, "pale");
		arc(hx, hy, 70, 70, 0, tilt, 2, "red");
		head(hx + 70, hy, hx + Math.cos(tilt) * 70, hy + Math.sin(tilt) * 70, "red", 10);
		write(text.camera.level, hx + 122, hy + 7, 28, "red");
		write(text.camera.down, hx + 56, hy + 98, 28, "red");
		// The ribbon back up to the plate, in blue, with its label above.
		stroke([corner(24, -17), corner(24, -34), [hx + 10, plateY + 22], [x0 + 128, plateY + 10], [x0 + 150, plateY - 14]], 2.2, "blue");
		head(x0 + 128, plateY + 10, x0 + 150, plateY - 14, "blue", 10);
		write(text.camera.ribbon, x0 + 70, 526, 22, "blue");
		// Notes.
		write(text.camera.model, x0 + 262, 560, 33, "blue");
		write(text.camera.specs, x0 + 262, 596, 27, "graphite", 190);
		write(text.camera.mount, x0 + 262, 652, 27, "graphite", 190);
	}

	// Flight controller: the board and what plugs into it.
	{
		const x0 = 580;
		write(text.fc.heading, x0, 496, 40, "blue");
		squiggle(x0, x0 + width(text.fc.heading, 40), 505, "blue", 1.8);
		const bx = 700;
		const by = 556;
		const s = 88;
		write(text.fc.model, 806, 540, 29, "graphite");
		write(text.fc.specs, 806, 566, 22, "graphite", 150);
		rect(bx, by, s, s, 3, "graphite");
		for (const [dx, dy] of [
			[12, 12],
			[s - 12, 12],
			[12, s - 12],
			[s - 12, s - 12],
		] as Pt[]) arc(bx + dx, by + dy, 6, 6, 0, Math.PI * 2, 2);
		write("FC", bx + s / 2 - 20, by + s / 2 + 14, 40, "blue");
		// Ports: the pads on the left, the pin row on the right, the USB-C notch at the bottom.
		for (let i = 0; i < 3; i++) line(bx - 8, by + 28 + i * 16, bx + 6, by + 28 + i * 16, 2.4, "graphite");
		for (let i = 0; i < 8; i++) line(bx + s - 6, by + 12 + i * 9, bx + s + 8, by + 12 + i * 9, 2.4, "graphite");
		rect(bx + s / 2 - 15, by + s - 4, 30, 11, 2, "graphite");
		// What goes where.
		write(text.fc.sbus, x0, by + 10, 23, "blue", 110);
		arrow(x0 + 66, by + 44, bx - 12, by + 44, 2.2, "blue");
		arrow(bx + s + 12, by + 50, bx + s + 36, by + 50, 2.2, "blue");
		write(text.fc.ioBoard, bx + s + 44, by + 62, 23, "graphite", 130);
		arrow(bx + s / 2, by + s + 10, bx + s / 2 - 16, by + s + 34, 2.2, "blue");
		write(text.fc.usb, x0 + 20, 702, 23, "blue", 270);
		write(text.fc.warning, 832, 478, 23, "red", 145, -0.02);
	}

	/* ================= Right page ================= */
	// The roadmap along the top: where the project is.
	{
		const labels = text.steps;
		const x0 = rightPage + 20;
		const x1 = 1990;
		const y = 78;
		const stepX = (x1 - x0 - 60) / (labels.length - 1);
		line(x0 + 8, y, x1 - 40, y, 2.2, "graphite");
		labels.forEach((label, i) => {
			const cx = x0 + 30 + i * stepX;
			const state = steps.states[i] ?? "upcoming";
			arc(cx, y, 11, 11, 0, Math.PI * 2, 2.4, state === "current" ? "red" : "graphite");
			if (state === "done") {
				line(cx - 5, y, cx - 1, y + 5, 2.6, "blue");
				line(cx - 1, y + 5, cx + 7, y - 6, 2.6, "blue");
			}
			const ink: Ink = state === "current" ? "red" : state === "upcoming" ? "pale" : "graphite";
			// One line, or two when it's wider than its step (split where the two halves come out most even).
			const words = label.split(" ");
			let rows = [label];
			if (words.length > 1 && width(label, 25) > stepX - 12) {
				let best = 1;
				for (let k = 1; k < words.length; k++) {
					const a = width(words.slice(0, k).join(" "), 25);
					const b = width(words.slice(k).join(" "), 25);
					const c = width(words.slice(0, best).join(" "), 25) - width(words.slice(best).join(" "), 25);
					if (Math.abs(a - b) < Math.abs(c)) best = k;
				}
				rows = [words.slice(0, best).join(" "), words.slice(best).join(" ")];
			}
			// (kept on the page: the last one's right edge stays inside it)
			const place = (str: string, size: number) => Math.min(cx - width(str, size) / 2, x1 + 5 - width(str, size));
			rows.forEach((row, r) => write(row, place(row, 25), y + 38 + r * 27, 25, ink));
			if (state === "upcoming") write(text.planned, place(text.planned, 20), y + 38 + rows.length * 27, 20, "pale");
			const w = Math.max(...rows.map((row) => width(row, 25)));
			if (state === "current") {
				loop(cx, y + 26, w / 2 + 16, 27, "red", 2.2);
				write(text.here, cx - width(text.here, 24) / 2, y + 76, 24, "red");
				line(cx, y + 54, cx, y + 42, 2.2, "red");
			}
		});
	}

	// The drone from above.
	const cx = 1330;
	const cy = 346;
	const d = 102;
	const prop = 58;
	{
		const corners: Pt[] = [
			[-1, -1],
			[1, -1],
			[-1, 1],
			[1, 1],
		];
		// Front is up. Front arms in red, rear arms in graphite, as on the real frame.
		for (const [sx, sy] of corners) {
			const inkColor: Ink = sy < 0 ? "red" : "graphite";
			line(cx + sx * 40, cy + sy * 40, cx + sx * (d - 12), cy + sy * (d - 12), 4, inkColor);
			line(cx + sx * 48, cy + sy * 32, cx + sx * (d - 8), cy + sy * (d - 17), 1.4, inkColor);
		}
		// Motors and props, and which way each one turns.
		for (const [sx, sy] of corners) {
			const mx = cx + sx * d;
			const my = cy + sy * d;
			arc(mx, my, 14, 14, 0, Math.PI * 2, 2.8);
			arc(mx, my, 5, 5, 0, Math.PI * 2, 1.8);
			arc(mx, my, prop, prop, 0, Math.PI * 2, 1.5, "pale");
			const cw = sx * sy > 0; // front right and rear left turn clockwise; the other pair the other way
			const a0 = cw ? -0.2 : Math.PI + 0.2;
			const a1 = cw ? 1.7 : Math.PI - 1.7;
			arc(mx, my, 36, 36, a0, a1, 2, "blue");
			const ex = mx + Math.cos(a1) * 36;
			const ey = my + Math.sin(a1) * 36;
			const tx = -Math.sin(a1) * (cw ? 1 : -1);
			const ty = Math.cos(a1) * (cw ? 1 : -1);
			head(ex - tx * 10, ey - ty * 10, ex, ey, "blue", 10);
		}
		// The top plate with the IO board, the flight controller and the receiver on it.
		rect(cx - 54, cy - 54, 108, 108, 2.8);
		rect(cx - 44, cy - 2, 88, 40, 2.2);
		rect(cx - 21, cy - 27, 42, 42, 3, "blue");
		write(text.drone.fc, cx - 16, cy + 5, 32, "blue");
		rect(cx + 16, cy - 48, 30, 12, 2.2);
		line(cx + 41, cy - 48, cx + 56, cy - 68, 2, "graphite");
		// Front arrow.
		arrow(cx - 4, cy - 62, cx - 4, cy - 100, 2.4, "graphite");
		write(text.drone.front, cx + 6, cy - 80, 25);
		// Callouts: the words sit clear of the drawing, an arrow to the part.
		const callout = (str: string, tx: number, ty: number, sx: number, sy: number, ax: number, ay: number, inkColor: Ink = "graphite", maxW = 360) => {
			write(str, tx, ty, 28, inkColor, maxW);
			arrow(sx, sy, ax, ay, 1.8, inkColor);
		};
		callout(text.drone.receiver, 1490, 210, 1484, 200, cx + 48, cy - 42);
		callout(text.drone.io, 1490, 322, 1484, 312, cx + 46, cy + 20);
		callout(text.drone.motors, 1490, 432, 1484, 422, cx + d + 16, cy + d - 10);
		callout(text.drone.props, 1490, 506, 1484, 496, cx + d + prop - 10, cy + d + 24, "blue");
		write(text.drone.frame, 1094, 392, 24, "graphite", 76);
		arrow(1136, 424, cx - d + 2, cy + d - 36, 1.8, "graphite");
	}

	// Under the frame: power, data and the way out over 4G.
	{
		const row1 = 560;
		const row2 = 650;
		const bw = 168;
		const bh = 52;
		const box = (x: number, y: number, label: string, inkColor: Ink = "graphite") => {
			rect(x, y, bw, bh, 2.6, inkColor);
			const lines = label.split("|");
			lines.forEach((t, i) => write(t, x + 14, y + (lines.length === 1 ? 33 : 23) + i * 23, 25, "graphite"));
		};
		const b1 = 1100;
		const b2 = 1350;
		const b3 = 1600;
		write(text.drone.underneath, 1100, 546, 28, "graphite");
		dashed(1098, 554, 1098 + width(text.drone.underneath, 28) + 8, 554, 1.6, "pale", 8, 6);
		// Power in red: battery, the BEC, down to the Pi.
		box(b1, row1, text.drone.battery);
		box(b2, row1, text.drone.bec.replace(" 5 V", "|5 V"));
		arrow(b1 + bw + 4, row1 + bh / 2, b2 - 6, row1 + bh / 2, 2.6, "red");
		arrow(b2 + bw / 2, row1 + bh + 4, b2 + bw / 2, row2 - 6, 2.6, "red");
		// Data in blue: camera, the Pi, the modem, and out to wherever the viewer is.
		box(b1, row2, text.camera.model.replace("Camera ", "Camera|"));
		box(b2, row2, text.drone.pi);
		box(b3, row2, text.drone.modem);
		arrow(b1 + bw + 4, row2 + bh / 2, b2 - 6, row2 + bh / 2, 2.6, "blue");
		arrow(b2 + bw + 4, row2 + bh / 2, b3 - 6, row2 + bh / 2, 2.6, "blue");
		write("USB", b2 + bw + 10, row2 + bh / 2 - 12, 22, "blue");
		// The link: arcs of signal, then the viewer's screen.
		for (const r of [14, 26, 38]) arc(b3 + bw + 20, row2 + 26, r, r, -0.9, 0.9, 2.2, "blue");
		write(text.drone.link, b3 + 10, row2 - 12, 24, "blue");
		const sx = 1950;
		write(text.drone.viewer, 1840, row2 - 38, 24, "graphite", 150);
		rect(sx - 54, row2 + 4, 76, 46, 2.6, "graphite");
		line(sx - 40, row2 + 58, sx + 8, row2 + 58, 2.6, "graphite");
	}

	return marks;
}

function paper(g: CanvasRenderingContext2D) {
	const w = SKETCH_WIDTH;
	const h = SKETCH_HEIGHT;
	g.fillStyle = "#f4eedd";
	g.fillRect(0, 0, w, h);
	// Ruled lines, a red margin on the left page, the edges a little darker, the spine in the middle.
	g.strokeStyle = "rgba(80, 118, 176, 0.24)";
	g.lineWidth = 1.4;
	for (let y = 92; y < h - 10; y += 46) {
		for (const [a, b] of [
			[44, 984],
			[1064, 2004],
		]) {
			g.beginPath();
			g.moveTo(a, y);
			g.lineTo(b, y);
			g.stroke();
		}
	}
	g.strokeStyle = "rgba(200, 70, 70, 0.3)";
	g.beginPath();
	g.moveTo(84, 0);
	g.lineTo(84, h);
	g.stroke();
	const spine = g.createLinearGradient(w / 2 - 70, 0, w / 2 + 70, 0);
	spine.addColorStop(0, "rgba(60, 46, 28, 0)");
	spine.addColorStop(0.5, "rgba(60, 46, 28, 0.3)");
	spine.addColorStop(1, "rgba(60, 46, 28, 0)");
	g.fillStyle = spine;
	g.fillRect(w / 2 - 70, 0, 140, h);
	for (const [x0, x1, a0, a1] of [
		[0, 46, 0.12, 0],
		[w - 46, w, 0, 0.12],
	] as const) {
		const edge = g.createLinearGradient(x0, 0, x1, 0);
		edge.addColorStop(0, `rgba(60, 46, 28, ${a0})`);
		edge.addColorStop(1, `rgba(60, 46, 28, ${a1})`);
		g.fillStyle = edge;
		g.fillRect(x0, 0, x1 - x0, h);
	}
}

function ink(g: CanvasRenderingContext2D, m: Mark) {
	if (m.k === 0) {
		g.strokeStyle = INK[m.ink];
		g.lineWidth = m.w;
		g.beginPath();
		g.moveTo(m.x0, m.y0);
		g.lineTo(m.x1, m.y1);
		g.stroke();
	} else if (m.k === 1) {
		g.save();
		g.translate(m.x, m.y);
		g.rotate(m.rot);
		g.font = font(m.size);
		g.fillStyle = INK[m.ink];
		g.fillText(m.text, 0, 0);
		g.restore();
	} else {
		g.fillStyle = INK[m.ink];
		g.fillRect(m.x, m.y, m.w, m.h);
	}
}

export interface Sketch {
	/** Draw the page up to `progress` (0 to 1) of the way through. Only what is new since the last call is drawn. */
	show(progress: number): void;
}

/**
 * @param surface  The canvas the sketchbook's pages are drawn on (SKETCH_WIDTH × SKETCH_HEIGHT) and a way to say it changed.
 */
export function createSketch(surface: { g: CanvasRenderingContext2D; redraw(): void }, text: SketchText, steps: SketchSteps): Sketch {
	const { g } = surface;
	g.lineCap = "round";
	g.lineJoin = "round";
	g.textBaseline = "alphabetic";
	paper(g);
	surface.redraw();

	let marks: Mark[] = [];
	let built = false;
	let drawn = 0;
	let wanted = 0;
	const rebuild = () => {
		marks = layout(text, steps, g);
		built = true;
	};
	// The handwriting font comes by itself a moment after the room does; the page is laid out again once it is here (the
	// words are measured in it), and what was already drawn is drawn again.
	if (typeof document !== "undefined" && document.fonts) {
		document.fonts.load(font(40)).then(
			() => {
				built = false;
				drawn = 0;
				paper(g);
				api.show(wanted);
			},
			() => undefined,
		);
	}

	const api: Sketch = {
		show(progress) {
			wanted = Math.max(0, Math.min(1, progress));
			if (wanted <= 0) return;
			if (!built) rebuild();
			const target = Math.floor(wanted * marks.length + (wanted >= 1 ? 1 : 0));
			if (target === drawn) return;
			if (target < drawn) {
				paper(g);
				drawn = 0;
			}
			for (let i = drawn; i < target && i < marks.length; i++) ink(g, marks[i]);
			drawn = Math.min(target, marks.length);
			surface.redraw();
		},
	};
	return api;
}
