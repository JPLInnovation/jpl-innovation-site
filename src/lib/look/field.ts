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
 * The camera's flight over the floor: the scroll (0 to 1 down the page) carries it forward, lifts it from eye height
 * to over the drawing, tilts it down onto the drawing and turns it a little, so the page's end looks down at the drawing
 * the pen has finished; the pointer (-1 to 1 each way) leans it.
 */
export function cameraFor(scrollProgress: number, pointer: { x: number; y: number }): { height: number; pitch: number; yaw: number; drift: number; lean: [number, number] } {
	const p = Math.min(1, Math.max(0, scrollProgress));
	const e = smooth(p);
	return {
		height: 1.6 + (4.2 - 1.6) * e,
		pitch: 0.18 + (0.62 - 0.18) * e,
		yaw: -0.22 + (0.3 + 0.22) * e,
		drift: p * 26,
		lean: [pointer.x * 0.04, pointer.y * 0.04],
	};
}

/**
 * The frame meter: decides, a second of drawing at a time, whether the field should draw fewer pixels, more, or give up
 * for the still picture. The screen's own frame interval is not known, so it is taken as a low percentile of the last
 * frames (one stray short gap can't fake it, and a move to a slower screen is learnt within a second); frames are
 * judged against it, so 60 Hz and 240 Hz screens are both "on time" at their own rate. Under 25 fps is slow whatever
 * the screen. Long frames count (capped), they are never dropped: a device at 5 fps must fall back too.
 */
export type Meter = { scale: number; last: number; spent: number; frames: number; recent: number[]; slowWindows: number };

const WINDOW_MS = 1000;
const HISTORY = 60; // frames the screen's interval is learnt from
const FLOOR_MS = 40; // an average frame slower than this (under 25 fps) is slow on any screen
const CAP_MS = 250; // one frame counts at most this much (a hitch, not a pause: pauses reset the meter)
const MIN_BASELINE_MS = 3.5; // no screen refreshes faster than ~285 Hz

export function newMeter(scale = 1): Meter {
	return { scale, last: 0, spent: 0, frames: 0, recent: [], slowWindows: 0 };
}

/** On every wake (tab shown again, a page change, motion allowed again): the next frame starts the clock. */
export function resetMeter(m: Meter): void {
	m.last = 0;
	m.spent = 0;
	m.frames = 0;
	m.recent = [];
	m.slowWindows = 0;
}

/** One frame at `now` (the frame's own timestamp). `active`: drawn at full rate (scrolling or pointing), not idle. */
export function tickMeter(m: Meter, now: number, active: boolean): "ok" | "rescale" | "fallback" {
	if (!m.last) {
		m.last = now;
		return "ok";
	}
	const interval = Math.min(CAP_MS, now - m.last);
	m.last = now;
	if (!active || interval <= 0) return "ok";
	m.recent.push(interval);
	if (m.recent.length > HISTORY) m.recent.shift();
	m.spent += interval;
	m.frames++;
	if (m.spent < WINDOW_MS) return "ok";
	const average = m.spent / m.frames;
	m.spent = 0;
	m.frames = 0;
	const sorted = [...m.recent].sort((a, b) => a - b);
	const baseline = Math.max(MIN_BASELINE_MS, sorted[Math.floor(sorted.length * 0.05)]);
	// 10 means "on time" at the screen's own rate; nextScale steps down above 12 and up below 7.
	let normalised = (10 * average) / baseline - 4;
	if (average > FLOOR_MS) normalised = Math.max(normalised, 20);
	const before = m.scale;
	m.scale = nextScale(m.scale, normalised);
	m.slowWindows = m.scale === 0.5 && normalised > SLOW_MS ? m.slowWindows + 1 : 0;
	if (shouldFallBack(m.slowWindows)) return "fallback";
	return m.scale !== before ? "rescale" : "ok";
}
