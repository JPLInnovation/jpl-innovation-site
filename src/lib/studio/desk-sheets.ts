/**
 * The loose sheets on the desk and pinned on the wall beside it: the F450's working pages, drawn by hand in the
 * sketchbook's pen (graphite, blue and red, in Caveat). Around the open sketchbook, never on it, and never under the
 * drone (the drone has its own bench, build-bench.ts).
 *
 *   - All sheets are drawn once into one canvas (an atlas: 5 × 3 slots of 384 × 543 px, one texture).
 *   - Every sheet is a slightly bent plane (a corner lifting, a gentle curl), and all of them are merged into one mesh:
 *     one draw call, one material, no lights of its own. A soft baked shadow sits under the desk ones.
 *   - Two crumpled balls of paper, a corkboard with pins, and a strip of tape on the wall ones.
 *
 * Words: src/text/studio.ts (`deskSheets`), from the drone page's own facts (src/text/projects/drone.ts).
 */
import {
	BufferGeometry,
	CanvasTexture,
	Group,
	IcosahedronGeometry,
	InstancedMesh,
	Matrix4,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Object3D,
	PlaneGeometry,
	SphereGeometry,
	SRGBColorSpace,
	Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { hardware } from "../three/finish";
import type { deskSheets as DeskSheetsText } from "../../text/studio";

const SLOT_W = 384;
const SLOT_H = 543;
const COLS = 5;
const ROWS = 3;
export const ATLAS_W = SLOT_W * COLS;
export const ATLAS_H = SLOT_H * ROWS;
/** The atlas slot of a blank sheet, for the pages under the top one in a pile. */
export const BLANK = 12;
/** A4, in metres. */
const SHEET_W = 0.21;
const SHEET_H = 0.297;

const FONT = '"Caveat", "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
const INK = { graphite: "#2a2f3a", blue: "#1d4fc0", red: "#c4312b", pale: "rgba(42,47,58,0.45)" } as const;
type Ink = keyof typeof INK;

/** Where a sheet lies. Desk ones: x, z on the desk and a turn; wall ones: x, y on the front wall and a tilt. */
export interface SheetPlace {
	slot: number;
	on: "desk" | "wall";
	x: number;
	/** Desk: z. Wall: y. */
	y: number;
	turn: number;
	/** Desk: how high the lifted corner rises (m). Wall: how much the sheet bows out (m). */
	lift?: number;
	/** Stacking order on the desk (higher lies on top). */
	layer?: number;
	scale?: number;
}

/** A pen that wobbles like a hand, seeded per sheet so it is the same every time. */
function pen(g: CanvasRenderingContext2D, seed: number) {
	const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	const jit = (a: number) => (rand() - 0.5) * a;
	const ink = (c: Ink, w: number) => {
		g.strokeStyle = INK[c];
		g.fillStyle = INK[c];
		g.lineWidth = w * (0.85 + rand() * 0.3);
	};
	const line = (x0: number, y0: number, x1: number, y1: number, w = 2, c: Ink = "graphite") => {
		const len = Math.hypot(x1 - x0, y1 - y0) || 1;
		const n = Math.max(2, Math.round(len / 18));
		const nx = -(y1 - y0) / len;
		const ny = (x1 - x0) / len;
		const bow = jit(len * 0.016);
		ink(c, w);
		g.beginPath();
		for (let i = 0; i <= n; i++) {
			const t = i / n;
			const off = Math.sin(t * Math.PI) * bow + jit(0.7);
			const x = x0 + (x1 - x0) * t + nx * off;
			const y = y0 + (y1 - y0) * t + ny * off;
			if (i) g.lineTo(x, y);
			else g.moveTo(x - (x1 - x0) * 0.01, y - (y1 - y0) * 0.01);
		}
		g.stroke();
	};
	const circle = (cx: number, cy: number, r: number, w = 2, c: Ink = "graphite", from = 0, to = Math.PI * 2.08) => {
		ink(c, w);
		g.beginPath();
		const n = Math.max(12, Math.round((r * Math.abs(to - from)) / 8));
		for (let i = 0; i <= n; i++) {
			const a = from + ((to - from) * i) / n;
			const rr = r * (1 + jit(0.03));
			const x = cx + Math.cos(a) * rr;
			const y = cy + Math.sin(a) * rr;
			if (i) g.lineTo(x, y);
			else g.moveTo(x, y);
		}
		g.stroke();
	};
	const rect = (x: number, y: number, w: number, h: number, sw = 2, c: Ink = "graphite") => {
		line(x - 2, y, x + w + 3, y + jit(2), sw, c);
		line(x + w, y - 2, x + w + jit(2), y + h + 3, sw, c);
		line(x + w + 2, y + h, x - 3, y + h + jit(2), sw, c);
		line(x, y + h + 2, x + jit(2), y - 3, sw, c);
	};
	const arrow = (x0: number, y0: number, x1: number, y1: number, w = 2, c: Ink = "graphite") => {
		line(x0, y0, x1, y1, w, c);
		const a = Math.atan2(y1 - y0, x1 - x0);
		for (const s of [-1, 1]) line(x1, y1, x1 - Math.cos(a + s * 0.5) * 11, y1 - Math.sin(a + s * 0.5) * 11, w, c);
	};
	/** Handwriting from (x, y) (baseline), wrapping at maxW. Returns the next baseline. */
	const write = (text: string, x: number, y: number, size: number, c: Ink = "graphite", maxW = 330, rot = 0) => {
		g.font = `600 ${size}px ${FONT}`;
		g.fillStyle = INK[c];
		let cx = x;
		let cy = y;
		for (const word of text.split(" ")) {
			const w = g.measureText(word).width;
			if (cx > x && cx + w - x > maxW) {
				cx = x;
				cy += size * 1.05;
			}
			g.save();
			g.translate(cx, cy + jit(1.4));
			g.rotate(rot + jit(0.03));
			g.fillText(word, 0, 0);
			g.restore();
			cx += w + size * 0.27;
		}
		return cy + size * 1.15;
	};
	const tick = (x: number, y: number, c: Ink = "blue") => {
		line(x, y, x + 6, y + 7, 2.4, c);
		line(x + 6, y + 7, x + 17, y - 9, 2.4, c);
	};
	const box = (x: number, y: number) => rect(x, y - 13, 15, 15, 1.6, "graphite");
	return { rand, jit, line, circle, rect, arrow, write, tick, box };
}

/** The paper: off-white with a little grain and tint, ruled, squared or plain; darker at the edges. */
function paper(g: CanvasRenderingContext2D, x0: number, y0: number, kind: "ruled" | "grid" | "plain", tint: number, seed: number) {
	g.save();
	g.beginPath();
	g.rect(x0, y0, SLOT_W, SLOT_H);
	g.clip();
	g.fillStyle = `hsl(${42 + tint * 8}, ${28 + tint * 10}%, ${92 - tint * 3}%)`;
	g.fillRect(x0, y0, SLOT_W, SLOT_H);
	let s = seed;
	const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
	// Grain: faint specks and fibres.
	for (let i = 0; i < 900; i++) {
		g.fillStyle = `rgba(90,70,40,${0.02 + rand() * 0.05})`;
		g.fillRect(x0 + rand() * SLOT_W, y0 + rand() * SLOT_H, 1 + rand() * 1.5, 1);
	}
	if (kind === "ruled") {
		g.strokeStyle = "rgba(80,118,176,0.22)";
		g.lineWidth = 1;
		for (let y = 60; y < SLOT_H - 10; y += 26) {
			g.beginPath();
			g.moveTo(x0 + 8, y0 + y);
			g.lineTo(x0 + SLOT_W - 8, y0 + y);
			g.stroke();
		}
		g.strokeStyle = "rgba(200,70,70,0.28)";
		g.beginPath();
		g.moveTo(x0 + 42, y0);
		g.lineTo(x0 + 42, y0 + SLOT_H);
		g.stroke();
	} else if (kind === "grid") {
		g.strokeStyle = "rgba(80,118,176,0.13)";
		g.lineWidth = 1;
		for (let x = 12; x < SLOT_W; x += 16) {
			g.beginPath();
			g.moveTo(x0 + x, y0);
			g.lineTo(x0 + x, y0 + SLOT_H);
			g.stroke();
		}
		for (let y = 12; y < SLOT_H; y += 16) {
			g.beginPath();
			g.moveTo(x0, y0 + y);
			g.lineTo(x0 + SLOT_W, y0 + y);
			g.stroke();
		}
	}
	// Handled edges: a little darker, and a faint smudge of graphite where the hand rested.
	const edge = g.createRadialGradient(x0 + SLOT_W / 2, y0 + SLOT_H / 2, SLOT_H * 0.3, x0 + SLOT_W / 2, y0 + SLOT_H / 2, SLOT_H * 0.75);
	edge.addColorStop(0, "rgba(70,55,30,0)");
	edge.addColorStop(1, "rgba(70,55,30,0.16)");
	g.fillStyle = edge;
	g.fillRect(x0, y0, SLOT_W, SLOT_H);
	const sx = x0 + SLOT_W * (0.55 + rand() * 0.35);
	const sy = y0 + SLOT_H * (0.6 + rand() * 0.3);
	const smudge = g.createRadialGradient(sx, sy, 2, sx, sy, 60);
	smudge.addColorStop(0, "rgba(50,52,60,0.07)");
	smudge.addColorStop(1, "rgba(50,52,60,0)");
	g.fillStyle = smudge;
	g.fillRect(x0, y0, SLOT_W, SLOT_H);
	g.restore();
}

/** A coffee ring, where a mug stood on the page. */
function coffeeRing(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
	g.save();
	for (let i = 0; i < 3; i++) {
		g.strokeStyle = `rgba(120,78,36,${0.12 - i * 0.03})`;
		g.lineWidth = 3 + i * 2;
		g.beginPath();
		g.arc(cx + i * 0.6, cy - i * 0.4, r - i, 0.2, Math.PI * 1.85);
		g.stroke();
	}
	g.restore();
}

/** Draws every sheet into the atlas, in slot order. */
function drawSheets(g: CanvasRenderingContext2D, t: typeof DeskSheetsText) {
	g.lineCap = "round";
	g.lineJoin = "round";
	const sheets: ((p: ReturnType<typeof pen>) => void)[] = [
		// 0 The F450 from above: the X, four motors, the 450 mm diagonal.
		(p) => {
			p.write(t.topView.title, 30, 52, 36);
			const cx = 192, cy = 300, r = 118;
			for (const a of [0.785, 2.356, 3.927, 5.498]) {
				p.line(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3);
				p.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 14, 2.2);
				p.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 52, 1.2, "pale");
			}
			p.rect(cx - 30, cy - 30, 60, 60, 2.4);
			p.line(cx + Math.cos(3.927) * r - 8, cy + Math.sin(3.927) * r + 8, cx + Math.cos(0.785) * r - 8, cy + Math.sin(0.785) * r + 8, 1.4, "blue");
			p.write(t.topView.diag, cx - 96, cy + 34, 30, "blue", 200, 0.785);
			p.arrow(cx, cy - 40, cx, cy - 92, 2, "red");
			p.write(t.topView.front, cx + 10, cy - 74, 26, "red");
			p.write(t.topView.motors, 40, 500, 26, "graphite");
		},
		// 1 Power: the chain from the battery to the motors, and the BEC branch.
		(p) => {
			p.write(t.power.title, 56, 52, 38);
			let y = 96;
			t.power.steps.forEach((s, i) => {
				p.rect(70, y - 26, 250, 36, 1.8);
				p.write(s, 82, y, 26);
				if (i < t.power.steps.length - 1) p.arrow(195, y + 12, 195, y + 34, 1.8, "blue");
				y += 58;
			});
			p.write(t.power.branch, 56, y + 6, 26, "blue");
			p.write(t.power.note, 56, y + 44, 24, "red");
		},
		// 2 Live video: camera to Pi to 4G to anyone.
		(p) => {
			p.write(t.video.title, 30, 52, 38);
			let y = 120;
			t.video.steps.forEach((s, i) => {
				p.circle(70, y - 8, 22, 2, i === 3 ? "blue" : "graphite");
				p.write(s, 104, y, 28);
				if (i < t.video.steps.length - 1) {
					p.arrow(70, y + 16, 70, y + 74, 1.8, "blue");
					p.write(t.video.links[i], 90, y + 54, 22, "blue");
				}
				y += 104;
			});
			p.line(30, 500, 350, 496, 1.2, "pale");
		},
		// 3 Flight control: radio to ESCs, and the USB-C branch to the Pi.
		(p) => {
			p.write(t.control.title, 30, 52, 36);
			let y = 104;
			t.control.steps.forEach((s, i) => {
				p.write(s, 46, y, 27);
				if (i < t.control.steps.length - 1) {
					p.arrow(60, y + 10, 60, y + 52, 1.8, "graphite");
					p.write(t.control.links[i] ?? "", 80, y + 40, 21, "blue");
				}
				y += 74;
			});
			p.write(t.control.branch, 30, y + 6, 24, "blue", 330);
		},
		// 4 The camera's tilt mount, from the side.
		(p) => {
			p.write(t.tilt.title, 30, 52, 34);
			p.rect(70, 150, 110, 30, 2.4);
			p.rect(150, 180, 30, 150, 2.4);
			p.rect(120, 330, 120, 22, 2.4);
			p.circle(168, 255, 9, 2);
			p.rect(176, 220, 84, 60, 2.2, "blue");
			p.circle(262, 250, 12, 2, "blue");
			p.line(262, 250, 360, 250, 1.4, "pale");
			p.line(262, 250, 356, 276, 1.4, "pale");
			p.circle(262, 250, 70, 1.6, "red", 0, 0.5);
			p.write(t.tilt.level, 330, 240, 24);
			p.write(t.tilt.down, 300, 300, 24, "red");
			p.write(t.tilt.material, 40, 420, 28, "blue");
			p.write(t.tilt.ribbon, 40, 462, 24);
		},
		// 5 The flight controller, 30 × 30 with its holes, and the warning.
		(p) => {
			p.write(t.fc.title, 30, 52, 40);
			p.rect(92, 110, 200, 200, 2.6);
			for (const [x, y] of [[112, 130], [272, 130], [112, 290], [272, 290]]) p.circle(x, y, 7, 1.8);
			p.write(t.fc.model, 120, 214, 26);
			p.line(92, 334, 292, 334, 1.4, "blue");
			p.write(t.fc.size, 130, 362, 24, "blue");
			p.write(t.fc.firmware, 40, 420, 28);
			p.write(t.fc.warn, 40, 470, 28, "red");
			p.line(40, 478, 300, 476, 1.6, "red");
		},
		// 6 Props: quad X, which way each one turns.
		(p) => {
			p.write(t.props.title, 30, 52, 36);
			const pts = [[110, 160, 1], [274, 160, 0], [110, 330, 0], [274, 330, 1]] as const;
			for (const [x, y, cw] of pts) {
				p.circle(x, y, 58, 1.8);
				p.circle(x, y, 40, 2, cw ? "blue" : "red", -0.3, 2.4);
				p.write(cw ? t.props.cw : t.props.ccw, x - 22, y + 10, 28, cw ? "blue" : "red");
			}
			p.line(110, 160, 274, 330, 1.2, "pale");
			p.line(274, 160, 110, 330, 1.2, "pale");
			p.write(t.props.note, 40, 460, 26);
		},
		// 7 The parts list, ticked.
		(p) => {
			p.write(t.parts.title, 56, 46, 38);
			let y = 86;
			for (const item of t.parts.items) {
				p.tick(56, y - 6);
				y = p.write(item, 84, y, 25) + 8;
			}
		},
		// 8 Landing gear: why the legs are tall.
		(p) => {
			p.write(t.legs.title, 30, 52, 36);
			p.line(60, 160, 320, 160, 3);
			p.line(100, 160, 80, 330, 2.6);
			p.line(280, 160, 300, 330, 2.6);
			p.line(50, 330, 130, 330, 2.6);
			p.line(250, 330, 330, 330, 2.6);
			p.rect(150, 170, 90, 50, 2, "blue");
			p.line(350, 160, 350, 330, 1.4, "blue");
			p.write(t.legs.height, 300, 260, 26, "blue");
			p.write(t.legs.note, 40, 420, 26, "graphite", 310);
		},
		// 9 Battery under the frame, strapped.
		(p) => {
			p.write(t.battery.title, 30, 52, 36);
			p.line(50, 170, 330, 170, 3);
			p.rect(90, 200, 200, 70, 2.4);
			p.write(t.battery.pack, 110, 245, 26);
			p.line(130, 188, 130, 284, 2, "blue");
			p.line(250, 188, 250, 284, 2, "blue");
			p.write(t.battery.note, 40, 360, 26, "graphite", 310);
		},
		// 10 The 4G stick.
		(p) => {
			p.write(t.modem.title, 30, 52, 36);
			p.rect(70, 160, 220, 70, 2.4);
			p.rect(290, 182, 34, 26, 2);
			p.write(t.modem.model, 96, 205, 28);
			for (let i = 0; i < 3; i++) p.circle(180, 140, 24 + i * 18, 1.6, "blue", 3.6, 5.8);
			p.write(t.modem.note, 40, 320, 26, "blue");
		},
		// 11 Ideas for later (planned, not built).
		(p) => {
			p.write(t.ideas.title, 56, 52, 36);
			let y = 110;
			for (const item of t.ideas.items) {
				p.box(56, y);
				y = p.write(item, 86, y, 27) + 14;
			}
			p.write(t.ideas.note, 56, y + 20, 26, "red");
		},
	];
	sheets.forEach((draw, i) => {
		const x0 = (i % COLS) * SLOT_W;
		const y0 = Math.floor(i / COLS) * SLOT_H;
		const kind = i % 3 === 0 ? "grid" : i % 3 === 1 ? "ruled" : "plain";
		paper(g, x0, y0, kind, (i * 37) % 10 / 10, 11 + i * 97);
		g.save();
		g.translate(x0, y0);
		g.beginPath();
		g.rect(0, 0, SLOT_W, SLOT_H);
		g.clip();
		draw(pen(g, 3 + i * 131));
		if (i === 7) coffeeRing(g, 300, 470, 46);
		g.restore();
	});
	// Slot 12: a blank sheet (the backs of the pages in a pile).
	paper(g, (BLANK % COLS) * SLOT_W, Math.floor(BLANK / COLS) * SLOT_H, "plain", 0.3, 4242);
	return sheets.length;
}

