/**
 * Shared engine for the logo intros (IntroSplash on most pages, FrcSplash on the FRC page).
 * Markup and shared CSS: src/components/SplashShell.astro. Each intro supplies its own timeline via runSplash().
 *
 * It handles everything the two have in common:
 *   - one clock: every animation is created up front (Web Animations API), so Skip = finish them all, and in
 *     development the timeline can be frozen at any moment with window.__splash.seek(seconds)
 *   - the version (SplashShell's head script chose it, see src/lib/splash.ts): intro-full plays the timeline at
 *     its written speed, intro-fast plays the very same timeline faster (every animation's playbackRate)
 *   - Skip: the button, a click or tap anywhere, any key, or a scroll
 *   - prefers-reduced-motion: no movement, just a quick 300 ms fade
 *   - a tab opened in the background waits until it's visible; a script that arrives very late doesn't start
 *   - clean-up: overlay removed, page classes reset, nothing left running
 */

export type Frames = Keyframe[];

/** Ease curves (GSAP equivalents in the comments). Nothing is linear. */
export const E = {
	out: "cubic-bezier(0.25, 1, 0.5, 1)", // power3.out
	out2: "cubic-bezier(0.33, 1, 0.68, 1)", // power2.out
	outExpo: "cubic-bezier(0.16, 1, 0.3, 1)", // expo.out
	outBack: "cubic-bezier(0.34, 1.56, 0.64, 1)", // back.out(1.7)
	outBackSoft: "cubic-bezier(0.3, 1.35, 0.5, 1)", // back.out(1.2)
	inOut: "cubic-bezier(0.65, 0, 0.35, 1)", // power2.inOut
	inOutSine: "cubic-bezier(0.37, 0, 0.63, 1)", // sine.inOut
	outSine: "cubic-bezier(0.61, 1, 0.88, 1)", // sine.out
	in: "cubic-bezier(0.32, 0, 0.67, 0)", // power2.in
	inStrong: "cubic-bezier(0.5, 0, 0.75, 0)", // power3.in
	fly: "cubic-bezier(0.7, 0, 0.18, 1)", // strong in-out for the hand-off
};

export interface SplashContext {
	/** The overlay element. */
	el: HTMLElement;
	/** "full" (first entry) or "fast" (refresh). */
	mode: "full" | "fast";
	/** Playback speed of the whole timeline: 1 for full, the intro's fastRate for fast. */
	rate: number;
	/** Add one animation to the timeline: `frames` over [start, start + dur] seconds. */
	tween: (el: Element | null | undefined, frames: Frames, start: number, dur: number, easing?: string, options?: KeyframeAnimationOptions) => Animation | undefined;
	/** Run `fn` at `seconds` of the timeline (skipped once the splash has ended). */
	at: (seconds: number, fn: () => void) => void;
	/** Clean up when this animation finishes (the last one in the timeline). */
	endWith: (animation: Animation | undefined) => void;
	/** Extra clean-up for this intro (canvases, listeners...). */
	onCleanup: (fn: () => void) => void;
	/** For window.__splash in development. */
	devExtras: (extras: Record<string, unknown>) => void;
}

const root = document.documentElement;
const anims: Animation[] = [];
const timers: number[] = [];
const cleanups: Array<() => void> = [];
let finished = false;
let rate = 1;
let unwire = () => {};

/** Transform (origin: top-left) that moves and scales box `from` exactly onto box `to`. */
export function flip(from: DOMRect, to: DOMRect) {
	return `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width})`;
}

/** True when `rect` is actually on screen (the header can be hidden or scrolled away). */
export function onScreen(rect: DOMRect | undefined) {
	return !!rect && rect.width > 0 && rect.bottom > 0 && rect.top < innerHeight;
}

function tween(el: Element | null | undefined, frames: Frames, start: number, dur: number, easing = E.out, options: KeyframeAnimationOptions = {}) {
	if (!el) return undefined;
	const a = el.animate(frames, { delay: start * 1000, duration: dur * 1000, easing, fill: "both", ...options });
	a.playbackRate = rate; // times are written for the full version; fast plays them all quicker
	anims.push(a);
	return a;
}

