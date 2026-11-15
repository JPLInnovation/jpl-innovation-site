/**
 * The city outside the studio's back wall (room.ts makes that wall glass above the sill): Saigon across the river, at
 * night in the dark theme and at dusk in the light one. Three curved layers behind the room, at different distances,
 * so the camera's moves give real parallax, in front of a real sky:
 *
 *   sky    a photograph per theme (public/studio/window/sky-{night,dusk}.webp, generated for the site), mirrored
 *          round the arc so its clouds keep their shape
 *   far    the skyline across the river, hazy with distance: Landmark 81's stepped bundle of towers with its spire,
 *          Bitexco's tapered tower with its helipad, slim towers with lit window grids, antennas, red aviation lights
 *   mid    the far bank's mid-rise blocks (a lit face, a darker side, regular office windows, rooftop signs), the river
 *          with its reflections, and a cable-stayed bridge: one tall leaning pylon, its fan of cables, the lit deck
 *   near   the street in front: tube houses floor by floor (balconies with railings, shutters and lit shopfronts, signs,
 *          air conditioners, water tanks), the tangle of power lines, street lamps, and trees built from leaf clusters
 *
 * plus the traffic: one Points draw call of small red and white lights along the street and across the bridge.
 * Everything is drawn into canvases at load (no download but the two skies, 43 KB): 4 draw calls, three textures.
 *
 * The drawings are encoded, so one set serves both themes: alpha is coverage. Where green is 0 the pixel is a surface:
 * red picks its tone (brown, slate, green, ochre, grey, tree, water) and blue its shade (0.35 to 1.65 times the tone),
 * so facades have light and shadow. Where green is above 0 it is a light: green is its own threshold (on while the
 * share lit is above it, so each window is on or off as a whole), red its brightness, blue its kind (warm white,
 * amber, street-lamp orange, aviation red; the red ones blink).
 */
import {
	AdditiveBlending,
	BackSide,
	BufferAttribute,
	BufferGeometry,
	CanvasTexture,
	Color,
	CylinderGeometry,
	type Group,
	Mesh,
	Points,
	RepeatWrapping,
	ShaderMaterial,
	SRGBColorSpace,
	type Texture,
	TextureLoader,
} from "three";

/** Every setting of the city outside, in one place to tune. */
export const BACKDROP = {
	/** The sky photographs, per theme (paths under public/). */
	sky: { night: "/studio/window/sky-night.webp", dusk: "/studio/window/sky-dusk.webp" },
	/** Where the layers curve round (the room is x -8.5 to 8.5, z -3.4 to 6.4) and the street level (m). */
	centre: [0, -2] as [number, number],
	ground: -1.5,
	/**
	 * Radii (m), tops (m above the floor), how often each drawing repeats round the arc, how much distance haze, and
	 * the canvas each is drawn into. All inside the stage camera's 40 m reach from anywhere in the room.
	 */
	far: { radius: 35, top: 26, repeat: 1, haze: 0.42, canvas: [4096, 1024] },
	mid: { radius: 31, top: 16, repeat: 1, haze: 0.2, canvas: [4096, 1024] },
	near: { radius: 26, top: 12, repeat: 2, haze: 0, canvas: [4096, 1024] },
	/** The arc's width, degrees, centred behind the back wall. */
	arc: 176,
	/** The bridge: where it spans on the middle layer's arc (0 to 1), its deck (m) and the pylon's height over the deck. */
	bridge: { from: 0.18, to: 0.52, deck: -0.35, arch: 1.5 },
	/** Share of the drawn lights that are on, in the dark theme and the light one (dusk). */
	lit: { dark: 0.9, light: 0.45 },
	/** The traffic: how many lights, their size (px) and speed (m/s). */
	cars: 150,
	carSize: 2.4,
	carSpeed: 9,
	night: {
		haze: "#3a2433",
		tones: ["#2a1d17", "#1b2333", "#1a271f", "#2e2416", "#24252b", "#0a120c", "#0a1022"],
		lights: ["#ffe2b0", "#ffb05a", "#ff9a45", "#ff3b30"],
		/** An unlit window: what it reflects. */
		off: "#0d1322",
		glow: 1,
	},
	dusk: {
		haze: "#d8a2a6",
		// Darker than the sky behind them: at dusk the city is a silhouette, lit from the windows more than the sun.
		tones: ["#45363a", "#353b55", "#33433d", "#52412f", "#41424d", "#1d2922", "#2b3754"],
		lights: ["#ffe8c4", "#ffc27a", "#ffb070", "#ff4d40"],
		off: "#7d7193",
		glow: 0.6,
	},
};

