/**
 * The 2026 KitBot for the FRC page's scroll showcase (src/components/showcase.tsx, words in src/text/showcase/robot.ts):
 * the same robot as the plain 3D viewer (./frc-robot.ts), a camera stop per feature, and every CAD part tagged with
 * the feature it belongs to so the rest of the robot can fade back (src/lib/three/showcase.ts).
 *
 * frc-robot-cad.json has no part names, so the parts are sorted by what the CAD does give, in this order:
 *   1. rotor: the two intake rollers -> intake; the launcher and feeder shafts -> shooter (with everything on them)
 *   2. the see-through material -> hopper
 *   3. the blue bumper material -> no feature (they're in every view)
 *   4. the orange signal light (the CAD's only orange part) and what touches it -> electronics
 *   5. a box around the battery anchor (the battery and its mount) -> electronics
 *   6. the electronics board under the hopper and everything on it (the power hub among them) -> electronics
 *   7. tall thin plates (the shooter's side plates) -> no feature: structure, like the frame
 *   8. the intake's ramp panels (their light grey, low down) and anything else low at the front -> intake
 *   9. anything else high up (hood, its spacers, the motors and belt that drive the shooter) -> shooter
 *  10. anything else low (wheels, belts, gears, the CIM motors, the aluminium frame) -> drivetrain
 * Anything left is the rest of the frame: it fades back on every stop but the first. The boxes are in metres, in the
 * robot's space (y up, intake toward +z, wheels on y = 0); if the CAD changes, check them with
 * window.__showcase.go(n) on /work/frc/.
 */
import type { ShowcaseModel, ShowcaseStop } from "../showcase";
import type { StageContext, StageView } from "../stage";
import { buildRobot, robotAnchors, type RobotPart } from "./frc-robot";

type V3 = [number, number, number];

const BUMPER = "#1651b0";
const SIDE_PLATE = "#a5a5a5"; // the shooter's side plates (and the motor shafts, which share the colour)
const RAMP = "#eaeaea"; // the intake ramp panels, and the hood's cross bars higher up
const ORANGE = "#f88701"; // the signal light

/**
 * How each stop frames its parts (the box around everything with that feature; the whole robot for the overview).
 * `at` (where the camera aims) and `label` are points in the box: -1..1 across it on each axis, with ±1 for the label
 * meaning just outside that face. `from` is the direction the camera looks from, as an offset from `at`; how far back
 * it sits is worked out for the stage, so the whole robot always fits and no part is cut off
 * (src/lib/three/showcase.ts).
 */
const FRAMING: Record<string, { at?: V3; from: V3; label: V3; distance?: number }> = {
	// The FRC chapter's opening beats (src/components/FrcChapter.astro, ./frc-chapter.ts): low at the front in the dark,
	// close on the launcher and its hood, then the other three-quarter view as the lights come up.
	prologue: { at: [0, -0.25, 0.2], from: [0.42, 0.1, 1.5], label: [0, 1.2, 0] },
	stakes: { at: [0, 0.2, 0.3], from: [0.75, 0.38, 0.9], label: [0.6, 1.25, 0.4], distance: 0.95 },
	reveal: { at: [0, -0.1, 0], from: [-1.25, 0.7, 1.3], label: [-0.55, 1.1, 0.6] },
	overview: { at: [0, -0.15, 0], from: [1.18, 0.78, 1.3], label: [0.55, 1.1, -0.6] }, // the 3D viewer's three-quarter view
	intake: { at: [0, -0.3, 0], from: [0.55, 0.12, 1.3], label: [-0.7, 1.4, 0.5] }, // low at the front
	hopper: { from: [-0.6, 0.95, -1.0], label: [0.6, 1.2, -0.6] }, // high at the back, looking down into it
	shooter: { from: [1.45, 0.15, 0.12], label: [1.1, 1.25, 0] }, // from the side, through the side plates
	drivetrain: { at: [0, 0, 0], from: [1.65, 0.16, 0.8], label: [0.9, 1.6, 0.6] }, // low at the side, through the bumpers
	electronics: { at: [0, -0.2, 0], from: [0.8, 1.05, -0.95], label: [0.5, 1.4, -0.9] }, // high at the back
};

const LABEL_GAP = 0.02; // metres outside a face, for label coordinates of ±1

/** Only the camera before the model has loaded; the showcase moves it straight to the right stop. */
export const view: StageView = { camera: [1.3, 0.95, 1.45], target: [0, 0.22, 0], fov: 34, orbit: false };

/** Where the FUEL is (seconds into its 5 s loop, see frc-robot.ts) in each stop's still. */
const POSE: Record<string, number> = { overview: 2, intake: 0.85, hopper: 1.9, shooter: 2.65, stakes: 2.65, reveal: 2 };
/** Stops that frame another stop's parts (the chapter's stakes look at the launcher). */
const LOOKS_AT: Record<string, string> = { stakes: "shooter" };

const inside = (p: RobotPart, lo: V3, hi: V3) => [0, 1, 2].every((d) => p.lo[d] >= lo[d] && p.hi[d] <= hi[d]);
const touches = (a: RobotPart, b: RobotPart, gap: number) =>
	[0, 1, 2].every((d) => a.lo[d] <= b.hi[d] + gap && b.lo[d] <= a.hi[d] + gap);
const center = (p: RobotPart, d: number) => (p.lo[d] + p.hi[d]) / 2;
const size = (p: RobotPart, d: number) => p.hi[d] - p.lo[d];

