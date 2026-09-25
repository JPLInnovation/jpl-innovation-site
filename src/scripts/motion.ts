/**
 * Site-wide scroll motion, driven by data attributes so pages stay plain markup:
 *
 *   data-reveal            rise + fade in once, when it enters the viewport
 *   data-reveal-group      reveal each direct child in turn (a stagger)
 *   data-words             text lights up word by word as it scrolls through the viewport
 *   data-parallax          the first <img> inside settles from a slight zoom as it scrolls into place
 *   data-draw              a line or bar grows from its start edge once in view
 *   data-count="1234"      counts up from zero once in view (data-count-format="vnd" for ₫)
 *
 *   data-draw-duration / data-draw-ease="linear" / data-reveal-delay (ms) tune the above
 *
 * React islands animate themselves (src/components/motion-primitives.tsx): editing their DOM before
 * hydration would make React throw it away, so anything inside <astro-island> is skipped here.
 *
 * Everything is visible without JS. The inline script in BaseLayout adds `motion` to <html> only when
 * the visitor allows motion, and CSS hides revealables only under that class.
 */
import { animate, inView, scroll, stagger } from "motion";

const spring = { type: "spring", bounce: 0, duration: 0.9 } as const;
const vnd = new Intl.NumberFormat("vi-VN");
let cleanups: Array<() => void> = [];

/** Run `start` the first time `el` scrolls into view, then stop watching. */
function once(el: Element, start: () => void, margin = "0px 0px -12% 0px") {
	const stop = inView(el, () => {
		start();
		stop();
	}, { margin: margin as `${number}px ${number}px ${number}% ${number}px` });
	cleanups.push(stop);
}

/** Elements of this page matching `selector`, outside React islands. */
const all = (selector: string) =>
	[...document.querySelectorAll<HTMLElement>(selector)].filter((el) => !el.closest("astro-island"));

function init() {
	cleanups.forEach((stop) => stop());
	cleanups = [];
	const root = document.documentElement;
	root.classList.add("motion-live");
	if (!root.classList.contains("motion")) return;

	for (const el of all("[data-reveal]")) {
		const delay = Number(el.dataset.revealDelay ?? 0) / 1000;
		once(el, () => animate(el, { opacity: 1, y: [28, 0] }, { ...spring, delay }));
	}

	for (const group of all("[data-reveal-group]")) {
		const items = [...group.children] as HTMLElement[];
		once(group, () => animate(items, { opacity: 1, y: [28, 0] }, { ...spring, delay: stagger(0.08) }));
	}

	for (const el of all("[data-words]")) {
		// Split once into word spans; the text itself is unchanged for screen readers.
		if (!el.dataset.wordsReady) {
			const text = (el.textContent ?? "").trim();
			const readable = document.createElement("span");
			readable.className = "sr-only";
			readable.textContent = text;
			const words = text.split(/\s+/).flatMap((word, i) => {
				const span = document.createElement("span");
				span.className = "motion-word";
				span.setAttribute("aria-hidden", "true");
				span.textContent = word;
				return i ? [document.createTextNode(" "), span] : [span];
			});
			el.replaceChildren(readable, ...words);
			el.dataset.wordsReady = "true";
		}
		const words = [...el.querySelectorAll<HTMLElement>(".motion-word")];
		cleanups.push(
			scroll(
				(progress: number) => {
					const lit = progress * (words.length + 2);
					words.forEach((w, i) => (w.style.opacity = String(Math.min(1, Math.max(0.18, lit - i)))));
				},
				{ target: el, offset: ["start 0.9", "end 0.55"] },
			),
		);
	}

	for (const el of all("[data-parallax]")) {
		const img = el.querySelector("img");
		if (!img) continue;
		cleanups.push(
			scroll(animate(img, { scale: [1.14, 1] }, { ease: "linear" }), {
				target: el,
				offset: ["start end", "center center"],
			}),
		);
	}

	for (const el of all("[data-draw]")) {
		const vertical = el.dataset.draw === "y";
		once(el, () =>
			animate(el, vertical ? { scaleY: [0, 1] } : { scaleX: [0, 1] }, {
				duration: Number(el.dataset.drawDuration ?? 1.2),
				ease: el.dataset.drawEase === "linear" ? "linear" : [0.22, 1, 0.36, 1],
				delay: Number(el.dataset.revealDelay ?? 0) / 1000,
			}),
		);
	}

	// Tilt toward the pointer on a spring; springs back (with a little bounce) when the pointer leaves.
	if (matchMedia("(pointer: fine)").matches) {
		for (const el of all("[data-tilt]")) {
			const area = el.closest("figure") ?? el;
			const move = (e: PointerEvent) => {
				const r = area.getBoundingClientRect();
				const x = (e.clientX - r.left) / r.width - 0.5;
				const y = (e.clientY - r.top) / r.height - 0.5;
				animate(el, { rotateY: x * 22, rotateX: -y * 22 }, { type: "spring", bounce: 0, duration: 0.5 });
			};
			const leave = () => animate(el, { rotateX: 0, rotateY: 0 }, { type: "spring", bounce: 0.25, duration: 0.8 });
			area.addEventListener("pointermove", move as EventListener);
			area.addEventListener("pointerleave", leave);
			cleanups.push(() => {
				area.removeEventListener("pointermove", move as EventListener);
				area.removeEventListener("pointerleave", leave);
			});
		}
	}

	for (const el of all("[data-count]")) {
		const target = Number(el.dataset.count);
		const decimals = (el.dataset.count!.split(".")[1] ?? "").length;
		const format = (n: number) =>
			el.dataset.countFormat === "vnd" ? `${vnd.format(Math.round(n))} ₫` : n.toFixed(decimals);
		el.textContent = format(0);
		once(el, () =>
			animate(0, target, {
				duration: 1.4,
				ease: [0.16, 1, 0.3, 1],
				onUpdate: (n) => (el.textContent = format(n)),
			}),
		);
	}
}

// Runs on first load and after every client-side navigation.
document.addEventListener("astro:page-load", init);
