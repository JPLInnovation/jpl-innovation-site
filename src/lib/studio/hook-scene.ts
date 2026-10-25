/**
 * The 3D under the opening words (hook B): plays only while a run of the words plays (hook-state.ts, told by
 * src/scripts/studio-hook.ts), on the studio's own stage and room. With no run, it draws nothing and leaves the camera
 * and the lights alone, so Home is unchanged (scripts/home-regression.py).
 *
 *   0 s       the heading: the F450 on the open sketchbook on the dark desk, in a cool rim light; the camera behind the
 *             desk, looking across the dark room to the city through the back wall
 *   line 1    "Then the season ends...": a second after it appears, the drone dissolves top to bottom (3.6 s) into
 *             particles sampled from its surface (hook-dissolve.ts), which hang and drift
 *   line 2    "What's left is one line on a résumé.": the particles collapse into one glowing line (1.6 s), which
 *             breathes until the lamp line
 *   line 3    the lamp line: the lamp warms (the room's own), the line spreads into the blueprint of the drone's part
 *             boxes, the drone reassembles part by part, bottom to top (its exploded view in reverse,
 *             hook-blueprint.ts), faint blueprint lines on the wall light with the lamp, and the camera pulls back
 *             over the drone to the lit room, the logo and the slogan
 *   the end   the camera hands back to the room's own (the title shot). The drone stays on the desk, and dissolves away
 *             as the camera leaves the title, so Home is as it always is from there on.
 *
 * The desk drone is a clone of the drone bench's F450 (stations.ts): it shares its geometry. If that drone hasn't
 * loaded when the words begin, the words play over the dark room as they always did. Reduced motion: one still frame,
 * the end state (the drone whole, the blueprint lit), under the still card.
 */
import { Box3, CatmullRomCurve3, Color, Group, Matrix4, type Object3D, Quaternion, Vector3 } from "three";
import type { StageContext } from "../three/stage";
import { blueprintLines, blueprintTargets, explodePieces, partBoxes, wallBlueprint } from "./hook-blueprint";
import { type DissolveUniforms, dissolveMaterials, lineGlow, type Particles, surfaceParticles } from "./hook-dissolve";
import { type HookRun, hookState } from "./hook-state";
import { DESK, ROOM, type Room } from "./room";