type Palette = typeof BACKDROP.night;
/** The surface tones, by index into `tones`. */
const TONE = { brown: 0, slate: 1, green: 2, ochre: 3, grey: 4, tree: 5, water: 6 } as const;
const FACADES = [TONE.brown, TONE.slate, TONE.green, TONE.ochre, TONE.grey];
/** The lights' kinds, by index into `lights`. */
const LIGHT = { warm: 0, amber: 1, lamp: 2, red: 3 } as const;

/** A seeded random number generator (the same city every visit). */
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

type Layer = ReturnType<typeof layerCanvas>;

/** A canvas for one layer, drawn in metres: x along the arc from 0, y up from the street. */
function layerCanvas(widthM: number, heightM: number, [cw, ch]: number[]) {
	const canvas = document.createElement("canvas");
	canvas.width = cw;
	canvas.height = ch;
	const g = canvas.getContext("2d")!;
	const sx = canvas.width / widthM;
	const sy = canvas.height / heightM;
	const X = (m: number) => m * sx;
	const Y = (m: number) => canvas.height - m * sy;
	/** A surface: its tone, and its shade (1 = the tone itself; 0.35 to 1.65). */
	const tone = (t: number, shade = 1) => `rgb(${t * 40},0,${Math.max(1, Math.min(255, Math.round(((shade - 0.35) / 1.3) * 255)))})`;
	const light = (threshold: number, kind: number, bright = 1) => `rgb(${Math.round(bright * 255)},${Math.max(1, Math.round(threshold * 255))},${kind * 80})`;
	/** A rectangle in metres. */
	const rect = (x: number, y: number, w: number, h: number, style: string | CanvasGradient) => {
		g.fillStyle = style;
		g.fillRect(X(x), Y(y + h), Math.max(1, w * sx), Math.max(1, h * sy));
	};
	/** A rectangle shaded from `bottom` to `top` (a facade lit from the sky, darker at street level). */
	const shaded = (x: number, y: number, w: number, h: number, t: number, bottom: number, top: number) => {
		const grad = g.createLinearGradient(0, Y(y), 0, Y(y + h));
		grad.addColorStop(0, tone(t, bottom));
		grad.addColorStop(1, tone(t, top));
		rect(x, y, w, h, grad);
	};
	/** A polygon in metres. */
	const poly = (points: Array<[number, number]>, style: string | CanvasGradient) => {
		g.fillStyle = style;
		g.beginPath();
		points.forEach(([px, py], i) => (i ? g.lineTo(X(px), Y(py)) : g.moveTo(X(px), Y(py))));
		g.closePath();
		g.fill();
	};
	/** A line in metres, `width` in pixels. */
	const line = (x0: number, y0: number, x1: number, y1: number, width: number, style: string) => {
		g.strokeStyle = style;
		g.lineWidth = width;
		g.beginPath();
		g.moveTo(X(x0), Y(y0));
		g.lineTo(X(x1), Y(y1));
		g.stroke();
	};
	const texture = () => {
		const t = new CanvasTexture(canvas);
		t.wrapS = RepeatWrapping;
		t.anisotropy = 4;
		return t;
	};
	return { g, canvas, sx, sy, X, Y, tone, light, rect, shaded, poly, line, texture };
}

/** A grid of windows on a facade: rows a floor apart, columns `col` apart, a share of them lit. */
function windowGrid(L: Layer, rand: () => number, x: number, y0: number, w: number, h: number, floor: number, col: number, share: number, kinds = [LIGHT.warm, LIGHT.warm, LIGHT.amber]) {
	const ww = col * 0.55;
	const wh = floor * 0.45;
	for (let y = y0 + floor * 0.35; y < y0 + h - floor * 0.5; y += floor) {
		const rowLit = rand() < 0.85; // whole floors are sometimes dark
		for (let cx = x + col * 0.3; cx < x + w - col * 0.6; cx += col) {
			if (rowLit && rand() < share) L.rect(cx, y, ww, wh, L.light(rand(), kinds[Math.floor(rand() * kinds.length)], 0.5 + rand() * 0.5));
		}
	}
}

/** A block seen slightly from the side: the lit face, a darker side face, a lighter roof edge, windows on both. */
function block(L: Layer, rand: () => number, x: number, y0: number, w: number, h: number, t: number, floor: number, share: number) {
	const side = Math.min(w * 0.22, 0.6);
	L.shaded(x, y0, w - side, h, t, 0.75, 1.15);
	L.shaded(x + w - side, y0, side, h, t, 0.5, 0.75);
	L.rect(x, y0 + h - floor * 0.12, w - side, floor * 0.12, L.tone(t, 1.4));
	windowGrid(L, rand, x, y0, w - side, h, floor, floor * 0.85, share);
	windowGrid(L, rand, x + w - side, y0, side, h, floor, floor * 0.85, share * 0.5);
}

