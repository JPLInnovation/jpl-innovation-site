/**
 * The FRC chapter's 3D (src/components/FrcChapter.astro): one full-window stage for the KitBot, beats 1 to 4, built
 * like the drone chapter (./drone-chapter.ts). The camera is the scroll showcase's (src/lib/three/showcase.ts), on the
 * KitBot and its part-by-part stops (./frc-robot-showcase.ts), with three stops in front of them: the prologue (the
 * robot low and dark, lit from behind), the stakes (close on the launcher, FUEL on its way out) and the reveal (the
 * lights come up).
 *
 * The atmosphere is cheap, as on the drone: the stage's key and a cyan rim light re-levelled per beat, a grid on the
 * floor that fades out, a few hundred specks of dust, reflections of a blurred dusk. No real-time shadows, no
 * full-screen passes. Behind it, a backdrop per beat (CSS, the team's own event photos blurred: public/chapter/frc/).
 *
 * Every intensity is in LOOK, below, to tune in one place.
 */
import {
	AdditiveBlending,
	BufferAttribute,
	BufferGeometry,
	Color,
	EquirectangularReflectionMapping,
	Float32BufferAttribute,
	HemisphereLight,
	Mesh,
	PlaneGeometry,
	Points,
	SRGBColorSpace,
	ShaderMaterial,
	type Texture,
	TextureLoader,
} from "three";
import { drive } from "../showcase";
import type { Model, StageContext } from "../stage";
import createRobotShowcase from "./frc-robot-showcase";

type Light = { key: number; fill: number; rim: number; sky: number; environment: number };

/** Every intensity of the chapter's look. */
export const LOOK = {
	/** The light on each beat; the camera blends between them as it moves. Beat 4's stops all use `anatomy`. */
	light: {
		prologue: { key: 0.06, fill: 0, rim: 3.4, sky: 0.02, environment: 0.05 },
		stakes: { key: 0.9, fill: 0.08, rim: 2.6, sky: 0.05, environment: 0.3 },
		reveal: { key: 1.6, fill: 0.3, rim: 1.0, sky: 0.18, environment: 0.45 },
		anatomy: { key: 1.6, fill: 0.3, rim: 1.0, sky: 0.18, environment: 0.45 },
	} satisfies Record<string, Light>,
	keyColor: "#ffffff",
	/** The site's cyan accent (--accent). */
	rimColor: "#dbeafe",
	/** The floor grid: line brightness, and how far out (metres) it has faded to nothing. */
	grid: 0.22,
	gridReach: 1.9,
	/** Dust: how many specks, their size and their brightness when the rim light is fullest. */
	dust: 240,
	dustSize: 8,
	dustBrightness: 0.45,
	/** CSS, behind and over the canvas: the glow behind the robot, the vignette and the grain. */
	glow: 0.22,
	vignette: 0.62,
	grain: 0.06,
	/** The dark scrim behind the words on the left, on wide windows. */
	scrim: 0.7,
	/** On wide windows, the share of the width the robot is framed in (on the right; the words are on the left). */
	frame: 0.6,
	/** One backdrop per beat (the team's photos, blurred: public/chapter/frc/), opacity 0 to 1. */
	backdrop: { arena: 0.75, field: 0.7, pits: 0.6 },
	/** The model's reflections: a blurred dusk (Poly Haven, Kiara 9 Dusk, CC0), shared with the drone chapter. */
	environment: "/chapter/drone/env.webp",
};

/** The chapter's stops, in order: beats 1 to 3, then beat 4's part-by-part stops (src/text/showcase/robot.ts). */
export const STOPS = ["prologue", "stakes", "reveal", "overview", "intake", "hopper", "indexer", "shooter", "hopper-close", "krakens", "vision", "odometry", "drivetrain", "electronics"];

export interface ChapterOptions {
	/** Where the page is, in stops (0 = the prologue). */
	position(): number;
	/** The stop being read changed. */
	onStop(index: number): void;
	/** Every frame: where the camera is, in stops. */
	onFrame(at: number): void;
	/** The small label on each stop (empty: none). */
	titles: string[];
	/** For the stills: the robot alone, lit as on beat 4, nothing else drawn. */
	capture?: boolean;
}

