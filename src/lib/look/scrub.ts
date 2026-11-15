/**
 * The home page's live thing (src/components/home/Scrubber.astro): one drag, or the arrow keys, takes the F450 from its
 * sketch (t = 0), through its CAD render (0.5), to the built drone (1). Pure, so `npm test` covers it.
 */

export type Stage = 0 | 1 | 2;

const clamp = (t: number) => (Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0);

/** Which stage `t` has reached, and how far (0..1) it is into the next one. */
export function scrubStage(t: number): { stage: Stage; mix: number } {
	const s = clamp(t) * 2;
	const stage = Math.min(2, Math.floor(s)) as Stage;
	return { stage, mix: stage === 2 ? 0 : s - stage };
}

/** The stage mostly showing: what a screen reader hears and the caption names. */
export const nearestStage = (t: number) => Math.round(clamp(t) * 2) as Stage;

const STEP = 0.05;
const grid = (t: number) => Math.round(clamp(t) * 100) / 100;

/** Where a key press moves `t`; null for keys the scrubber leaves alone. */
export function scrubKey(t: number, key: string): number | null {
	switch (key) {
		case "ArrowRight":
		case "ArrowUp":
			return grid(t + STEP);
		case "ArrowLeft":
		case "ArrowDown":
			return grid(t - STEP);
		case "PageUp":
			return Math.min(1, (Math.floor(clamp(t) * 2 + 1e-9) + 1) / 2);
		case "PageDown":
			return Math.max(0, (Math.ceil(clamp(t) * 2 - 1e-9) - 1) / 2);
		case "Home":
			return 0;
		case "End":
			return 1;
		default:
			return null;
	}
}

/**
 * How each of the three pictures stands at `t` (transform and opacity only):
 *   tilt  the sketch's page lying back, 0..1 (the script turns it into degrees)
 *   lift  the CAD render still rising out of the page, 1..0
 *   dark  the built drone's lights still to come up, 1..0
 */
export function scrubLayers(t: number): Array<{ opacity: number; tilt: number; lift: number; dark: number }> {
	const a = Math.min(1, clamp(t) * 2); // sketch -> CAD
	const b = Math.max(0, clamp(t) * 2 - 1); // CAD -> built
	return [
		{ opacity: 1 - a, tilt: a, lift: 0, dark: 0 },
		{ opacity: b > 0 ? 1 - b : a, tilt: 0, lift: 1 - a, dark: 0 },
		{ opacity: b, tilt: 0, lift: 0, dark: 1 - b },
	];
}
