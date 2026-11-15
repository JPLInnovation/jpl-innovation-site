/**
 * The light on a glass sheet's rim (global.css .sheet): the edge facing the pointer brightens. One passive listener,
 * at most one update a frame, only the sheet under or nearest the pointer; nothing on touch, in Solid, or with reduce
 * motion. The maths is src/lib/look/surface.ts (rimFromPointer), tested.
 */
import { rimFromPointer } from "@/lib/look/surface";
import { reducedMotion } from "@/lib/prefs";

const fine = matchMedia("(hover: hover) and (pointer: fine)");
let lit: HTMLElement | null = null;
let queued = false;
let x = 0;
let y = 0;

function update() {
	queued = false;
	const root = document.documentElement;
	if (!fine.matches || reducedMotion() || root.classList.contains("solid")) return;
	const under = document.elementFromPoint(x, y)?.closest<HTMLElement>(".sheet") ?? null;
	if (lit && lit !== under) lit.style.setProperty("--rim-strength", "0");
	lit = under;
	if (!under) return;
	const { angle, strength } = rimFromPointer(under.getBoundingClientRect(), x, y);
	under.style.setProperty("--rim-angle", `${angle}deg`);
	under.style.setProperty("--rim-strength", String(strength));
}

addEventListener(
	"pointermove",
	(event) => {
		x = event.clientX;
		y = event.clientY;
		if (!queued) {
			queued = true;
			requestAnimationFrame(update);
		}
	},
	{ passive: true },
);
