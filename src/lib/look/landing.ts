/**
 * "Land the drone", the footer's game (spec §11): one axis, in metres and seconds. The F450 starts at the ceiling;
 * throttle pushes it up, gravity pulls it down, and it has to touch the H pad under 1.5 m/s.
 *
 * Real gravity (9.8 m/s²) and the throttle's 14 m/s² are both scaled by SCALE, so the ratio between them is the real
 * one but the flight lasts long enough to fly by hand in a panel this size (a drop from the top takes about 2.8 s; a good landing uses about half the tank).
 */
export interface State {
	y: number; // height of the skids above the ground, m
	vy: number; // vertical speed, m/s (up is positive)
	fuel: number; // seconds of throttle left
}
export interface Pad {
	y: number; // height of the pad's top, m
}

export const SCALE = 0.4;
export const GRAVITY = 9.8 * SCALE;
export const THRUST = 14 * SCALE;
export const FUEL = 6;
export const CEILING = 15;
/** A touchdown slower than this (m/s) is a soft landing. */
export const SOFT = 1.5;

export const start = (): State => ({ y: CEILING, vy: 0, fuel: FUEL });

/** One tick of flight (semi-implicit Euler). Throttle only lifts while there is fuel; it never climbs past the ceiling. */
export function step(s: State, throttle: boolean, dt: number): State {
	const burn = throttle ? Math.min(s.fuel, dt) : 0;
	const vy = s.vy - GRAVITY * dt + THRUST * burn;
	const y = s.y + vy * dt;
	return y > CEILING ? { y: CEILING, vy: Math.min(vy, 0), fuel: s.fuel - burn } : { y, vy, fuel: s.fuel - burn };
}

/** null while it is above the pad; then "soft" under SOFT m/s, "hard" otherwise. */
export function landed(s: State, pad: Pad): "soft" | "hard" | null {
	if (s.y > pad.y) return null;
	return -s.vy < SOFT ? "soft" : "hard";
}
