/**
 * Shared Three.js stage for the site's 3D models (src/lib/three/models/*).
 *
 * One stage per <canvas>. It owns the renderer, camera, lights, resizing, theme colours and cleanup, so a
 * model only builds meshes and (optionally) animates them. Loaded lazily by src/components/model-viewer.tsx.
 *
 * Behaviour:
 * - Renders only while the canvas is on screen and the tab is visible.
 * - prefers-reduced-motion: no animation loop; one still frame, redrawn only when something changes.
 * - Drag to orbit on mouse/trackpad. On touch screens there are no controls, so the page scrolls normally.
 * - Re-colours when the site switches between light and dark.
 */
import {
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
	/** A floating HTML label that follows a point on the model. */
	label(text: string, at: Object3D | Vector3, className?: string): HTMLElement;
	/** Ask for a redraw (only needed for still frames under reduced motion). */
	invalidate(): void;
}

export interface Model {
	/** Called every frame with elapsed and delta seconds. Not called under reduced motion (except once with t = 0). */
	update?(t: number, dt: number): void;
	/** Re-colour after a light/dark switch. */
	applyPalette?(p: Palette): void;
	dispose?(): void;
}

export type ModelFactory = (ctx: StageContext) => Model | Promise<Model>;

/* ------------------------------------------------------------------ */
/* Helpers for models                                                  */
/* ------------------------------------------------------------------ */

export const standard = (color: number | Color, params: MeshStandardMaterialParameters = {}) =>
	new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...params });

/** Soft round shadow under a model, so it sits on the page instead of floating. */
export function contactShadow(radius: number, opacity = 0.35) {
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
		new MeshBasicMaterial({ map: new CanvasTexture(canvas), transparent: true, opacity, depthWrite: false }),
	);
	mesh.rotation.x = -Math.PI / 2;
	mesh.renderOrder = -1;
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
/* Stage                                                               */
/* ------------------------------------------------------------------ */

/** Throws if WebGL is unavailable, so the caller can keep showing its fallback. */
export async function mountStage(
	container: HTMLElement,
	canvas: HTMLCanvasElement,
	factory: ModelFactory,
	view: StageView,
): Promise<() => void> {
	const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const finePointer = matchMedia("(pointer: fine)").matches;

	const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setClearColor(0x000000, 0);

	const scene = new Scene();
	const pmrem = new PMREMGenerator(renderer);
	const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
	scene.environment = environment;
	pmrem.dispose();

	scene.add(new HemisphereLight(0xffffff, 0x3a4658, 0.7));
	const sun = new DirectionalLight(0xffffff, 1.5);
	sun.position.set(4, 7, 5);
	scene.add(sun);

	const camera = new PerspectiveCamera(view.fov ?? 35, 1, 0.01, 100);
	camera.position.set(...view.camera);
	const target = new Vector3(...(view.target ?? [0, 0, 0]));
	camera.lookAt(target);
	const baseDistance = camera.position.distanceTo(target);

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
	let needsRender = true;
	let running = false;
	let onScreen = false;
	const invalidate = () => {
		needsRender = true;
		if (reducedMotion || !running) requestStill();
	};

	const ctx: StageContext = {
		scene,
		root,
		camera,
		canvas,
		container,
		palette,
		reducedMotion,
		invalidate,
		label(text, at, className = "") {
			const el = document.createElement("span");
			el.textContent = text;
			el.className =
				"absolute left-0 top-0 whitespace-nowrap rounded-full border bg-card/90 px-2.5 py-1 text-[12px] font-semibold text-foreground shadow-sm max-sm:px-1.5 max-sm:py-0.5 max-sm:text-[9.5px] " +
				className;
			overlay.appendChild(el);
			labels.push({ el, at });
			return el;
		},
	};

	const model = await factory(ctx);

	let controls: OrbitControls | undefined;
	let idleAt = 0; // spin pauses while dragging and for a moment after
	if (finePointer) {
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
		renderer.render(scene, camera);
		positionLabels();
		needsRender = false;
	};

	// Resize to the container (the canvas is absolutely positioned inside it).
	const resize = () => {
		const w = Math.max(1, container.clientWidth);
		const h = Math.max(1, container.clientHeight);
		renderer.setSize(w, h, false);
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

	// Animation loop, only while visible.
	let last = performance.now();
	let elapsed = 0;
	const frame = () => {
		const now = performance.now();
		const dt = Math.min((now - last) / 1000, 0.05);
		last = now;
		elapsed += dt;
		if (view.spin && now > idleAt) root.rotation.y += view.spin * dt;
		controls?.update();
		model.update?.(elapsed, dt);
		render();
	};
	const start = () => {
		if (running || reducedMotion) return;
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
	if (reducedMotion) {
		// One pose, redrawn on demand (drag, resize, theme).
		model.update?.(0, 0);
		controls?.addEventListener("change", requestStill);
	}

	// Follow the site's light/dark switch.
	const themeObserver = new MutationObserver(() => {
		const next = readPalette();
		if (next.dark === palette.dark) return;
		palette = next;
		ctx.palette = next;
		model.applyPalette?.(next);
		invalidate();
	});
	themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
	model.applyPalette?.(palette);

	resize();
	render();

	return () => {
		stop();
		intersection.disconnect();
		resizeObserver.disconnect();
		themeObserver.disconnect();
		document.removeEventListener("visibilitychange", sync);
		controls?.dispose();
		model.dispose?.();
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
		});
		textures.forEach((t) => t.dispose());
		environment.dispose();
		renderer.dispose();
		renderer.forceContextLoss();
	};
}
