/**
 * The studio's camera (src/components/Studio.astro), on the shared 3D stage (src/lib/three/stage.ts).
 *
 * The page scrolls natively: every scene is one screen of scroll, and the camera follows that position.
 *   - It travels a closed curve through the scenes' camera points, so it moves sideways around the room and, after the
 *     last scene, curves back to the first: the loop.
 *   - It turns by heading and tilt from one scene's view to the next (the shorter way round), never by sliding a
 *     point it looks at: the loop's last move is a turn on the spot, from the door back to the desk.
 *   - It follows the scroll through a critically damped spring (about 1 s to settle, never overshoots): the damping
 *     is the camera operator.
 *   - It holds still for the middle of each scene's scroll, where its text is read, and eases between scenes (the hold
 *     gives way when the page is moving fast, so a jump across the room is one continuous flight).
 * Nothing per frame goes through React or layout: the page's position is read from scrollY against offsets measured
 * on resize.
 */
import { CatmullRomCurve3, Vector3 } from "three";
import type { Model, StageContext } from "../three/stage";
import { buildRoom, type RoomContent, type RoomState } from "./room";
import type { SceneShot } from "./scenes";

const FOLLOW = 4.2; // per second: the spring the camera follows the scroll through (critically damped, about 1 s)
const HOLD = 0.22; // share of each scene's scroll, either side of it, where the camera stays put
const LAMP_TIME = 1.6; // seconds for the desk lamp to come on
const OPEN_TIME = 3.6; // seconds of the opening shot: the camera starts back from the desk and slowly pushes in
const OPEN_BACK = 0.9; // metres it starts back
// Every scene is framed for a 16:10 window at 42° (a horizontal field of about 63.6°). On a narrower window the vertical
// field widens (up to a limit) so the horizontal field stays the same: the composition holds instead of being cropped.
const FOV = 42;
const REF_ASPECT = 1.6;
const MAX_FOV = 68;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const smootherstep = (x: number) => x * x * x * (x * (6 * x - 15) + 10);
const settle = (f: number, hold: number) => smootherstep(clamp((f - hold) / (1 - 2 * hold), 0, 1));
/** The hold shrinks to nothing when the page is moving fast (a jump across the room), so a long move is one flight, not a stop at every scene. */
const FAST = [1.5, 4.5]; // scenes per second: the hold starts to give way here, and is gone here
const holdFor = (speed: number) => HOLD * (1 - smootherstep(clamp((Math.abs(speed) - FAST[0]) / (FAST[1] - FAST[0]), 0, 1)));

export interface StudioOptions {
	shots: SceneShot[];
	/** What the room shows: the projects on the wall, the portraits by the table and so on. */
	content: RoomContent;
	/** Where the page is, in scenes: 0 = the first; shots.length = back at the first (the end of the loop). */
	position(): number;
	/** Every frame, after the camera has moved: where the camera is, in scenes (for the text and the ruler). */
	onFrame(cameraAt: number): void;
}

export interface StudioHandle {
	/** Put the camera straight at `scene`, no travel (the loop's silent reset, a jump). */
	snap(scene: number): void;
}

