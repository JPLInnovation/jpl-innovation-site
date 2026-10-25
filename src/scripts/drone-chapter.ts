/**
 * The drone chapter (src/pages/work/drone.astro, words in src/text/projects/drone.ts `droneChapter`).
 *
 *   - The status strip's clock: the live local time in Ho Chi Minh City, every second, in both modes.
 *   - In 3D (the chapter without data-read): each beat comes in as it reaches the screen (data-in), and the chapter
 *     map lights the beat in the middle of the window. Until this runs (data-live), everything simply shows, so the
 *     page never waits on it.
 */
let teardown: (() => void) | undefined;

function armChapter() {
	teardown?.();
	teardown = undefined;
	const chapter = document.querySelector<HTMLElement>("[data-drone-chapter]");
	if (!chapter) return;

	const clocks = [...chapter.querySelectorAll<HTMLTimeElement>("[data-chapter-clock]")];
	const formats = clocks.map(
		(c) => new Intl.DateTimeFormat("en-GB", { timeZone: c.dataset.chapterClock, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
	);
	const tick = () => {
		const now = new Date();
		clocks.forEach((c, i) => {
			c.textContent = formats[i].format(now);
			c.dateTime = now.toISOString();
		});
	};
	tick();
	const clock = window.setInterval(tick, 1000);
	const cleanups = [() => clearInterval(clock)];

	if (!chapter.hasAttribute("data-read")) {
		const beats = [...chapter.querySelectorAll<HTMLElement>("[data-beat]")];
		const links = new Map([...chapter.querySelectorAll<HTMLAnchorElement>("[data-map-link]")].map((a) => [a.dataset.mapLink!, a]));
		// A beat comes in once a third of it (or a third of the window) is on screen, and stays in.
		const enter = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (!e.isIntersecting) continue;
					(e.target as HTMLElement).setAttribute("data-in", "");
					enter.unobserve(e.target);
				}
			},
			{ threshold: 0, rootMargin: "0px 0px -33% 0px" },
		);
		// The map lights the beat that crosses the middle of the window.
		const current = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (!e.isIntersecting) continue;
					const id = (e.target as HTMLElement).dataset.beat!;
					links.forEach((a, key) => (key === id ? a.setAttribute("aria-current", "step") : a.removeAttribute("aria-current")));
				}
			},
			{ rootMargin: "-50% 0px -50% 0px" },
		);
		beats.forEach((b) => {
			enter.observe(b);
			current.observe(b);
		});
		chapter.setAttribute("data-live", "");
		cleanups.push(() => {
			enter.disconnect();
			current.disconnect();
		});
	}
	teardown = () => cleanups.forEach((c) => c());
}

document.addEventListener("astro:page-load", armChapter);
document.addEventListener("astro:before-swap", () => {
	teardown?.();
	teardown = undefined;
});