/** Far: the skyline across the river, with its two landmarks. */
function drawFar(widthM: number, heightM: number) {
	// Drawn at a little over half size (the canvas spans more metres than the layer): across the river, the skyline sits
	// low under a big sky, as it does from a fourth floor.
	const S = 0.55;
	const L = layerCanvas(widthM / S, heightM / S, BACKDROP.far.canvas);
	widthM /= S;
	const rand = seeded(11);
	// The low skyline: blocks of every height, some with a set-back top, antennas, a few lit floors.
	let x = 0;
	while (x < widthM) {
		const w = 0.8 + rand() * 2.6;
		const h = 0.8 + rand() * 2.8;
		const t = FACADES[Math.floor(rand() * FACADES.length)];
		block(L, rand, x, 0, w, h, t, 0.32, 0.22);
		if (rand() < 0.3) block(L, rand, x + w * 0.2, h, w * 0.55, 0.4 + rand() * 0.8, t, 0.32, 0.22);
		if (rand() < 0.25) L.rect(x + w * (0.3 + rand() * 0.4), h, 0.04, 0.5 + rand() * 0.6, L.tone(TONE.grey, 0.9));
		x += w + rand() * 0.3;
	}
	// Slim towers between them, each with a red light on top.
	for (const [at, h, w] of [[0.12, 5.2, 1.0], [0.27, 6.4, 1.2], [0.48, 4.6, 0.9], [0.83, 5.8, 1.1], [0.94, 4.2, 0.9]]) {
		const tx = widthM * at;
		block(L, rand, tx, 0, w, h, TONE.slate, 0.3, 0.4);
		L.rect(tx + w * 0.42, h, 0.05, 0.6, L.tone(TONE.grey, 1));
		L.rect(tx + w * 0.38, h + 0.6, 0.14, 0.1, L.light(rand(), LIGHT.red, 1));
	}
	// Bitexco: a tower tapering as it rises, a helipad held out from its side, a cut top.
	{
		const bx = widthM * 0.38;
		const h = 9.2;
		const shape: Array<[number, number]> = [];
		for (let i = 0; i <= 20; i++) {
			const u = i / 20;
			shape.push([bx + 0.75 * (1 - 0.35 * u * u), u * h]);
		}
		for (let i = 20; i >= 0; i--) {
			const u = i / 20;
			shape.push([bx - 0.75 * (1 - 0.35 * u * u), u * h]);
		}
		shape[20] = [bx + 0.5, h * 0.97];
		const grad = L.g.createLinearGradient(L.X(bx - 0.75), 0, L.X(bx + 0.75), 0);
		grad.addColorStop(0, L.tone(TONE.slate, 1.2));
		grad.addColorStop(1, L.tone(TONE.slate, 0.62));
		L.poly(shape, grad);
		for (let y = 0.4; y < h - 0.5; y += 0.27) {
			const half = 0.7 * (1 - 0.35 * (y / h) ** 2);
			for (let cx = bx - half + 0.1; cx < bx + half - 0.12; cx += 0.19) if (rand() < 0.42) L.rect(cx, y, 0.1, 0.11, L.light(rand(), LIGHT.warm, 0.6 + rand() * 0.4));
		}
		L.poly([[bx + 0.2, h * 0.74], [bx + 1.35, h * 0.735], [bx + 1.4, h * 0.71], [bx + 0.2, h * 0.705]], L.tone(TONE.grey, 0.75)); // the helipad
		L.rect(bx + 0.05, h * 0.97, 0.12, 0.1, L.light(0.3, LIGHT.red, 1));
	}
	// Landmark 81: a bundle of square towers stepping up to the tallest in the middle, and its spire.
	{
		const lx = widthM * 0.6;
		const shafts: Array<[number, number, number]> = [
			[-2.1, 0.5, 7.4], [-1.55, 0.6, 9.2], [-0.95, 0.65, 10.8], [-0.3, 0.75, 12.4], [0.45, 0.65, 11.2], [1.1, 0.6, 9.6], [1.7, 0.5, 7.8],
		];
		for (const [dx, w, h] of shafts) {
			const sx0 = lx + dx;
			const inner = 1 - Math.abs(dx) / 3;
			L.shaded(sx0, 0, w, h, TONE.slate, 0.7, 0.95 + 0.3 * inner);
			L.rect(sx0 + w - 0.04, 0, 0.04, h, L.tone(TONE.slate, 0.45)); // the seam between shafts
			for (let y = 0.35; y < h - 0.3; y += 0.24) for (let cx = sx0 + 0.07; cx < sx0 + w - 0.12; cx += 0.16) if (rand() < 0.45) L.rect(cx, y, 0.08, 0.1, L.light(rand(), LIGHT.warm, 0.55 + rand() * 0.45));
			L.rect(sx0, h - 0.18, w - 0.04, 0.1, L.light(0.05, LIGHT.lamp, 0.5)); // a band of light under each crown
		}
		L.poly([[lx - 0.2, 12.4], [lx + 0.25, 12.4], [lx + 0.04, 15.2]], L.tone(TONE.grey, 1.1)); // the spire
		L.rect(lx - 0.03, 15.1, 0.1, 0.12, L.light(0.6, LIGHT.red, 1));
	}
	return L.texture();
}

