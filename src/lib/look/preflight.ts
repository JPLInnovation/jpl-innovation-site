/**
 * The Pre-flight hook's clock (src/scripts/preflight.ts plays it; spec §11). Seconds from the start of the hook.
 *
 *   arming   0 → 2.6 s: the F450 draws itself part by part, the boot log runs, the altitude climbs 000 → 120 m
 *   prompt   at PROMPT_AT: "Click, scroll or press any key to take off."
 */

/** The climb: rotors spin up first, then 0 → 120 m, settling into cruise. */
export const CLIMB = { start: 0.35, end: 2.45, top: 120 };
/** When the take-off prompt is up (the rule: under 4 s). */
export const PROMPT_AT = 2.7;
/** When each line of the boot log appears (one per check in src/text/site.ts `preflight.checks`). */
const BOOT_AT = [0.55, 0.95, 1.35, 1.75, 2.15];
export const BOOT_LINES = BOOT_AT.length;

/** Ease in and out (cubic): slow off the ground, fast in the middle, slow into cruise. */
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

/** The altitude at `t` in metres, unrounded (the counter's drums roll through the fractions). */
export function climbAt(t: number): number {
	const k = Math.min(1, Math.max(0, (t - CLIMB.start) / (CLIMB.end - CLIMB.start)));
	return ease(k) * CLIMB.top;
}

/** The altitude at `t`, in whole metres. */
export function altitudeAt(t: number): number {
	return Math.round(climbAt(t));
}

/**
 * Where each drum of a three-digit counter stands for `metres` (hundreds, tens, ones), as a mechanical altimeter rolls:
 * the ones drum turns all the time; a higher drum turns only while the one below it goes from 9 to 0. A drum's position
 * runs 0..10, where 10 is its 0 again (each drum carries digits 0-9 and then 0).
 */
export function drumsAt(metres: number): [number, number, number] {
	const v = Math.max(0, metres);
	const carry = (step: number) => Math.max(0, (v % step) - (step - 1)); // 0..1 while the drums below roll over
	return [(Math.floor(v / 100) % 10) + carry(100), (Math.floor(v / 10) % 10) + carry(10), v % 10];
}

/** How many lines of the boot log are showing at `t`. */
export function bootLine(t: number): number {
	return BOOT_AT.filter((at) => t >= at).length;
}