/** A sheet's plane: A4, bent a little, with its UVs on its atlas slot, placed in the room. */
function sheetGeometry(place: SheetPlace, deskTop: number, wallZ: number) {
	const scale = place.scale ?? 1;
	const geometry = new PlaneGeometry(SHEET_W * scale, SHEET_H * scale, 6, 8);
	const pos = geometry.getAttribute("position");
	const uv = geometry.getAttribute("uv");
	const col = place.slot % COLS;
	const row = Math.floor(place.slot / COLS);
	const lift = place.lift ?? 0;
	for (let i = 0; i < pos.count; i++) {
		const u = uv.getX(i);
		const v = uv.getY(i);
		// The slot on the atlas (v runs bottom to top; the canvas top is row 0).
		uv.setXY(i, (col + u) / COLS, 1 - (row + (1 - v)) / ROWS);
		// The bend: on the desk, one corner lifts; on the wall, the middle bows out a touch.
		const curl = place.on === "desk" ? lift * Math.max(0, u + v - 1.25) ** 2 * 4 : lift * Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
		pos.setZ(i, curl);
	}
	const m = new Matrix4();
	const o = new Object3D();
	if (place.on === "desk") {
		o.position.set(place.x, deskTop + 0.0012 + (place.layer ?? 0) * 0.0006, place.y);
		o.rotation.set(-Math.PI / 2, 0, place.turn);
	} else {
		o.position.set(place.x, place.y, wallZ + 0.012 + (place.layer ?? 0) * 0.002);
		o.rotation.set(0, 0, place.turn);
	}
	o.updateMatrix();
	m.copy(o.matrix);
	geometry.applyMatrix4(m);
	return geometry;
}