/** Every position, time and level of the hook, in one place to tune. */
export const HOOK_LOOK = {
	/** Where the drone stands: on the open sketchbook (its own design), facing the room. */
	drone: { x: DESK.book.x + 0.06, z: DESK.book.z, turn: 0 },
	/**
	 * The opening shot: behind the desk, clear of the lamp, looking across the dark room to the glass of the back wall,
	 * the drone on the right of the frame (the words are on the left; facing +z, screen right is -x).
	 */
	open: { camera: [-6.1, 1.1, -3.18] as const, target: [-5.79, 0.72, -0.2] as const, push: 0.08 },
	/** The pull-back after the lamp: over the drone and out into the room (then the room's own camera takes over). */
	pull: { via: [[-5.95, 1.78, -1.95], [-5.55, 1.62, 0.35]] as const, after: 1.0 },
	/** The stage's lights while the room is dark: a whisper of key, no fill, a cool rim that outlines the drone. */
	dark: { key: 0.05, fill: 0, rim: 1.5, rimColor: 0xbfe3ff },
	/** The dissolve: how long after its line appears it starts (s), how long the cut takes (s), its edge's colour. */
	dissolve: { after: 1, time: 3.6, edge: 0x6fdcff },
	/** The collapse into the line: how long (s) from its words, and the glow behind the line at its brightest. */
	collapse: { time: 1.6, glow: 0.55 },
	/** After the lamp line (s): the blueprint spreading out, and the reassembly. `spread`: how far apart it starts (m). */
	blueprint: { from: 0.3, to: 1.5, opacity: 0.85, colour: 0x7fe0ff },
	assemble: { from: 1.4, to: 4.6, spread: 0.32 },
	/** The faint blueprint on the wall, right of the logo: where, how big (m), how bright with the lamp on. */
	wall: { x: -4.45, y: 2.3, width: 0.95, height: 0.55, opacity: 0.45 },
	/** How many particles (fewer on the low tier). */
	particles: 4500,
	particlesLow: 1500,
	/** Seconds for the hand-back to the room's camera (and after Skip); scenes of scroll over which the drone goes away. */
	handBack: 1.1,
	skip: 0.8,
	away: 0.2,
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
/** 0 to 1 over [from, to] seconds, eased. */
const span = (t: number, from: number, to: number) => smoother(clamp01((t - from) / Math.max(1e-3, to - from)));

export function createHookScene(ctx: StageContext, room: Room): HookScene {
	const { camera } = ctx;
	const holder = new Group();
	holder.position.set(HOOK_LOOK.drone.x, DESK.top + 0.012, HOOK_LOOK.drone.z);
	holder.rotation.y = HOOK_LOOK.drone.turn;
	holder.visible = false;
	room.group.add(holder);
	let drone: Object3D | undefined;
	const cut: DissolveUniforms = { uHookCut: { value: 100 }, uHookEdge: { value: new Color(HOOK_LOOK.dissolve.edge) }, uHookAssemble: { value: 1 } };
	let particles: Particles | undefined;
	let glow: ReturnType<typeof lineGlow> | undefined;
	let blueprint: ReturnType<typeof blueprintLines> | undefined;
	let wall: ReturnType<typeof wallBlueprint> | undefined;
	const bounds = new Box3();
	const centre = new Vector3();

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
	const path = new CatmullRomCurve3([open.camera.clone().addScaledVector(forward, HOOK_LOOK.open.push * 0.75), ...HOOK_LOOK.pull.via.map((p) => new Vector3(...p))]);

	/** The drone, cloned from the bench's the first time (shared geometry), with its cut, particles and blueprint. */
	const prepare = () => {
		if (drone) return true;
		const source = room.stationDrone();
		if (!source) return false;
		drone = source.model.clone(true);
		holder.add(drone);
		holder.updateMatrixWorld(true);
		// Its own materials (the cut and the reassembly), the exploded view, the particles, the line's glow.
		dissolveMaterials(drone, cut);
		explodePieces(drone, HOOK_LOOK.assemble.spread);
		particles = surfaceParticles(drone, ctx.tier === "low" ? HOOK_LOOK.particlesLow : HOOK_LOOK.particles, cut);
		drone.add(particles.points);
		glow = lineGlow(particles.line);
		drone.add(glow.sprite);
		// The blueprint: the real part boxes from the CAD.
		const boxes = partBoxes(source.parts);
		const lo = Math.min(...boxes.map((b) => b[1]));
		const hi = Math.max(...boxes.map((b) => b[4]));
		blueprint = blueprintLines(boxes, lo, hi, HOOK_LOOK.blueprint.colour);
		drone.add(blueprint.lines);
		blueprintTargets(particles.points.geometry, boxes, lo, hi);
		wall = wallBlueprint(boxes, HOOK_LOOK.wall.width, HOOK_LOOK.wall.height);
		wall.panel.position.set(HOOK_LOOK.wall.x, HOOK_LOOK.wall.y, ROOM.z0 + 0.012);
		wall.panel.visible = false;
		room.group.add(wall.panel);
		return true;
	};

	const begin = (r: HookRun) => {
		if (!prepare()) {
			skipped = r;
			return;
		}
		run = r;
		holder.visible = true;
		wall!.panel.visible = true;
		holder.updateMatrixWorld(true);
		bounds.setFromObject(drone!, true);
		bounds.getCenter(centre);
		cut.uHookCut.value = bounds.max.y + 0.05;
		cut.uHookAssemble.value = 1;
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

	/** Everything at the end state: the drone whole, the effects gone, the wall's blueprint lit. */
	const settle = (top: number) => {
		cut.uHookCut.value = top;
		cut.uHookAssemble.value = 1;
		if (particles) particles.material.uniforms.uOpacity.value = 0;
		if (glow) glow.material.opacity = 0;
		if (blueprint) blueprint.material.uniforms.uOpacity.value = 0;
		if (wall) wall.material.opacity = HOOK_LOOK.wall.opacity;
	};

	return {
		update(_dt, position) {
			const current = hookState.run;
			if (current && current !== run && current !== skipped) begin(current);
			const top = bounds.max.y + 0.05;
			const bottom = bounds.min.y - 0.02;
			if (onDesk && !run) {
				// After the words: the drone goes away as the camera leaves the title (and is gone from there on).
				const away = smoother(clamp01((position - 0.02) / HOOK_LOOK.away));
				cut.uHookCut.value = top - (top - bottom) * away;
				if (wall) wall.material.opacity = HOOK_LOOK.wall.opacity * (1 - away);
				if (away >= 1) {
					onDesk = false;
					holder.visible = false;
					if (wall) wall.panel.visible = false;
				}
			}
			if (!run) return;
			const now = performance.now();
			const t = (now - run.start) / 1000;
			const end = run.end / 1000;
			const lampAt = (run.lines[run.lamp] ?? 0) / 1000;
			const skipping = run.ended !== undefined;

			// The camera: behind the desk, pushing in a touch; after the lamp, it pulls back over the drone into the room;
			// at the end (or after Skip) it hands back to the room's own camera.
			const pullFrom = lampAt + HOOK_LOOK.pull.after;
			const pullTo = end - HOOK_LOOK.handBack;
			const pull = run.still ? 0 : span(t, pullFrom, pullTo);
			if (pull > 0) path.getPoint(pull, eye);
			else eye.copy(open.camera).addScaledVector(forward, HOOK_LOOK.open.push * 0.75 * smoother(clamp01(t / Math.max(1, pullFrom))));
			look.lerpVectors(open.target, centre, smoother(clamp01(pull * 1.6)));
			let w = run.still ? 0 : span(t, pullTo, end);
			if (skipping) w = Math.max(w, span((now - run.ended!) / 1000, 0, HOOK_LOOK.skip));
			engineAt.copy(camera.position);
			engineQ.copy(camera.quaternion);
			aimQ.setFromRotationMatrix(aim.lookAt(eye, look, camera.up)); // (a camera looks down its -z)
			camera.position.lerpVectors(eye, engineAt, w);
			camera.quaternion.slerpQuaternions(aimQ, engineQ, w);

			// The lights: dark until the lamp line, then back to the room's own as the lamp comes up.
			const lamp = run.still ? 0 : clamp01((t - lampAt) / 1.6);
			restoreLights(skipping ? Math.max(lamp, w) : lamp);

			if (run.still || skipping) {
				// Reduced motion: the end state, still. Skip: straight to it while the camera hands back.
				settle(top);
				if (run.still && blueprint) {
					blueprint.material.uniforms.uReveal.value = 1;
					blueprint.material.uniforms.uSolid.value = 0;
					blueprint.material.uniforms.uOpacity.value = 0.6;
				}
			} else {
				// The dissolve, then (after the lamp line) the reassembly, bottom to top.
				const dissolveAt = (run.lines[0] ?? 0) / 1000 + HOOK_LOOK.dissolve.after;
				const swept = span(t, dissolveAt, dissolveAt + HOOK_LOOK.dissolve.time);
				const assembleFrom = lampAt + HOOK_LOOK.assemble.from;
				const solid = span(t, assembleFrom, lampAt + HOOK_LOOK.assemble.to);
				if (t < assembleFrom) {
					cut.uHookCut.value = top - (top - bottom) * swept;
					cut.uHookAssemble.value = 1;
				} else {
					cut.uHookCut.value = top;
					cut.uHookAssemble.value = solid;
				}
				// The line, then the blueprint it spreads into; both fade as the parts seat.
				const collapse = clamp01((t - (run.lines[1] ?? 0) / 1000) / HOOK_LOOK.collapse.time);
				const blue = span(t, lampAt + HOOK_LOOK.blueprint.from, lampAt + HOOK_LOOK.blueprint.to);
				if (glow) glow.material.opacity = HOOK_LOOK.collapse.glow * smoother(collapse) * (0.85 + 0.15 * Math.sin(t * 2.2)) * (1 - blue);
				if (particles) {
					const u = particles.material.uniforms;
					u.uCollapse.value = collapse;
					u.uBlue.value = blue;
					u.uSolid.value = solid;
					u.uTime.value = t;
					u.uAfter.value = Math.max(0, t - dissolveAt - HOOK_LOOK.dissolve.time);
					u.uOpacity.value = 0.9;
				}
				if (blueprint) {
					const u = blueprint.material.uniforms;
					u.uReveal.value = blue;
					u.uSolid.value = solid;
					u.uOpacity.value = HOOK_LOOK.blueprint.opacity;
				}
				if (wall) wall.material.opacity = HOOK_LOOK.wall.opacity * lamp;
			}

			if (w >= 1) {
				restoreLights(1);
				settle(top);
				run = undefined;
			}
		},
		busy: () => !!run,
		dispose() {
			if (run) restoreLights(1);
			holder.removeFromParent();
			wall?.panel.removeFromParent();
		},
	};
}
