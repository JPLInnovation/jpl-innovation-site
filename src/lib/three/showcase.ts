/**
 * The scroll showcase's 3D side (src/components/showcase.tsx), on top of the shared stage (./stage.ts).
 *
 * Inside the stage's own animation frame, so only while the canvas is on screen:
 * - the camera follows the page from stop to stop and settles on each one instead of drifting all the time. It
 *   follows the scroll through a critically damped spring, so it never overshoots, and a jump from the dots glides
 *   past the stops in between instead of pausing at each;
 * - each stop is framed for the stage's real shape, and always with the whole model inside the stage's faded edges,
 *   so no part is ever cut off: a stop turns the camera to its parts instead of cropping into them;
 * - the parts the current text is about keep their colour while the rest of the model fades back, in step with the
 *   camera (the fade is tied to where the camera is, not to a timer);
 * - one label per stop, shown once the camera has arrived;
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
	/** One per feature in the page's text, in the same order. Only the camera's direction from the target counts:
	 *  its distance is worked out for the stage. */
	stops: ShowcaseStop[];
	/** The lowest point of the model: dragging never takes the camera below it. */
	floor: number;
	/**
	 * Every frame, before update(): how much each stop is showing (0 to 1, adding up to 1), following the camera. For
	 * effects that belong to one stop only (the drone's 4G rings, the robot's FUEL). Don't keep the array.
	 */
	focus?(weights: ArrayLike<number>): void;
	/** For the stills (window.__showcase.go): put any animation in a pose that tells stop n's story. */
	pose?(stop: number): void;
}

interface Options {
	/** One label per stop. */
	titles: string[];
	/** Where the page is, in stops: 0 = the first, 1.5 = halfway from the second to the third. */
	position(): number;
	/** The stop being read changed. */
	onStop(index: number): void;
}

const HOLD = 0.2; // the camera stays put for this share of the way either side of each stop
const FOLLOW = 15; // per second: the spring the camera follows the scroll through (critically damped, about 0.4 s)
const GLIDE = [2.5, 6]; // stops per second: between these speeds the holds fade out, so fast jumps glide through
const LABEL = 0.12; // the label shows within this share of a stop of its camera
const SPRING = 13; // per second: back to the scroll camera after a drag, critically damped (about 0.4 s)
const DIM_SLOTS = 8;
const FILL = 0.86; // share of the stage's width or height the model may take: clear of the faded edges (about 7% each)

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const smoothstep = (x: number) => x * x * (3 - 2 * x);
const settle = (f: number) => smoothstep(clamp((f - HOLD) / (1 - 2 * HOLD), 0, 1));

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

/**
 * Frames the model (sampled points of its surface) from a stop's direction on a stage of this shape: moves the target
 * so the model's outline is centred, and the camera back until the outline fills FILL of the stage's limiting side.
 * Perspective makes near points look bigger, so it settles in a few passes. Writes the target into `target`.
 */
function fit(stop: ShowcaseStop, points: Float32Array, aspect: number, tanHalf: number, target: Vector3) {
	target.set(...stop.target);
	const back = new Vector3(...stop.camera).sub(target).normalize();
	const forward = back.clone().negate();
	const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
	const up = new Vector3().crossVectors(right, forward);
	const eye = new Vector3();
	const v = new Vector3();
	let distance = new Vector3(...stop.camera).distanceTo(target);
	for (let pass = 0; pass < 5; pass++) {
		eye.copy(target).addScaledVector(back, distance);
		let left = Infinity;
		let rightmost = -Infinity;
		let bottom = Infinity;
		let top = -Infinity;
		for (let p = 0; p < points.length; p += 3) {
			v.fromArray(points, p).sub(eye);
			const depth = Math.max(v.dot(forward), 0.05);
			const x = v.dot(right) / depth;
			const y = v.dot(up) / depth;
			left = Math.min(left, x);
			rightmost = Math.max(rightmost, x);
			bottom = Math.min(bottom, y);
			top = Math.max(top, y);
		}
		target.addScaledVector(right, ((left + rightmost) / 2) * distance).addScaledVector(up, ((bottom + top) / 2) * distance);
		distance *= Math.max((rightmost - left) / 2 / aspect, (top - bottom) / 2) / (FILL * tanHalf);
	}
	return distance;
}

