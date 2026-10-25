/**
 * The drone chapter's 3D (src/components/DroneChapter.astro): one full-window stage for beats 1 to 4. The camera is
 * the scroll showcase's (src/lib/three/showcase.ts: the damped spring, the holds at each stop, the moves round the
 * model), on the same drone and the same part-by-part stops as before (./drone-showcase.ts), with three stops in
 * front of them: the prologue (a silhouette in the dark), the stakes (a close-up on the camera lens) and the reveal
 * (the lights come up).
 *
 * The atmosphere is all cheap: a key and a cyan rim light (the stage's own, re-levelled per beat), a grid on the bench
 * that fades out, a few hundred specks of dust, a glow ring round the lens, a 450 mm line across the frame. No real-time
 * shadows (the blob under the drone is faked) and no full-screen passes (the stage runs without its effects). The
 * background gradient, glow, vignette and grain are CSS, behind and over the canvas.
 *
 * Behind it, a backdrop per beat (CSS layers, drawn and blurred offline by scripts/drone-backdrops.mjs): city lights
 * low on the horizon (beat 1), streaks from the lens (2), a dusk with mountains in fog (3), the teal grid (4), and at
 * the 4G stop a faint skyline with streaks leaving the 4G stick (the video going out over 4G). The drone reflects a
 * blurred dusk (Poly Haven's Kiara 9 Dusk, CC0). Streaks only ever stand for the camera's video or the 4G data, and
 * nothing moves as if the drone were flying.
 *
 * Every intensity is in LOOK, below, to tune in one place.
 */
import {
	AdditiveBlending,
	BufferAttribute,
	BufferGeometry,
	Color,
	EquirectangularReflectionMapping,
	DoubleSide,
	Float32BufferAttribute,
	HemisphereLight,
	LineBasicMaterial,
	LineSegments,
	Mesh,
	MeshBasicMaterial,
	PlaneGeometry,
	Points,
	RingGeometry,
	ShaderMaterial,
	SRGBColorSpace,
	type Texture,
	TextureLoader,
	Vector3,
} from "three";
import { drive } from "../showcase";
import type { Model, StageContext } from "../stage";
import createDroneShowcase from "./drone-showcase";

type Light = { key: number; fill: number; rim: number; sky: number; environment: number };

/** Every intensity of the chapter's look. The lights are the stage's own (key, fill, rim, sky) and its environment. */
export const LOOK = {
	/** The light on each beat; the camera blends between them as it moves. Beat 4's stops all use `anatomy`. */
	light: {
		prologue: { key: 0.05, fill: 0, rim: 3.2, sky: 0.02, environment: 0.04 },
		stakes: { key: 0.8, fill: 0.05, rim: 2.4, sky: 0.04, environment: 0.2 },
		reveal: { key: 2.3, fill: 0.3, rim: 2.6, sky: 0.18, environment: 1.3 },
		anatomy: { key: 2.2, fill: 0.35, rim: 2.2, sky: 0.2, environment: 1.4 },
	} satisfies Record<string, Light>,
	keyColor: "#fff4e8",
	/** The site's cyan accent (--accent). */
	rimColor: "#22d3ee",
	/** The bench grid: line brightness, and how far out (metres) it has faded to nothing. */
	grid: 0.2,
	gridReach: 1.3,
	/** Dust: how many specks, their size and their brightness when the rim light is fullest. */
	dust: 260,
	dustSize: 7,
	dustBrightness: 0.5,
	/** The glow ring round the lens on the stakes. */
	lensRing: 0.8,
	/** The 450 mm line on the anatomy's first stop. */
	measure: 0.85,
	/** CSS, behind and over the canvas (custom properties on the stage): the glow behind the drone, the vignette and the grain. */
	glow: 0.24,
	vignette: 0.62,
	grain: 0.06,
	/** The dark scrim behind the words on the left, on wide windows (their contrast over the drone). */
	scrim: 0.7,
	/** On wide windows, the share of the width the drone is framed in (on the right; the words are on the left). */
	frame: 0.6,
	/**
	 * One backdrop per beat (the images: public/chapter/drone/, scripts/drone-backdrops.mjs). Opacities 0 to 1; `scrim`
	 * darkens the words' side further on that beat; drift in seconds per loop.
	 */
	backdrop: {
		prologue: { cityOpacity: 0.85, farDrift: 260, nearDrift: 170, scrim: 0 },
		stakes: { streaksOpacity: 0.85, streaksGrow: 0.75, scrim: 0.05 },
		reveal: { duskOpacity: 1, parallax: 1, scrim: 0.3 },
		anatomy: { scrim: 0 }, // the teal grid (grid, gridReach, above)
		"video-link": { skylineOpacity: 0.16, streaksOpacity: 0.75, streaks: 24, scrim: 0 },
	},
	/** The model's reflections: a blurred dusk (Poly Haven, Kiara 9 Dusk, CC0). Its strength per beat is `environment` in `light`. */
	environment: "/chapter/drone/env.webp",
};

