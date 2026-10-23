/**
 * Shared Three.js stage for the site's 3D models (src/lib/three/models/*).
 *
 * One stage per <canvas>. It owns the renderer, camera, lights, resizing, theme colours, quality and cleanup, so a
 * model only builds meshes and (optionally) animates them. Loaded lazily by src/components/model-viewer.tsx and
 * src/components/showcase.tsx (through src/lib/three/showcase.ts).
 *
 * Look: physically based. ACES filmic tone mapping (it keeps the CAD's reds and yellows saturated, where AgX
 * washed them out), a studio environment (RoomEnvironment, generated, nothing downloaded),
 * and a key, fill and rim light that travel with the camera like a photographer's lights, so every angle is lit.
 *
 * Quality tiers (see docs/SHOWCASE.md), picked from the device and then from the frame time it actually achieves:
 *   high    4x MSAA, ambient occlusion (GTAO), soft contact shadows, up to 2x device pixels, the full finishes
 *   medium  the canvas's own MSAA, soft contact shadows, up to 1.5x device pixels, the full finishes
 *   low     the plain renderer: round blob shadows, 1.25x device pixels at most, standard materials
 * Frames are timed while something moves. Slower than 19 ms on average, the stage first lowers the resolution a little (in
 * proportion to how slow it is, down to 0.7 of the tier's pixel ratio; it creeps back after a steady stretch), and only
 * if that is not enough drops a tier (never climbs back).
 * ?quality=high|medium|low pins a tier (for testing). window.__stage lists every stage's tier and frame time.
 *
 * Behaviour:
 * - Renders only while the canvas is on screen and the tab is visible, and only while something changes: a model can
 *   say it has come to rest (update() returns false) and the stage sleeps until ctx.wake().
 * - prefers-reduced-motion: no animation loop; one still frame, redrawn only when something changes.
 * - Drag to orbit on mouse/trackpad (unless the view sets `orbit: false`). On touch screens there are no controls,
 *   so the page scrolls normally.
 * - Re-colours and re-lights when the site switches between light and dark.
 */
