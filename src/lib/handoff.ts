/**
 * How the opening page (the JPL intro, src/scripts/intro-splash.ts) and the 3D studio (src/components/Studio.astro)
 * work together on the home page, two separate scripts:
 *
 *   - A first visit that picks 3D on the opening page: the studio is switched on there and then (`startStudio`),
 *     without reloading the page.
 *   - Once the studio is up, the opening page asks where the logo on its wall is (`whenLive`), and flies its own logo
 *     onto it as the room appears.
 */
export interface StudioLink {
	/** The logo on the studio's wall, in CSS pixels on the screen, or null if it isn't in view. */
	logoRect(): DOMRect | null;
}

let starter: (() => void) | undefined;
let live: StudioLink | undefined;
let waiters: Array<(link: StudioLink) => void> = [];

/** Studio: how to switch this page to 3D now. */
export function offerStart(start: (() => void) | undefined) {
	starter = start;
}

/** Opening page: switch the page to 3D now. False when this page has no studio. */
export function startStudio() {
	if (!starter) return false;
	const start = starter;
	starter = undefined;
	start();
	return true;
}

/** Studio: it is up (or, with undefined, gone again). */
export function setLive(link: StudioLink | undefined) {
	live = link;
	if (link) for (const resolve of waiters.splice(0)) resolve(link);
}

/** Opening page: the studio once it is up, or null if it isn't within `ms` (too slow, or no 3D on this device). */
export function whenLive(ms: number): Promise<StudioLink | null> {
	if (live) return Promise.resolve(live);
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			waiters = waiters.filter((w) => w !== done);
			resolve(null);
		}, ms);
		const done = (link: StudioLink) => {
			clearTimeout(timer);
			resolve(link);
		};
		waiters.push(done);
	});
}
