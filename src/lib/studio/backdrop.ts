/**
 * The night outside the studio's back wall (room.ts makes that wall glass above the sill): an ordinary Ho Chi Minh
 * City night, open space, not a framed picture. Three curved layers far behind the room, at different distances so the
 * camera's moves give a little parallax:
 *
 *   far    the sky (dark, with a faint orange haze low down) and the farthest buildings
 *   mid    a band of buildings with lit windows
 *   near   taller buildings with lit windows, and the roads at their feet
 *
 * plus the traffic: one Points draw call of small red and white lights moving along the roads in the vertex shader.
 * Warm white and amber windows; no neon. The buildings are drawn here into two canvases at load (no download): a
 * generic city, not a claim about real buildings. In the light theme the same city at dusk.
 *
 * A photo of your own can replace the far layer: set BACKDROP.photo (blurred, EXIF stripped, a WebP under 60 KB).
 * Nothing here is fogged or lit by the room; it costs 4 draw calls and two 2048 x 512 textures.
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
	/** Where the layers curve round: their centre (the room is x -8.5 to 8.5, z -3.4 to 6.4) and the street level. */
	centre: [0, -2] as [number, number],
	ground: -3,
	/**
	 * Radii (m), tops (m above the floor) and how often the drawing repeats round the arc. All inside the stage camera's
	 * 40 m reach from anywhere in the room (it draws nothing further).
	 */
	far: { radius: 35, top: 30, repeat: 3 },
	mid: { radius: 31, top: 12, repeat: 3 },
	near: { radius: 26, top: 12, repeat: 2 },
	/** The arc's width, degrees, centred behind the back wall. */
	arc: 176,
	/** Share of windows lit, in the dark theme and the light one (dusk). */
	lit: { dark: 0.42, light: 0.18 },
	/** The traffic: how many lights, their size (px) and speed (m/s). */
	cars: 150,
	carSize: 2.6,
	carSpeed: 9,
	night: {
		skyTop: "#03060c",
		skyMid: "#0a1020",
		haze: "#3a2216",
		far: "#0b111c",
		mid: "#070b14",
		near: "#04070d",
		window: "#ffe2b0",
		amber: "#ffaf55",
		glow: 0.9,
	},
	dusk: {
		skyTop: "#3d5590",
		skyMid: "#9a7d9e",
		haze: "#f2b48a",
		far: "#5c6683",
		mid: "#3c4561",
		near: "#262d43",
		window: "#ffe8c4",
		amber: "#ffc27a",
		glow: 0.55,
	},
};

type Palette = typeof BACKDROP.night;

/** A seeded random number generator (the same city every visit). */
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

/**
 * Buildings into a mask: red where a building is; green on a window, its value the window's own threshold (it is lit
 * when the share lit is above it, so each window is on or off as a whole); blue for the amber ones. The bottom of the
 * canvas is the street; `min` and `max` are building heights, 0 to 1 of the canvas height.
 */
