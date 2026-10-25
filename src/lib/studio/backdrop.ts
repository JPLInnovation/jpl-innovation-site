/**
 * The night outside the studio's back wall (room.ts makes that wall glass above the sill): an ordinary Ho Chi Minh
 * City night, open space, not a framed picture. Flat, as the city is: a river, not hills. Three curved layers behind
 * the room, at different distances, so the camera's moves give a little parallax:
 *
 *   far    the sky (dark, a faint orange haze low down), a low far skyline and one or two towers
 *   mid    the river, a bridge with a softly lit deck and arc, and the far bank's few mid-rise blocks
 *   near   rows of narrow tube houses (flat or slightly sloped roofs, a lit door or balcony here and there), the odd
 *          orange street lamp, and dark rounded trees in front
 *
 * plus the traffic: one Points draw call of small red and white lights, along the street in front and across the
 * bridge, moving in the vertex shader. Facades in several dark tones (brown, slate, muted green, ochre); only a few
 * scattered windows lit, in warm white and amber; no neon. All drawn here into canvases at load (no download): a
 * generic city, not a claim about real buildings. In the light theme the same city at dusk.
 *
 * A photo of your own can replace the far layer: set BACKDROP.photo (blurred, EXIF stripped, a WebP under 60 KB).
 * Nothing here is fogged or lit by the room; it costs 4 draw calls and three 2048 x 512 textures.
 *
 * The drawings are encoded, so one set serves both themes: alpha is coverage; where green is 0, red picks the facade's
 * tone; where green is above 0 it is a light: green is its own threshold (it is on while the share lit is above it, so
 * each light is on or off as a whole), red its brightness, blue its kind (warm white, amber, street-lamp orange).
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

/** Every setting of the night outside, in one place to tune. */
export const BACKDROP = {
	/** Your own night photo for the far layer (a path under public/), or null for the drawn sky. */
	photo: null as string | null,
	/** Where the layers curve round (the room is x -8.5 to 8.5, z -3.4 to 6.4) and the street level (m). */
	centre: [0, -2] as [number, number],
	ground: -1.5,
	/**
	 * Radii (m), tops (m above the floor) and how often each drawing repeats round the arc. All inside the stage
	 * camera's 40 m reach from anywhere in the room (it draws nothing further).
	 */
	far: { radius: 35, top: 26, repeat: 2 },
	mid: { radius: 31, top: 16, repeat: 1 },
	near: { radius: 26, top: 12, repeat: 2 },
	/** The arc's width, degrees, centred behind the back wall. */
	arc: 176,
	/** The bridge: where it spans on the middle layer's arc (0 to 1), its deck and the top of its arc (m). */
	bridge: { from: 0.18, to: 0.52, deck: -0.35, arch: 1.5 },
	/** Share of the drawn lights that are on, in the dark theme and the light one (dusk). */
	lit: { dark: 0.9, light: 0.45 },
	/** The traffic: how many lights, their size (px) and speed (m/s). */
	cars: 150,
	carSize: 2.4,
	carSpeed: 9,
	night: {
		skyTop: "#03060c",
		skyMid: "#0d1530",
		haze: "#4a2a1a",
		tones: ["#1a120d", "#10151d", "#0f1712", "#1d170c", "#141416", "#070c08", "#05080d"],
		lights: ["#ffe2b0", "#ffb05a", "#ff9a45"],
		glow: 1,
	},
	dusk: {
		skyTop: "#3d5590",
		skyMid: "#9a7d9e",
		haze: "#f2b48a",
		tones: ["#4a3a33", "#3b4456", "#3a4a40", "#5a4a32", "#474a52", "#26322a", "#2e3a52"],
		lights: ["#ffe8c4", "#ffc27a", "#ffb070"],
		glow: 0.6,
	},
};

type Palette = typeof BACKDROP.night;
/** The facade tones, by index into `tones`. */
const TONE = { brown: 0, slate: 1, green: 2, ochre: 3, grey: 4, tree: 5, water: 6 } as const;
const FACADES = [TONE.brown, TONE.slate, TONE.green, TONE.ochre, TONE.grey];
/** The lights' kinds, by index into `lights`. */
const LIGHT = { warm: 0, amber: 1, lamp: 2 } as const;

/** A seeded random number generator (the same city every visit). */
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