/** Mid: the far bank's blocks, the river with its reflections, and the cable-stayed bridge across it. */
function drawMid(widthM: number, heightM: number) {
	const L = layerCanvas(widthM, heightM, BACKDROP.mid.canvas);
	const rand = seeded(23);
	const water = 0.9; // the river's height in the layer (it lies at the street's level)
	const { from, to, deck, arch } = BACKDROP.bridge;
	const deckY = deck - BACKDROP.ground;
	// The far bank: mid-rise blocks, a few with a lit sign on the roof (no words), antennas.
	let x = 0;
	const lit: Array<[number, number, number]> = []; // lit spots to reflect in the river: x, height, kind
	while (x < widthM) {
		const tall = rand() < 0.22;
		const w = tall ? 2 + rand() * 2.8 : 1.2 + rand() * 2.2;
		const h = tall ? 2.4 + rand() * 2.8 : 0.8 + rand() * 1.4;
		const t = FACADES[Math.floor(rand() * FACADES.length)];
		block(L, rand, x, water, w, h, t, tall ? 0.36 : 0.32, tall ? 0.34 : 0.22);
		if (tall && rand() < 0.4) {
			L.rect(x + w * 0.2, water + h, w * 0.45, 0.22, L.light(rand() * 0.5, rand() < 0.5 ? LIGHT.lamp : LIGHT.warm, 0.85));
			lit.push([x + w * 0.4, water + h, LIGHT.lamp]);
		}
		if (rand() < 0.3) L.rect(x + w * 0.6, water + h, 0.04, 0.5, L.tone(TONE.grey, 1));
		for (let k = 0; k < 3; k++) lit.push([x + rand() * w, water + rand() * h, LIGHT.warm]);
		x += w + rand() * 0.7;
	}
	// The river: darker under the far bank, a lighter sheen in the middle.
	const river = L.g.createLinearGradient(0, L.Y(0), 0, L.Y(water));
	river.addColorStop(0, L.tone(TONE.water, 1.15));
	river.addColorStop(0.6, L.tone(TONE.water, 0.95));
	river.addColorStop(1, L.tone(TONE.water, 0.7));
	L.rect(0, 0, widthM, water, river);
	// The bridge: a deck on slim piers, one tall pylon leaning a little, and the fan of cables holding the deck.
	const bx0 = widthM * from;
	const bx1 = widthM * to;
	const span = bx1 - bx0;
	const px = bx0 + span * 0.32; // the pylon stands on the near third
	const top = deckY + arch * 3.2;
	for (let p = bx0 + 1.5; p < bx1 - 1; p += 4 + rand() * 2) L.rect(p, 0, 0.16, deckY - 0.1, L.tone(TONE.grey, 0.7));
	L.shaded(bx0, deckY - 0.16, span, 0.16, TONE.grey, 0.6, 0.9); // the girder
	L.rect(bx0, deckY, span, 0.06, L.tone(TONE.grey, 1.3)); // the road's edge
	L.poly([[px - 0.22, 0], [px + 0.22, 0], [px + 0.18, top], [px + 0.02, top + 0.15]], L.tone(TONE.grey, 1.05)); // the pylon
	L.rect(px + 0.05, 0, 0.06, top, L.tone(TONE.grey, 1.35)); // its lit edge
	for (let k = 1; k <= 11; k++) {
		const anchor = top - k * 0.12;
		L.line(px + 0.1, anchor, px - (span * 0.3 * k) / 11, deckY + 0.05, 1.2, L.tone(TONE.grey, 1.25));
		L.line(px + 0.1, anchor, px + (span * 0.66 * k) / 11, deckY + 0.05, 1.2, L.tone(TONE.grey, 1.25));
	}
	L.rect(px + 0.02, top + 0.12, 0.12, 0.1, L.light(0.5, LIGHT.red, 1)); // the pylon's aviation light
	for (let lx = bx0 + 0.3; lx < bx1; lx += 0.9) {
		L.rect(lx, deckY + 0.06, 0.12, 0.1, L.light(0.01, LIGHT.lamp, 0.95));
		lit.push([lx, deckY, LIGHT.lamp]);
	}
	// Reflections: soft vertical streaks under the lit things, broken into dashes by the ripples.
	for (const [rx, , kind] of lit) {
		if (rand() < (kind === LIGHT.lamp ? 0.15 : 0.55)) continue;
		const len = (kind === LIGHT.lamp ? 0.55 : 0.3) * water * (0.6 + rand() * 0.6);
		for (let y = water - 0.04; y > water - len; y -= 0.07 + rand() * 0.05) L.rect(rx + (rand() - 0.5) * 0.06, y - 0.04, 0.08 + rand() * 0.1, 0.035, L.light(0.01, kind, 0.25 + rand() * 0.2));
	}
	return L.texture();
}