import {
	ACESFilmicToneMapping,
	Box3,
	type BufferGeometry,
	CanvasTexture,
	Color,
	DirectionalLight,
	Group,
	HemisphereLight,
	type Material,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	type MeshStandardMaterialParameters,
	type Object3D,
	PerspectiveCamera,
	PlaneGeometry,
	PMREMGenerator,
	Scene,
	SRGBColorSpace,
	type Texture,
	Vector3,
	WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { qualityPref, reducedMotion as prefersReducedMotion } from "../prefs";
import { setDetail, simplify } from "./finish";

/** Site colours (from the CSS custom properties in global.css), as Three.js colours. */
export interface Palette {
	dark: boolean;
	background: Color;
	foreground: Color;
	card: Color;
	muted: Color;
	border: Color;
	accent: Color;
	red: Color;
	blue: Color;
	/** Categorical data colours (--chart-1..4), validated for contrast in both themes. */
	chart: [Color, Color, Color, Color];
}

export function readPalette(): Palette {
	const style = getComputedStyle(document.documentElement);
	const color = (name: string, fallback: string) => new Color(style.getPropertyValue(name).trim() || fallback);
	return {
		dark: document.documentElement.classList.contains("dark"),
		background: color("--background", "#eef1f4"),
		foreground: color("--foreground", "#0e1b2c"),
		card: color("--card", "#ffffff"),
		muted: color("--muted-foreground", "#4f5b6c"),
		border: color("--border", "#cdd4dc"),
		accent: color("--accent", "#ffc20e"),
		red: color("--alliance-red", "#c8283a"),
		blue: color("--alliance-blue", "#1f5fd1"),
		chart: [
			color("--chart-1", "#1f5fd1"),
			color("--chart-2", "#b87a00"),
			color("--chart-3", "#7a4bd0"),
			color("--chart-4", "#c8283a"),
		],
	};
}

export type Tier = "high" | "medium" | "low";

export interface StageView {
	camera: [number, number, number];
	target?: [number, number, number];
	fov?: number;
	/** Radians per second the model turns on its own (0 = still). */
	spin?: number;
	/** Keep the camera above the floor: polar angle limits in radians. */
	minPolar?: number;
	maxPolar?: number;
	/** Pull the camera back on narrow screens so this much width (in scene units) always fits. */
	fitWidth?: number;
	/** false: no drag-to-orbit; the model moves the camera itself (the scroll showcase). */
	orbit?: boolean;
	/** Highest device pixel ratio to render at, on any tier (the tiers have their own caps). */
	pixelRatio?: number;
	/**
	 * Called once when the stage gives up and the page should show its plain version instead: the frame loop threw
	 * ("error"), the GPU is too slow even on the lowest tier ("slow"; never when the quality was pinned by ?quality= or
	 * Settings), or the WebGL context was lost and did not come back ("context"). The stage has already stopped drawing;
	 * the caller disposes it.
	 */
	onFallback?(reason: "error" | "slow" | "context"): void;
}

export interface StageContext {
	scene: Scene;
	/** Add the model here; the stage turns this group for the idle spin. */
	root: Group;
	camera: PerspectiveCamera;
	canvas: HTMLCanvasElement;
	container: HTMLElement;
	palette: Palette;
	reducedMotion: boolean;
	/** The quality tier this stage started on (it may drop later). */
	tier: Tier;
	/** A floating HTML label that follows a point on the model. */
	label(text: string, at: Object3D | Vector3, className?: string): HTMLElement;
	/** Ask for a redraw (only needed for still frames under reduced motion, or while the stage sleeps). */
	invalidate(): void;
	/** Start the animation loop again after the model said it had come to rest. */
	wake(): void;
	/** The model changed shape (the drone's exploded view): draw the contact shadows again. */
	refreshShadows(): void;
	/** Draw right now, so the canvas can be read back in the same task (canvas.toDataURL). */
	render(): void;
	/**
	 * Build the shaders of everything in the scene now, off screen parts included, so the first time the camera reaches
	 * a model that loaded late there is no pause while its shaders compile. Call after adding it.
	 */
	precompile(): void;
	/** The light rig (it rides on the camera; positions are in the camera's space). For a light sweep. */
	lights: { key: DirectionalLight; fill: DirectionalLight; rim: DirectionalLight };
	/** 0..1: how much ambient occlusion to blend in (high tier). Lowered while the model is pulled apart. */
	occlusion: number;
}

export interface Model {
	/**
	 * Called every frame with elapsed and delta seconds. Not called under reduced motion (except once with t = 0).
	 * Return false when nothing is moving any more: the stage stops drawing until ctx.wake() (or a drag, resize or
	 * theme change).
	 */
	update?(t: number, dt: number): void | boolean;
	/** Re-colour after a light/dark switch. */
	applyPalette?(p: Palette): void;
	/**
	 * True while nothing moves but the scene's own slow life (dust, a breath of camera sway): the stage then draws every
	 * other frame (about 30 a second), which halves the GPU's work while someone is reading and costs nothing to look at.
	 */
	idle?: boolean;
	dispose?(): void;
}

export type ModelFactory = (ctx: StageContext) => Model | Promise<Model>;

/* ------------------------------------------------------------------ */
/* Helpers for models                                                  */
/* ------------------------------------------------------------------ */

export const standard = (color: number | Color, params: MeshStandardMaterialParameters = {}) =>
	new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...params });

/**
 * Soft shadow under a model, so it sits on the page instead of floating. On the low tier it's a round blob; on the
 * others the stage replaces the blob with the model's real footprint, blurred (quality.ts). `height`: how far above
 * the floor a part still casts (default: most of the radius).
 */