/** A canvas for one layer, drawn in metres: x along the arc from 0, y up from the street. */
function layerCanvas(widthM: number, heightM: number) {
	const canvas = document.createElement("canvas");
	canvas.width = 2048;
	canvas.height = 512;
	const g = canvas.getContext("2d")!;
	const sx = canvas.width / widthM;
	const sy = canvas.height / heightM;
	const X = (m: number) => m * sx;
	const Y = (m: number) => canvas.height - m * sy;
	const tone = (t: number) => `rgb(${t * 40},0,0)`;
	const light = (threshold: number, kind: number, bright = 1) => `rgb(${Math.round(bright * 255)},${Math.max(1, Math.round(threshold * 255))},${kind * 100})`;
	/** A rectangle in metres. */
	const rect = (x: number, y: number, w: number, h: number, style: string) => {
		g.fillStyle = style;
		g.fillRect(X(x), Y(y + h), Math.max(1, w * sx), Math.max(1, h * sy));
	};
	const texture = () => {
		const t = new CanvasTexture(canvas);
		t.wrapS = RepeatWrapping;
		t.anisotropy = 4;
		return t;
	};
	return { g, canvas, sx, sy, X, Y, tone, light, rect, texture };
}

/** A few lit windows, scattered (no grids): uneven sizes and gaps, roughly on floors, most of the facade dark. */
function scatterWindows(L: ReturnType<typeof layerCanvas>, rand: () => number, x: number, y0: number, w: number, h: number, floor: number, share: number) {
	for (let y = y0 + floor * 0.45; y < y0 + h - floor * 0.6; y += floor) {
		// (sizes and gaps in floors, so a small building far off gets small windows)
		let cx = x + floor * (0.3 + rand() * 0.8);
		while (cx < x + w - floor * 0.6) {
			const ww = floor * (0.4 + rand() * 0.8);
			if (rand() < share) L.rect(cx, y + (rand() - 0.5) * 0.15, ww, floor * (0.32 + rand() * 0.18), L.light(rand(), rand() < 0.3 ? LIGHT.amber : LIGHT.warm, 0.55 + rand() * 0.45));
			cx += ww + floor * (0.6 + rand() * 2.2);
		}
	}
}

/** Far: a low skyline far off, and one or two towers. */
function drawFar(widthM: number, heightM: number) {
	const L = layerCanvas(widthM, heightM);
	const rand = seeded(11);
	let x = 0;
	while (x < widthM) {
		const w = 1.2 + rand() * 3.5;
		const h = 0.6 + rand() * 1.8;
		L.rect(x, 0, w, h, L.tone(TONE.slate));
		if (rand() < 0.5) L.rect(x + rand() * (w - 0.3), 0.3 + rand() * (h - 0.5), 0.18, 0.12, L.light(rand(), LIGHT.warm, 0.5));
		x += w + rand() * 0.6;
	}
	// One or two towers, thin, with a few lit floors and a light at the top.
	for (const [at, h] of [[0.31, 6.2], [0.72, 4.6]]) {
		const tx = widthM * at;
		L.rect(tx, 0, 1.1, h, L.tone(TONE.grey));
		L.rect(tx + 0.35, h, 0.35, 0.5, L.tone(TONE.grey));
		for (let y = 1; y < h - 0.4; y += 0.55) if (rand() < 0.35) L.rect(tx + 0.15 + rand() * 0.5, y, 0.28, 0.14, L.light(rand(), LIGHT.warm, 0.6));
		L.rect(tx + 0.45, h + 0.5, 0.15, 0.12, L.light(0.01, LIGHT.amber, 0.8));
	}
	return L.texture();
}

