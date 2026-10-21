/**
 * Pointer effects, mouse and trackpad only (touch screens and reduced motion get the plain page):
 *
 *   Big headings (h1 and h2 in the wide display face, text only): a light in the site's blue-to-violet (cyan and violet
 *   on the dark theme) follows the pointer across the letters. global.css `.glint`; the colours keep large-text
 *   contrast (3:1 and up) on both themes, and away from the pointer the heading is its normal colour.
 *   Cards with `data-tilt`: tilt toward the pointer, up to TILT degrees, with a soft highlight where it is, and spring
 *   back when it leaves. The tilt uses the CSS `rotate` property, so it never fights the scroll reveals, which animate
 *   `transform`.
 *
 * One set of listeners on the document, so it keeps working across client-side page swaps.
 * (Headings in another colour, such as the contact band's white, are left alone.)
 */
const TILT = 5; // degrees at the card's edge

const fine = matchMedia("(hover: hover) and (pointer: fine)");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const on = () => fine.matches && !reduced.matches;

/** Headings whose content is plain text (a heading with animated parts inside, like the FRC odometer, is left alone). */
function markHeadings() {
	// Only headings in the page's own text colour: white headings on the contact band and photos keep their colour.
	const text = getComputedStyle(document.body).color;
	for (const h of document.querySelectorAll<HTMLElement>("main :is(h1, h2).font-wide")) {
		if (h.children.length === 0 && !h.closest("astro-island") && getComputedStyle(h).color === text) h.classList.add("glint");
	}
}

let tilted: HTMLElement | null = null;
const release = (card: HTMLElement) => {
	card.style.removeProperty("rotate");
	card.removeAttribute("data-tilting");
};

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

		const card = target.closest<HTMLElement>("[data-tilt]");
		if (tilted && tilted !== card) release(tilted);
		tilted = card;
		if (!card) return;
		const r = card.getBoundingClientRect();
		const x = (event.clientX - r.left) / r.width - 0.5; // -0.5 .. 0.5
		const y = (event.clientY - r.top) / r.height - 0.5;
		// One rotation about the axis at right angles to the pointer's offset: the near edge dips toward you.
		const angle = Math.min(1, Math.hypot(x, y) * 2) * TILT;
		card.style.rotate = `${-y} ${x} 0 ${angle.toFixed(2)}deg`;
		card.style.setProperty("--tx", `${(x + 0.5) * 100}%`);
		card.style.setProperty("--ty", `${(y + 0.5) * 100}%`);
		card.setAttribute("data-tilting", "");
	},
	{ passive: true },
);
document.addEventListener("pointerleave", () => tilted && release(tilted));
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

document.addEventListener("astro:page-load", () => {
	tilted = null;
	markHeadings();
});
