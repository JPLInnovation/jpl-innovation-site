/**
 * The drone pages' two moments (only when <html> has `motion`, i.e. the visitor allows it):
 *
 *   [data-drone-decode]   a headline scrambles from random glyphs into its words, once, in under a second, when it comes
 *                   into view (the letters: src/lib/look/decode.ts, shared with the kit's DecodeHeading). Each word keeps its own box, so nothing around it moves.
 *   [data-lights]   a render (./Lit.astro) or a drawing comes up from darkness when it comes into view, as if the
 *                   studio lights switched on; several entering together light one after another.
 *
 * Skipped inside the drone chapter while it runs in 3D (the 3D stages its own words).
 */
import { decodeFrame } from "@/lib/look/decode";

const DURATION = 760; // ms, the whole decode
let stop: (() => void) | undefined;

function decode(el: HTMLElement) {
	const text = el.textContent ?? "";
	const parts = text.split(/(\s+)/);
	const overlays: Array<{ span: HTMLElement; from: number; to: number }> = [];
	let at = 0;
	el.replaceChildren(
		...parts.map((part) => {
			const from = at;
			at += part.length;
			if (!part.trim()) return document.createTextNode(part);
			const word = document.createElement("span");
			word.className = "decode-word";
			word.textContent = part;
			const overlay = document.createElement("span");
			overlay.className = "decode-glyphs";
			overlay.setAttribute("aria-hidden", "true");
			word.append(overlay);
			overlays.push({ span: overlay, from, to: at });
			return word;
		}),
	);
	el.setAttribute("data-decoding", "");
	const start = performance.now();
	const frame = (now: number) => {
		const p = Math.min(1, (now - start) / DURATION);
		const s = decodeFrame(text, p);
		for (const o of overlays) o.span.textContent = s.slice(o.from, o.to);
		if (p < 1) requestAnimationFrame(frame);
		else {
			el.textContent = text;
			el.removeAttribute("data-decoding");
		}
	};
	requestAnimationFrame(frame);
}

function init() {
	stop?.();
	stop = undefined;
	if (!document.documentElement.classList.contains("motion")) return;
	const outside3d = (el: Element) => !el.closest(".dch:not([data-read])");

	const decodes = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				if (!e.isIntersecting) continue;
				decodes.unobserve(e.target);
				if (outside3d(e.target) && !document.documentElement.classList.contains("reduce-motion")) decode(e.target as HTMLElement);
			}
		},
		{ threshold: 0.6 },
	);
	document.querySelectorAll("[data-drone-decode]").forEach((el) => decodes.observe(el));

	const lights = new IntersectionObserver(
		(entries) => {
			let n = 0;
			for (const e of entries) {
				if (!e.isIntersecting) continue;
				lights.unobserve(e.target);
				const el = e.target as HTMLElement;
				el.style.setProperty("--lights-delay", `${n++ * 220}ms`);
				el.setAttribute("data-lit", "");
			}
		},
		{ threshold: 0.3 },
	);
	document.querySelectorAll("[data-lights]").forEach((el) => lights.observe(el));

	stop = () => {
		decodes.disconnect();
		lights.disconnect();
	};
}

document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => stop?.());