/** Near: the street in front, tube house by tube house, power lines, lamps, and trees. */
function drawNear(widthM: number, heightM: number) {
	// Drawn at half size (the canvas spans twice the metres): it reads as further off, and the bridge and the far skyline
	// show over its roofs.
	const L = layerCanvas(widthM / 0.5, heightM / 0.5, BACKDROP.near.canvas);
	widthM /= 0.5;
	const rand = seeded(37);
	const poles: number[] = [];
	let x = 0;
	while (x < widthM) {
		// A gap now and then: the river and the bridge show through.
		if (rand() < 0.12) {
			x += 4 + rand() * 7;
			continue;
		}
		const big = rand() < 0.08;
		const w = big ? 8 + rand() * 6 : 3.6 + rand() * 1.6; // a mid-rise block, or one narrow tube house
		const floors = big ? 6 + Math.floor(rand() * 3) : 2 + Math.floor(rand() * 4);
		const floor = 1.1 + rand() * 0.12;
		const h = floors * floor;
		const t = FACADES[Math.floor(rand() * FACADES.length)];
		if (big) {
			block(L, rand, x, 0, w, h, t, floor, 0.3);
		} else {
			L.shaded(x, 0, w, h, t, 0.62, 1.1);
			for (let f = 0; f < floors; f++) {
				const y = f * floor;
				L.rect(x, y + floor - 0.08, w, 0.08, L.tone(t, 0.55)); // the slab line between floors
				if (f === 0) {
					// The ground floor: a shop, lit or shuttered, a sign over it.
					if (rand() < 0.55) {
						L.rect(x + 0.35, 0, w - 0.7, floor * 0.72, L.light(rand(), rand() < 0.5 ? LIGHT.amber : LIGHT.warm, 0.85));
						L.rect(x + 0.2, floor * 0.74, w - 0.4, 0.14, L.tone(t, 0.45)); // the awning
					} else {
						L.rect(x + 0.35, 0, w - 0.7, floor * 0.72, L.tone(TONE.grey, 0.8));
						for (let s = 0.08; s < floor * 0.72; s += 0.09) L.rect(x + 0.35, s, w - 0.7, 0.025, L.tone(TONE.grey, 0.55)); // the shutter's slats
					}
					if (rand() < 0.6) L.rect(x + 0.4 + rand() * (w - 2.2), floor * 0.86, 1.2 + rand() * 0.6, 0.2, L.light(rand(), rand() < 0.5 ? LIGHT.lamp : LIGHT.warm, 0.95));
				} else {
					// An upper floor: a window (lit or not) and, every other floor, a balcony with its railing.
					const lit = rand() < 0.4;
					L.rect(x + 0.6, y + 0.32, w - 1.2, floor * 0.48, lit ? L.light(rand(), rand() < 0.4 ? LIGHT.amber : LIGHT.warm, 0.55 + rand() * 0.4) : L.tone(t, 0.42));
					if (rand() < 0.55) {
						L.rect(x + 0.2, y + 0.1, w - 0.4, 0.12, L.tone(t, 1.3)); // the balcony slab
						L.rect(x + 0.2, y + 0.42, w - 0.4, 0.05, L.tone(TONE.grey, 0.5)); // the rail
						for (let r = x + 0.3; r < x + w - 0.3; r += 0.28) L.rect(r, y + 0.22, 0.03, 0.2, L.tone(TONE.grey, 0.5));
					}
					if (rand() < 0.3) L.rect(x + (rand() < 0.5 ? 0.25 : w - 0.85), y + 0.55, 0.6, 0.38, L.tone(TONE.grey, 1.2)); // an air conditioner
				}
			}
			// The roof: a water tank, a little stair-head, or a sloped tin roof.
			const r = rand();
			if (r < 0.35) {
				L.shaded(x + 0.5 + rand() * (w - 1.8), h, 0.9, 0.7, TONE.grey, 0.8, 1.3);
			} else if (r < 0.6) {
				L.shaded(x + rand() * (w - 1.6), h, 1.4, 0.9, t, 0.7, 1.05);
			} else if (r < 0.8) {
				L.poly([[x, h], [x + w, h], [x + w, h + 0.4 + rand() * 0.3]], L.tone(t, 0.85));
			}
		}
		if (rand() < 0.5) poles.push(x + w);
		x += w + (rand() < 0.3 ? rand() * 0.5 : 0);
	}
	// Power lines between the poles: the city's tangle of wires, sagging a little.
	for (const p of poles) L.rect(p - 0.06, 0, 0.12, 3.4, L.tone(TONE.grey, 0.6));
	for (let i = 0; i + 1 < poles.length; i++) {
		const a = poles[i];
		const b = poles[i + 1];
		if (b - a > 14) continue;
		for (let k = 0; k < 3 + Math.floor(rand() * 3); k++) {
			const y = 2.6 + k * 0.18 + rand() * 0.1;
			const sag = 0.25 + rand() * 0.35;
			L.g.strokeStyle = L.tone(TONE.grey, 0.4);
			L.g.lineWidth = 1.1;
			L.g.beginPath();
			L.g.moveTo(L.X(a), L.Y(y));
			L.g.quadraticCurveTo(L.X((a + b) / 2), L.Y(y - sag * 2), L.X(b), L.Y(y));
			L.g.stroke();
		}
	}
	// Street lamps: an orange glow on a curved arm.
	for (let lx = 3 + rand() * 6; lx < widthM; lx += 10 + rand() * 14) {
		L.rect(lx, 0, 0.12, 2.4, L.tone(TONE.grey, 0.75));
		L.rect(lx, 2.3, 0.6, 0.08, L.tone(TONE.grey, 0.75));
		L.rect(lx + 0.45, 2.16, 0.35, 0.16, L.light(0.01, LIGHT.lamp, 1));
	}
	// Trees: crowns built from leaf clusters, darker inside, lit at the top, on a slim trunk.
	for (let tx = rand() * 4; tx < widthM; tx += 3 + rand() * 7) {
		const r = 1.1 + rand() * 1.3;
		const top = 1.6 + rand() * 2;
		L.rect(tx - 0.07, 0, 0.14, top, L.tone(TONE.tree, 0.7));
		for (let k = 0; k < 22; k++) {
			const a = rand() * Math.PI * 2;
			const d = Math.sqrt(rand()) * r;
			const cx = tx + Math.cos(a) * d;
			const cy = top + Math.sin(a) * d * 0.7;
			const rr = r * (0.28 + rand() * 0.2);
			const shade = 0.65 + 0.55 * Math.max(0, (cy - top) / (r * 0.7)) + rand() * 0.1;
			L.g.fillStyle = L.tone(TONE.tree, shade);
			L.g.beginPath();
			L.g.ellipse(L.X(cx), L.Y(cy), rr * L.sx, rr * L.sy * 0.9, 0, 0, Math.PI * 2);
			L.g.fill();
		}
	}
	return L.texture();
}

