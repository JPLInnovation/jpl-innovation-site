/**
 * The drone chapter's 3D (src/components/DroneChapter.astro): one full-window stage for the whole chapter. The camera is
 * the scroll showcase's (src/lib/three/showcase.ts: the damped spring, the holds at each stop, the moves round the
 * model), on the same drone and the same part-by-part stops as before (./drone-showcase.ts).
 *
 * The F450 is in the place it is built for: the made-up dusk country of the studio's simulated flight
 * (src/lib/three/flight-world.ts: the sky, the ridges, the fields and trees, the H pads), the same world and the same
 * route. It sits on its pad for the prologue, the stakes and the reveal; the scroll then flies it off the pad, out over
 * the fields with the ridges ahead, to a hover by the far pad, where the part-by-part close-ups happen. Scrolling back
 * flies it back. It is a simulation of the real CAD, and the page says so on screen: the drone has not flown.
 *
 * How it is drawn: the drone stays at the stage's origin and the world moves round it. Before every frame of the stage,
 * the world is drawn first, from where the stage's camera stands in it (the drone's place and heading on the route), then
 * the stage draws the drone over it (only the depth is cleared between the two). One canvas, one renderer, no extra
 * picture. The stage draws only while the scroll (or a drag) moves something, so a resting page costs nothing.
 *
 * Every intensity and timing is in LOOK, below, to tune in one place.
 */
import { BufferGeometry, LineBasicMaterial, LineSegments, Matrix4, type MeshBasicMaterial, PerspectiveCamera, Quaternion, type HemisphereLight, Vector3 } from "three";
import { createFlightWorld, newPose, SUN } from "../flight-world";
import { drive } from "../showcase";
import { contactShadow, type Model, type StageContext } from "../stage";
import { compileInSlices, uploadInSlices } from "../yield";
import createDroneShowcase from "./drone-showcase";

type Light = { key: number; fill: number; rim: number; sky: number; environment: number; world: number };

/** Every intensity and timing of the chapter. The lights are the stage's own (key, fill, rim, sky) and the world's reflections. */
export const LOOK = {
	/**
	 * The light on each beat; the camera blends between them as it moves. The part-by-part stops all use `anatomy`.
	 * `world`: the place's exposure (1 = as the studio shows it): deep dusk for the prologue's silhouette, then up.
	 */
	light: {
		prologue: { key: 0.12, fill: 0.04, rim: 2.8, sky: 0.04, environment: 0.3, world: 0.6 },
		stakes: { key: 0.9, fill: 0.08, rim: 2.2, sky: 0.06, environment: 0.5, world: 0.8 },
		reveal: { key: 2.1, fill: 0.3, rim: 2.4, sky: 0.18, environment: 1.1, world: 1 },
		flight: { key: 1.9, fill: 0.3, rim: 2.4, sky: 0.2, environment: 1.1, world: 1 },
		anatomy: { key: 2.2, fill: 0.35, rim: 2.2, sky: 0.2, environment: 1.3, world: 1 },
	} satisfies Record<string, Light>,
	/** A warm key, the low sun behind as the rim, the dusk sky's blue as the fill: the place's own light. */
	keyColor: "#fff1e2",
	rimColor: SUN,
	fillColor: "#c9d6ff",
	/** The 450 mm line on the anatomy's first stop, in the brand's yellow (--mark). */
	measureColor: "#f5d042",
	measure: 0.85,
	/** The flight, in stops: off the pad after the reveal (2), at a hover by the far pad on the first part stop (4). */
	fly: { from: 2.1, to: 4 },
	/** The props spin up as the camera comes round for the reveal (in stops). */
	spinUp: [1.45, 2.05],
	/** The world's camera: its nearest and furthest distances (m). */
	near: 0.06,
	far: 4200,
	/**
	 * Simulated telemetry for the HUD: the simulation's own cruise speed in m/s (a modest figure for an F450, not a measured
	 * one: the drone has not flown), and the 4G bars (4, one fewer at full speed).
	 */
	cruise: 12,
	/** CSS, over the canvas (custom properties on the stage): the vignette and the grain. */
	vignette: 0.55,
	grain: 0.05,
	/** The dark scrim behind the words on the left, on wide windows (their contrast over the world). */
	scrim: 0.72,
	/** On wide windows, the share of the width the drone is framed in (on the right; the words are on the left). */
	frame: 0.6,
};

