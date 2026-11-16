/**
 * The KitBot's drive on the 2026 field in the FRC chapter (src/lib/three/models/frc-chapter.ts): where the robot is at
 * each point of the scroll. It drives a short curve in its alliance zone, shoots a stream of FUEL into its HUB, then
 * turns in place for its close-ups. Pure functions of the camera's position in stops, so scrolling back plays it back.
 *
 * Field space: metres, x along the field's length (the blue alliance wall at -x), z across it, y up; the field's centre
 * at the origin. A heading is radians from +z toward +x. The robot's own space has it at the origin facing +z, so the
 * chapter moves the field under the robot (fieldTransform), and the camera's framing of the robot never changes.
 */

/** The field: its size, and the HUB's centre on the x axis (blue at -x), its footprint and the height of its opening. */
export const FIELD = { length: 16.54, width: 8.07 };
export const HUB = { x: -4.24, size: 1.19, top: 1.83 };

export interface Spot {
	x: number;
	z: number;
}

/** The heading that faces the blue HUB from `p`. */
export const aimAt = (p: Spot) => Math.atan2(HUB.x - p.x, -p.z);

const deg = (d: number) => (d * Math.PI) / 180;

/**
 * The drive, in field space; when each part happens, in stops (0 the prologue, 1 the stakes, 2 the reveal, 3 on the
 * part-by-part stops). Tune here.
 */
export const DRIVE = {
	// From the middle of its alliance zone, out toward the guardrail side, clear of the HUB (whose z is ±0.6): there the
	// close-up cameras, about 2 m out, stay on the field and never look through the HUB.
	from: { x: -7.0, z: -1.25, heading: deg(18) },
	to: { x: -6.55, z: 1.95 },
	/** After the shot, it turns in place this far (radians) for its close-ups: round to face its own drivers (-x). */
	turnBy: deg(139.8),
	drive: [0.08, 0.86] as const,
	shot: [0.78, 1.5] as const,
	turn: [1.32, 2.15] as const,
	/** How far out the curve leaves its start and arrives at the shot spot, as a share of the straight distance. */
	bend: 0.42,
	/** The stream of FUEL: how many balls, how far apart along the arc, how high it rises above the straight line. */
	balls: 5,
	gap: 0.17,
	lift: 1.05,
	/** Where FUEL leaves the robot: the top of the hood, in the robot's space (x across, y up, z forward), metres. */
	launcher: [0, 0.56, 0.225] as const,
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smootherstep = (x: number) => x * x * x * (x * (6 * x - 15) + 10);
const phase = (s: number, [a, b]: readonly [number, number]) => smootherstep(clamp01((s - a) / (b - a)));

/* The curve: a cubic Bézier from the start (leaving along its heading) to the shot spot (arriving facing the HUB),
   walked at an even speed through a table of its lengths. */
const end = aimAt(DRIVE.to);
const span = Math.hypot(DRIVE.to.x - DRIVE.from.x, DRIVE.to.z - DRIVE.from.z) * DRIVE.bend;
const P = [
	[DRIVE.from.x, DRIVE.from.z],
	[DRIVE.from.x + Math.sin(DRIVE.from.heading) * span, DRIVE.from.z + Math.cos(DRIVE.from.heading) * span],
	[DRIVE.to.x - Math.sin(end) * span, DRIVE.to.z - Math.cos(end) * span],
	[DRIVE.to.x, DRIVE.to.z],
];
const bezier = (t: number, d: 0 | 1) => {
	const u = 1 - t;
	return u * u * u * P[0][d] + 3 * u * u * t * P[1][d] + 3 * u * t * t * P[2][d] + t * t * t * P[3][d];
};
const tangent = (t: number, d: 0 | 1) => {
	const u = 1 - t;
	return 3 * u * u * (P[1][d] - P[0][d]) + 6 * u * t * (P[2][d] - P[1][d]) + 3 * t * t * (P[3][d] - P[2][d]);
};
const STEPS = 96;
const lengths = [0];
for (let i = 1; i <= STEPS; i++) {
	const a = (i - 1) / STEPS;
	const b = i / STEPS;
	lengths.push(lengths[i - 1] + Math.hypot(bezier(b, 0) - bezier(a, 0), bezier(b, 1) - bezier(a, 1)));
}
/** The path's length, metres. */
export const PATH_LENGTH = lengths[STEPS];
/** The curve's parameter at a share `f` of its length. */
const atLength = (f: number) => {
	const want = f * PATH_LENGTH;
	let i = 1;
	while (i < STEPS && lengths[i] < want) i++;
	const k = (want - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
	return (i - 1 + clamp01(k)) / STEPS;
};

export interface Pose extends Spot {
	heading: number;
	/** Metres driven along the path so far (the wheels roll by this). */
	travelled: number;
}

/** Where the robot is when the camera is at `s` stops. */
export function poseAt(s: number): Pose {
	const f = phase(s, DRIVE.drive);
	const t = atLength(f);
	// The start and the end headings exactly; in between, along the curve.
	const heading = f <= 0 ? DRIVE.from.heading : f >= 1 ? end : Math.atan2(tangent(t, 0), tangent(t, 1));
	return {
		x: f >= 1 ? DRIVE.to.x : bezier(t, 0),
		z: f >= 1 ? DRIVE.to.z : bezier(t, 1),
		heading: heading + DRIVE.turnBy * phase(s, DRIVE.turn),
		travelled: f * PATH_LENGTH,
	};
}

/** The field's rotation about y and position that put the robot at the origin facing +z (three.js order: turn, then move). */
export function fieldTransform(p: Pose) {
	const c = Math.cos(p.heading);
	const n = Math.sin(p.heading);
	return { rotationY: -p.heading, x: -(p.x * c - p.z * n), z: -(p.x * n + p.z * c) };
}

/** A point of the field (x, z) in the robot's own space. */
export function toRobot(p: Pose, x: number, z: number) {
	const t = fieldTransform(p);
	const c = Math.cos(t.rotationY);
	const n = Math.sin(t.rotationY);
	return { x: x * c + z * n + t.x, z: -x * n + z * c + t.z };
}

/** The shot's arc in field space, from the hood (u = 0) to just above the HUB's opening (u = 1). */
export function shotPoint(u: number): [number, number, number] {
	const [, y0, ahead] = DRIVE.launcher;
	const x0 = DRIVE.to.x + Math.sin(end) * ahead;
	const z0 = DRIVE.to.z + Math.cos(end) * ahead;
	const y1 = HUB.top + 0.12;
	return [x0 + (HUB.x - x0) * u, y0 + (y1 - y0) * u + 4 * DRIVE.lift * u * (1 - u), z0 + (0 - z0) * u];
}

/** The stream of FUEL at `s` stops: each ball's place along the arc (0 to 1) and whether it is in the air. */
export function ballsAt(s: number) {
	const p = clamp01((s - DRIVE.shot[0]) / (DRIVE.shot[1] - DRIVE.shot[0]));
	const reach = 1 + (DRIVE.balls - 1) * DRIVE.gap;
	return Array.from({ length: DRIVE.balls }, (_, k) => {
		const u = p * reach - k * DRIVE.gap;
		return { u, visible: u > 0 && u < 1 };
	});
}
