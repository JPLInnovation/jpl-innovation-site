/**
 * The studio's camera (src/components/Studio.astro), on the shared 3D stage (src/lib/three/stage.ts).
 *
 * The page scrolls natively: every scene is one screen of scroll, and the camera follows that position.
 *   - It travels a closed curve through the scenes' camera points (and a second one through what it looks at), so it
 *     moves sideways around the room and, after the last scene, curves back to the first: the loop.
 *   - It follows the scroll through a critically damped spring (about 1 s to settle, never overshoots): the damping
 *     is the camera operator.
 *   - It holds still for the middle of each scene's scroll, where its text is read, and eases between scenes.
 * Nothing per frame goes through React or layout: the page's position is read from scrollY against offsets measured
 * on resize.
 */
import { CatmullRomCurve3, Vector3 } from "three";
import type { Model, StageContext } from "../three/stage";
import { buildRoom, type RoomState } from "./room";
import type { SceneShot } from "./scenes";

const FOLLOW = 4.2; // per second: the spring the camera follows the scroll through (critically damped, about 1 s)
const HOLD = 0.22; // share of each scene's scroll, either side of it, where the camera stays put
const LAMP_TIME = 1.6; // seconds for the desk lamp to come on

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const smootherstep = (x: number) => x * x * x * (x * (6 * x - 15) + 10);
const settle = (f: number) => smootherstep(clamp((f - HOLD) / (1 - 2 * HOLD), 0, 1));

export interface StudioOptions {
	shots: SceneShot[];
	/** Where the page is, in scenes: 0 = the first; shots.length = back at the first (the end of the loop). */
	position(): number;
	/** Every frame, after the camera has moved: where the camera is, in scenes (for the text and the ruler). */
	onFrame(cameraAt: number): void;
}

export interface StudioHandle {
	/** Put the camera straight at `scene`, no travel (the loop's silent reset, a jump). */
	snap(scene: number): void;
}

export function drive(ctx: StageContext, { shots, position, onFrame }: StudioOptions): Model & StudioHandle {
	const { camera } = ctx;
	const room = buildRoom(ctx);
	const n = shots.length;
	const path = new CatmullRomCurve3(shots.map((s) => new Vector3(...s.camera)), true, "centripetal", 0.5);
	const aim = new CatmullRomCurve3(shots.map((s) => new Vector3(...s.target)), true, "centripetal", 0.5);
	const at = new Vector3();
	const look = new Vector3();

	let s = 0;
	let speed = 0;
	let snapped = true;
	let lamp = ctx.reducedMotion ? 1 : 0;
	let clock = 0;
	const near: Record<string, number> = {};
	const state: RoomState = { position: 0, lamp, time: 0, near };

	const place = () => {
		// Held near each scene, eased between: the curve's parameter moves only in the middle of each scene's scroll.
		const i = Math.floor(s);
		const f = s - i;
		const u = (i + settle(f)) / n;
		path.getPoint(((u % 1) + 1) % 1, at);
		aim.getPoint(((u % 1) + 1) % 1, look);
		camera.position.copy(at);
		camera.lookAt(look);
		for (let k = 0; k < n; k++) {
			// How much scene k is in view: 1 on it, 0 a scene away (the loop's end counts as the first scene).
			const d = Math.min(Math.abs(s - k), Math.abs(s - k - n));
			near[shots[k].id] = clamp(1 - d, 0, 1);
		}
	};

	const step = (dt: number) => {
		clock += dt;
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
		snap(scene) {
			s = scene;
			speed = 0;
			place();
		},
	};
}