export function drive(ctx: StageContext, { shots, content, position, onFrame }: StudioOptions): Model & StudioHandle {
	const { camera } = ctx;
	const room = buildRoom(ctx, content);
	const n = shots.length;
	const path = new CatmullRomCurve3(shots.map((s) => new Vector3(...s.camera)), true, "centripetal", 0.5);
	// Each scene's view as a heading (around y) and a tilt (up or down).
	const views = shots.map(({ camera: c, target: t }) => {
		const dx = t[0] - c[0];
		const dy = t[1] - c[1];
		const dz = t[2] - c[2];
		return { yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
	});
	const at = new Vector3();
	const look = new Vector3();

	let s = 0;
	let speed = 0;
	let snapped = true;
	let lamp = ctx.reducedMotion ? 1 : 0;
	let clock = 0;
	// Pointer parallax: the camera leans a few centimetres toward where the pointer is (mouse and pen only).
	let pxT = 0;
	let pyT = 0;
	let px = 0;
	let py = 0;
	const onPointer = (event: PointerEvent) => {
		if (event.pointerType === "touch") return;
		pxT = (event.clientX / innerWidth) * 2 - 1;
		pyT = (event.clientY / innerHeight) * 2 - 1;
	};
	if (!ctx.reducedMotion) addEventListener("pointermove", onPointer, { passive: true });
	const near: Record<string, number> = {};
	const focus: Record<string, number> = {};
	const state: RoomState = { position: 0, lamp, time: 0, near, focus };

	const place = () => {
		// Held near each scene, eased between: the curve's parameter moves only in the middle of each scene's scroll.
		const i = Math.floor(s);
		const f = s - i;
		const e = settle(f, holdFor(speed));
		const u = (i + e) / n;
		path.getPoint(((u % 1) + 1) % 1, at);
		const a = views[((i % n) + n) % n];
		const b = views[(((i + 1) % n) + n) % n];
		let turn = b.yaw - a.yaw;
		turn -= Math.round(turn / (Math.PI * 2)) * Math.PI * 2;
		const yaw = a.yaw + turn * e;
		const pitch = a.pitch + (b.pitch - a.pitch) * e;
		for (const shot of shots) focus[shot.id] = 0;
		focus[shots[((i % n) + n) % n].id] = 1 - e;
		focus[shots[(((i + 1) % n) + n) % n].id] = e;
		// Motion on top of the move: the opening push-in, a slow breath, and the lean toward the pointer.
		const calm = ctx.reducedMotion ? 0 : 1;
		const open = calm * (1 - smootherstep(clamp(clock / OPEN_TIME, 0, 1))) * focus[shots[0].id];
		const fx = Math.sin(yaw);
		const fz = Math.cos(yaw);
		const sway = calm * (Math.sin(clock * 0.37) * 0.01 + Math.sin(clock * 0.83) * 0.004) + px * 0.07 * calm;
		const lift = calm * Math.sin(clock * 0.52 + 1) * 0.007 - py * 0.045 * calm;
		const push = -OPEN_BACK * open;
		camera.position.set(at.x + fz * sway + fx * push, at.y + lift, at.z - fx * sway + fz * push);
		// Aim at a point a few metres ahead of where the camera would be without the extras, so they read as parallax.
		look.set(at.x + Math.sin(yaw) * Math.cos(pitch) * 4, at.y + Math.sin(pitch) * 4, at.z + Math.cos(yaw) * Math.cos(pitch) * 4);
		camera.lookAt(look);
		for (let k = 0; k < n; k++) {
			// How much scene k is in view: 1 on it, 0 a scene away (the loop's end counts as the first scene).
			const d = Math.min(Math.abs(s - k), Math.abs(s - k - n));
			near[shots[k].id] = clamp(1 - d, 0, 1);
		}
	};

	const fit = () => {
		const aspect = camera.aspect || REF_ASPECT;
		const fov = aspect >= REF_ASPECT ? FOV : Math.min(MAX_FOV, (2 * Math.atan((Math.tan((FOV * Math.PI) / 360) * REF_ASPECT) / aspect) * 180) / Math.PI);
		if (Math.abs(camera.fov - fov) > 0.01) {
			camera.fov = fov;
			camera.updateProjectionMatrix();
		}
	};

	const step = (dt: number) => {
		fit();
		clock += dt;
		const lean = 1 - Math.exp(-4 * dt);
		px += (pxT - px) * lean;
		py += (pyT - py) * lean;
		const page = clamp(position(), 0, n);
		if (snapped || dt <= 0) {
			s = page;
			speed = 0;
			snapped = false;
		} else {
			const e = Math.exp(-FOLLOW * dt);
			const x = s - page;
			const k = speed + FOLLOW * x;
			s = page + (x + k * dt) * e;
			speed = (speed - FOLLOW * k * dt) * e;
		}
		lamp = Math.min(1, lamp + dt / LAMP_TIME);
		place();
		state.position = s;
		state.lamp = lamp;
		state.time = clock;
		room.update(state);
		onFrame(s);
	};
	step(0);

	return {
		update(_t, dt) {
			step(dt);
		},
		applyPalette: (p) => room.applyPalette(p),
		dispose() {
			removeEventListener("pointermove", onPointer);
		},
		snap(scene) {
			s = scene;
			speed = 0;
			place();
		},
	};
}