function cleanup(el: HTMLElement) {
	if (finished) return;
	finished = true;
	unwire();
	for (const t of timers) clearTimeout(t);
	for (const fn of cleanups) fn();
	root.classList.remove("splash", "splash-live", "splash-reduced", "splash-leaving", "splash-jpl", "splash-frc", "splash-fast");
	for (const a of anims) a.cancel(); // page elements the splash hid get their own styles back
	el.remove();
}

function wireSkip(el: HTMLElement) {
	const skip = () => {
		for (const a of anims) {
			try {
				a.finish();
			} catch {
				/* already cancelled */
			}
		}
		cleanup(el);
	};
	const onKey = () => skip(); // Tab still moves focus into the page as usual
	el.addEventListener("pointerdown", skip);
	addEventListener("keydown", onKey, true);
	addEventListener("wheel", skip, { passive: true });
	addEventListener("touchmove", skip, { passive: true });
	unwire = () => {
		el.removeEventListener("pointerdown", skip);
		removeEventListener("keydown", onKey, true);
		removeEventListener("wheel", skip);
		removeEventListener("touchmove", skip);
	};
}

/**
 * Start the intro of this `kind` if its overlay is on the page (SplashShell's inline script put it there, during
 * a real page load or an in-site page swap). `play` builds the timeline; reduced motion gets a quick fade instead.
 * `fastRate`: how much faster the refresh version plays. Safe to call again: an intro already playing is left be.
 */
export function runSplash(kind: "jpl" | "frc", play: (ctx: SplashContext) => void, { fastRate }: { fastRate: number }) {
	const el = document.querySelector<HTMLElement>(`[data-splash="${kind}"]`);
	if (el?.hasAttribute("data-splash-run")) return; // already playing
	if (!el || !root.classList.contains("splash")) {
		el?.remove();
		return;
	}
	el.setAttribute("data-splash-run", "");
	// A fresh clock (an in-site arrival can play an intro again after an earlier one finished).
	anims.length = timers.length = cleanups.length = 0;
	finished = false;
	rate = 1;
	// Seconds since the overlay went up: from the page load, or from the in-site swap that put it there.
	const waited = performance.now() - Number(el.dataset.splashT0 ?? 0);
	// A script that arrives late (slow connection) plays the fast version, so the page isn't held back long.
	const late = waited > 2500;
	const begin = () => {
		root.classList.add("splash-live"); // cancels the CSS failsafe
		wireSkip(el);
		if (root.classList.contains("splash-reduced")) {
			// No movement, in either version: the finished artwork shows at once, then a 300 ms fade.
			const fade = tween(el, [{ opacity: 1 }, { opacity: 0 }], 0.35, 0.3, E.out);
			fade?.finished.then(() => cleanup(el), () => {});
			return;
		}
		const fast = root.classList.contains("intro-fast") || late;
		if (fast) root.classList.add("splash-fast");
		rate = fast ? fastRate : 1;
		let extras: Record<string, unknown> = {};
		play({
			el,
			mode: fast ? "fast" : "full",
			rate,
			tween,
			at: (seconds, fn) => timers.push(window.setTimeout(() => !finished && fn(), (seconds * 1000) / rate)),
			endWith: (a) => (a ?? anims[anims.length - 1])?.finished.then(() => cleanup(el), () => {}),
			onCleanup: (fn) => cleanups.push(fn),
			devExtras: (x) => (extras = { ...extras, ...x }),
		});
		if (import.meta.env.DEV) {
			(window as unknown as { __splash: object }).__splash = {
				kind,
				mode: fast ? "fast" : "full",
				rate,
				anims,
				seek(t: number) {
					for (const a of anims) {
						a.pause();
						a.currentTime = t * 1000;
					}
				},
				...extras,
			};
		}
	};
	if (waited > 4000) {
		// The script arrived so late that the CSS failsafe is about to hide the overlay: don't start now.
		cleanup(el);
	} else if (document.hidden) {
		// Opened in a background tab: hold the first frame until the visitor actually looks.
		root.classList.add("splash-live");
		document.addEventListener("visibilitychange", function onVisible() {
			if (document.hidden) return;
			document.removeEventListener("visibilitychange", onVisible);
			begin();
		});
	} else {
		begin();
	}
}
