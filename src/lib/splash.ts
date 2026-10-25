/**
 * The logo intros: which one a page has, and which version of it plays.
 *
 * Which intro: decided here only, when each page is built, so every page's HTML carries exactly one splash and
 * two can never both play or overlap:
 *   - FRC pages (the FIRST Robotics page and anything under it) → FrcSplash
 *   - the F450 drone page → DroneSplash
 *   - every other page → the JPL IntroSplash
 *
 * Which version: decided once per real page load, before the first paint (SplashShell inlines these functions
 * into its blocking <head> script, which puts intro-full / intro-fast / intro-none on <html>):
 *   - "full"  first entry: a link from another site, a search result, a bookmark, a typed URL
 *   - "fast"  refresh (F5, Ctrl+R, Ctrl+Shift+R, the reload button): the same timeline, played faster
 *   - "none"  back/forward
 * Arriving from another page of this site (arrivalMode): an ordinary click doesn't reload, Astro's router swaps
 * the page, and SplashShell's script shows the intro then too, but only the FRC and drone ones:
 *   - FRC or drone page → full the first time in this tab, fast after that (so it doesn't hold you up every visit)
 *   - every other page → none (the JPL intro only greets you on the way in)
 * Back/forward inside the site plays nothing either.
 */
export type SplashKind = "jpl" | "frc" | "drone";
export type IntroMode = "full" | "fast" | "none";

export const isFrcRoute = (path: string) => /^\/work\/frc(\/|$)/.test(path);
export const isDroneRoute = (path: string) => /^\/work\/drone\/?$/.test(path);

/** Runs inlined in the browser too (SplashShell), next to the two route tests above. */
export const splashFor = (path: string): SplashKind => (isFrcRoute(path) ? "frc" : isDroneRoute(path) ? "drone" : "jpl");

/** Arriving at a page of this `kind` from another page of this site. Runs inlined in the browser: keep it self-contained. */
export function arrivalMode(kind: SplashKind): IntroMode {
	if (kind === "jpl") return "none";
	try {
		return sessionStorage.getItem(kind + "-intro-seen") ? "fast" : "full";
	} catch {
		return "full"; // storage blocked
	}
}

/** This kind of intro has played in this tab (arrivalMode's "fast after that"). */
export function markSeen(kind: SplashKind) {
	try {
		sessionStorage.setItem(kind + "-intro-seen", "1");
	} catch {
		/* storage blocked: every arrival plays the full version */
	}
}

/**
 * Resolves once no logo intro covers the page, so a 3D model (src/components/model-viewer.tsx, showcase.tsx) doesn't
 * build and render underneath it while the intro needs the GPU (the drone page's intro flies a 3D drone itself).
 * Also once the intro pauses on the opening page (html.splash-hold, src/scripts/intro-splash.ts): nothing moves then,
 * and the 3D studio has to be built under it so the logo can fly onto its wall. Gives up waiting after 8 s.
 */
export function afterIntro() {
	const root = document.documentElement;
	const covered = () => root.classList.contains("splash") && !root.classList.contains("splash-hold");
	if (!covered()) return Promise.resolve();
	return new Promise<void>((resolve) => {
		const done = () => {
			observer.disconnect();
			clearTimeout(timer);
			resolve();
		};
		const observer = new MutationObserver(() => !covered() && done());
		observer.observe(root, { attributes: true, attributeFilter: ["class"] });
		const timer = setTimeout(done, 8000);
	});
}

/**
 * How this page load was opened. Runs inlined in the browser before first paint: keep it self-contained, apart
 * from arrivalMode, which SplashShell inlines next to it.
 */
export function getIntroMode(kind: SplashKind): IntroMode {
	try {
		// Settings' "Replay the opening" (src/components/SettingsPanel.astro): the full version, once.
		if (sessionStorage.getItem("replay-opening")) {
			sessionStorage.removeItem("replay-opening");
			return "full";
		}
	} catch {
		/* storage blocked */
	}
	const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
	const type = nav ? nav.type : "navigate";
	if (type === "reload") return "fast";
	if (type === "back_forward") return "none";
	try {
		// Came here from another page of this site (e.g. a link opened in a new tab).
		if (document.referrer && new URL(document.referrer).origin === location.origin) return arrivalMode(kind);
	} catch {
		/* unreadable referrer: treat as a first entry */
	}
	return "full";
}