export function contactShadow(radius: number, opacity = 0.35, height = radius * 0.8) {
	const size = 128;
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext("2d")!;
	const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
	gradient.addColorStop(0, "rgba(0,0,0,1)");
	gradient.addColorStop(1, "rgba(0,0,0,0)");
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, size, size);
	const mesh = new Mesh(
		new PlaneGeometry(radius * 2, radius * 2),
		new MeshBasicMaterial({ map: new CanvasTexture(canvas), transparent: true, opacity, depthWrite: false, toneMapped: false }),
	);
	mesh.rotation.x = -Math.PI / 2;
	mesh.renderOrder = -1;
	mesh.userData.contactShadow = { radius, height };
	return mesh;
}

/** Text drawn onto a transparent canvas texture (bumper numbers, screen labels, etc.). */
export function textTexture(text: string, opts: { width?: number; height?: number; font?: string; color?: string; background?: string } = {}) {
	const { width = 512, height = 128, font = '800 84px "Archivo Variable", "Arial Black", sans-serif', color = "#ffffff", background } = opts;
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d")!;
	if (background) {
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, width, height);
	}
	ctx.font = font;
	ctx.fillStyle = color;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(text, width / 2, height / 2 + 4);
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.anisotropy = 4;
	return texture;
}

/* ------------------------------------------------------------------ */
/* Quality                                                             */
/* ------------------------------------------------------------------ */

const TIERS: Tier[] = ["high", "medium", "low"];
const PIXEL_RATIO: Record<Tier, number> = { high: 2, medium: 1.5, low: 1.25 };
// At most this many canvas pixels per tier. A big display (a 4K screen or projector at 1x) would otherwise be drawn at its
// full size, which an integrated GPU cannot keep up with; drawing a little below native size and letting the browser
// scale it up keeps the motion smooth. The HTML on top stays sharp.
const MAX_PIXELS: Record<Tier, number> = { high: 4.6e6, medium: 3.2e6, low: 2.2e6 };
const MIN_RATIO = 0.6;
const SLOW = 19; // ms: frames slower than this, on average, first lose some resolution, then a tier
const TARGET = 15; // ms: what the resolution is steered to when frames run slow (a little under one 60 Hz frame)
const GOOD = 17.6; // ms: an average at or under this is a steady 60 a second (a 60 Hz screen cannot show less)
const SCALE_MIN = 0.7; // dynamic resolution: the least share of a tier's pixel ratio it steps down to
const SCALE_UP = 1.12; // and the step back up, once frames have been steady for a while
const WARMUP = 12; // frames skipped before timing (shaders compiling, textures uploading)
const SAMPLE = 50; // frames timed for the first verdict (about a second at 50 to 60 fps)
const VERY_SLOW = 66; // ms: a median frame slower than this (under 15 a second) is a slideshow: straight to the lowest tier, and if it is still that slow there, the page falls back to its plain version
const RECENT = 16; // frames the very slow verdict is judged on (the median, so a few hitches while textures arrive do not count)

/** What the device suggests, before any frame is timed. */
function startingTier(renderer: WebGLRenderer): Tier {
	const forced = new URLSearchParams(location.search).get("quality");
	if (forced === "high" || forced === "medium" || forced === "low") return forced;
	const chosen = qualityPref(); // the Settings panel
	if (chosen) return chosen;
	const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
	if (nav.connection?.saveData) return "low";
	if ((nav.deviceMemory ?? 8) <= 2 || (navigator.hardwareConcurrency ?? 8) <= 2) return "low";
	const gl = renderer.getContext();
	const info = gl.getExtension("WEBGL_debug_renderer_info");
	const gpu = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
	if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) return "low";
	// Integrated Intel graphics (Iris, UHD): the plan's target laptop. Ambient occlusion at full resolution would run
	// slowly for the first second and then be dropped on screen, so start on medium. (Intel Arc is a discrete GPU.)
	if (/intel/i.test(gpu) && !/arc/i.test(gpu)) return "medium";
	const coarse = matchMedia("(pointer: coarse)").matches;
	if (coarse && Math.max(screen.width, screen.height) < 1000) return "low"; // phones
	if (coarse) return "medium"; // tablets
	return "high";
}

