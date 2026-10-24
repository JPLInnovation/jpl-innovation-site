/**
 * A page on one of the studio's screens (the desk monitor, the test bench's laptop and phone) that the visitor can
 * scroll with the mouse wheel, like a real website inside the screen.
 *
 * The page is a tall screenshot cut into tiles (public/studio/screens/, made by scripts/studio-screens.py; the list is
 * screens.json). Only the tiles in view are drawn, the next one is loaded ahead, and tiles far away are let go, so a
 * long page costs no more memory than a short one.
 *
 *   - Until the visitor scrolls it, the page drifts down and back up by itself while its scene is in view.
 *   - The engine (engine.ts) sends the wheel to `scroll()` while the pointer is on the screen; at the page's top or
 *     bottom `scroll()` says no, and the wheel goes back to moving the studio.
 *   - The screen eases to where it was scrolled to, draws a scrollbar, and says "Scroll to read" under the pointer.
 */
import { Mesh, PlaneGeometry } from "three";
import { studio } from "../../text/studio";
import { canvasSurface, loadImage, screenMaterial } from "./room";
import { SCREEN_STEP } from "./stations";
import pages from "./screens.json";

export type PageName = keyof typeof pages;

export interface PageScreen {
	/** The screen's surface, ready to position. */
	mesh: Mesh;
	/** The scene it belongs to (scenes.ts): it only takes the wheel while that scene is in view. */
	scene: string;
	/** Scroll by `dy` page pixels. False when the page is already at that end (the wheel then moves the studio). */
	scroll(dy: number): boolean;
	/** The pointer is on it (shows the scrollbar and the hint). */
	hover(on: boolean): void;
	/** Every frame. `inView` is how much its scene is in view, 0 to 1. True while it is still moving. */
	update(dt: number, inView: number): boolean;
}

interface Options {
	page: PageName;
	/** The canvas, in pixels, and the surface, in metres (same shape). */
	pixels: [number, number];
	size: [number, number];
	scene: string;
	/** A browser window with an address bar, or a phone with a status bar. */
	frame: "browser" | "phone";
	/** The address shown in the browser's bar. */
	address?: string;
	reducedMotion: boolean;
	/** Asks the stage for another frame (a tile has arrived). */
	wake(): void;
}

const DRIFT = 45; // page pixels a second while it plays by itself
const KEEP = 2; // tiles kept either side of the ones in view

