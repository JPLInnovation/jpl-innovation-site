/**
 * Warms the 3D code in the browser's idle time, on every page, so a click on Home or Work does not wait for it to
 * download and compile in the middle of the page change (which is when a stall shows most). Not on phones, with the
 * data saver on, or when motion is turned down: those never build the 3D room.
 */
import { afterIntro } from "@/lib/splash";

const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
const root = document.documentElement;
// The FRC and drone intros' code too, on any screen: on a click it would otherwise download while the intro's first
// frame waits. Importing one here starts nothing: it only runs when its own overlay is on the page.
if (!connection?.saveData) {
	const intros = () => {
		void import("@/scripts/frc-splash");
		if (!matchMedia("(max-width: 767px)").matches) void import("@/scripts/drone-splash");
	};
	const soon = () => afterIntro().then(() => ("requestIdleCallback" in window ? requestIdleCallback(intros, { timeout: 3000 }) : setTimeout(intros, 1500)));
	if (document.readyState === "complete") soon();
	else addEventListener("load", soon, { once: true });
}
const skip = connection?.saveData || root.classList.contains("reduce-motion") || matchMedia("(max-width: 767px), (prefers-reduced-motion: reduce)").matches;

if (!skip) {
	const warm = () => {
		void import("@/lib/three/stage");
		void import("@/lib/three/quality");
		void import("@/lib/studio/engine");
		void import("@/lib/three/models/work-wall");
	};
	// After the page has loaded and any logo intro is over (the intros need the main thread to themselves).
	const later = () => afterIntro().then(() => ("requestIdleCallback" in window ? requestIdleCallback(warm, { timeout: 5000 }) : setTimeout(warm, 2500)));
	if (document.readyState === "complete") later();
	else addEventListener("load", later, { once: true });
}
