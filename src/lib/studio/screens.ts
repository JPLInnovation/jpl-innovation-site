/**
 * A page on one of the studio's screens (the desk monitor, the test bench's laptop) that the visitor can scroll with
 * the mouse wheel, like a real website inside the screen.
 *
 * The page is a tall screenshot at 3x pixels cut into tiles (public/studio/screens/, made by
 * scripts/studio-screens.py; the list is screens.json). Each tile goes to the graphics card once, as its own texture,
 * and the screen's shader shows the part of the page in view from the two tiles it spans: scrolling only changes a
 * number, so a 4K page scrolls as smoothly as a small one. Tiles are downloaded as they come near and let go of when
 * they are far away again.
 *
 *   - Until the visitor scrolls it, the page drifts down and back up by itself while its scene is in view.
 *   - The engine (engine.ts) sends the wheel to `scroll()` while the pointer is on the screen; at the page's top or
 *     bottom `scroll()` says no, and the wheel goes back to moving the studio.
 *   - A browser's address bar across the top, a scrollbar, and "Scroll to read" under the pointer (drawn once on a
 *     transparent layer over the page).
 */
import { Color, Mesh, PlaneGeometry, ShaderMaterial, SRGBColorSpace, Texture } from "three";
import { studio } from "../../text/studio";
import { canvasSurface, loadImage } from "./room";
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
	/** Every frame. `inView` is how much its scene is in view, 0 to 1. True while it is still moving for the visitor. */
	update(dt: number, inView: number): boolean;
}

interface Options {
	page: PageName;
	/** The surface, in metres. */
	size: [number, number];
	scene: string;
	/** The address shown in the browser's bar. */
	address: string;
	/** The page's own background, shown while a tile is on its way. */
	background: string;
	reducedMotion: boolean;
	/** Asks the stage for another frame (a tile has arrived). */
	wake(): void;
}

const DRIFT = 45; // page pixels a second while it plays by itself
const BAR = 0.068; // the address bar, as a share of the screen's height
const LAYER_W = 1600; // the address bar and hint layer, in pixels across

const vertexShader = /* glsl */ `
	varying vec2 vUv;
	void main() {
		vUv = uv;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

// The page: which page pixel is under this point of the screen, then that pixel from tile A (the top one) or tile B
// (the next). The lookups use the gradients of the unbroken page position, so there is no seam where tiles meet.
// Then the scrollbar, then the layer with the address bar and the hint.
const fragmentShader = /* glsl */ `
	uniform sampler2D uA;
	uniform sampler2D uB;
	uniform sampler2D uLayer;
	uniform float uHasA;
	uniform float uHasB;
	uniform float uIndexA;
	uniform float uOffset;
	uniform float uView;
	uniform float uTile;
	uniform float uHeight;
	uniform float uBar;
	uniform float uHint;
	uniform vec4 uHintRect;
	uniform vec3 uThumb;
	uniform vec2 uThumbX;
	uniform vec3 uBackground;
	varying vec2 vUv;

	void main() {
		vec3 colour = uBackground;
		float top = 1.0 - uBar;
		if (vUv.y < top) {
			float t = (top - vUv.y) / top;
			float pageY = uOffset + t * uView;
			float index = floor(pageY / uTile);
			float local = pageY - index * uTile;
			float tileH = min(uTile, uHeight - index * uTile);
			vec2 at = vec2(vUv.x, 1.0 - local / tileH);
			vec2 gx = dFdx(vec2(vUv.x, -pageY / tileH));
			vec2 gy = dFdy(vec2(vUv.x, -pageY / tileH));
			vec4 a = textureGrad(uA, at, gx, gy);
			vec4 b = textureGrad(uB, at, gx, gy);
			if (index == uIndexA && uHasA > 0.5) colour = a.rgb;
			else if (index == uIndexA + 1.0 && uHasB > 0.5) colour = b.rgb;
			if (vUv.x > uThumbX.x && vUv.x < uThumbX.y && t > uThumb.x && t < uThumb.y) {
				colour = mix(colour, vec3(0.08, 0.12, 0.18), uThumb.z);
			}
		}
		vec4 layer = texture2D(uLayer, vUv);
		if (vUv.x > uHintRect.x && vUv.x < uHintRect.z && vUv.y > uHintRect.y && vUv.y < uHintRect.w) layer.a *= uHint;
		gl_FragColor = vec4(mix(colour, layer.rgb, layer.a), 1.0);
		#include <colorspace_fragment>
	}
