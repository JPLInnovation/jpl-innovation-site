/**
 * The scroll showcase's 3D side (src/components/showcase.tsx), on top of the shared stage (./stage.ts).
 *
 * Inside the stage's own animation frame, so only while the canvas is on screen:
 * - the camera follows the page from stop to stop and settles on each one instead of drifting all the time. It
 *   follows the scroll through a critically damped spring, so it never overshoots, and a jump from the dots glides
 *   past the stops in between instead of pausing at each. Between two stops it travels on a curve around the model
 *   (its direction turns on a great circle, it pulls back and rises a little in the middle of a long turn, like a
 *   crane), never in a straight line through it, and eases into each stop;
 * - an opening beat while the section scrolls into place (less than a screen of scroll, before the first stop):
 *   the model's own `opening(progress)`, plus the camera settling in from a little further out;
 * - an exploded view, scrubbed by the scroll, for models that tag their vertices with how far each part moves
 *   (an `explode` attribute) and say how far apart each stop is (`explode` per stop);
 * - each stop is framed for the stage's real shape, and always with the whole model inside the stage's faded edges,
 *   so no part is ever cut off: a stop turns the camera to its parts instead of cropping into them;
 * - the parts the current text is about keep their colour while the rest of the model fades back, in step with the
 *   camera (the fade is tied to where the camera is, not to a timer);
 * - one label per stop, shown once the camera has arrived;
 * - mouse/trackpad: drag to look around the current stop; on release it springs back to the scroll camera.
 *   No zoom, no pan, and touch is left alone so the page scrolls normally;
 * - once nothing has moved for a few seconds, the model's own animation winds down and the stage stops drawing; a
 *   scroll or a press wakes it.
 *
 * Dev and test hook, for checking a stop or rendering the stills (scripts/showcase-stills.py):
 *   window.__showcase.go(n)      show stop n without scrolling (go(null) follows the page again)
 *   window.__showcase.capture()  the 3D view alone as a PNG data URL, with a transparent background
 */
import { type BufferAttribute, type Material, type Mesh, Quaternion, Spherical, Vector3 } from "three";
import type { Model, StageContext } from "./stage";

type V3 = [number, number, number];

export interface ShowcaseStop {
	camera: V3;
	target: V3;
	/** Where this stop's label hangs: just outside the parts it's about. */
	label: V3;
	/** How far the label moves with its parts when the model is fully pulled apart (exploded view). */
	labelShift?: V3;
	/** A close-up: the camera stays this far from `target`, framed as given, instead of fitting the whole model. */
	distance?: number;
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
	focus?(weights: ArrayLike<number>, explode: number): void;
	/** How far apart the model is on each stop, 0 (assembled) to 1. Needs the `explode` vertex attribute. */
	explode?: number[];
	/** The stops that keep the whole model in colour (default: the first only). */
	whole?: number[];
	/**
	 * The opening beat, while the section scrolls into place: 0 (the section just coming into view) to 1 (the first
	 * stop). Called every frame before update(); also returns how far apart the model is at that point (0 = together).
	 */
	opening?(progress: number): number | void;
	/** For the stills (window.__showcase.go): put any animation in a pose that tells stop n's story. */
	pose?(stop: number): void;
}

interface Options {
	/** One label per stop. */
	titles: string[];
	/** Where the page is, in stops: 0 = the first, 1.5 = halfway from the second to the third. */
	position(): number;
	/** How far the section has scrolled into place, 0 to 1 (1 from the first stop on). */
	opening(): number;
	/** The stop being read changed. */
	onStop(index: number): void;
	/** Every frame, after the camera has moved: where the camera is, in stops (for text that follows it). */
	onFrame?(at: number): void;
}