export function pageScreen({ page: name, pixels: [w, h], size, scene, frame, address = "", reducedMotion, wake }: Options): PageScreen {
	const page = pages[name];
	const surface = canvasSurface(w, h);
	const { g } = surface;
	const mesh = new Mesh(new PlaneGeometry(size[0], size[1]), screenMaterial(surface.texture));
	const bar = frame === "browser" ? 54 : 30;
	const scale = w / page.width; // canvas pixels per page pixel
	const view = (h - bar) / scale; // page pixels on screen at once
	const max = Math.max(0, page.height - view);

	const tiles = new Map<number, HTMLImageElement | null>(); // null: on its way
	const load = (i: number) => {
		if (i < 0 || i >= page.files.length || tiles.has(i)) return;
		tiles.set(i, null);
		loadImage(page.files[i]).then(
			(img) => {
				if (!tiles.has(i)) return; // let go while it was loading
				tiles.set(i, img);
				dirty = true;
				wake();
			},
			() => tiles.delete(i),
		);
	};

	let offset = 0; // where the page is drawn from, in page pixels
	let target = 0; // where it is going
	let touched = false; // the visitor has scrolled it: no more drifting
	let down = true; // which way it drifts
	let hovered = false;
	let shown = 0; // the scrollbar and the hint, 0 to 1
	let dirty = true;
	let since = 0; // seconds since the last draw

	const draw = () => {
		g.fillStyle = frame === "browser" ? "#eceff1" : "#ffffff";
		g.fillRect(0, 0, w, h);
		const first = Math.floor(offset / page.tile);
		const last = Math.floor((offset + view) / page.tile);
		for (let i = first; i <= last; i++) {
			const img = tiles.get(i);
			if (img) g.drawImage(img, 0, bar + (i * page.tile - offset) * scale, w, img.naturalHeight * (w / img.naturalWidth));
			else load(i);
		}
		// Ahead and behind; let go of the rest.
		load(last + 1);
		load(first - 1);
		for (const i of tiles.keys()) if (i < first - KEEP || i > last + KEEP) tiles.delete(i);

		// The scrollbar: always faint, clearer while the pointer is on it or the page moves.
		if (max > 0) {
			const trackH = h - bar - 12;
			const thumbH = Math.max(40, (trackH * view) / page.height);
			const y = bar + 6 + (trackH - thumbH) * (offset / max);
			g.fillStyle = `rgba(20, 30, 45, ${0.18 + 0.35 * shown})`;
			roundRect(g, w - 12, y, 7, thumbH, 3.5);
		}
		// The hint, under the pointer, until the visitor scrolls.
		if (shown > 0.01 && hovered && !touched) {
			const text = studio.screenHint;
			const size = Math.round(w * 0.022);
			g.font = `600 ${size}px "Archivo Variable", sans-serif`;
			const tw = g.measureText(text).width;
			const pw = tw + size * 2;
			const ph = size * 2.1;
			g.globalAlpha = shown;
			g.fillStyle = "rgba(13, 22, 40, 0.86)";
			roundRect(g, (w - pw) / 2, h - ph - size, pw, ph, ph / 2);
			g.fillStyle = "#ffffff";
			g.textAlign = "center";
			g.textBaseline = "middle";
			g.fillText(text, w / 2, h - size - ph / 2);
			g.textAlign = "start";
			g.globalAlpha = 1;
		}

		// The frame: a browser's address bar, or a phone's status bar.
		g.fillStyle = "#1f2430";
		g.fillRect(0, 0, w, bar);
		if (frame === "browser") {
			for (const [i, c] of ["#f0596b", "#ffc20e", "#34d399"].entries()) {
				g.fillStyle = c;
				g.beginPath();
				g.arc(26 + i * 24, bar / 2, 7, 0, Math.PI * 2);
				g.fill();
			}
			g.fillStyle = "#2c3343";
			g.fillRect(110, 12, w - 140, bar - 24);
			g.fillStyle = "#c5cee0";
			g.font = '500 20px "Archivo Variable", sans-serif';
			g.textBaseline = "middle";
			g.fillText(address, 126, bar / 2 + 1);
		} else {
			g.fillStyle = "#c5cee0";
			g.font = '600 15px "Archivo Variable", sans-serif';
			g.textBaseline = "middle";
			g.fillText("9:41", 18, bar / 2 + 1);
			g.fillRect(w - 44, bar / 2 - 5, 24, 10);
		}
		surface.redraw();
	};

	return {
		mesh,
		scene,
		scroll(dy) {
			const next = Math.min(max, Math.max(0, target + dy));
			if (next === target) return false;
			touched = true;
			target = next;
			if (reducedMotion) offset = target;
			dirty = true;
			return true;
		},
		hover(on) {
			if (on !== hovered) dirty = true;
			hovered = on;
		},
		update(dt, inView) {
			if (!touched && !reducedMotion && inView > 0.02 && max > 0) {
				// Drift down, then back up, faster as the scene comes fully into view.
				target += (down ? 1 : -1) * DRIFT * Math.min(1, inView * 1.5) * dt;
				if (target >= max) [target, down] = [max, false];
				if (target <= 0) [target, down] = [0, true];
			}
			const was = offset;
			offset += (target - offset) * (1 - Math.exp(-12 * dt));
			if (Math.abs(target - offset) < 0.3) offset = target;
			// The scrollbar brightens and the hint shows while the pointer is on it, or while the visitor's scroll settles
			// (not while it drifts by itself).
			const want = hovered || (touched && Math.abs(target - offset) > 1) ? 1 : 0;
			const fade = shown;
			shown += (want - shown) * (1 - Math.exp(-8 * dt));
			if (Math.abs(want - shown) < 0.01) shown = want;
			const moving = offset !== was || shown !== fade;
			// Drifting on its own: about 20 draws a second is plenty (a full texture upload is the costly part). Scrolled by
			// the visitor or pointed at: every frame, so it follows the wheel smoothly.
			since += dt;
			const steady = touched || hovered || shown !== fade;
			if (dirty || (moving && (steady || since > SCREEN_STEP))) {
				dirty = false;
				since = 0;
				draw();
			}
			return moving && steady;
		},
	};
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	g.beginPath();
	g.roundRect(x, y, w, h, r);
	g.fill();
}