`;

export function pageScreen({ page: name, size, scene, address, background, reducedMotion, wake }: Options): PageScreen {
	const page = pages[name];
	const view = page.width * ((size[1] * (1 - BAR)) / size[0]); // page pixels on screen at once
	const max = Math.max(0, page.height - view);
	const count = page.files.length;

	/* ---------- The layer over the page: the address bar, and the hint (its opacity is a uniform) ---------- */
	const lw = LAYER_W;
	const lh = Math.round((LAYER_W * size[1]) / size[0]);
	const layer = canvasSurface(lw, lh);
	const bar = Math.round(lh * BAR);
	const hintSize = Math.round(lw * 0.024);
	const hintH = Math.round(hintSize * 2.1);
	const drawLayer = () => {
		const { g } = layer;
		g.clearRect(0, 0, lw, lh);
		g.fillStyle = "#1f2430";
		g.fillRect(0, 0, lw, bar);
		for (const [i, c] of ["#f0596b", "#ffc20e", "#34d399"].entries()) {
			g.fillStyle = c;
			g.beginPath();
			g.arc(bar * 0.48 + i * bar * 0.44, bar / 2, bar * 0.13, 0, Math.PI * 2);
			g.fill();
		}
		const field = bar * 1.9;
		g.fillStyle = "#2c3343";
		g.fillRect(field, bar * 0.22, lw - field - bar * 0.5, bar * 0.56);
		g.fillStyle = "#c5cee0";
		g.font = `500 ${Math.round(bar * 0.36)}px "Archivo Variable", sans-serif`;
		g.textBaseline = "middle";
		g.fillText(address, field + bar * 0.3, bar / 2 + 1);
		// The hint, under the pointer (faded in and out by the shader).
		g.font = `600 ${hintSize}px "Archivo Variable", sans-serif`;
		const pw = g.measureText(studio.screenHint).width + hintSize * 2;
		g.fillStyle = "rgba(13, 22, 40, 0.88)";
		g.beginPath();
		g.roundRect((lw - pw) / 2, lh - hintH - hintSize, pw, hintH, hintH / 2);
		g.fill();
		g.fillStyle = "#ffffff";
		g.textAlign = "center";
		g.fillText(studio.screenHint, lw / 2, lh - hintSize - hintH / 2);
		g.textAlign = "start";
		layer.redraw();
	};
	drawLayer();
	document.fonts?.ready.then(drawLayer); // again once the site's font is in
	const hintRect = [0.25, (hintSize * 0.5) / lh, 0.75, (hintSize * 1.5 + hintH) / lh];

	const empty = new Texture();
	const material = new ShaderMaterial({
		vertexShader,
		fragmentShader,
		uniforms: {
			uA: { value: empty },
			uB: { value: empty },
			uLayer: { value: layer.texture },
			uHasA: { value: 0 },
			uHasB: { value: 0 },
			uIndexA: { value: 0 },
			uOffset: { value: 0 },
			uView: { value: view },
			uTile: { value: page.tile },
			uHeight: { value: page.height },
			uBar: { value: BAR },
			uHint: { value: 0 },
			uHintRect: { value: hintRect },
			uThumb: { value: [0, 0, 0] },
			uThumbX: { value: [0.985, 0.994] },
			uBackground: { value: new Color(background) },
		},
	});
	const u = material.uniforms;
	const mesh = new Mesh(new PlaneGeometry(size[0], size[1]), material);

	/* ---------- Tiles: loaded as they come near, let go of when far away ---------- */
	const tiles = new Map<number, Texture | null>(); // null: on its way
	let shownA = -1; // the tile index the shader is showing as A (-1: look again)
	const load = (i: number) => {
		if (i < 0 || i >= count || tiles.has(i)) return;
		tiles.set(i, null);
		loadImage(page.files[i]).then(
			(img) => {
				if (!tiles.has(i)) return; // let go of while it was loading
				const texture = new Texture(img);
				texture.colorSpace = SRGBColorSpace;
				texture.anisotropy = 8;
				texture.needsUpdate = true;
				tiles.set(i, texture);
				shownA = -1; // put it on the screen if it belongs there
				wake();
			},
			() => tiles.delete(i),
		);
	};
	const place = () => {
		const a = Math.min(count - 1, Math.floor(offset / page.tile));
		for (const i of [a, a + 1, a - 1, a + 2]) load(i);
		for (const [i, texture] of tiles) {
			if (i >= a - 1 && i <= a + 2) continue;
			texture?.dispose();
			tiles.delete(i);
		}
		if (a === shownA) return;
		shownA = a;
		const ta = tiles.get(a);
		const tb = tiles.get(a + 1);
		u.uIndexA.value = a;
		u.uA.value = ta ?? empty;
		u.uB.value = tb ?? empty;
		u.uHasA.value = ta ? 1 : 0;
		u.uHasB.value = tb ? 1 : 0;
		if (!ta || (a + 1 < count && !tb)) shownA = -1; // look again once the missing one arrives
	};

	let offset = 0; // the top of the screen, in page pixels
	let target = 0; // where it is going
	let touched = false; // the visitor has scrolled it: no more drifting
	let down = true; // which way it drifts
	let hovered = false;
	let shown = 0; // the scrollbar and the hint, 0 to 1

	return {
		mesh,
		scene,
		scroll(dy) {
			const next = Math.min(max, Math.max(0, target + dy));
			if (next === target) return false;
			touched = true;
			target = next;
			if (reducedMotion) offset = target;
			return true;
		},
		hover(on) {
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
			// The scrollbar brightens and the hint shows while the pointer is on it, or while the visitor's scroll
			// settles (not while it drifts by itself).
			const want = hovered || (touched && Math.abs(target - offset) > 1) ? 1 : 0;
			const fade = shown;
			shown += (want - shown) * (1 - Math.exp(-8 * dt));
			if (Math.abs(want - shown) < 0.01) shown = want;
			if (inView > 0.02 || shownA < 0) place();
			u.uOffset.value = offset;
			const thumb = Math.max(0.08, view / page.height);
			const y = max > 0 ? (1 - thumb) * (offset / max) : 0;
			u.uThumb.value = [y, y + thumb, 0.18 + 0.35 * shown];
			u.uHint.value = hovered && !touched ? shown : 0;
			return (offset !== was || shown !== fade) && (touched || hovered || shown !== fade);
		},
	};
}