const vertex = /* glsl */ `
	varying vec2 vUv;
	varying float vY;
	void main() {
		vUv = uv;
		vec4 world = modelMatrix * vec4(position, 1.0);
		vY = world.y;
		gl_Position = projectionMatrix * viewMatrix * world;
	}`;

const layerFragment = /* glsl */ `
	uniform sampler2D uMask;
	uniform float uRepeat;
	uniform vec3 uTones[7];
	uniform vec3 uLights[4];
	uniform vec3 uOff;
	uniform float uLit;
	uniform float uGlow;
	uniform float uSky;
	uniform vec3 uHaze;
	uniform float uFog;
	uniform float uTime;
	uniform sampler2D uSkyMap;
	varying vec2 vUv;
	varying float vY;
	void main() {
		vec4 m = texture2D(uMask, vec2(vUv.x * uRepeat, vUv.y));
		vec3 colour;
		if (m.g > 0.002) {
			// A light: on while the share lit is above its own threshold; its kind and brightness. Aviation lights blink.
			int kind = int(m.b * 255.0 / 80.0 + 0.5);
			vec3 c = kind == 0 ? uLights[0] : kind == 1 ? uLights[1] : kind == 2 ? uLights[2] : uLights[3];
			float on = kind == 3 ? step(0.45, fract(uTime * 0.6 + m.g * 7.0)) : step(m.g, uLit);
			colour = mix(uOff, c * m.r * uGlow, on);
			colour = mix(colour, uHaze, uFog * 0.3);
		} else {
			int t = int(m.r * 255.0 / 40.0 + 0.5);
			float shade = m.b > 0.001 ? 0.35 + m.b * 1.3 : 1.0;
			colour = mix(uTones[t] * shade, uHaze, uFog);
		}
		if (uSky > 0.5) {
			// The sky photograph, mirrored round the arc (so it is never stretched past its own shape).
			float u = vUv.x * 2.0;
			vec3 sky = texture2D(uSkyMap, vec2(1.0 - abs(mod(u, 2.0) - 1.0), vUv.y)).rgb;
			gl_FragColor = vec4(mix(sky, colour, m.a), 1.0);
		} else {
			if (m.a < 0.02) discard;
			gl_FragColor = vec4(colour, m.a);
		}
		#include <colorspace_fragment>
	}`;