/** A soft dark oval, baked into a little texture: the shadow under a sheet that has a corner up, and under the balls. */
function softShadow() {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 64;
	const g = canvas.getContext("2d")!;
	const gradient = g.createRadialGradient(32, 32, 4, 32, 32, 32);
	gradient.addColorStop(0, "rgba(0,0,0,0.45)");
	gradient.addColorStop(1, "rgba(0,0,0,0)");
	g.fillStyle = gradient;
	g.fillRect(0, 0, 64, 64);
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	return texture;
}

export interface DeskSheets {
	group: Group;
	/** Paper under the room's light washes out; dimmed per theme, as the sketchbook is. */
	applyPalette(dark: boolean): void;
	/** The desk sheets' footprints (x, z, half width, half depth: their bounding boxes), for the drone-never-on-paper check. */
	footprints: { x0: number; x1: number; z0: number; z1: number }[];
}

export function buildDeskSheets(text: typeof DeskSheetsText, places: SheetPlace[], deskTop: number, wallZ: number, cork?: { x: number; y: number; w: number; h: number }): DeskSheets {
	const group = new Group();
	const canvas = document.createElement("canvas");
	canvas.width = ATLAS_W;
	canvas.height = ATLAS_H;
	const g = canvas.getContext("2d")!;
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.anisotropy = 8;
	const draw = () => {
		g.clearRect(0, 0, ATLAS_W, ATLAS_H);
		drawSheets(g, text);
		texture.needsUpdate = true;
	};
	draw();
	// The handwriting font arrives a moment after the room: drawn again once it is here.
	document.fonts?.load(`600 40px ${FONT}`).then(draw, () => undefined);

	const geometries: BufferGeometry[] = places.map((place) => sheetGeometry(place, deskTop, wallZ));
	const merged = mergeGeometries(geometries, false)!;
	geometries.forEach((geo) => geo.dispose());
	const material = hardware({ color: 0xffffff, map: texture, roughness: 0.92, side: 2 }, "printed") as MeshStandardMaterial;
	const sheets = new Mesh(merged, material);
	group.add(sheets);

	// Soft shadows under the desk sheets with a lifted corner, and under the balls of paper.
	const shadowMat = new MeshBasicMaterial({ map: softShadow(), transparent: true, depthWrite: false, opacity: 0.55 });
	const footprints: DeskSheets["footprints"] = [];
	for (const place of places) {
		if (place.on !== "desk") continue;
		const s = place.scale ?? 1;
		const r = Math.hypot(SHEET_W * s, SHEET_H * s) / 2;
		footprints.push({ x0: place.x - r, x1: place.x + r, z0: place.y - r, z1: place.y + r });
		if (!place.lift) continue;
		const shadow = new Mesh(new PlaneGeometry(SHEET_W * s * 0.6, SHEET_H * s * 0.5), shadowMat);
		shadow.rotation.set(-Math.PI / 2, 0, place.turn);
		const c = Math.cos(place.turn);
		const sn = Math.sin(place.turn);
		const ox = SHEET_W * s * 0.22;
		const oz = -SHEET_H * s * 0.22;
		shadow.position.set(place.x + ox * c - oz * sn, deskTop + 0.0009, place.y + ox * sn + oz * c);
		group.add(shadow);
	}

	// Two crumpled balls of paper (on the desk's far left corner, and one on the floor by the desk).
	const ballGeometry = new IcosahedronGeometry(0.032, 2);
	const bp = ballGeometry.getAttribute("position");
	const v = new Vector3();
	let seed = 5;
	const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	for (let i = 0; i < bp.count; i++) {
		v.fromBufferAttribute(bp, i);
		v.multiplyScalar(0.78 + rand() * 0.38);
		bp.setXYZ(i, v.x, v.y, v.z);
	}
	ballGeometry.computeVertexNormals();
	const ballMat = hardware({ color: 0xece4d2, roughness: 0.95, flatShading: true }, "printed") as MeshStandardMaterial;
	const balls = [
		[-7.06, deskTop + 0.026, -2.78],
		[-6.62, 0.026, -1.62],
	];
	for (const [x, y, z] of balls) {
		const ball = new Mesh(ballGeometry, ballMat);
		ball.position.set(x, y, z);
		ball.rotation.set(rand() * 3, rand() * 3, rand() * 3);
		group.add(ball);
		const shadow = new Mesh(new PlaneGeometry(0.1, 0.1), shadowMat);
		shadow.rotation.x = -Math.PI / 2;
		shadow.position.set(x + 0.008, y - 0.0255, z + 0.006);
		group.add(shadow);
	}

	// The corkboard behind the wall sheets, and a pin at the top of each one.
	let corkMat: MeshStandardMaterial | undefined;
	if (cork) {
		corkMat = hardware({ color: 0x9b7650, roughness: 0.95 }, "fabric") as MeshStandardMaterial;
		const board = new Mesh(new PlaneGeometry(cork.w, cork.h), corkMat);
		board.position.set(cork.x, cork.y, wallZ + 0.006);
		group.add(board);
		const frame = hardware({ color: 0x5b4636, roughness: 0.6 }, "plastic");
		for (const [w, h, x, y] of [
			[cork.w + 0.04, 0.02, cork.x, cork.y + cork.h / 2 + 0.01],
			[cork.w + 0.04, 0.02, cork.x, cork.y - cork.h / 2 - 0.01],
			[0.02, cork.h, cork.x - cork.w / 2 - 0.01, cork.y],
			[0.02, cork.h, cork.x + cork.w / 2 + 0.01, cork.y],
		]) {
			const bar = new Mesh(new PlaneGeometry(w, h), frame);
			bar.position.set(x, y, wallZ + 0.009);
			group.add(bar);
		}
	}
	const wallPlaces = places.filter((p) => p.on === "wall");
	if (wallPlaces.length) {
		const pins = new InstancedMesh(new SphereGeometry(0.007, 10, 8), hardware({ color: 0xc8283a, roughness: 0.35 }, "plastic"), wallPlaces.length);
		const o = new Object3D();
		wallPlaces.forEach((p, i) => {
			const s = p.scale ?? 1;
			o.position.set(p.x - Math.sin(p.turn) * SHEET_H * s * 0.44, p.y + Math.cos(p.turn) * SHEET_H * s * 0.44, wallZ + 0.02 + (p.layer ?? 0) * 0.002);
			o.updateMatrix();
			pins.setMatrixAt(i, o.matrix);
		});
		group.add(pins);
	}

	return {
		group,
		footprints,
		applyPalette(dark) {
			// The same dimming as the sketchbook's page (room.ts), so the ink keeps its contrast under the lamp.
			material.color.setScalar(dark ? 0.5 : 0.5);
			ballMat.color.set(dark ? 0x9a9488 : 0xb8b0a0);
			if (corkMat) corkMat.color.set(dark ? 0x6e5236 : 0x9b7650);
		},
	};
}