/** The chapter's stops, in order: beats 1 to 3, then beat 4's six part-by-part stops. */
export const STOPS = ["prologue", "stakes", "reveal", "overview", "flight-controller", "motors", "power", "camera", "video-link"];

export interface ChapterOptions {
	/** Where the page is, in stops (0 = the prologue). */
	position(): number;
	/** The stop being read changed. */
	onStop(index: number): void;
	/** Every frame: where the camera is, in stops. */
	onFrame(at: number): void;
	/** The small label on each stop (empty: none). */
	titles: string[];
	/** The measurement line's label: "450 mm". */
	measureLabel: string;
	/** For the stills: the drone alone, lit as on beat 4, nothing else drawn. */
	capture?: boolean;
}

const lightOf = (id: string): Light => (LOOK.light as Record<string, Light>)[id] ?? LOOK.light.anatomy;

export default async function createDroneChapter(ctx: StageContext, options: ChapterOptions): Promise<Model> {
	const { camera, scene } = ctx;
	const base = await createDroneShowcase(ctx, STOPS, { spinAt: "motors", led: false, staticRings: true });
	const { rig } = base;
	const atmosphere = !options.capture;

	/* ---------- Lights: the key and a cyan rim, levelled per beat ---------- */
	const { key, fill, rim } = ctx.lights;
	key.color.set(LOOK.keyColor);
	rim.color.set(LOOK.rimColor);
	let sky: HemisphereLight | undefined;
	scene.traverse((o) => {
		if ((o as HemisphereLight).isHemisphereLight) sky = o as HemisphereLight;
	});
	const lights = STOPS.map((id) => (options.capture ? LOOK.light.anatomy : lightOf(id)));
	let rimLevel = 1;
	const weights = new Float32Array(STOPS.length);
	weights[0] = 1;
	const applyLights = () => {
		const l = { key: 0, fill: 0, rim: 0, sky: 0, environment: 0 };
		STOPS.forEach((_, i) => {
			for (const k of Object.keys(l) as (keyof Light)[]) l[k] += lights[i][k] * weights[i];
		});
		key.intensity = l.key;
		fill.intensity = l.fill;
		rim.intensity = l.rim;
		if (sky) sky.intensity = l.sky;
		scene.environmentIntensity = l.environment;
		rimLevel = l.rim / LOOK.light.prologue.rim;
	};

	/* ---------- The bench: a grid that fades out, under the faked contact shadow ---------- */
	const grid = new Mesh(
		new PlaneGeometry(LOOK.gridReach * 2.4, LOOK.gridReach * 2.4),
		new ShaderMaterial({
			transparent: true,
			depthWrite: false,
			uniforms: { uOpacity: { value: LOOK.grid }, uReach: { value: LOOK.gridReach }, uColor: { value: new Color(LOOK.rimColor) } },
			vertexShader: /* glsl */ `
				varying vec2 vXZ;
				void main() {
					vec4 world = modelMatrix * vec4(position, 1.0);
					vXZ = world.xz;
					gl_Position = projectionMatrix * viewMatrix * world;
				}`,
			fragmentShader: /* glsl */ `
				uniform float uOpacity;
				uniform float uReach;
				uniform vec3 uColor;
				varying vec2 vXZ;
				void main() {
					vec2 cell = vXZ / 0.1;
					vec2 g = abs(fract(cell - 0.5) - 0.5) / fwidth(cell);
					float line = 1.0 - min(min(g.x, g.y), 1.0);
					float fade = 1.0 - smoothstep(0.12, uReach, length(vXZ));
					gl_FragColor = vec4(uColor, (line * 0.85 + 0.06) * fade * uOpacity);
				}`,
		}),
	);
	grid.rotation.x = -Math.PI / 2;
	grid.position.y = rig.floor - 0.001;
	grid.renderOrder = -2;

	/* ---------- Dust, drifting slowly, lit by the rim light ---------- */
	const count = LOOK.dust;
	const positions = new Float32Array(count * 3);
	const seeds = new Float32Array(count);
	for (let i = 0; i < count; i++) {
		positions.set([(Math.random() - 0.5) * 1.6, Math.random() * 0.9, (Math.random() - 0.5) * 1.6], i * 3);
		seeds[i] = Math.random();
	}
	const dustGeometry = new BufferGeometry();
	dustGeometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
	dustGeometry.setAttribute("seed", new BufferAttribute(seeds, 1));
	const dustMaterial = new ShaderMaterial({
		transparent: true,
		depthWrite: false,
		blending: AdditiveBlending,
		uniforms: {
			uTime: { value: 0 },
			uOpacity: { value: 0 },
			uSize: { value: LOOK.dustSize * Math.min(window.devicePixelRatio, 1.5) },
			uFloor: { value: rig.floor },
			uColor: { value: new Color(LOOK.rimColor) },
		},
		vertexShader: /* glsl */ `
			attribute float seed;
			uniform float uTime;
			uniform float uOpacity;
			uniform float uSize;
			uniform float uFloor;
			varying float vAlpha;
			void main() {
				vec3 p = position;
				p.y = uFloor + mod(p.y + uTime * 0.01 * (0.4 + seed), 0.9);
				p.x += sin(uTime * 0.11 + seed * 6.283) * 0.03;
				p.z += cos(uTime * 0.09 + seed * 12.0) * 0.03;
				vec4 view = modelViewMatrix * vec4(p, 1.0);
				gl_Position = projectionMatrix * view;
				gl_PointSize = clamp(uSize * (0.5 + seed) / -view.z, 1.0, uSize * 1.5);
				vAlpha = uOpacity * (0.3 + 0.7 * seed) * smoothstep(0.05, 0.25, -view.z);
			}`,
		fragmentShader: /* glsl */ `
			uniform vec3 uColor;
			varying float vAlpha;
			void main() {
				float d = length(gl_PointCoord - 0.5);
				gl_FragColor = vec4(uColor, vAlpha * smoothstep(0.5, 0.0, d));
			}`,
	});
	const dust = new Points(dustGeometry, dustMaterial);
	dust.frustumCulled = false;

	/* ---------- A glow ring round the camera lens (the stakes) ---------- */
	const ringMaterial = new MeshBasicMaterial({ color: LOOK.rimColor, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
	const ring = new Mesh(new RingGeometry(0.0135, 0.0152, 64), ringMaterial);
	ring.quaternion.copy(rig.lens.quaternion);
	ring.position.copy(rig.lens.position).add(new Vector3(0, 0, 0.003).applyQuaternion(rig.lens.quaternion));

	/* ---------- The 450 mm line: from motor to motor across the frame (front left to rear right) ---------- */
	const hubs = rig.model.children.filter((o) => !(o as Mesh).isMesh && o.children.length > 0).map((o) => o.position);
	const from = hubs.find((h) => h.x > 0 && h.z > 0);
	const to = hubs.find((h) => h.x < 0 && h.z < 0);
	const measureMaterial = new LineBasicMaterial({ color: LOOK.rimColor, transparent: true, opacity: 0, depthWrite: false });
	let measure: LineSegments | undefined;
	let measureLabel: HTMLElement | undefined;
	if (from && to) {
		const y = 0.095; // over the props
		const tick = 0.02;
		const a = new Vector3(from.x, y, from.z);
		const b = new Vector3(to.x, y, to.z);
		measure = new LineSegments(
			new BufferGeometry().setFromPoints([a, b, a.clone().setY(y - tick), a.clone().setY(y + tick), b.clone().setY(y - tick), b.clone().setY(y + tick)]),
			measureMaterial,
		);
		measureLabel = ctx.label(options.measureLabel, a.clone().lerp(b, 0.5).setY(y + 0.02), "opacity-0 transition-opacity duration-300 data-[on]:opacity-100");
	}

	/* ---------- The 4G stop: streaks leaving the 4G stick, flowing away from the drone ---------- */
	// They flow toward the window's right, away from the words on the left (set each frame from the camera).
	const modem = rig.parts["ZTE MF833 4G stick"];
	const video = LOOK.backdrop["video-link"];
	const dataMaterial = new ShaderMaterial({
		transparent: true,
		depthWrite: false,
		blending: AdditiveBlending,
		uniforms: {
			uTime: { value: 0 },
			uOpacity: { value: 0 },
			uOrigin: { value: new Vector3() },
			uOut: { value: new Vector3(1, 0, 0) },
			uSide: { value: new Vector3(0, 0, 1) },
			uColor: { value: new Color(LOOK.rimColor) },
		},
		vertexShader: /* glsl */ `
			attribute float seed;
			attribute float head;
			attribute vec2 lane;
			uniform float uTime;
			uniform float uOpacity;
			uniform vec3 uOrigin;
			uniform vec3 uOut;
			uniform vec3 uSide;
			varying float vAlpha;
			void main() {
				float t = fract(uTime * (0.22 + seed * 0.18) + seed);
				float along = 0.04 + t * 0.95 + head * (0.07 + seed * 0.1);
				vec3 p = uOrigin + uOut * along + uSide * lane.x + vec3(0.0, lane.y, 0.0);
				gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
				vAlpha = uOpacity * sin(t * 3.14159) * mix(0.1, 1.0, head);
			}`,
		fragmentShader: /* glsl */ `
			uniform vec3 uColor;
			varying float vAlpha;
			void main() {
				gl_FragColor = vec4(uColor, vAlpha);
			}`,
	});
	let data: LineSegments | undefined;
	if (modem) {
		dataMaterial.uniforms.uOrigin.value.set((modem[0] + modem[3]) / 2, (modem[1] + modem[4]) / 2, (modem[2] + modem[5]) / 2);
		const n = video.streaks;
		const geometry = new BufferGeometry();
		const lanes = new Float32Array(n * 4);
		const seedsOf = new Float32Array(n * 2);
		const heads = new Float32Array(n * 2);
		for (let i = 0; i < n; i++) {
			const side = (Math.random() - 0.5) * 0.22;
			const up = (Math.random() - 0.5) * 0.12;
			const s = Math.random();
			lanes.set([side, up, side, up], i * 4);
			seedsOf.set([s, s], i * 2);
			heads.set([0, 1], i * 2);
		}
		geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(n * 6), 3));
		geometry.setAttribute("lane", new BufferAttribute(lanes, 2));
		geometry.setAttribute("seed", new BufferAttribute(seedsOf, 1));
		geometry.setAttribute("head", new BufferAttribute(heads, 1));
		data = new LineSegments(geometry, dataMaterial);
		data.frustumCulled = false;
	}

	/* ---------- The reflections: a blurred dusk instead of the stage's studio ---------- */
	let environment: Texture | undefined;
	if (atmosphere)
		new TextureLoader().load(LOOK.environment, (texture) => {
			texture.mapping = EquirectangularReflectionMapping;
			texture.colorSpace = SRGBColorSpace;
			environment = texture;
			scene.environment = texture;
			ctx.wake();
			ctx.invalidate();
		});

	if (atmosphere) {
		ctx.root.add(grid, dust, ring);
		if (measure) ctx.root.add(measure);
		if (data) ctx.root.add(data);
	}

	/* ---------- Framing: on a wide window the drone sits in the right part, clear of the words ---------- */
	const frameShift = () => {
		const w = ctx.canvas.clientWidth;
		const h = ctx.canvas.clientHeight;
		if (!w || !h) return;
		const k = options.capture || w / h < 1.2 ? 1 : LOOK.frame;
		const aspect = (w * k) / h;
		const offset = w - w * k;
		const view = camera.view;
		const right = k === 1 ? !view?.enabled : !!view?.enabled && view.fullWidth === w * k && view.offsetX === -offset && view.width === w;
		if (Math.abs(camera.aspect - aspect) < 1e-6 && right) return;
		camera.aspect = aspect;
		if (k === 1) camera.clearViewOffset();
		else camera.setViewOffset(w * k, h, -offset, 0, w, h);
		camera.updateProjectionMatrix();
	};

	let clock = 0;
	const at = { stakes: STOPS.indexOf("stakes"), overview: STOPS.indexOf("overview"), video: STOPS.indexOf("video-link") };
	const chapter = {
		...base,
		focus(w: ArrayLike<number>, explode: number) {
			base.focus?.(w, explode);
			for (let i = 0; i < weights.length; i++) weights[i] = w[i] ?? 0;
			applyLights();
			dustMaterial.uniforms.uOpacity.value = LOOK.dustBrightness * Math.min(1, rimLevel);
			ringMaterial.opacity = LOOK.lensRing * weights[at.stakes] * (0.8 + 0.2 * Math.sin(clock * 2));
			measureMaterial.opacity = LOOK.measure * weights[at.overview];
			dataMaterial.uniforms.uOpacity.value = video.streaksOpacity * weights[at.video];
			if (weights[at.video] > 0) {
				// Level, toward the window's right; spread a little toward and away from the camera.
				const out = dataMaterial.uniforms.uOut.value.set(1, 0, 0).applyQuaternion(camera.quaternion).setY(0);
				if (out.lengthSq() > 1e-6) out.normalize();
				dataMaterial.uniforms.uSide.value.set(-out.z, 0, out.x);
			}
			measureLabel?.toggleAttribute("data-on", atmosphere && weights[at.overview] > 0.6);
		},
		update(t: number, dt: number) {
			clock += dt;
			dustMaterial.uniforms.uTime.value = clock;
			dataMaterial.uniforms.uTime.value = clock;
			return base.update?.(t, dt);
		},
		// The chapter is dark in both themes: the drone's shadow and finish as on the dark page, and the lights as above.
		applyPalette(p: StageContext["palette"]) {
			base.applyPalette?.({ ...p, dark: true });
			applyLights();
		},
	};

	const driven = drive(ctx, chapter, {
		titles: options.titles,
		position: options.position,
		opening: () => 1,
		onStop: options.onStop,
		onFrame: options.onFrame,
	});
	frameShift();
	applyLights();
	// A resize while the stage rests: frame it again and draw (the stage itself redraws without asking the model).
	const refit = new ResizeObserver(() =>
		requestAnimationFrame(() => {
			frameShift();
			ctx.wake();
			ctx.invalidate();
		}),
	);
	refit.observe(ctx.canvas);
	return {
		...driven,
		update(t, dt) {
			frameShift();
			return driven.update?.(t, dt);
		},
		applyPalette(p) {
			driven.applyPalette?.(p);
			frameShift();
		},
		dispose() {
			refit.disconnect();
			environment?.dispose();
			driven.dispose?.();
		},
	};
}