export interface Backdrop {
	update(): void;
	applyPalette(dark: boolean): void;
}

export function buildBackdrop(parent: Group): Backdrop {
	const [cx, cz] = BACKDROP.centre;
	const arc = (BACKDROP.arc * Math.PI) / 180;
	const ground = BACKDROP.ground;
	const layers: ShaderMaterial[] = [];
	const layer = (spec: { radius: number; top: number; repeat: number; haze: number }, draw: (w: number, h: number) => Texture, sky: boolean, order: number) => {
		const height = spec.top - ground;
		// The drawing's width in metres: one repeat's share of the arc at this radius.
		const mask = draw((spec.radius * arc) / spec.repeat, height);
		const material = new ShaderMaterial({
			vertexShader: vertex,
			fragmentShader: layerFragment,
			side: BackSide,
			transparent: !sky,
			depthWrite: sky,
			fog: false,
			uniforms: {
				uMask: { value: mask },
				uRepeat: { value: spec.repeat },
				uTones: { value: BACKDROP.night.tones.map(() => new Color()) },
				uLights: { value: BACKDROP.night.lights.map(() => new Color()) },
				uLit: { value: 0.9 },
				uGlow: { value: 1 },
				uSky: { value: sky ? 1 : 0 },
				uHaze: { value: new Color() },
				uOff: { value: new Color() },
				uFog: { value: spec.haze },
				uTime: { value: 0 },
				uSkyMap: { value: null },
			},
		});
		const mesh = new Mesh(new CylinderGeometry(spec.radius, spec.radius, height, 96, 1, true, -arc / 2, arc), material);
		mesh.position.set(cx, ground + height / 2, cz);
		mesh.renderOrder = order;
		parent.add(mesh);
		layers.push(material);
		return material;
	};
	const far = layer(BACKDROP.far, drawFar, true, -30);
	const mid = layer(BACKDROP.mid, drawMid, false, -29);
	const near = layer(BACKDROP.near, drawNear, false, -28);
	// The two skies (the theme picks one; both load at once, 43 KB in all, so a theme switch never waits).
	const base = import.meta.env.BASE_URL.replace(/\/$/, "");
	const skies: Record<"night" | "dusk", Texture> = {
		night: new TextureLoader().load(base + BACKDROP.sky.night),
		dusk: new TextureLoader().load(base + BACKDROP.sky.dusk),
	};
	for (const t of Object.values(skies)) {
		t.colorSpace = SRGBColorSpace;
		t.wrapS = RepeatWrapping;
	}

	/* ---------- The traffic: the street in front, and across the bridge ---------- */
	const n = BACKDROP.cars;
	const seeds = new Float32Array(n);
	const lanes = new Float32Array(n);
	const rand = seeded(5);
	for (let i = 0; i < n; i++) {
		seeds[i] = rand();
		lanes[i] = Math.floor(rand() * 4); // 0, 1: the street, both ways; 2, 3: the bridge, both ways
	}
	const carGeometry = new BufferGeometry();
	carGeometry.setAttribute("position", new BufferAttribute(new Float32Array(n * 3), 3));
	carGeometry.setAttribute("seed", new BufferAttribute(seeds, 1));
	carGeometry.setAttribute("lane", new BufferAttribute(lanes, 1));
	const { from, to, deck } = BACKDROP.bridge;
	const cars = new Points(
		carGeometry,
		new ShaderMaterial({
			transparent: true,
			depthWrite: false,
			blending: AdditiveBlending,
			fog: false,
			uniforms: {
				uTime: { value: 0 },
				uSize: { value: BACKDROP.carSize * Math.min(window.devicePixelRatio, 1.5) },
				uCentre: { value: [cx, cz] },
				uArc: { value: arc },
				// The street just in front of the near houses; the bridge's deck on the middle layer, over its span.
				uStreet: { value: [BACKDROP.near.radius - 0.8, ground + 0.25] },
				uBridge: { value: [BACKDROP.mid.radius - 0.3, deck + 0.05, from, to] },
				uSpeed: { value: BACKDROP.carSpeed },
				uBright: { value: 1 },
			},
			vertexShader: /* glsl */ `
				attribute float seed;
				attribute float lane;
				uniform float uTime;
				uniform float uSize;
				uniform vec2 uCentre;
				uniform float uArc;
				uniform vec2 uStreet;
				uniform vec4 uBridge;
				uniform float uSpeed;
				uniform float uBright;
				varying vec3 vColour;
				varying float vAlpha;
				void main() {
					bool bridge = lane > 1.5;
					float dir = mod(lane, 2.0) < 1.0 ? 1.0 : -1.0;
					float r = (bridge ? uBridge.x : uStreet.x) + (dir > 0.0 ? 0.0 : 0.6);
					float y = bridge ? uBridge.y : uStreet.y;
					float a0 = bridge ? uBridge.z : 0.0;
					float a1 = bridge ? uBridge.w : 1.0;
					float span = r * uArc * (a1 - a0);
					float u = fract(seed + dir * uTime * uSpeed * (0.7 + 0.6 * fract(seed * 7.0)) / span);
					float a = (a0 + (a1 - a0) * u - 0.5) * uArc;
					vec3 p = vec3(uCentre.x + r * sin(a), y, uCentre.y + r * cos(a));
					gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
					gl_PointSize = uSize * (bridge ? 0.7 : 1.0) * (0.75 + 0.5 * fract(seed * 13.0));
					// Coming toward the room: white headlights; going away: red tail lights.
					vColour = dir > 0.0 ? vec3(1.0, 0.96, 0.88) : vec3(1.0, 0.16, 0.1);
					vAlpha = uBright * smoothstep(0.0, 0.04, u) * smoothstep(1.0, 0.96, u);
				}`,
			fragmentShader: /* glsl */ `
				varying vec3 vColour;
				varying float vAlpha;
				void main() {
					float d = length(gl_PointCoord - 0.5);
					gl_FragColor = vec4(vColour, vAlpha * smoothstep(0.5, 0.15, d));
					#include <colorspace_fragment>
				}`,
		}),
	);
	cars.frustumCulled = false;
	cars.renderOrder = -27;
	parent.add(cars);
	const carMaterial = cars.material as ShaderMaterial;

	const apply = (p: Palette, lit: number) => {
		for (const m of layers) {
			(m.uniforms.uTones.value as Color[]).forEach((c, i) => c.set(p.tones[i]));
			(m.uniforms.uLights.value as Color[]).forEach((c, i) => c.set(p.lights[i]));
			m.uniforms.uHaze.value.set(p.haze);
			m.uniforms.uOff.value.set(p.off);
			m.uniforms.uLit.value = lit;
		}
		far.uniforms.uGlow.value = p.glow * 0.6;
		mid.uniforms.uGlow.value = p.glow * 0.8;
		near.uniforms.uGlow.value = p.glow;
		carMaterial.uniforms.uBright.value = p === BACKDROP.night ? 1 : 0.6;
		far.uniforms.uSkyMap.value = p === BACKDROP.night ? skies.night : skies.dusk;
	};
	apply(BACKDROP.night, BACKDROP.lit.dark);

	return {
		update() {
			// Its own clock: the traffic keeps moving while the room waits (the logo intro, the opening words).
			const time = (performance.now() / 1000) % 100000;
			carMaterial.uniforms.uTime.value = time;
			for (const m of layers) m.uniforms.uTime.value = time; // the aviation lights' blink
		},
		applyPalette(dark) {
			apply(dark ? BACKDROP.night : BACKDROP.dusk, dark ? BACKDROP.lit.dark : BACKDROP.lit.light);
		},
	};
}