/** Mid: the river, the bridge across it, and the far bank's few mid-rise blocks. */
function drawMid(widthM: number, heightM: number) {
	const L = layerCanvas(widthM, heightM);
	const rand = seeded(23);
	const water = 0.9; // the river's height in the layer (it lies at the street's level)
	const { from, to, deck, arch } = BACKDROP.bridge;
	const deckY = deck - BACKDROP.ground;
	const archY = arch - BACKDROP.ground;
	// The far bank: low buildings and a few mid-rise blocks, sparsely lit.
	let x = 0;
	while (x < widthM) {
		const tall = rand() < 0.16;
		const w = tall ? 2 + rand() * 2.5 : 1 + rand() * 2.2;
		const h = tall ? 2.2 + rand() * 2.6 : 0.6 + rand() * 1.2;
		const t = FACADES[Math.floor(rand() * FACADES.length)];
		L.rect(x, water, w, h, L.tone(t));
		scatterWindows(L, rand, x, water, w, h, tall ? 0.45 : 0.38, tall ? 0.28 : 0.2);
		x += w + rand() * 1.2;
	}
	// The river.
	L.rect(0, 0, widthM, water, L.tone(TONE.water));
	// The bridge: a deck line with its lamps, a soft arc over it, and the piers.
	const bx0 = widthM * from;
	const bx1 = widthM * to;
	L.rect(bx0, deckY - 0.12, bx1 - bx0, 0.24, L.tone(TONE.grey));
	for (let px = bx0 + 2; px < bx1 - 1; px += 7 + rand() * 3) L.rect(px, 0, 0.5, deckY - 0.12, L.tone(TONE.grey));
	const span = bx1 - bx0;
	for (let i = 0; i <= 120; i++) {
		const u = i / 120;
		const ax = bx0 + span * u;
		const ay = deckY + (archY - deckY) * 4 * u * (1 - u);
		L.rect(ax, ay, span / 120 + 0.05, 0.12, L.light(0.02, LIGHT.warm, 0.55));
		if (i % 8 === 0) L.rect(ax, deckY + 0.12, 0.2, 0.14, L.light(0.01, LIGHT.lamp, 0.9)); // the deck's lamps
	}
	// Reflections: soft vertical streaks in the water under the lit things.
	for (let i = 0; i < 90; i++) {
		const rx = rand() * widthM;
		const onBridge = rx > bx0 && rx < bx1;
		if (!onBridge && rand() < 0.6) continue;
		L.rect(rx, 0.05 + rand() * 0.2, 0.12 + rand() * 0.2, 0.25 + rand() * (water - 0.35), L.light(onBridge ? 0.01 : rand(), onBridge ? LIGHT.lamp : LIGHT.amber, 0.22 + rand() * 0.15));
	}
	return L.texture();
}