interface StageStats {
	tier: Tier;
	started: Tier;
	/** Average frame time of the last timed window, ms. */
	frameMs: number;
	drops: Array<{ from: Tier; to: Tier; frameMs: number }>;
	pixelRatio: number;
	/** Dynamic resolution: the share of the tier's pixel ratio in use (1 until frames run slow). */
	scale: number;
	/** What the last frame cost the GPU's driver: draw calls and triangles (a frame with ambient occlusion counts its extra passes too), and lights in the scene. */
	calls: number;
	triangles: number;
	/** Frames actually drawn so far (a still room draws every other animation frame). */
	renders: number;
	readonly lights: number;
}
const registry: StageStats[] = [];
(window as unknown as { __stage?: StageStats[] }).__stage = registry;

/** Light rig per theme: on a dark page the rim does more of the work, on a light one the key and fill. */
const LIGHTING = {
	light: { exposure: 0.95, environment: 0.9, key: 2.4, fill: 0.7, rim: 1.6, sky: 0.35 },
	dark: { exposure: 1.0, environment: 0.75, key: 2.2, fill: 0.45, rim: 2.6, sky: 0.25 },
};

/* ------------------------------------------------------------------ */
/* Stage                                                               */
/* ------------------------------------------------------------------ */

/** Throws if WebGL is unavailable, so the caller can keep showing its fallback. */
export async function mountStage(
	container: HTMLElement,
	canvas: HTMLCanvasElement,
	factory: ModelFactory,
	view: StageView,
): Promise<() => void> {
	const reducedMotion = prefersReducedMotion();
	const finePointer = matchMedia("(pointer: fine)").matches;

	const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
	renderer.setClearColor(0x000000, 0);
	renderer.toneMapping = ACESFilmicToneMapping;
	renderer.outputColorSpace = SRGBColorSpace;
	renderer.info.autoReset = false; // reset once per frame (render below), so the stats count a frame's extra passes too

	let tier = startingTier(renderer);
	const pinned = new URLSearchParams(location.search).has("quality") || qualityPref() !== null;
	const stats: StageStats = { tier, started: tier, frameMs: 0, drops: [], pixelRatio: 1, scale: 1, calls: 0, triangles: 0, renders: 0,
		// Counted when asked for (window.__stage in the console), not every frame.
		get lights() {
			let n = 0;
			scene.traverse((o) => ((o as { isLight?: boolean }).isLight ? n++ : 0));
			return n;
		},
	};
	registry.push(stats);
	setDetail(tier !== "low");

	const scene = new Scene();
	const pmrem = new PMREMGenerator(renderer);
	const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
	scene.environment = environment;
	pmrem.dispose();

	const camera = new PerspectiveCamera(view.fov ?? 35, 1, 0.01, 40);
	camera.position.set(...view.camera);
	const target = new Vector3(...(view.target ?? [0, 0, 0]));
	camera.lookAt(target);
	const baseDistance = camera.position.distanceTo(target);
	scene.add(camera);

	// Key, fill and rim, carried by the camera (positions in the camera's space: x right, y up, -z ahead). They all aim
	// at the model, wherever the camera goes.
	const aim = new Group();
	aim.position.copy(target);
	scene.add(aim);
	const sky = new HemisphereLight(0xffffff, 0x3a4658, 0.35);
	scene.add(sky);
	const light = (color: number, x: number, y: number, z: number) => {
		const l = new DirectionalLight(color, 1);
		l.position.set(x, y, z);
		l.target = aim;
		camera.add(l);
		return l;
	};
	const key = light(0xfff4e8, -3, 4, 1.5); // warm, high, camera left
	const fill = light(0xe4efff, 4, 0.5, 2); // cool, low, camera right
	const rim = light(0xffffff, 1.5, 3, -6); // behind the model, outlining it against the page

	const root = new Group();
	scene.add(root);

	// Labels live in an overlay above the canvas; positions are projected each frame.
	const overlay = document.createElement("div");
	overlay.className = "pointer-events-none absolute inset-0 overflow-hidden";
	overlay.setAttribute("aria-hidden", "true");
	container.appendChild(overlay);
	const labels: Array<{ el: HTMLElement; at: Object3D | Vector3 }> = [];
	const scratch = new Vector3();

	let palette = readPalette();
	// Models may ask for a redraw (a texture arrived) or build shaders while the stage is still setting itself up (it
	// awaits the quality code and the shader compile); those asks are answered by the first render at the end of setup.
	let ready = false;
	let needsRender = true;
	let running = false;
	let sleeping = false;
	let onScreen = false;
	let shadowsDirty = false;
	const invalidate = () => {
		needsRender = true;
		if (!ready) return;
		if (reducedMotion || !running || sleeping) requestStill();
	};
	const wake = () => {
		if (!sleeping) return;
		sleeping = false;
		sync();
	};

	const ctx: StageContext = {
		scene,
		root,
		camera,
		canvas,
		container,
		palette,
		reducedMotion,
		tier,
		invalidate,
		wake,
		refreshShadows: () => {
			shadowsDirty = true;
			invalidate();
		},
		render: () => render(),
		precompile() {
			renderer.compileAsync(scene, camera).then(invalidate, () => undefined);
		},
		lights: { key, fill, rim },
		occlusion: 1,
		label(text, at, className = "") {
			const el = document.createElement("span");
			el.textContent = text;
			el.className =
				"stage-label absolute left-0 top-0 whitespace-nowrap rounded-full border bg-card/90 px-2.5 py-1 text-[12px] font-semibold text-foreground shadow-sm max-sm:px-1.5 max-sm:py-0.5 max-sm:text-[9.5px] " +
				className;
			overlay.appendChild(el);
			labels.push({ el, at });
			return el;
		},
	};

	const model = await factory(ctx);
	// Interface colours (screens, LEDs, the 4G rings) are shown as they are, not tone mapped like lit surfaces.
	scene.traverse((o) => {
		const mesh = o as Mesh;
		if (mesh.isMesh) for (const m of ([] as Material[]).concat(mesh.material)) if (m instanceof MeshBasicMaterial) m.toneMapped = false;
	});

	// The model's size, for how far the ambient occlusion reaches.
	const bounds = new Box3().setFromObject(root);
	const modelSize = bounds.isEmpty() ? 1 : bounds.getSize(new Vector3()).length();

	/* ---------- Tiers ---------- */
	type Quality = typeof import("./quality");
	let quality: Quality | undefined;
	let shadows: ReturnType<Quality["createContactShadows"]> | undefined;
	let pipeline: ReturnType<Quality["createPipeline"]> | undefined;
	if (tier !== "low") {
		try {
			quality = await import("./quality");
			shadows = quality.createContactShadows(renderer, scene);
			shadows.update();
			if (tier === "high") pipeline = quality.createPipeline(renderer, scene, camera, modelSize * 0.05);
		} catch (error) {
			console.warn("3D: higher quality unavailable, using the plain renderer.", error);
			tier = stats.tier = "low";
		}
	}
	// Build every shader before the first frame (in parallel where the browser can), so nothing compiles mid-move.
	try {
		await renderer.compileAsync(scene, camera);
	} catch {
		/* the first frame compiles them instead */
	}
	let scale = 1; // dynamic resolution (see time())
	const pixelRatio = () => {
		const ratio = Math.min(window.devicePixelRatio, PIXEL_RATIO[tier], view.pixelRatio ?? Infinity);
		const area = Math.max(1, container.clientWidth * container.clientHeight);
		return Math.max(MIN_RATIO, Math.min(ratio, Math.sqrt(MAX_PIXELS[tier] / area)) * scale);
	};
	const dropTier = (frameMs: number) => {
		const next = TIERS[TIERS.indexOf(tier) + 1];
		if (!next || pinned) return;
		stats.drops.push({ from: tier, to: next, frameMs });
		tier = stats.tier = next;
		if (tier !== "high") {
			pipeline?.dispose();
			pipeline = undefined;
		}
		if (tier === "low") {
			// Back to the blob shadows and cheaper shading.
			shadows?.dispose();
			shadows = undefined;
			const materials = new Set<Material>();
			scene.traverse((o) => {
				const mesh = o as Mesh;
				if (!mesh.isMesh) return;
				for (const m of ([] as Material[]).concat(mesh.material)) materials.add(m);
				if (mesh.userData.contactShadow) {
					const material = mesh.material as MeshBasicMaterial;
					material.map = mesh.userData.blob;
					material.needsUpdate = true;
					const uv = mesh.geometry.getAttribute("uv");
					for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
					uv.needsUpdate = true;
				}
			});
			simplify(materials);
		}
		resize();
	};
	scene.traverse((o) => {
		if (o.userData.contactShadow) o.userData.blob = ((o as Mesh).material as MeshBasicMaterial).map;
	});

	/* ---------- Controls ---------- */
	let controls: OrbitControls | undefined;
	let idleAt = 0; // spin pauses while dragging and for a moment after
	if (finePointer && view.orbit !== false) {
		controls = new OrbitControls(camera, canvas);
		controls.target.copy(target);
		controls.enableZoom = false; // never hijack the page's scroll wheel
		controls.enablePan = false;
		controls.enableDamping = !reducedMotion;
		controls.dampingFactor = 0.08;
		controls.rotateSpeed = 0.7;
		if (view.minPolar !== undefined) controls.minPolarAngle = view.minPolar;
		if (view.maxPolar !== undefined) controls.maxPolarAngle = view.maxPolar;
		controls.addEventListener("start", () => {
			idleAt = Number.POSITIVE_INFINITY;
			canvas.style.cursor = "grabbing";
			wake();
		});
		controls.addEventListener("end", () => {
			idleAt = performance.now() + 2500;
			canvas.style.cursor = "grab";
		});
		controls.addEventListener("change", () => (needsRender = true));
		canvas.style.cursor = "grab";
		controls.update();
	} else {
		canvas.style.touchAction = "pan-y";
	}

	const positionLabels = () => {
		const w = container.clientWidth;
		const h = container.clientHeight;
		for (const { el, at } of labels) {
			if (at instanceof Vector3) scratch.copy(at);
			else at.getWorldPosition(scratch);
			scratch.project(camera);
			const visible = scratch.z < 1;
			el.style.opacity = visible ? "" : "0";
			el.style.transform = `translate(-50%, -50%) translate(${((scratch.x + 1) / 2) * w}px, ${((1 - scratch.y) / 2) * h}px)`;
		}
	};

	const render = () => {
		aim.position.copy(controls?.target ?? target);
		if (shadowsDirty) {
			shadows?.update();
			shadowsDirty = false;
		}
		renderer.info.reset();
		if (pipeline && ctx.occlusion > 0.01) pipeline.render(ctx.occlusion);
		else renderer.render(scene, camera);
		stats.renders++;
		stats.calls = renderer.info.render.calls;
		stats.triangles = renderer.info.render.triangles;
		positionLabels();
		needsRender = false;
	};

	// Resize to the container (the canvas is absolutely positioned inside it).
	const resize = () => {
		const w = Math.max(1, container.clientWidth);
		const h = Math.max(1, container.clientHeight);
		const ratio = pixelRatio();
		stats.pixelRatio = ratio;
		renderer.setPixelRatio(ratio);
		renderer.setSize(w, h, false);
		pipeline?.setSize(w, h, ratio);
		camera.aspect = w / h;
		if (view.fitWidth) {
			const from = controls?.target ?? target;
			const halfFov = (camera.fov * Math.PI) / 360;
			const distance = Math.max(baseDistance, view.fitWidth / 2 / (Math.tan(halfFov) * camera.aspect));
			camera.position.sub(from).setLength(distance).add(from);
		}
		camera.updateProjectionMatrix();
		invalidate();
	};
	const resizeObserver = new ResizeObserver(resize);
	resizeObserver.observe(container);

	/* ---------- Animation loop, only while visible and something moves ---------- */
	let last = performance.now();
	let elapsed = 0;
	let frames = 0;
	let windowMs = 0;
	let windowFrames = 0;
	let slowStreak = 0;
	let goodStreak = 0;
	let probing = false; // the last change was a step back up in resolution
	let locked = false; // a step back up ran slow: no more of them
	const recent: number[] = [];
	let sinceVerdict = 0;
	let verySlow = 0;
	let failed = false;
	let lostTimer = 0;
	/** The stage gives up: stop drawing and tell the page to show its plain version (once). */
	const fail = (reason: "error" | "slow" | "context") => {
		if (failed) return;
		failed = true;
		console.warn(`3D: switching to the plain page (${reason}).`);
		stop();
		window.clearTimeout(lostTimer);
		view.onFallback?.(reason);
	};
	const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
	const time = (ms: number) => {
		frames++;
		if (frames <= WARMUP || ms > 1000) return; // compiling, or a pause (a dropped tab, a debugger)
		// A slideshow (the median of the last frames is under 15 a second): no point stepping down one tier at a time.
		recent.push(ms);
		if (recent.length > RECENT) recent.shift();
		if (recent.length === RECENT && ++sinceVerdict >= RECENT / 2) {
			sinceVerdict = 0;
			verySlow = median(recent) > VERY_SLOW ? verySlow + 1 : 0;
			if (verySlow >= 1 && tier !== "low" && !pinned) {
				for (let step = 0; step < 2 && (tier as Tier) !== "low"; step++) dropTier(median(recent));
				frames = WARMUP;
				recent.length = 0;
				verySlow = 0;
				windowMs = windowFrames = slowStreak = 0;
				return;
			}
			if (verySlow >= 2 && tier === "low" && !pinned && view.onFallback) return fail("slow");
		}
		windowMs += ms;
		windowFrames++;
		if (windowFrames < SAMPLE) return;
		const average = windowMs / windowFrames;
		stats.frameMs = Math.round(average * 10) / 10;
		windowMs = windowFrames = 0;
		if (pinned) return;
		// Time the next window from scratch (the new size or tier needs no warm-up of its own).
		const restart = () => {
			frames = WARMUP;
			recent.length = 0;
			slowStreak = goodStreak = 0;
		};
		const setScale = (next: number) => {
			scale = stats.scale = Math.round(next * 100) / 100;
			resize();
			restart();
		};
		if (average > SLOW) {
			goodStreak = 0;
			if (probing) locked = true; // it ran slow again after stepping back up: stay where it is
			probing = false;
			// Fill-bound frames cost in proportion to the pixels, so one proportional step usually does it. This costs
			// nothing to look at while the camera moves, and a whole tier is only given up when it is not enough.
			if (scale > SCALE_MIN + 0.01) return setScale(Math.max(SCALE_MIN, scale * Math.sqrt(TARGET / average)));
			// The first window decides straight away; after that a tier only goes after two slow windows in a row.
			if (++slowStreak >= (frames <= WARMUP + SAMPLE ? 1 : 2)) {
				restart();
				dropTier(average);
			}
			return;
		}
		slowStreak = 0;
		probing = false;
		// Steady for about seven seconds of movement: try a little more resolution again (once; if that runs slow it stays).
		if (average > GOOD) goodStreak = 0;
		else if (scale < 1 && !locked && ++goodStreak >= 8) {
			probing = true;
			setScale(Math.min(1, scale * SCALE_UP));
		}
	};
	let skip = false;
	// `now` is the browser's own time for this frame (the same for everything drawn in it, aligned to the screen's refresh),
	// so the movement steps by even amounts; reading performance.now() here would add the jitter of when this ran.
	const frame = (now: number = performance.now()) => {
		// An error here would end the loop silently and leave a frozen picture: say so, stop, and let the page fall back.
		try {
			const ms = Math.max(0, now - last);
			const dt = Math.min(ms / 1000, 0.05);
			last = now;
			elapsed += dt;
			if (view.spin && now > idleAt) root.rotation.y += view.spin * dt;
			const moving = controls?.update() ?? false;
			const more = model.update?.(elapsed, dt);
			// While nothing moves, draw every other frame (the model still advances every frame).
			if (model.idle && !moving) {
				skip = !skip;
				if (skip) return;
			} else skip = false;
			render();
			if (!model.idle || moving) time(ms); // (a still room draws every other frame: those say nothing about the cost of a move)
			if (more === false && !moving && !view.spin) {
				sleeping = true;
				stop();
			}
		} catch (error) {
			console.error("3D stopped:", error);
			fail("error");
		}
	};
	const start = () => {
		if (running || reducedMotion || sleeping) return;
		running = true;
		last = performance.now();
		renderer.setAnimationLoop(frame);
	};
	const stop = () => {
		if (!running) return;
		running = false;
		renderer.setAnimationLoop(null);
	};
	let stillQueued = false;
	function requestStill() {
		if (stillQueued) return;
		stillQueued = true;
		requestAnimationFrame(() => {
			stillQueued = false;
			controls?.update();
			if (needsRender) render();
		});
	}
	const sync = () => (onScreen && !document.hidden ? start() : stop());

	const intersection = new IntersectionObserver((entries) => {
		onScreen = entries.some((e) => e.isIntersecting);
		sync();
	});
	intersection.observe(container);
	document.addEventListener("visibilitychange", sync);
	// The GPU can drop the WebGL context (a display plugged in or out, a driver reset). The browser usually gives it
	// back within a moment and three.js rebuilds what it needs; if it does not, the page falls back to its plain version.
	const onContextLost = () => {
		window.clearTimeout(lostTimer);
		lostTimer = window.setTimeout(() => fail("context"), 5000);
	};
	const onContextRestored = () => {
		window.clearTimeout(lostTimer);
		sleeping = false;
		invalidate();
		sync();
	};
	canvas.addEventListener("webglcontextlost", onContextLost);
	canvas.addEventListener("webglcontextrestored", onContextRestored);
	if (reducedMotion) {
		// One pose, redrawn on demand (drag, resize, theme).
		model.update?.(0, 0);
		controls?.addEventListener("change", requestStill);
	} else {
		controls?.addEventListener("change", wake);
	}

	/* ---------- Theme ---------- */
	const applyLighting = () => {
		const l = palette.dark ? LIGHTING.dark : LIGHTING.light;
		renderer.toneMappingExposure = l.exposure;
		scene.environmentIntensity = l.environment;
		key.intensity = l.key;
		fill.intensity = l.fill;
		rim.intensity = l.rim;
		sky.intensity = l.sky;
	};
	const themeObserver = new MutationObserver(() => {
		const next = readPalette();
		if (next.dark === palette.dark) return;
		palette = next;
		ctx.palette = next;
		applyLighting();
		model.applyPalette?.(next);
		invalidate();
	});
	themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
	applyLighting();
	model.applyPalette?.(palette);

	resize();
	render();
	ready = true;

	return () => {
		stop();
		registry.splice(registry.indexOf(stats), 1);
		intersection.disconnect();
		resizeObserver.disconnect();
		themeObserver.disconnect();
		document.removeEventListener("visibilitychange", sync);
		window.clearTimeout(lostTimer);
		canvas.removeEventListener("webglcontextlost", onContextLost);
		canvas.removeEventListener("webglcontextrestored", onContextRestored);
		controls?.dispose();
		model.dispose?.();
		shadows?.dispose();
		pipeline?.dispose();
		overlay.remove();
		const textures = new Set<Texture>();
		scene.traverse((object) => {
			const mesh = object as Mesh;
			(mesh.geometry as BufferGeometry | undefined)?.dispose();
			const materials = ([] as Material[]).concat((mesh.material as Material | Material[] | undefined) ?? []);
			for (const material of materials) {
				for (const value of Object.values(material)) if ((value as Texture)?.isTexture) textures.add(value as Texture);
				material.dispose();
			}
			if (object.userData.blob) textures.add(object.userData.blob);
		});
		textures.forEach((t) => t.dispose());
		environment.dispose();
		renderer.dispose();
		renderer.forceContextLoss();
	};
}