const HOLD = 0.2; // the camera stays put for this share of the way either side of each stop
const FOLLOW = 15; // per second: the spring the camera follows the scroll through (critically damped, about 0.4 s)
const GLIDE = [2.5, 6]; // stops per second: between these speeds the holds fade out, so fast jumps glide through
const LABEL = 0.12; // the label shows within this share of a stop of its camera
const SPRING = 13; // per second: back to the scroll camera after a drag, critically damped (about 0.4 s)
const DIM_SLOTS = 24;
const FILL = 0.86; // share of the stage's width or height the model may take: clear of the faded edges (about 7% each)
const ARC = 0.16; // how much further back the camera swings in the middle of a half turn
const LIFT = 0.14; // radians the camera rises in the middle of a half turn
const OPEN_FROM = 1.22; // the opening beat starts this much further out
const REST_AFTER = 4; // seconds without movement before the animation winds down
const WIND = 1.2; // seconds to wind down (and up again)

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const smoothstep = (x: number) => x * x * (3 - 2 * x);
const smootherstep = (x: number) => x * x * x * (x * (6 * x - 15) + 10);
// Held near each stop; in between, a quintic ease: it leaves gently and arrives without a bump.
const settle = (f: number) => smootherstep(clamp((f - HOLD) / (1 - 2 * HOLD), 0, 1));

const UP = new Vector3(0, 1, 0);
/** Turns `a` toward `b` (both unit length) along a great circle; `u` from 0 to 1. Writes into `out`; returns the angle. */
function slerpDirection(a: Vector3, b: Vector3, u: number, out: Vector3, q: Quaternion) {
	const angle = a.angleTo(b);
	if (angle < 1e-4) {
		out.copy(a);
		return 0;
	}
	const axis = new Vector3().crossVectors(a, b);
	if (axis.lengthSq() < 1e-8) axis.copy(UP); // straight opposite: go round, not through
	q.setFromAxisAngle(axis.normalize(), angle * u);
	out.copy(a).applyQuaternion(q);
	return angle;
}

/**
 * Dims by blending toward grey and letting the page show through: the colour fades back the same way on the light and
 * the dark theme, and in the transparent stills. The canvas is premultiplied, so all four channels scale together.
 */
function patchDim(material: Material, dim: { value: number[] }, explode?: { value: number }) {
	const previous = material.onBeforeCompile.bind(material);
	const previousKey = material.customProgramCacheKey.bind(material);
	material.onBeforeCompile = (shader, renderer) => {
		previous(shader, renderer);
		shader.uniforms.showcaseDim = dim;
		shader.vertexShader = shader.vertexShader.replace(
			"void main() {",
			`attribute float feature;\nuniform float showcaseDim[${DIM_SLOTS}];\nvarying float vShowcaseDim;\nvoid main() {\n\tvShowcaseDim = showcaseDim[int(feature + 0.5)];`,
		);
		if (explode) {
			shader.uniforms.showcaseExplode = explode;
			shader.vertexShader = shader.vertexShader
				.replace("void main() {", "attribute vec3 explode;\nuniform float showcaseExplode;\nvoid main() {")
				.replace("#include <begin_vertex>", "#include <begin_vertex>\n\ttransformed += explode * showcaseExplode;");
		}
		shader.fragmentShader = shader.fragmentShader
			.replace("void main() {", "varying float vShowcaseDim;\nvoid main() {")
			.replace(
				"#include <dithering_fragment>",
				"#include <dithering_fragment>\n\tgl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722))), 0.75 * vShowcaseDim);\n\tgl_FragColor *= 1.0 - 0.5 * vShowcaseDim;",
			);
	};
	material.customProgramCacheKey = () => `${previousKey()}|showcase-dim${explode ? "-explode" : ""}`;
}

/**
 * Frames the model (sampled points of its surface) from a stop's direction on a stage of this shape: moves the target
 * so the model's outline is centred, and the camera back until the outline fills FILL of the stage's limiting side.
 * Perspective makes near points look bigger, so it settles in a few passes. Writes the target into `target`.
 */
