/**
 * The scroll showcase's 3D side (src/components/showcase.tsx), on top of the shared stage (./stage.ts).
 *
 * Inside the stage's own animation frame, so only while the canvas is on screen:
 * - the camera eases from stop to stop as the page scrolls, settling on each one instead of drifting all the time;
 * - the parts the current text is about keep their colour while the rest of the model fades back a little;
 * - one label per stop, shown only on its stop;
 * - mouse/trackpad: drag to look around the current stop; on release it springs back to the scroll camera.
 *   No zoom, no pan, and touch is left alone so the page scrolls normally.
 *
 * Dev and test hook, for checking a stop or rendering the stills (scripts/showcase-stills.py):
 *   window.__showcase.go(n)      show stop n without scrolling (go(null) follows the page again)
 *   window.__showcase.capture()  the 3D view alone as a PNG data URL, with a transparent background
 */
import { type Material, type Mesh, Spherical, Vector3 } from "three";
import type { Model, StageContext } from "./stage";

type V3 = [number, number, number];

export interface ShowcaseStop {
	camera: V3;
	target: V3;
	/** Where this stop's label hangs: just outside the parts it's about. */
	label: V3;
}

/**
 * What a showcase model module's default export resolves to. Meshes whose geometry has a `feature` attribute (one
 * float per vertex: 0 = no stop in particular, n = stop n's parts) fade back when another stop is showing.
 */
export interface ShowcaseModel extends Model {
	/** One per feature in the page's text, in the same order. */
	stops: ShowcaseStop[];
	/** The lowest point of the model: dragging never takes the camera below it. */
	floor: number;
}

interface Options {
	/** One label per stop. */
	titles: string[];
	/** Where the page is, in stops: 0 = the first, 1.5 = halfway from the second to the third. */
	position(): number;
	/** The stop being shown changed. */
	onStop(index: number): void;
}

const HOLD = 0.2; // the camera stays put for this share of the way either side of each stop
const FOLLOW = 0.12; // seconds: how closely the camera follows the scroll (softens jumps from the dots)
const FADE = 0.18; // seconds: the other parts fading back or in
const SPRING = 13; // per second: back to the scroll camera after a drag, critically damped (about 0.4 s)
const DIM_SLOTS = 8;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const settle = (f: number) => {
	const u = clamp((f - HOLD) / (1 - 2 * HOLD), 0, 1);
	return u * u * (3 - 2 * u);
};

/**
 * Dims by blending toward grey and letting the page show through: the colour fades back the same way on the light and
 * the dark theme, and in the transparent stills. The canvas is premultiplied, so all four channels scale together.
 */
function patchDim(material: Material, dim: { value: number[] }) {
	material.onBeforeCompile = (shader) => {
		shader.uniforms.showcaseDim = dim;
		shader.vertexShader = shader.vertexShader.replace(
			"void main() {",
			`attribute float feature;\nuniform float showcaseDim[${DIM_SLOTS}];\nvarying float vShowcaseDim;\nvoid main() {\n\tvShowcaseDim = showcaseDim[int(feature + 0.5)];`,
		);
		shader.fragmentShader = shader.fragmentShader
			.replace("void main() {", "varying float vShowcaseDim;\nvoid main() {")
			.replace(
				"#include <dithering_fragment>",
				"#include <dithering_fragment>\n\tgl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722))), 0.75 * vShowcaseDim);\n\tgl_FragColor *= 1.0 - 0.5 * vShowcaseDim;",
			);
	};
	material.customProgramCacheKey = () => "showcase-dim";
}