const lightOf = (id: string): Light => (LOOK.light as Record<string, Light>)[id] ?? LOOK.light.anatomy;

export default async function createFrcChapter(ctx: StageContext, options: ChapterOptions): Promise<Model> {
	const { camera, scene } = ctx;
	const base = await createRobotShowcase(ctx, STOPS);
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

	/* ---------- The floor: a grid that fades out round the robot ---------- */
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
					vec2 cell = vXZ / 0.15;
					vec2 g = abs(fract(cell - 0.5) - 0.5) / fwidth(cell);
					float line = 1.0 - min(min(g.x, g.y), 1.0);
					float fade = 1.0 - smoothstep(0.2, uReach, length(vXZ));
					gl_FragColor = vec4(uColor, (line * 0.85 + 0.05) * fade * uOpacity);
				}`,
		}),
	);
	grid.rotation.x = -Math.PI / 2;
	grid.position.y = base.floor - 0.001;
	grid.renderOrder = -2;

	/* ---------- Dust, drifting slowly, lit by the rim light ---------- */
	const count = LOOK.dust;
	const positions = new Float32Array(count * 3);
	const seeds = new Float32Array(count);
	for (let i = 0; i < count; i++) {
		positions.set([(Math.random() - 0.5) * 2.4, Math.random() * 1.4, (Math.random() - 0.5) * 2.4], i * 3);
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
			uFloor: { value: base.floor },
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
				p.y = uFloor + mod(p.y + uTime * 0.012 * (0.4 + seed), 1.4);
				p.x += sin(uTime * 0.11 + seed * 6.283) * 0.04;
				p.z += cos(uTime * 0.09 + seed * 12.0) * 0.04;
				vec4 view = modelViewMatrix * vec4(p, 1.0);
				gl_Position = projectionMatrix * view;
				gl_PointSize = clamp(uSize * (0.5 + seed) / -view.z, 1.0, uSize * 1.5);
				vAlpha = uOpacity * (0.3 + 0.7 * seed) * smoothstep(0.05, 0.3, -view.z);
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
	if (atmosphere) ctx.root.add(grid, dust);

	/* ---------- Framing: on a wide window the robot sits in the right part, clear of the words ---------- */
	const frameShift = (w = ctx.canvas.clientWidth, h = ctx.canvas.clientHeight) => {
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
	const chapter = {
		...base,
		// The opening beats and the overview keep the whole robot in colour; each part stop fades the rest back.
		whole: [0, 1, 2, 3],
		focus(w: ArrayLike<number>, explode: number) {
			base.focus?.(w, explode);
			for (let i = 0; i < weights.length; i++) weights[i] = w[i] ?? 0;
			applyLights();
			dustMaterial.uniforms.uOpacity.value = LOOK.dustBrightness * Math.min(1, rimLevel);
		},
		update(t: number, dt: number) {
			clock += dt;
			dustMaterial.uniforms.uTime.value = clock;
			return base.update?.(t, dt);
		},
		// The chapter is dark in both themes, as the drone's.
		applyPalette(p: StageContext["palette"]) {
			base.applyPalette?.({ ...p, dark: true });
			applyLights();
		},
	};

	const driven = drive(ctx, chapter, {
		titles: options.titles,
		directScroll: false,
		position: options.position,
		opening: () => 1,
		onStop: options.onStop,
		onFrame: options.onFrame,
	});
	frameShift();
	applyLights();
	return {
		...driven,
		resize(w, h) {
			frameShift(w, h);
			driven.update?.(0, 0);
		},
		update(t, dt) {
			return driven.update?.(t, dt);
		},
		applyPalette(p) {
			driven.applyPalette?.(p);
			frameShift();
		},
		dispose() {
			environment?.dispose();
			driven.dispose?.();
		},
	};
}