/** Wraps a showcase model so the stage runs it: camera, fading, labels and drag. */
export function drive(ctx: StageContext, model: ShowcaseModel, { titles, position, onStop }: Options): Model {
	const { camera, canvas } = ctx;
	const stops = model.stops;
	const last = stops.length - 1;
	const targets = stops.map((s) => new Vector3(...s.target)); // aimed at the middle of the model, per stage shape
	const offsets = stops.map((s, i) => new Vector3(...s.camera).sub(targets[i]).normalize());

	/* ---------- Framing for the stage's shape ---------- */
	// The model's outline: up to about 4000 points of the meshes that fade (the model itself, not effects like FUEL).
	ctx.root.updateMatrixWorld(true);
	const meshes: Mesh[] = [];
	let total = 0;
	ctx.root.traverse((object) => {
		const mesh = object as Mesh;
		if (!mesh.isMesh || !mesh.geometry.getAttribute("feature")) return;
		meshes.push(mesh);
		total += mesh.geometry.getAttribute("position").count;
	});
	const stride = Math.max(1, Math.ceil(total / 4000));
	const sampled: number[] = [];
	const at = new Vector3();
	for (const mesh of meshes) {
		const position = mesh.geometry.getAttribute("position");
		for (let i = 0; i < position.count; i += stride) {
			at.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
			sampled.push(at.x, at.y, at.z);
		}
	}
	const points = new Float32Array(sampled);

	// Each stop keeps its direction, centres the model and moves in or out until the whole model fits inside the
	// stage's faded edges: a tall stage backs off only as far as the model's width needs, a wide one moves closer. Worked
	// out again when the stage changes shape.
	const distances = new Float64Array(stops.length);
	let aspect = 0;
	const frame = () => {
		if (camera.aspect === aspect) return;
		aspect = camera.aspect;
		const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
		stops.forEach((stop, i) => (distances[i] = fit(stop, points, aspect, tanHalf, targets[i])));
	};

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
	const weights = new Float32Array(stops.length);

	/* ---------- Labels ---------- */
	const labels = stops.map((s, i) =>
		ctx.label(titles[i] ?? "", new Vector3(...s.label), "opacity-0 transition-opacity duration-300 data-[on]:opacity-100"),
	);
	let labelled = -1;

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
	const target = new Vector3();
	const dir = new Vector3();
	const offset = new Vector3();
	const spherical = new Spherical();

	let override: number | null = null;
	let read = -1; // the stop whose text is being read
	let s = 0; // where the camera is, in stops: follows the page through the spring
	let speed = 0;
	let snap = true; // the first frame jumps straight to wherever the page is

	const step = (dt: number) => {
		clock += dt;
		frame();
		const page = clamp(override ?? position(), 0, last);

		// The spring: exact for any frame length, so a slow frame can't make it overshoot.
		if (snap || dt <= 0) {
			s = page;
			speed = 0;
		} else {
			const e = Math.exp(-FOLLOW * dt);
			const x = s - page;
			const k = speed + FOLLOW * x;
			s = page + (x + k * dt) * e;
			speed = (speed - FOLLOW * k * dt) * e;
		}

		// Between two stops: settled near each, unless it's moving fast (a jump), when it glides straight through.
		const i = Math.min(Math.max(last - 1, 0), Math.floor(s));
		const j = Math.min(i + 1, last);
		const f = clamp(s - i, 0, 1);
		const glide = smoothstep(clamp((Math.abs(speed) - GLIDE[0]) / (GLIDE[1] - GLIDE[0]), 0, 1));
		const u = settle(f) + (f - settle(f)) * glide;
		target.lerpVectors(targets[i], targets[j], u);
		dir.lerpVectors(offsets[i], offsets[j], u).normalize(); // around the model, never through it
		const distance = distances[i] + (distances[j] - distances[i]) * u;

		// The drag offset on top, springing back once released.
		if (released) {
			const t = clock - released.at;
			const k = (1 + SPRING * t) * Math.exp(-SPRING * t);
			yaw = released.yaw * k;
			pitch = released.pitch * k;
			if (k < 1e-4) released = undefined;
		}
		spherical.setFromVector3(offset.copy(dir).multiplyScalar(distance));
		const phi = spherical.phi;
		const floorPhi = Math.acos(clamp((model.floor + 0.02 - target.y) / spherical.radius, -1, 1));
		spherical.phi = clamp(phi + pitch, Math.min(phi, 0.15), Math.max(phi, floorPhi));
		if (dragging) pitch = spherical.phi - phi;
		spherical.theta += yaw;
		camera.position.setFromSpherical(spherical).add(target);
		camera.lookAt(target);

		// Fading, in step with the camera: stop n's parts in colour while it shows, everything on the first stop.
		weights.fill(0);
		weights[i] = 1 - u;
		weights[j] += u;
		for (let n = 0; n < DIM_SLOTS; n++) dim.value[n] = 1 - Math.min(1, weights[0] + (n > 0 && n <= last ? weights[n] : 0));
		model.focus?.(weights);

		// The label once the camera is there; the text and dots follow the page itself.
		const near = Math.round(s);
		const label = Math.abs(s - near) < LABEL ? near : -1;
		if (label !== labelled) {
			labels[labelled]?.removeAttribute("data-on");
			labels[label]?.setAttribute("data-on", "");
			labelled = label;
		}
		const reading = Math.round(page);
		if (reading !== read) {
			read = reading;
			onStop(reading);
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
			if (override !== null) model.pose?.(override);
			ctx.render();
		},
		capture() {
			ctx.render();
			return canvas.toDataURL("image/png");
		},
	};
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