function fit(stop: ShowcaseStop, points: Float32Array, aspect: number, tanHalf: number, target: Vector3, shift?: Float32Array, apart = 0) {
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
			v.fromArray(points, p);
			if (shift && apart) v.x += shift[p] * apart, v.y += shift[p + 1] * apart, v.z += shift[p + 2] * apart;
			v.sub(eye);
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
export function drive(ctx: StageContext, model: ShowcaseModel, { titles, position, opening, onStop, onFrame }: Options): Model {
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
	const shifted: number[] = [];
	const at = new Vector3();
	for (const mesh of meshes) {
		const position = mesh.geometry.getAttribute("position");
		const shift = mesh.geometry.getAttribute("explode") as BufferAttribute | undefined;
		for (let i = 0; i < position.count; i += stride) {
			at.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
			sampled.push(at.x, at.y, at.z);
			if (shift) shifted.push(shift.getX(i), shift.getY(i), shift.getZ(i));
			else shifted.push(0, 0, 0);
		}
	}
	const points = new Float32Array(sampled);
	const shifts = model.explode ? new Float32Array(shifted) : undefined;
	const apart = stops.map((_, i) => model.explode?.[i] ?? 0);

	// Each stop keeps its direction, centres the model and moves in or out until the whole model fits inside the
	// stage's faded edges: a tall stage backs off only as far as the model's width needs, a wide one moves closer. Worked
	// out again when the stage changes shape.
	const distances = new Float64Array(stops.length);
	let aspect = 0;
	const frame = () => {
		if (camera.aspect === aspect) return;
		aspect = camera.aspect;
		const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
		// An exploded stop is framed pulled apart, so its parts stay inside the stage too.
		stops.forEach((stop, i) => (distances[i] = stop.distance ?? fit(stop, points, aspect, tanHalf, targets[i], shifts, apart[i])));
	};

	/* ---------- Fading: one value per feature, shared by every patched material ---------- */
	const dim = { value: new Array<number>(DIM_SLOTS).fill(0) };
	const explodeUniform = { value: 0 };
	const patched = new Set<Material>();
	ctx.root.traverse((object) => {
		const mesh = object as Mesh;
		if (!mesh.isMesh || !mesh.geometry.getAttribute("feature")) return;
		const explodes = !!mesh.geometry.getAttribute("explode");
		for (const material of ([] as Material[]).concat(mesh.material)) {
			if (!patched.has(material)) patchDim(material, dim, explodes ? explodeUniform : undefined);
			patched.add(material);
		}
	});
	const weights = new Float32Array(stops.length);
	const whole = model.whole ?? [0];

	/* ---------- Labels ---------- */
	const labelPoints = stops.map((s) => new Vector3(...s.label));
	// (a stop without a title has no label)
	const labels = stops.map((_, i) =>
		titles[i] ? ctx.label(titles[i], labelPoints[i], "opacity-0 transition-opacity duration-300 data-[on]:opacity-100") : undefined,
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
		ctx.wake();
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
	const turn = new Quaternion();

	let override: number | null = null;
	let read = -1; // the stop whose text is being read
	let s = 0; // where the camera is, in stops: follows the page through the spring
	let speed = 0;
	let open = 1; // the opening beat, following the page through the same spring
	let openSpeed = 0;
	let snap = true; // the first frame jumps straight to wherever the page is
	let still = 0; // seconds since anything last moved
	let pace = 1; // how fast the model's own animation runs: winds down to 0 when nothing moves
	let lastPage = -1;
	let lastOpen = -1;

	/** One step of a critically damped spring toward `to`; exact for any frame length, so it never overshoots. */
	const follow = (x: number, v: number, to: number, dt: number): [number, number] => {
		const e = Math.exp(-FOLLOW * dt);
		const d = x - to;
		const k = v + FOLLOW * d;
		return [to + (d + k * dt) * e, (v - FOLLOW * k * dt) * e];
	};

	const step = (dt: number) => {
		clock += dt;
		frame();
		const page = clamp(override ?? position(), 0, last);
		const opened = override !== null ? 1 : clamp(opening(), 0, 1);
		if (snap || dt <= 0) {
			s = page;
			speed = 0;
			open = opened;
			openSpeed = 0;
		} else {
			[s, speed] = follow(s, speed, page, dt);
			[open, openSpeed] = follow(open, openSpeed, opened, dt);
		}

		// Between two stops: settled near each, unless it's moving fast (a jump), when it glides straight through.
		const i = Math.min(Math.max(last - 1, 0), Math.floor(s));
		const j = Math.min(i + 1, last);
		const f = clamp(s - i, 0, 1);
		const glide = smoothstep(clamp((Math.abs(speed) - GLIDE[0]) / (GLIDE[1] - GLIDE[0]), 0, 1));
		const u = settle(f) + (f - settle(f)) * glide;
		target.lerpVectors(targets[i], targets[j], u);
		// Around the model on a great circle; the wider the turn, the further it swings out and up on the way.
		const angle = slerpDirection(offsets[i], offsets[j], u, dir, turn);
		const swing = Math.sin(Math.PI * u) * Math.min(1, angle / Math.PI);
		let distance = (distances[i] + (distances[j] - distances[i]) * u) * (1 + ARC * swing);
		// The opening: the camera settles in from further out as the section arrives.
		const intro = smootherstep(open);
		distance *= OPEN_FROM + (1 - OPEN_FROM) * intro;

		// The drag offset on top, springing back once released.
		if (released) {
			const t = clock - released.at;
			const k = (1 + SPRING * t) * Math.exp(-SPRING * t);
			yaw = released.yaw * k;
			pitch = released.pitch * k;
			if (k < 1e-4) released = undefined;
		}
		spherical.setFromVector3(offset.copy(dir).multiplyScalar(distance));
		const phi = spherical.phi - LIFT * swing;
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
		let all = 0;
		for (const k of whole) all += weights[k];
		for (let n = 0; n < DIM_SLOTS; n++) dim.value[n] = 1 - Math.min(1, all + (n > 0 && n <= last && !whole.includes(n) ? weights[n] : 0));

		// Exploded view: how far apart this stop is, plus whatever the opening beat asks for.
		let explode = apart[i] * (1 - u) + apart[j] * u;
		const pulled = model.opening?.(open);
		if (typeof pulled === "number") explode = Math.max(explode, pulled);
		explodeUniform.value = explode;
		ctx.occlusion = 1 - smoothstep(clamp(explode * 4, 0, 1)); // occlusion is worked out on the assembled shape
		labelPoints.forEach((p, n) => {
			const shift = stops[n].labelShift;
			p.set(...stops[n].label);
			if (shift) p.set(p.x + shift[0] * explode, p.y + shift[1] * explode, p.z + shift[2] * explode);
		});
		model.focus?.(weights, explode);
		onFrame?.(s);

		// The label once the camera is there; the text and dots follow the page itself.
		const near = Math.round(s);
		const label = Math.abs(s - near) < LABEL && open > 0.98 ? near : -1;
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

		// Rest: once the camera, the page and the drag have all been still for a while, wind the animation down.
		const moving = Math.abs(speed) > 1e-3 || Math.abs(openSpeed) > 1e-3 || dragging || !!released || page !== lastPage || opened !== lastOpen;
		lastPage = page;
		lastOpen = opened;
		still = moving ? 0 : still + dt;
		const wanted = still > REST_AFTER ? 0 : 1;
		pace = wanted > pace ? Math.min(1, pace + dt / (WIND * 0.5)) : Math.max(0, pace - dt / WIND);
		snap = false;
		return pace > 0 || moving;
	};
	step(0);
	snap = true;

	// A scroll (or a press, above) wakes a stage that has come to rest.
	const onScroll = () => ctx.wake();
	addEventListener("scroll", onScroll, { passive: true });

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

	let animated = 0; // the model's own clock, which runs at `pace`
	return {
		update(_t, dt) {
			const awake = step(dt);
			const paced = dt * smoothstep(pace);
			animated += paced;
			if (paced > 0) model.update?.(animated, paced);
			return awake;
		},
		applyPalette: (p) => model.applyPalette?.(p),
		dispose() {
			removeEventListener("scroll", onScroll);
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
