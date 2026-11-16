/**
 * Pointer effects, mouse and trackpad only (touch screens and reduced motion get the plain page):
 *
 *   Big headings (h1 and h2 in the wide display face, text only): a light in the site's blue and gold (gold and pale blue
 *   on the dark theme) follows the pointer across the letters. global.css `.glint`; the colours keep large-text
 *   contrast (3:1 and up) on both themes, and away from the pointer the heading is its normal colour.
 *
 * One set of listeners on the document, so it keeps working across client-side page swaps.
 * (Headings in another colour, such as the contact band's white, are left alone.)
 */
import { reducedMotion } from "@/lib/prefs";

const fine = matchMedia("(hover: hover) and (pointer: fine)");
const on = () => fine.matches && !reducedMotion();

/** Headings whose content is plain text (a heading with animated parts inside, like the FRC odometer, is left alone). */
function markHeadings() {
	// Only headings in the page's own text colour: white headings on the contact band and photos keep their colour.
	const text = getComputedStyle(document.body).color;
	for (const h of document.querySelectorAll<HTMLElement>("main :is(h1, h2).font-wide")) {
		if (h.children.length === 0 && !h.closest("astro-island") && getComputedStyle(h).color === text) h.classList.add("glint");
	}
}

document.addEventListener(
	"pointermove",
	(event) => {
		if (event.pointerType !== "mouse" || !on()) return;
		const target = event.target as Element;

		const heading = target.closest<HTMLElement>(".glint");
		if (heading) {
			const r = heading.getBoundingClientRect();
			heading.style.setProperty("--gx", `${event.clientX - r.left}px`);
			heading.style.setProperty("--gy", `${event.clientY - r.top}px`);
		}
	},
	{ passive: true },
);
document.addEventListener(
	"pointerout",
	(event) => {
		const card = (event.target as Element).closest?.<HTMLElement>(".glint");
		if (card && !card.contains(event.relatedTarget as Node)) {
			card.style.removeProperty("--gx");
			card.style.removeProperty("--gy");
		}
	},
	{ passive: true },
);

document.addEventListener("astro:page-load", markHeadings);
