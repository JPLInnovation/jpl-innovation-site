/**
 * The studio's camera (src/components/Studio.astro), on the shared 3D stage (src/lib/three/stage.ts).
 *
 * The page scrolls natively: every scene is one screen of scroll, and the camera follows that position.
 *   - It travels a closed curve through the scenes' camera points, so it moves sideways around the room and, after the
 *     last scene, curves back to the first: the loop.
 *   - It turns by heading and tilt from one scene's view to the next (the shorter way round), never by sliding a
 *     point it looks at: the loop's last move is a turn on the spot, from the door back to the desk.
 *   - It follows the scroll through a critically damped spring (about 0.4 s to settle, about 0.2 s behind a steady
 *     scroll, never overshoots): the damping is the camera operator. A slower spring or a dead zone before the camera
 *     starts to move feels like lag, so neither is used: the camera answers the first notch of the wheel.
 *   - Between two scenes it moves mostly in step with the scroll, eased only a little at either end (so it settles
 *     into each scene and never whips across the room); a long scroll is one continuous flight.
 * Nothing per frame goes through React or layout: the page's position is read from scrollY against offsets measured
 * on resize.
 */
import { CatmullRomCurve3, type Mesh, Raycaster, Vector2, Vector3 } from "three";
import type { Model, StageContext } from "../three/stage";
import { buildRoom, type RoomContent, type RoomState } from "./room";
import type { SceneShot } from "./scenes";

const FOLLOW = 10; // per second: the spring the camera follows the scroll through (critically damped)
const SOFT = 0.7; // how much of each move is eased (0 = in step with the scroll, 1 = smoothstep, flat at both ends)
const LEAVE_TIME = 0.45; // seconds for the push-in toward the project wall when a panel is clicked
const LEAVE_PUSH = 1.3; // metres the camera moves forward in it
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
const smoothstep = (x: number) => x * x * (3 - 2 * x);
/** The share of the way between two scenes for `f` (0 to 1) of the scroll between them: nearly straight, softened at the ends. */
const settle = (f: number) => f + SOFT * (smoothstep(f) - f);

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
	/** The project panel under a point of the screen (client pixels), or -1; only while the camera is at the wall. */
	pickWall(clientX: number, clientY: number): number;
	/** Push the camera into the wall (a panel was clicked), then resolve. */
	leave(): Promise<void>;
	/** Back out again (the page did not change after all). */
	release(): void;
}

export async function drive(ctx: StageContext, { shots, content, position, onFrame }: StudioOptions): Promise<Model & StudioHandle> {
	const { camera } = ctx;
	const room = await buildRoom(ctx, content);
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
	// Where the pointer is on the canvas (not over a card or the header), for the project wall's hover.
	const pointer = { x: 0, y: 0, over: false };
	const onPointer = (event: PointerEvent) => {
		if (event.pointerType === "touch") return;
		pxT = (event.clientX / innerWidth) * 2 - 1;
		pyT = (event.clientY / innerHeight) * 2 - 1;
		pointer.x = pxT;
		pointer.y = -pyT;
		pointer.over = event.target === ctx.canvas;
	};
	const onLeave = () => (pointer.over = false);
	if (!ctx.reducedMotion) {
		addEventListener("pointermove", onPointer, { passive: true });
		document.documentElement.addEventListener("pointerleave", onLeave);
		addEventListener("blur", onLeave);
	}
	const raycaster = new Raycaster();
	const ndc = new Vector2();
	/** The wall's panel under a point (normalised device coordinates), or -1. */
	const pickAt = (x: number, y: number) => {
		camera.updateMatrixWorld();
		raycaster.setFromCamera(ndc.set(x, y), camera);
		const hit = raycaster.intersectObjects(room.wall.screens, false)[0];
		return hit ? room.wall.screens.indexOf(hit.object as Mesh) : -1;
	};
	let hoverIndex = -1;
	// The push-in toward the wall: 0 = normal, 1 = pushed in. It follows `leaving` at a steady rate.
	let leaving = false;
	let leaveAmt = 0;
	let leaveDone: (() => void) | undefined;
	const near: Record<string, number> = {};
	const focus: Record<string, number> = {};
	const state: RoomState = { position: 0, lamp, time: 0, near, focus };

	const place = () => {
		// The curve's parameter follows the scroll between two scenes, softened at each end.
		const i = Math.floor(s);
		const f = s - i;
		const e = settle(f);
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
		const lunge = LEAVE_PUSH * smootherstep(leaveAmt);
			const push = -OPEN_BACK * open + lunge;
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
		const toward = leaving ? 1 : 0;
		if (leaveAmt !== toward) {
			leaveAmt = clamp(leaveAmt + Math.sign(toward - leaveAmt) * (dt / LEAVE_TIME), 0, 1);
			if (leaveAmt === 1) {
				leaveDone?.();
				leaveDone = undefined;
			}
		}
		place();
		state.position = s;
		state.lamp = lamp;
		state.time = clock;
		room.update(state);
		// The wall's panels answer the pointer: the one under it lifts and glows, and the cursor says it opens.
		const over = !leaving && (near.wall ?? 0) > 0.6 && pointer.over ? pickAt(pointer.x, pointer.y) : -1;
		if (over !== hoverIndex) {
			hoverIndex = over;
			room.wall.hover(over);
			ctx.canvas.style.cursor = over >= 0 ? "pointer" : "";
		}
		onFrame(s);
	};
	step(0);

	const api: Model & StudioHandle = {
		idle: false,
		update(_t, dt) {
			step(dt);
			// Idle: the camera is at rest (and the opening push-in is over), so only the room's slow life is moving.
			api.idle = clock > OPEN_TIME && lamp >= 1 && leaveAmt === (leaving ? 1 : 0) && hoverIndex < 0 && Math.abs(speed) < 0.003 && Math.abs(s - clamp(position(), 0, n)) < 0.003 && Math.abs(pxT - px) < 0.01 && Math.abs(pyT - py) < 0.01;
		},
		applyPalette: (p) => room.applyPalette(p),
		dispose() {
			removeEventListener("pointermove", onPointer);
			removeEventListener("blur", onLeave);
			document.documentElement.removeEventListener("pointerleave", onLeave);
			ctx.canvas.style.cursor = "";
		},
		snap(scene) {
			s = scene;
			speed = 0;
			place();
			if (shots[((scene % n) + n) % n].id === "sketch") room.finishSketch(); // (a jump to the book, or a picture of it: not the pen's show)
		},
		pickWall(clientX, clientY) {
			if ((near.wall ?? 0) <= 0.6 || leaving) return -1;
			return pickAt((clientX / innerWidth) * 2 - 1, -((clientY / innerHeight) * 2 - 1));
		},
		leave() {
			if (ctx.reducedMotion) return Promise.resolve();
			leaving = true;
			ctx.wake();
			return new Promise<void>((resolve) => (leaveDone = resolve));
		},
		release() {
			leaving = false;
			leaveDone = undefined;
			ctx.wake();
		},
	};
	return api;
}
