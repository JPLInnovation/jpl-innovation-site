/**
 * The studio's first words (the hook, src/text/home.ts `hook`; markup in src/pages/index.astro). On the first visit to
 * the 3D studio the room stays dark (html.studio-dark: the engine holds the lamp, src/lib/studio/engine.ts) while the
 * heading and the short cut of lines play over it; the lamp comes on with the lamp line, then the words make way for
 * the title.
 *
 *   - Skip (shown from the start) and Escape end it at once. A wheel, a swipe or a scroll key does too, but not in the
 *     first 1.5 s: a trackpad's momentum from picking 3D on the opening page would skip it.
 *   - Reduced motion: no timing, the heading and the lamp line as a still card with Continue.
 *   - Seen once per browser (localStorage "hook-seen"; Settings' "Replay the opening" forgets it).
 *   - The 3D under the words (hook B) follows these same timers: each run, its line times and its end are told to
 *     src/lib/studio/hook-state.ts, which the studio's engine reads.
 */
import { hookEnded, hookStarted } from "@/lib/studio/hook-state";

const SEEN = "hook-seen";
const QUIET = 1500; // ms in which scrolling doesn't skip
const HEADING = 2400; // ms the heading is up alone
const LINE = 900; // ms per line, plus PER_WORD for each word
const PER_WORD = 260;
const HOLD = 1500; // after the last line
const FADE = 800; // the words fading out (as the CSS's transition)
const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "Home", "End"]);

let abort: (() => void) | undefined;

function arm() {
	abort?.();
	abort = undefined;
	const html = document.documentElement;
	const el = document.querySelector<HTMLElement>("[data-studio-hook]");
	const studio = document.querySelector<HTMLElement>("[data-studio]");
	if (!el || !studio || !html.classList.contains("studio-on") || studio.hasAttribute("data-read") || scrollY > 40) return;
	try {
		if (localStorage.getItem(SEEN)) return;
	} catch {
		/* storage blocked: it plays every visit */
	}
	const still = html.classList.contains("reduce-motion") || matchMedia("(prefers-reduced-motion: reduce)").matches;
	const lines = [...el.querySelectorAll<HTMLElement>("[data-play]")];
	const lampAt = Math.max(0, lines.findIndex((line) => line.hasAttribute("data-lamp")));
	const roll = el.querySelector<HTMLElement>("[data-hook-roll]")!;
	const skip = el.querySelector<HTMLButtonElement>("[data-hook-skip]")!;
	const timers: number[] = [];
	let started = 0;
	let begun = false;
	let over = false;
	html.classList.add("studio-dark"); // at once, before the intro lets the lamp warm up

	const reset = () => {
		timers.forEach(clearTimeout);
		watch.disconnect();
		removeEventListener("keydown", onKey, true);
		removeEventListener("wheel", onScroll, true);
		removeEventListener("touchmove", onScroll, true);
		skip.removeEventListener("click", finish);
	};
	const clear = () => {
		html.classList.remove("studio-dark", "hook-on");
		el.removeAttribute("data-playing");
		el.removeAttribute("data-leaving");
		el.removeAttribute("data-still");
		skip.hidden = true;
	};
	function finish() {
		if (over) return;
		over = true;
		hookEnded();
		reset();
		try {
			localStorage.setItem(SEEN, "1");
		} catch {
			/* storage blocked */
		}
		html.classList.remove("studio-dark");
		el.setAttribute("data-leaving", "");
		window.setTimeout(clear, FADE);
	}
	abort = () => {
		over = true;
		hookEnded();
		reset();
		clear();
	};
	const show = (i: number) => {
		lines.forEach((line, j) => (line.dataset.state = j === i ? "current" : j === i - 1 ? "previous" : j < i ? "old" : ""));
		const line = lines[i];
		roll.style.transform = `translateY(${roll.parentElement!.clientHeight - line.offsetTop - line.offsetHeight}px)`;
		if (i === lampAt) html.classList.remove("studio-dark");
	};
	function onKey(event: KeyboardEvent) {
		if (event.key === "Escape") return finish();
		if (!SCROLL_KEYS.has(event.key) || (event.target as Element).closest?.("button, a, input, textarea, select")) return;
		if (performance.now() - started < QUIET) event.preventDefault();
		else finish();
	}
	function onScroll(event: Event) {
		if (performance.now() - started < QUIET) event.preventDefault();
		else finish();
	}
	const begin = () => {
		if (begun) return;
		begun = true;
		started = performance.now();
		el.setAttribute("data-playing", "");
		html.classList.add("hook-on");
		skip.hidden = false;
		skip.addEventListener("click", finish);
		addEventListener("keydown", onKey, true);
		if (still) {
			el.setAttribute("data-still", "");
			skip.textContent = skip.dataset.continue ?? skip.textContent;
			lines.forEach((line, j) => (line.dataset.state = j === lampAt ? "current" : "old"));
			hookStarted({ start: started, lines: [], lamp: lampAt, end: Infinity, still: true });
			return;
		}
		addEventListener("wheel", onScroll, { capture: true, passive: false });
		addEventListener("touchmove", onScroll, { capture: true, passive: false });
		let t = HEADING;
		const times: number[] = [];
		lines.forEach((line, i) => {
			times.push(t);
			timers.push(window.setTimeout(() => show(i), t));
			t += LINE + PER_WORD * line.textContent!.trim().split(/\s+/).length;
		});
		timers.push(window.setTimeout(finish, t + HOLD));
		hookStarted({ start: started, lines: times, lamp: lampAt, end: t + HOLD, still: false });
	};
	// Starts once the logo intro has gone and the room is up; lets go if the page falls back to Classic.
	const check = () => {
		if (!html.classList.contains("studio-on") || studio.hasAttribute("data-read")) abort?.();
		else if (!html.classList.contains("splash") && studio.hasAttribute("data-live")) begin();
	};
	const watch = new MutationObserver(check);
	watch.observe(html, { attributes: true, attributeFilter: ["class"] });
	watch.observe(studio, { attributes: true, attributeFilter: ["data-live", "data-read"] });
	check();
}

document.addEventListener("astro:page-load", arm);
document.addEventListener("studio:on", arm); // a first visit that picked 3D on the opening page
document.addEventListener("astro:before-swap", () => {
	abort?.();
	abort = undefined;
});