/** The chapter's stops, in order: beats 1 to 4, then beat 5's six part-by-part stops. */
export const STOPS = ["prologue", "stakes", "reveal", "flight", "overview", "flight-controller", "motors", "power", "camera", "video-link"];

/** What the HUD shows during the flight: simulated, from the 3D. */
export interface Telemetry {
	/** Metres above the first pad. */
	altitude: number;
	/** Degrees, 0 to 359 (north: toward the ridges). */
	heading: number;
	/** Metres a second. */
	speed: number;
	/** 4G bars, 0 to 4. */
	signal: number;
}

export interface ChapterOptions {
	/** Where the page is, in stops (0 = the prologue). */
	position(): number;
	/** The stop being read changed. */
	onStop(index: number): void;
	/** Every frame: where the camera is, in stops. */
	onFrame(at: number): void;
	/** Every frame: the simulated telemetry. */
	onTelemetry?(t: Telemetry): void;
	/** The small label on each stop (empty: none). */
	titles: string[];
	/** The measurement line's label: "450 mm". */
	measureLabel: string;
	/** For the stills: the drone alone, lit as on beat 5, nothing else drawn. */
	capture?: boolean;
}

const lightOf = (id: string): Light => (LOOK.light as Record<string, Light>)[id] ?? LOOK.light.anatomy;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => x * x * (3 - 2 * x);
const UP = new Vector3(0, 1, 0);