/** The feature id for every part, in CAD order ("" = the frame). See the list at the top. */
function classify(parts: RobotPart[], battery: V3): string[] {
	const light = new Set(parts.filter((p) => p.color === ORANGE));
	for (const p of parts) if (Math.max(size(p, 0), size(p, 1), size(p, 2)) < 0.1 && [...light].some((l) => touches(p, l, 0.003))) light.add(p);
	return parts.map((p) => {
		if (p.rotor === 0 || p.rotor === 1) return "intake";
		if (p.rotor >= 2) return "shooter";
		if (p.clear) return "hopper";
		if (p.color === BUMPER) return "";
		if (light.has(p)) return "electronics";
		if (inside(p, [battery[0] - 0.14, 0.06, battery[2] - 0.11], [battery[0] + 0.14, 0.26, battery[2] + 0.11])) return "electronics";
		if (inside(p, [-0.34, 0.15, -0.32], [0.34, 0.25, 0])) return "electronics"; // the board under the hopper
		if (size(p, 0) < 0.01 && size(p, 1) > 0.3) return "";
		if (p.color === RAMP && center(p, 1) < 0.3) return "intake";
		if (inside(p, [-0.3, 0.15, 0.17], [0.3, 0.32, 1])) return "intake";
		if (center(p, 1) > 0.3 && Math.abs(center(p, 0)) < 0.3) return "shooter";
		if (p.hi[1] < 0.23) return "drivetrain";
		return "";
	});
}

/** `ids`: the features in the order the page shows them. */
export default async function createRobotShowcase(ctx: StageContext, ids: string[]): Promise<ShowcaseModel> {
	const groups = new Map<string, RobotPart[]>();
	const rig = await buildRobot(ctx.root, (parts) => {
		const names = classify(parts, robotAnchors.battery);
		parts.forEach((p, i) => groups.set(names[i], [...(groups.get(names[i]) ?? []), p]));
		return names.map((name) => Math.max(0, ids.indexOf(name)));
	});

	const all = [...groups.values()].flat();
	const around = (parts: RobotPart[]) => ({
		lo: [0, 1, 2].map((d) => Math.min(...parts.map((p) => p.lo[d]))) as V3,
		hi: [0, 1, 2].map((d) => Math.max(...parts.map((p) => p.hi[d]))) as V3,
	});
	const point = ({ lo, hi }: { lo: V3; hi: V3 }, rel: V3, gap = 0) =>
		rel.map((r, d) => (lo[d] + hi[d]) / 2 + r * ((hi[d] - lo[d]) / 2 + gap)) as V3;

	const stops: ShowcaseStop[] = ids.map((id) => {
		const framing = FRAMING[id] ?? FRAMING.overview;
		const own = id === "overview" ? undefined : groups.get(LOOKS_AT[id] ?? id);
		const box = around(own?.length ? own : all);
		const target = point(box, framing.at ?? [0, 0, 0]);
		return {
			target,
			camera: target.map((v, d) => v + framing.from[d]) as V3,
			label: point(box, framing.label, LABEL_GAP),
			distance: framing.distance,
		};
	});

	// From the side, the bumpers hide the wheels and the side plates hide the feeder and launcher, so on those stops
	// they turn almost clear. They're drawn as see-through from the start, at full opacity, so the change never has to
	// rebuild a shader.
	const ghosts = [
		{ stop: ids.indexOf("drivetrain"), materials: [...rig.materials(BUMPER), ...rig.materials("numbers")] },
		{ stop: ids.indexOf("shooter"), materials: rig.materials(SIDE_PLATE) },
	].filter((g) => g.stop >= 0);
	for (const g of ghosts) for (const m of g.materials) m.transparent = true;
	// FUEL belongs to the intake, the hopper and the shooter: it leaves the picture for the drivetrain and electronics.
	const fuelStops = ["stakes", "reveal", "overview", "intake", "hopper", "shooter"].map((id) => ids.indexOf(id)).filter((n) => n >= 0);
	let fuel = true;
	// The opening beat: one ball of FUEL rides the whole way through as the section scrolls into place (off the floor,
	// up the intake, into the hopper, through the feeder and launcher, up the hood and out), then the loop takes over.
	let intro = 1;
	const hideFuel = () => {
		if (intro < 1) {
			rig.pose(intro * 3.95);
			rig.balls[1].visible = false;
		}
		if (!fuel) for (const ball of rig.balls) ball.visible = false; // after the loop has placed (and shown) them
	};

	return {
		stops,
		floor: 0,
		opening(progress) {
			intro = progress;
			hideFuel();
		},
		focus(weights) {
			for (const g of ghosts) {
				const clear = weights[g.stop];
				for (const m of g.materials) {
					m.opacity = 1 - (m.map ? 0.9 : 0.82) * clear;
					m.depthWrite = !m.map && clear < 0.05;
				}
			}
			let shown = 0;
			for (const n of fuelStops) shown += weights[n];
			fuel = shown > 0.5;
			hideFuel();
		},
		pose(stop) {
			intro = 1;
			const t = POSE[ids[stop]];
			if (t !== undefined) rig.pose(t);
			hideFuel();
		},
		update(t, dt) {
			rig.animate(t, dt);
			hideFuel();
		},
		applyPalette: (p) => rig.applyPalette(p),
	};
}
