/**
 * The 3D under the opening words (hook B): plays only while a run of the words plays (hook-state.ts, told by
 * src/scripts/studio-hook.ts), on the studio's own stage and room. With no run, it draws nothing and leaves the camera
 * and the lights alone, so Home is unchanged (scripts/home-regression.py).
 *
 *   0 s       the heading: the F450 on the open sketchbook on the dark desk, in a cool rim light; the camera behind the
 *             desk, looking across the dark room to the city through the back wall
 *   the end   the camera hands back to the room's own (the title shot), and the drone stays on the desk until the
 *             camera leaves the title
 *
 * The desk drone is a clone of the drone bench's F450 (stations.ts): it shares its geometry. If that drone hasn't
 * loaded when the words begin, the words play over the dark room as they always did.
 */
import { Group, Matrix4, type Object3D, Quaternion, Vector3 } from "three";
import type { StageContext } from "../three/stage";
import { type HookRun, hookState } from "./hook-state";
import { DESK, type Room } from "./room";

/** Every position and level of the hook, in one place to tune. */
export const HOOK_LOOK = {
	/** Where the drone stands: on the open sketchbook (its own design), facing the room. */
	drone: { x: DESK.book.x + 0.06, z: DESK.book.z, turn: 0 },
	/**
	 * The opening shot: behind the desk, clear of the lamp, looking across the dark room to the glass of the back wall,
	 * the drone on the right of the frame (the words are on the left; facing +z, screen right is -x).
	 */
	open: { camera: [-6.1, 1.1, -3.18] as const, target: [-5.79, 0.72, -0.2] as const, push: 0.08 },
	/** The stage's lights while the room is dark: a whisper of key, no fill, a cool rim that outlines the drone. */
	dark: { key: 0.05, fill: 0, rim: 1.5, rimColor: 0xbfe3ff },
	/** Seconds for the hand-back to the room's camera (and after Skip). */
	handBack: 1.1,
	skip: 0.8,
};

export interface HookScene {
	/** Every frame, after the room's camera has been placed: `position` is where it is, in scenes. */
	update(dt: number, position: number): void;
	/** True while it needs every frame drawn. */
	busy(): boolean;
	dispose(): void;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smoother = (x: number) => x * x * x * (x * (6 * x - 15) + 10);

export function createHookScene(ctx: StageContext, room: Room): HookScene {
	const { camera } = ctx;
	const holder = new Group();
	holder.position.set(HOOK_LOOK.drone.x, DESK.top + 0.012, HOOK_LOOK.drone.z);
	holder.rotation.y = HOOK_LOOK.drone.turn;
	holder.visible = false;
	room.group.add(holder);
	let drone: Object3D | undefined;

	let run: HookRun | undefined; // the run being shown (with the 3D)
	let skipped: HookRun | undefined; // a run that started without the drone: words only
	let onDesk = false; // the drone stays on the desk after a run, until the camera leaves the title
	const saved = { key: 0, fill: 0, rim: 0, rimColor: 0xffffff };

	const eye = new Vector3();
	const look = new Vector3();
	const aim = new Matrix4();
	const aimQ = new Quaternion();
	const engineAt = new Vector3();
	const engineQ = new Quaternion();
	const open = {
		camera: new Vector3(...HOOK_LOOK.open.camera),
		target: new Vector3(...HOOK_LOOK.open.target),
	};
	const forward = open.target.clone().sub(open.camera).normalize();

	/** The drone, cloned from the bench's the first time (shared geometry and materials). */
	const prepare = () => {
		if (drone) return true;
		const source = room.stationDrone();
		if (!source) return false;
		drone = source.model.clone(true);
		holder.add(drone);
		return true;
	};

	const begin = (r: HookRun) => {
		if (!prepare()) {
			skipped = r;
			return;
		}
		run = r;
		holder.visible = true;
		onDesk = true;
		saved.key = ctx.lights.key.intensity;
		saved.fill = ctx.lights.fill.intensity;
		saved.rim = ctx.lights.rim.intensity;
		saved.rimColor = ctx.lights.rim.color.getHex();
		ctx.lights.rim.color.setHex(HOOK_LOOK.dark.rimColor);
	};

	const restoreLights = (k: number) => {
		const { key, fill, rim } = ctx.lights;
		key.intensity = HOOK_LOOK.dark.key + (saved.key - HOOK_LOOK.dark.key) * k;
		fill.intensity = HOOK_LOOK.dark.fill + (saved.fill - HOOK_LOOK.dark.fill) * k;
		rim.intensity = HOOK_LOOK.dark.rim + (saved.rim - HOOK_LOOK.dark.rim) * k;
		if (k >= 1) rim.color.setHex(saved.rimColor);
	};

	return {
		update(_dt, position) {
			const current = hookState.run;
			if (current && current !== run && current !== skipped) begin(current);
			if (onDesk && !run && position > 0.04) {
				// Back to Home as it always is once the camera moves on.
				onDesk = false;
				holder.visible = false;
			}
			if (!run) return;
			const now = performance.now();
			const t = (now - run.start) / 1000;
			const end = run.end / 1000;
			const lampAt = (run.lines[run.lamp] ?? 0) / 1000;

			// The camera: behind the desk, pushing in a touch; then it hands back to the room's own camera.
			const push = HOOK_LOOK.open.push * smoother(clamp01(t / Math.max(1, end)));
			eye.copy(open.camera).addScaledVector(forward, push);
			look.copy(open.target);
			let w = run.still ? 0 : smoother(clamp01((t - (end - HOOK_LOOK.handBack)) / HOOK_LOOK.handBack));
			if (run.ended !== undefined) w = Math.max(w, smoother(clamp01((now - run.ended) / 1000 / HOOK_LOOK.skip)));
			engineAt.copy(camera.position);
			engineQ.copy(camera.quaternion);
			aimQ.setFromRotationMatrix(aim.lookAt(eye, look, camera.up)); // (a camera looks down its -z)
			camera.position.lerpVectors(eye, engineAt, w);
			camera.quaternion.slerpQuaternions(aimQ, engineQ, w);

			// The lights: dark until the lamp line, then back to the room's own as the lamp comes up.
			const lamp = run.still ? 0 : clamp01((t - lampAt) / 1.6);
			restoreLights(run.ended !== undefined ? Math.max(lamp, w) : lamp);

			if (w >= 1) {
				restoreLights(1);
				run = undefined;
			}
		},
		busy: () => !!run,
		dispose() {
			if (run) restoreLights(1);
			holder.removeFromParent();
		},
	};
}