/** Wraps a showcase model so the stage runs it: camera, fading, labels and drag. */
export function drive(ctx: StageContext, model: ShowcaseModel, { titles, position, onStop }: Options): Model {
	const { camera, canvas } = ctx;
	const stops = model.stops;
	const last = stops.length - 1;
	const cameras = stops.map((s) => new Vector3(...s.camera));
	const targets = stops.map((s) => new Vector3(...s.target));

	/* ---------- Fading: one value per feature, shared by every patched material ---------- */
	const dim = { value: new Array<number>(DIM_SLOTS).fill(0) };
	const patched = new Set<Material>();
	ctx.root.traverse((object) => {
		const mesh = object as Mesh;
		if (!mesh.isMesh || !mesh.geometry.getAttribute("feature")) return;
		for (const material of ([] as Material[]).concat(mesh.material)) {
			if (!patched.has(material)) patchDim(material, dim);
			patched.add(material);
		}
	});

	/* ---------- Labels ---------- */
	const labels = stops.map((s, i) =>
		ctx.label(titles[i] ?? "", new Vector3(...s.label), "opacity-0 transition-opacity duration-300 data-[on]:opacity-100"),
	);

	/* ---------- Drag to look around (mouse and pen only) ---------- */
	let yaw = 0;
	let pitch = 0;
	let dragging = false;
	let released: { yaw: number; pitch: number; at: number } | undefined;
	let clock = 0;
	let lastX = 0;
	let lastY = 0;
	const fine = matchMedia("(pointer: fine)").matches;
	const down = (e: PointerEvent) => {
		if (e.pointerType === "touch" || e.button !== 0) return;
		dragging = true;
		released = undefined;
		lastX = e.clientX;
		lastY = e.clientY;
		canvas.setPointerCapture(e.pointerId);
		canvas.style.cursor = "grabbing";
	};
	const move = (e: PointerEvent) => {
		if (!dragging) return;
		const speed = (1.4 * Math.PI) / Math.max(1, canvas.clientHeight);
		yaw = clamp(yaw - (e.clientX - lastX) * speed, -Math.PI, Math.PI);
		pitch -= (e.clientY - lastY) * speed; // clamped against the floor in step()
		lastX = e.clientX;
		lastY = e.clientY;
	};
	const up = () => {
		if (!dragging) return;
		dragging = false;
		released = { yaw, pitch, at: clock };
		canvas.style.cursor = "grab";
	};
	if (fine) {
		canvas.style.cursor = "grab";
		canvas.addEventListener("pointerdown", down);
		canvas.addEventListener("pointermove", move);
		canvas.addEventListener("pointerup", up);
		canvas.addEventListener("pointercancel", up);
	}

	/* ---------- Camera ---------- */
	const target = new Vector3().copy(targets[0]);
	const dir = new Vector3().subVectors(cameras[0], targets[0]);
	let distance = dir.length();
	dir.normalize();
	const goalTarget = new Vector3();
	const goalDir = new Vector3();
	const a = new Vector3();
	const b = new Vector3();
	const offset = new Vector3();
	const spherical = new Spherical();

	let override: number | null = null;
	let shown = -1;
	let snap = true; // the first frame jumps straight to wherever the page is

	const step = (dt: number) => {
		clock += dt;
		const s = clamp(override ?? position(), 0, last);

		// Where the camera should be: between two stops, settled near each.
		const i = Math.min(Math.max(last - 1, 0), Math.floor(s));
		const j = Math.min(i + 1, last);
		const u = settle(s - i);
		goalTarget.lerpVectors(targets[i], targets[j], u);
		a.subVectors(cameras[i], targets[i]);
		b.subVectors(cameras[j], targets[j]);
		const goalDistance = a.length() + (b.length() - a.length()) * u;
		goalDir.lerpVectors(a.normalize(), b.normalize(), u).normalize(); // around the model, never through it

		const follow = snap ? 1 : 1 - Math.exp(-dt / FOLLOW);
		target.lerp(goalTarget, follow);
		dir.lerp(goalDir, follow).normalize();
		distance += (goalDistance - distance) * follow;

		// Stops are framed for a square stage. Narrower (portrait) stages back off until the same width fits across.
		const fit = Math.max(1, 1 / camera.aspect);

		// The drag offset on top, springing back once released.
		if (released) {
			const t = clock - released.at;
			const k = (1 + SPRING * t) * Math.exp(-SPRING * t);
			yaw = released.yaw * k;
			pitch = released.pitch * k;
			if (k < 1e-4) released = undefined;
		}
		spherical.setFromVector3(offset.copy(dir).multiplyScalar(distance * fit));
		const phi = spherical.phi;
		const floorPhi = Math.acos(clamp((model.floor + 0.02 - target.y) / spherical.radius, -1, 1));
		spherical.phi = clamp(phi + pitch, Math.min(phi, 0.15), Math.max(phi, floorPhi));
		if (dragging) pitch = spherical.phi - phi;
		spherical.theta += yaw;
		camera.position.setFromSpherical(spherical).add(target);
		camera.lookAt(target);

		// The stop being shown: its parts in colour, its label, its text.
		const active = Math.round(s);
		const fade = snap ? 1 : 1 - Math.exp(-dt / FADE);
		for (let f = 0; f < DIM_SLOTS; f++) {
			const goal = active === 0 || f === active ? 0 : 1;
			dim.value[f] += (goal - dim.value[f]) * fade;
		}
		labels.forEach((el, n) => el.toggleAttribute("data-on", n === active && Math.abs(s - n) < HOLD));
		if (active !== shown) {
			shown = active;
			onStop(active);
		}
		snap = false;
	};
	step(0);
	snap = true;

	const hook = {
		go(n: number | null) {
			override = n === null ? null : clamp(Math.round(n), 0, last);
			snap = true;
			step(0);
			ctx.render();
		},
		capture() {
			ctx.render();
			return canvas.toDataURL("image/png");
		},	};
	(window as unknown as { __showcase?: typeof hook }).__showcase = hook;

	return {
		update(t, dt) {
			step(dt);
			model.update?.(t, dt);
		},
		applyPalette: (p) => model.applyPalette?.(p),
		dispose() {
			canvas.removeEventListener("pointerdown", down);
			canvas.removeEventListener("pointermove", move);
			canvas.removeEventListener("pointerup", up);
			canvas.removeEventListener("pointercancel", up);
			const w = window as unknown as { __showcase?: typeof hook };
			if (w.__showcase === hook) delete w.__showcase;
			model.dispose?.();
		},
	};
}
