/**
 * The hopper extension's swing, tied to the scroll (./frc-robot-showcase.ts). Measured from the CAD (the pose it was
 * exported in is open): SWING degrees about the hinge brings the extension's back plate parallel to the fixed panel's top
 * edge and its bottom plate parallel to the rear edge. The grooves run 90 degrees, so the clamps stop short of their end.
 * Stowed, its weight sits forward of the hinge, so it has to be lifted JOLT degrees before it can fall open.
 */
export const SWING = 85;
const JOLT = 26;
const SETTLE = 5; // degrees: how big the one rebound off the open stop is, before its damping
const FELL = 0.2; // share of the way: the jolt ends here
const LANDED = 0.82; // share of the way: the fall ends here

/** Degrees from open: `open` 0 is stowed (SWING), `open` 1 is open (0). The same curve plays backward on the way up. */
export function extensionAngle(open: number): number {
	const p = Math.min(1, Math.max(0, open));
	if (p < FELL) {
		const u = 1 - p / FELL;
		return SWING - JOLT * (1 - u * u); // quick, slowing as it tops out
	}
	if (p < LANDED) {
		const u = (p - FELL) / (LANDED - FELL);
		return (SWING - JOLT) * (1 - u * u); // accelerates all the way to the stop
	}
	const v = (p - LANDED) / (1 - LANDED);
	return SETTLE * Math.sin(Math.PI * v) * (1 - v); // one small rebound, gone by the end
}
