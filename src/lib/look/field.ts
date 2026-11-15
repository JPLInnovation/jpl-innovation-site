/**
 * The blueprint space's decisions (src/scripts/blueprint.ts draws it): how sharp to draw, when to give up for the
 * still picture, when to draw at all, and where the camera is. Pure, so `npm test` covers it.
 */

const MIN_SCALE = 0.5;
const SLOW_MS = 12; // average frame above this: draw fewer pixels
const FAST_MS = 7; // below this: try a few more
const TARGET_MS = 10;

/** Dynamic resolution: one proportional step down when frames run slow, a small step up when they run fast. */
export function nextScale(scale: number, frameMs: number): number {
	if (frameMs > SLOW_MS) return Math.max(MIN_SCALE, scale * Math.sqrt(TARGET_MS / frameMs));
	if (frameMs < FAST_MS) return Math.min(1, scale * 1.1);
	return scale;
}

/** After three slow one-second windows in a row at the lowest resolution, show the still picture instead. */
export function shouldFallBack(slowWindows: number): boolean {
	return slowWindows >= 3;
}

/** Draw only when the tab is visible, motion is allowed, and the page has no full-window 3D of its own. */
export function shouldAnimate(s: { hidden: boolean; reduced: boolean; ownBackdrop: boolean }): boolean {
	return !s.hidden && !s.reduced && !s.ownBackdrop;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * The camera over the grid floor: the scroll (0 to 1 down the page) carries it forward and tilts it a little further
 * down; the pointer (-1 to 1 each way) leans it.
 */
export function cameraFor(scrollProgress: number, pointer: { x: number; y: number }): { height: number; pitch: number; drift: number; lean: [number, number] } {
	const p = Math.min(1, Math.max(0, scrollProgress));
	return {
		height: 1.6,
		pitch: 0.18 + (0.32 - 0.18) * smooth(p),
		drift: p * 40,
		lean: [pointer.x * 0.04, pointer.y * 0.04],
	};
}