/** Near: rows of tube houses (with gaps onto the river), the odd street lamp, and trees in front. */
function drawNear(widthM: number, heightM: number) {
	// Drawn at half size (the canvas spans twice the metres): it reads as further off, and the bridge and the far skyline
	// show over its roofs.
	const L = layerCanvas(widthM / 0.5, heightM / 0.5);
	widthM /= 0.5;
	const rand = seeded(37);
	let x = 0;
	while (x < widthM) {
		// A gap now and then: the river and the bridge show through.
		if (rand() < 0.14) {
			x += 4 + rand() * 7;
			continue;
		}
		const block = rand() < 0.1;
		const w = block ? 9 + rand() * 8 : 3.6 + rand() * 1.6; // a mid-rise block, or one narrow tube house
		const floors = block ? 5 + Math.floor(rand() * 4) : 2 + Math.floor(rand() * 4);
		const floor = 1.05 + rand() * 0.15;
		const h = floors * floor;
		const t = FACADES[Math.floor(rand() * FACADES.length)];
		L.rect(x, 0, w, h, L.tone(t));
		// Flat or slightly sloped roof, sometimes a small stair-head or water tank on top.
		if (rand() < 0.35) {
			L.g.fillStyle = L.tone(t);
			L.g.beginPath();
			L.g.moveTo(L.X(x), L.Y(h));
			L.g.lineTo(L.X(x + w), L.Y(h));
			L.g.lineTo(L.X(x + w), L.Y(h + 0.35 + rand() * 0.35));
			L.g.closePath();
			L.g.fill();
		} else if (rand() < 0.4) L.rect(x + rand() * (w - 1.2), h, 0.9 + rand() * 0.6, 0.5, L.tone(t));
		if (block) scatterWindows(L, rand, x, 0, w, h, floor, 0.2);
		else {
			// A tube house: maybe a lit door at street level, a lit balcony, one window.
			if (rand() < 0.5) L.rect(x + 0.6 + rand() * (w - 2), 0, 1.1, 0.75, L.light(rand(), rand() < 0.5 ? LIGHT.amber : LIGHT.warm, 0.85));
			if (rand() < 0.38) L.rect(x + 0.3, floor * (1 + Math.floor(rand() * (floors - 1))) + 0.15, w - 0.6, 0.28, L.light(rand(), LIGHT.amber, 0.6));
			if (rand() < 0.5) L.rect(x + 0.5 + rand() * (w - 1.6), floor * (1 + Math.floor(rand() * (floors - 1))) + 0.35, 0.7 + rand() * 0.5, 0.45, L.light(rand(), LIGHT.warm, 0.75));
		}
		x += w + (rand() < 0.3 ? rand() * 0.6 : 0);
	}
	// Street lamps: an orange glow on a post, here and there.
	for (let lx = 3 + rand() * 6; lx < widthM; lx += 10 + rand() * 14) {
		L.rect(lx, 0, 0.12, 1.9, L.tone(TONE.grey));
		L.rect(lx - 0.18, 1.85, 0.45, 0.22, L.light(0.01, LIGHT.lamp, 1));
	}
	// Trees in front: dark rounded crowns, overlapping, breaking up the edges.
	L.g.fillStyle = L.tone(TONE.tree);
	for (let tx = rand() * 4; tx < widthM; tx += 2.5 + rand() * 7) {
		const r = 1 + rand() * 1.4;
		const top = 1.4 + rand() * 2;
		for (let k = 0; k < 4; k++) {
			L.g.beginPath();
			L.g.ellipse(L.X(tx + (rand() - 0.5) * r), L.Y(top + (rand() - 0.5) * r * 0.6), r * L.sx * (0.55 + rand() * 0.3), r * L.sy * (0.5 + rand() * 0.3), 0, 0, Math.PI * 2);
			L.g.fill();
		}
		L.rect(tx - 0.08, 0, 0.16, top, L.tone(TONE.tree));
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
	uniform vec3 uLights[3];
	uniform float uLit;
	uniform float uGlow;
	uniform float uSky;
	uniform vec3 uSkyTop;
	uniform vec3 uSkyMid;
	uniform vec3 uHaze;
	uniform float uGround;
	uniform float uTop;
	uniform bool uPhoto;
	uniform sampler2D uPhotoMap;
	varying vec2 vUv;
	varying float vY;
	void main() {
		vec4 m = texture2D(uMask, vec2(vUv.x * uRepeat, vUv.y));
		vec3 colour;
		if (m.g > 0.002) {
			// A light: on while the share lit is above its own threshold; its kind and brightness.
			int kind = int(m.b * 2.55 + 0.5);
			vec3 c = kind == 0 ? uLights[0] : kind == 1 ? uLights[1] : uLights[2];
			float on = step(m.g, uLit);
			colour = mix(uTones[1] * 0.6, c * m.r * uGlow, on);
		} else {
			int t = int(m.r * 255.0 / 40.0 + 0.5);
			colour = uTones[t];
		}
		if (uSky > 0.5) {
			float h = clamp((vY - uGround) / (uTop - uGround), 0.0, 1.0);
			vec3 sky = mix(uHaze, uSkyMid, smoothstep(0.0, 0.16, h));
			sky = mix(sky, uSkyTop, smoothstep(0.16, 0.7, h));
			if (uPhoto) sky = texture2D(uPhotoMap, vUv).rgb;
			gl_FragColor = vec4(mix(sky, colour, uPhoto ? 0.0 : m.a), 1.0);
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
	const layer = (spec: { radius: number; top: number; repeat: number }, draw: (w: number, h: number) => Texture, sky: boolean, order: number) => {
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
				uSkyTop: { value: new Color() },
				uSkyMid: { value: new Color() },
				uHaze: { value: new Color() },
				uGround: { value: ground },
				uTop: { value: spec.top },
				uPhoto: { value: false },
				uPhotoMap: { value: null },
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
	if (BACKDROP.photo) {
		new TextureLoader().load(BACKDROP.photo, (photo) => {
			photo.colorSpace = SRGBColorSpace;
			far.uniforms.uPhotoMap.value = photo;
			far.uniforms.uPhoto.value = true;
		});
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
			m.uniforms.uSkyTop.value.set(p.skyTop);
			m.uniforms.uSkyMid.value.set(p.skyMid);
			m.uniforms.uHaze.value.set(p.haze);
			m.uniforms.uLit.value = lit;
		}
		far.uniforms.uGlow.value = p.glow * 0.6;
		mid.uniforms.uGlow.value = p.glow * 0.8;
		near.uniforms.uGlow.value = p.glow;
		carMaterial.uniforms.uBright.value = p === BACKDROP.night ? 1 : 0.6;
	};
	apply(BACKDROP.night, BACKDROP.lit.dark);

	return {
		update() {
			// Its own clock: the traffic keeps moving while the room waits (the logo intro, the opening words).
			carMaterial.uniforms.uTime.value = (performance.now() / 1000) % 100000;
		},
		applyPalette(dark) {
			apply(dark ? BACKDROP.night : BACKDROP.dusk, dark ? BACKDROP.lit.dark : BACKDROP.lit.light);
		},
	};
}