export default async function createDroneChapter(ctx: StageContext, options: ChapterOptions): Promise<Model> {
	const { camera, scene, renderer } = ctx;
	const atmosphere = !options.capture;
	let spin = 0;
	// The drone and its world load together (the world's files are small; the CAD is most of the wait).
	const [base, world] = await Promise.all([
		createDroneShowcase(ctx, STOPS, { spin: atmosphere ? () => spin : undefined, led: false, rings: false }),
		atmosphere ? createFlightWorld(ctx.pmrem) : undefined,
	]);
	const { rig } = base;

	/* ---------- Lights: the place's own, levelled per beat ---------- */
	const { key, fill, rim } = ctx.lights;
	key.color.set(LOOK.keyColor);
	rim.color.set(LOOK.rimColor);
	fill.color.set(LOOK.fillColor);
	let sky: HemisphereLight | undefined;
	scene.traverse((o) => {
		if ((o as HemisphereLight).isHemisphereLight) sky = o as HemisphereLight;
	});
	const lights = STOPS.map((id) => (options.capture ? LOOK.light.anatomy : lightOf(id)));
	const weights = new Float32Array(STOPS.length);
	weights[0] = 1;
	let worldLevel = 1;
	const applyLights = () => {
		const l = { key: 0, fill: 0, rim: 0, sky: 0, environment: 0, world: 0 };
		STOPS.forEach((_, i) => {
			for (const k of Object.keys(l) as (keyof Light)[]) l[k] += lights[i][k] * weights[i];
		});
		key.intensity = l.key;
		fill.intensity = l.fill;
		rim.intensity = l.rim;
		if (sky) sky.intensity = l.sky;
		scene.environmentIntensity = l.environment;
		worldLevel = l.world;
	};

	/* ---------- The 450 mm line: from motor to motor across the frame (front left to rear right) ---------- */
	const hubs = rig.model.children.filter((o) => !(o as { isMesh?: boolean }).isMesh && o.children.length > 0).map((o) => o.position);
	const from = hubs.find((h) => h.x > 0 && h.z > 0);
	const to = hubs.find((h) => h.x < 0 && h.z < 0);
	const measureMaterial = new LineBasicMaterial({ color: LOOK.measureColor, transparent: true, opacity: 0, depthWrite: false });
	let measureLabel: HTMLElement | undefined;
	if (from && to && atmosphere) {
		const y = 0.095; // over the props
		const tick = 0.02;
		const a = new Vector3(from.x, y, from.z);
		const b = new Vector3(to.x, y, to.z);
		ctx.root.add(
			new LineSegments(
				new BufferGeometry().setFromPoints([a, b, a.clone().setY(y - tick), a.clone().setY(y + tick), b.clone().setY(y - tick), b.clone().setY(y + tick)]),
				measureMaterial,
			),
		);
		measureLabel = ctx.label(options.measureLabel, a.clone().lerp(b, 0.5).setY(y + 0.02), "opacity-0 transition-opacity duration-300 data-[on]:opacity-100");
	}

	/* ---------- The world, drawn first on every frame, from where the stage's camera stands in it ---------- */
	const pose = newPose();
	const worldCamera = new PerspectiveCamera();
	const place = new Matrix4();
	const heading = new Quaternion();
	const ONE = new Vector3(1, 1, 1);
	// The drone's shadow on the ground: the stage's own blob, but kept level and left on the ground as the drone climbs.
	const shadow = contactShadow(0.42, 0.55, 0.25);
	const shadowAt = rig.floor - 0.002;
	shadow.position.y = shadowAt;
	if (world) {
		ctx.root.children.forEach((o) => o.userData.contactShadow && (o.visible = false)); // (the showcase's, which would tilt with the drone)
		scene.add(shadow);
		scene.environment = world.environment;
		renderer.autoClearColor = false; // the stage clears the depth only: the world is already in the picture
		scene.onBeforeRender = () => {
			heading.setFromAxisAngle(UP, pose.yaw);
			place.compose(pose.point, heading, ONE).multiply(camera.matrixWorld);
			worldCamera.copy(camera, false);
			worldCamera.near = LOOK.near;
			worldCamera.far = LOOK.far;
			worldCamera.updateProjectionMatrix();
			place.decompose(worldCamera.position, worldCamera.quaternion, worldCamera.scale);
			worldCamera.updateMatrixWorld(true);
			const exposure = renderer.toneMappingExposure;
			renderer.toneMappingExposure = exposure * worldLevel;
			renderer.clear();
			renderer.render(world.scene, worldCamera);
			renderer.toneMappingExposure = exposure;
		};
		// Its shaders and textures now, so the first frame of the flight never stutters.
		worldCamera.copy(camera, false);
		await compileInSlices(renderer, world.scene, worldCamera);
		await uploadInSlices(renderer, world.scene);
	}

	/** The flight at `at` (in stops): the drone's place on the route, its tilt, its props, its shadow; the telemetry. */
	const fly = (at: number) => {
		if (!world) return;
		spin = smooth(clamp01((at - LOOK.spinUp[0]) / (LOOK.spinUp[1] - LOOK.spinUp[0])));
		world.pose(clamp01((at - LOOK.fly.from) / (LOOK.fly.to - LOOK.fly.from)), pose);
		// Heading lives in the world's camera (above); the tilt is the drone's own.
		ctx.root.rotation.set(pose.pitch, 0, pose.bank, "YXZ");
		const altitude = pose.point.y;
		shadow.position.y = shadowAt - altitude;
		shadow.visible = altitude < 1.2;
		(shadow.material as MeshBasicMaterial).opacity = 0.55 * (1 - altitude / 1.2);
		options.onTelemetry?.({
			altitude,
			heading: ((((Math.PI - pose.yaw) * 180) / Math.PI) % 360 + 360) % 360,
			speed: pose.speed * LOOK.cruise,
			signal: 4 - Math.round(pose.speed),
		});
	};

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

	const overview = STOPS.indexOf("overview");
	const chapter = {
		...base,
		focus(w: ArrayLike<number>, explode: number) {
			base.focus?.(w, explode);
			for (let i = 0; i < weights.length; i++) weights[i] = w[i] ?? 0;
			applyLights();
			measureMaterial.opacity = LOOK.measure * weights[overview];
			measureLabel?.toggleAttribute("data-on", weights[overview] > 0.6);
		},
		// Nothing moves on its own: the stage stops drawing as soon as the camera has settled (src/lib/three/showcase.ts).
		motion() {},
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
		onFrame(at) {
			fly(at);
			options.onFrame(at);
		},
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
			scene.onBeforeRender = () => {};
			if (world) {
				world.environment.dispose();
				world.scene.traverse((o) => {
					const mesh = o as unknown as { geometry?: { dispose(): void }; material?: { dispose(): void; map?: { dispose(): void } | null } };
					mesh.geometry?.dispose();
					mesh.material?.map?.dispose();
					mesh.material?.dispose();
				});
			}
			driven.dispose?.();
		},
	};
}
