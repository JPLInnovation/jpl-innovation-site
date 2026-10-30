/**
 * What the opening hook's words are doing, for the 3D that plays under them (hook B). The words' own script
 * (src/scripts/studio-hook.ts) says when a run starts, when each line comes up, and when it ends; the studio's engine
 * (engine.ts) reads it every frame and, when HOOK_3D is on, hands the camera to the hook's scene (hook-scene.ts) while
 * a run plays. With no run playing, nothing in the engine changes (scripts/home-regression.py checks it).
 */

/** The 3D under the opening words. Off: the words play over the dark room, as before. */
export const HOOK_3D = true;

export interface HookRun {
	/** performance.now() when the words began. */
	start: number;
	/** ms after `start` that each played line comes up (the heading is up from 0). */
	lines: number[];
	/** Which of `lines` turns the lamp on. */
	lamp: number;
	/** ms after `start` when the words would end by themselves. */
	end: number;
	/** Reduced motion: the words are a still card, the 3D one still frame. */
	still: boolean;
	/** performance.now() when the run ended (by itself, Skip, Escape or a scroll), once it has. */
	ended?: number;
}

export const hookState: { run?: HookRun } = {};

export function hookStarted(run: HookRun) {
	hookState.run = run;
}

export function hookEnded() {
	if (hookState.run && hookState.run.ended === undefined) hookState.run.ended = performance.now();
}