function drawCity(seed: number, { min, max, width: [wMin, wMax], floors }: { min: number; max: number; width: [number, number]; floors: number }) {
	const canvas = document.createElement("canvas");
	canvas.width = 2048;
	canvas.height = 512;
	const g = canvas.getContext("2d")!;
	const rand = seeded(seed);
	let x = 0;
	while (x < canvas.width) {
		const w = wMin + rand() * (wMax - wMin);
		const h = canvas.height * (min + (max - min) * rand() ** 1.6);
		g.fillStyle = "rgb(255,0,0)";
		g.fillRect(x, canvas.height - h, w, h);
		// Windows: a grid of floors; some lit, a few amber.
		const fh = canvas.height / floors;
		const cols = Math.max(2, Math.floor(w / (fh * 0.9)));
		for (let y = canvas.height - h + fh * 0.6; y < canvas.height - fh * 0.4; y += fh)
			for (let c = 0; c < cols; c++) {
				const threshold = 1 + Math.floor(rand() * 254);
				g.fillStyle = `rgb(255,${threshold},${rand() < 0.15 ? 255 : 0})`;
				g.fillRect(x + (w / cols) * (c + 0.25), y, (w / cols) * 0.5, fh * 0.42);
			}
		x += w + rand() * 4;
	}
	const texture = new CanvasTexture(canvas);
	texture.wrapS = RepeatWrapping;
	texture.anisotropy = 4;
	return texture;
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

/** A layer of buildings: the mask's colours, windows lit by `uLit` (a random share, steady per window). */
const layerFragment = /* glsl */ `
	uniform sampler2D uMask;
	uniform float uRepeat;
	uniform vec3 uBuilding;
	uniform vec3 uWindow;
	uniform vec3 uAmber;
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
		vec2 uv = vec2(vUv.x * uRepeat, vUv.y);
		vec4 m = texture2D(uMask, uv);
		// A window is on when the share lit is above its own threshold (the green value).
		float on = step(0.004, m.g) * step(m.g, uLit);
		vec3 lightColour = mix(uWindow, uAmber, step(0.5, m.b));
		vec3 building = uBuilding + lightColour * on * uGlow;
		if (uSky > 0.5) {
			float h = clamp((vY - uGround) / (uTop - uGround), 0.0, 1.0);
			vec3 sky = mix(uHaze, uSkyMid, smoothstep(0.0, 0.18, h));
			sky = mix(sky, uSkyTop, smoothstep(0.18, 0.75, h));
			if (uPhoto) sky = texture2D(uPhotoMap, vUv).rgb;
			gl_FragColor = vec4(mix(sky, building, uPhoto ? 0.0 : m.r), 1.0);
		} else {
			if (m.r < 0.02) discard;
			gl_FragColor = vec4(building, m.r);
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
	const layer = (radius: number, top: number, repeat: number, mask: Texture, sky: boolean, order: number) => {
		const height = top - ground;
		const material = new ShaderMaterial({
			vertexShader: vertex,
			fragmentShader: layerFragment,
			side: BackSide,
			transparent: !sky,
			depthWrite: sky,
			fog: false,
			uniforms: {
				uMask: { value: mask },
				uRepeat: { value: repeat },
				uBuilding: { value: new Color() },
				uWindow: { value: new Color() },
				uAmber: { value: new Color() },
				uLit: { value: 0.4 },
				uGlow: { value: 1 },
				uSky: { value: sky ? 1 : 0 },
				uSkyTop: { value: new Color() },
				uSkyMid: { value: new Color() },
				uHaze: { value: new Color() },
				uGround: { value: ground },
				uTop: { value: top },
				uPhoto: { value: false },
				uPhotoMap: { value: null },
			},
		});
		const mesh = new Mesh(new CylinderGeometry(radius, radius, height, 96, 1, true, -arc / 2, arc), material);
		mesh.position.set(cx, ground + height / 2, cz);
		mesh.renderOrder = order;
		parent.add(mesh);
		layers.push(material);
		return material;
	};
	const far = layer(BACKDROP.far.radius, BACKDROP.far.top, BACKDROP.far.repeat, drawCity(11, { min: 0.03, max: 0.13, width: [14, 46], floors: 90 }), true, -30);
	const midMask = drawCity(23, { min: 0.08, max: 0.42, width: [26, 90], floors: 40 });
	const mid = layer(BACKDROP.mid.radius, BACKDROP.mid.top, BACKDROP.mid.repeat, midMask, false, -29);
	const near = layer(BACKDROP.near.radius, BACKDROP.near.top, BACKDROP.near.repeat, drawCity(37, { min: 0.1, max: 0.5, width: [40, 140], floors: 34 }), false, -28);
	if (BACKDROP.photo) {
		new TextureLoader().load(BACKDROP.photo, (photo) => {
			photo.colorSpace = SRGBColorSpace;
			far.uniforms.uPhotoMap.value = photo;
			far.uniforms.uPhoto.value = true;
		});
	}

	/* ---------- The traffic: small lights along the roads at the near buildings' feet ---------- */
	const n = BACKDROP.cars;
	const seeds = new Float32Array(n);
	const lanes = new Float32Array(n);
	const rand = seeded(5);
	for (let i = 0; i < n; i++) {
		seeds[i] = rand();
		lanes[i] = Math.floor(rand() * 4); // two roads, two directions each
	}
	const carGeometry = new BufferGeometry();
	carGeometry.setAttribute("position", new BufferAttribute(new Float32Array(n * 3), 3));
	carGeometry.setAttribute("seed", new BufferAttribute(seeds, 1));
	carGeometry.setAttribute("lane", new BufferAttribute(lanes, 1));
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
				uGround: { value: ground + 0.4 },
				uArc: { value: arc * 0.98 },
				uRadius: { value: [BACKDROP.near.radius - 1.5, BACKDROP.mid.radius - 2] },
				uSpeed: { value: BACKDROP.carSpeed },
				uBright: { value: 1 },
			},
			vertexShader: /* glsl */ `
				attribute float seed;
				attribute float lane;
				uniform float uTime;
				uniform float uSize;
				uniform vec2 uCentre;
				uniform float uGround;
				uniform float uArc;
				uniform vec2 uRadius;
				uniform float uSpeed;
				uniform float uBright;
				varying vec3 vColour;
				varying float vAlpha;
				void main() {
					float road = lane < 2.0 ? uRadius.x : uRadius.y;
					float dir = mod(lane, 2.0) < 1.0 ? 1.0 : -1.0;
					float r = road + (dir > 0.0 ? 0.0 : 0.9);
					// Round the arc at about city speed (each car a little different), wrapping at its ends.
					float u = fract(seed + dir * uTime * uSpeed * (0.7 + 0.6 * fract(seed * 7.0)) / (r * uArc));
					float a = (u - 0.5) * uArc;
					vec3 p = vec3(uCentre.x + r * sin(a), uGround, uCentre.y + r * cos(a));
					gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
					gl_PointSize = uSize * (0.75 + 0.5 * fract(seed * 13.0));
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
		const set = (m: ShaderMaterial, building: string) => {
			m.uniforms.uBuilding.value.set(building);
			m.uniforms.uWindow.value.set(p.window);
			m.uniforms.uAmber.value.set(p.amber);
			m.uniforms.uSkyTop.value.set(p.skyTop);
			m.uniforms.uSkyMid.value.set(p.skyMid);
			m.uniforms.uHaze.value.set(p.haze);
			m.uniforms.uLit.value = lit;
		};
		set(far, p.far);
		set(mid, p.mid);
		set(near, p.near);
		far.uniforms.uGlow.value = p.glow * 0.45;
		mid.uniforms.uGlow.value = p.glow * 0.7;
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
