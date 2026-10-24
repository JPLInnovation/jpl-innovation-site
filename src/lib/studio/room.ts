/**
 * The studio room, blocked out in code (no downloaded model): one round workspace for the home page's camera to move
 * through. Metres, y up. The room spans x -8.5 to 8.5 and z -3.4 (front wall) to 6.4 (back wall), 3.4 m high.
 *
 *   Front wall, left to right:  the desk (lamp, sketchbook, monitor, keyboard, the logo on the wall above), then the
 *                               four work stations (robot cart, drone bench, switch rack, test bench), and the curved
 *                               project wall at the right-hand end.
 *   Back wall, right to left:   the whiteboard and binders, the long window, the team's table, the door.
 *
 * Everything on a screen or on paper is real: the build guide on the monitor, and the F450's ground station and
 * pre-flight checklist on the test bench's laptop and phone, are screenshots of the live pages that scroll with the
 * mouse wheel (screens.ts; public/studio/screens/, scripts/studio-screens.py); the projects and portraits are the site's
 * own pictures. The sketchbook is the F450's design page, drawn stroke by stroke (sketch.ts).
 *
 * This file holds the shell, the desk and the shared helpers; the stations and the back wall are in stations.ts.
 */
import {
	BoxGeometry,
	CanvasTexture,
	CylinderGeometry,
	DoubleSide,
	Fog,
	Group,
	HemisphereLight,
	type Material,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PlaneGeometry,
	SphereGeometry,
	SpotLight,
	SRGBColorSpace,
	type Texture,
	TextureLoader,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { hardware } from "../three/finish";
import { tick } from "../three/yield";
import type { SketchText } from "../../text/studio";
import type { Palette, StageContext } from "../three/stage";
import { buildAmbience } from "./ambience";
import { buildProps } from "./props";
import { createLightPool, type LightSpec } from "./lights";
import { SHOTS } from "./scenes";
import { createSketch, SKETCH_HEIGHT, SKETCH_WIDTH } from "./sketch";
import { type PageScreen, pageScreen } from "./screens";
import { buildStations } from "./stations";

export const ROOM = { x0: -8.5, x1: 8.5, z0: -3.4, z1: 6.4, h: 3.4 };
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
export const asset = (path: string) => `${BASE}${path}`;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function boxAt(parent: Group, w: number, h: number, d: number, material: Material, x: number, y: number, z: number, radius = 0) {
	const geometry = radius > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 2, h / 2, d / 2)) : new BoxGeometry(w, h, d);
	const mesh = new Mesh(geometry, material);
	mesh.position.set(x, y, z);
	parent.add(mesh);
	return mesh;
}

/** A canvas you can draw into, shown on a surface. `redraw()` after drawing. */
export function canvasSurface(width: number, height: number) {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const g = canvas.getContext("2d")!;
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.anisotropy = 8;
	return { canvas, g, texture, redraw: () => (texture.needsUpdate = true) };
}

const loader = new TextureLoader();
export function imageTexture(path: string) {
	const texture = loader.load(asset(path));
	texture.colorSpace = SRGBColorSpace;
	texture.anisotropy = 8;
	return texture;
}

/**
 * An image file as an <img>, for drawing into a canvas. An SVG with only a viewBox has no size of its own (the browser
 * would draw it at 300 × 150), so it gets one from its viewBox, at `svgWidth` pixels wide.
 */
export async function loadImage(path: string, svgWidth = 1600) {
	let src = asset(path);
	let url: string | undefined;
	if (path.endsWith(".svg")) {
		const text = await (await fetch(src)).text();
		const box = /viewBox="([\d.\s-]+)"/.exec(text)?.[1].trim().split(/\s+/).map(Number);
		if (box?.length === 4 && !/<svg[^>]*\swidth=/.test(text)) {
			const sized = text.replace("<svg", `<svg width="${svgWidth}" height="${Math.round((svgWidth * box[3]) / box[2])}"`);
			src = url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
		}
	}
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			resolve(img);
			if (url) URL.revokeObjectURL(url);
		};
		img.onerror = reject;
		img.src = src;
	});
}

/** A screen that shows a texture without being lit (it glows a little in the dark). */
export const screenMaterial = (map: Texture) => new MeshBasicMaterial({ map, toneMapped: false });

/* ------------------------------------------------------------------ */
/* The room                                                            */
/* ------------------------------------------------------------------ */

export interface RoomState {
	/** Where the camera is along the scenes (0 = the first; fractions in between). */
	position: number;
	/** How far the first scene's lamp has come on, 0 to 1. */
	lamp: number;
	/** Seconds since the room appeared (screens that play). */
	time: number;
	/** How much each scene is in view, 0 to 1, by scene id (follows the scroll). */
	near: Record<string, number>;
	/** How much the camera is on each scene, by scene id, summing to 1 (follows the camera's own easing). */
	focus: Record<string, number>;
}

/** What the room shows, from the site's own content (the page passes it in; src/components/Studio.astro). */
export interface RoomContent {
	/** The project wall, in order. `img` is a path under public/. */
	projects: { title: string; img: string; badge?: string; href: string }[];
	/** The portrait screens by the table. */
	portraits: { name: string; role: string; img: string }[];
	/** The whiteboard: a heading, the standards, and the steps of how we work (the last one circled). */
	standards: { heading: string; items: string[]; steps: string[] };
	/** The window: a year on each pane. */
	milestones: { year: string; state: "past" | "now" | "future" }[];
	/** The lit sign over the door. */
	sign: string;
	/** The web address drawn in the address bars of the monitor and the laptop (src/text/site.ts). */
	domain: string;
	/** The sketchbook: its words (src/text/studio.ts) and where the project is on its roadmap ("done", "current", "upcoming", in order). */
	sketch: { text: SketchText; states: string[] };
}

export interface Room {
	group: Group;
	/** The project wall's panels, for the pointer (see Stations). */
	wall: { screens: Mesh[]; hover(index: number): void };
	/** The screens whose pages scroll with the mouse wheel (screens.ts), for the engine. */
	screens: PageScreen[];
	/** The logo on the wall above the desk (the opening page's logo flies onto it). */
	logo: Mesh;
	/** True while a screen is moving because the visitor scrolled or pointed at it (the stage keeps full speed). */
	busy(): boolean;
	/** The sketchbook is drawn at once (a jump to its scene, the stills), instead of over a few seconds. */
	finishSketch(): void;
	update(state: RoomState): void;
	applyPalette(p: Palette): void;
}

/** Built in slices (`tick`), so the page stays responsive while the room comes up. */
export async function buildRoom(ctx: StageContext, content: RoomContent): Promise<Room> {
	const group = new Group();
	ctx.root.add(group);
	const { x0, x1, z0, z1, h } = ROOM;
	const width = x1 - x0;
	const depth = z1 - z0;

	/* ---------- Shell ---------- */
	const wallMat = new MeshStandardMaterial({ color: 0x0c1631, roughness: 0.92 });
	// Matte, and plain: a clear coat would mirror the bright generated environment at grazing angles (a pale band).
	const floorMat = new MeshStandardMaterial({ color: 0x0a1022, roughness: 0.85, envMapIntensity: 0.35 });
	const ceilingMat = new MeshStandardMaterial({ color: 0x0a1228, roughness: 1 });
	const floor = new Mesh(new PlaneGeometry(width, depth), floorMat);
	floor.rotation.x = -Math.PI / 2;
	floor.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
	group.add(floor);
	const ceiling = new Mesh(new PlaneGeometry(width, depth), ceilingMat);
	ceiling.rotation.x = Math.PI / 2;
	ceiling.position.set((x0 + x1) / 2, h, (z0 + z1) / 2);
	group.add(ceiling);
	const wall = (w: number, x: number, z: number, turn: number) => {
		const mesh = new Mesh(new PlaneGeometry(w, h), wallMat);
		mesh.position.set(x, h / 2, z);
		mesh.rotation.y = turn;
		group.add(mesh);
		return mesh;
	};
	wall(width, 0, z0, 0); // front, facing +z
	wall(width, 0, z1, Math.PI); // back, facing -z
	wall(depth, x0, (z0 + z1) / 2, Math.PI / 2);
	wall(depth, x1, (z0 + z1) / 2, -Math.PI / 2);
	// A skirting line and ceiling light strips: the room's lines, which make the camera's moves readable.
	const trimMat = new MeshStandardMaterial({ color: 0x1b2a52, roughness: 0.6 });
	boxAt(group, width, 0.08, 0.02, trimMat, 0, 0.04, z0 + 0.01);
	boxAt(group, width, 0.08, 0.02, trimMat, 0, 0.04, z1 - 0.01);
	const stripMat = new MeshBasicMaterial({ color: 0x9fdcff, toneMapped: false });
	for (let x = -7; x <= 7; x += 3.5) boxAt(group, 2.4, 0.03, 0.08, stripMat, x, h - 0.02, 1.5);

	/* ---------- Lights: a dim sky; the desk lamp does the work in scene 0, then the pooled lights (lights.ts) ---------- */
	const sky = new HemisphereLight(0x8fb4ff, 0x0a1022, 0.4);
	group.add(sky);

	await tick();

	/* ---------- The desk (scene 0 to 2) ---------- */
	const deskX = -6;
	const deskZ = -2.45;
	const deskTop = 0.76;
	const wood = hardware({ color: 0x5b4636, roughness: 0.55 }, "plastic");
	const steel = hardware({ color: 0x2d3446, roughness: 0.4, metalness: 0.7 }, "anodised");
	boxAt(group, 2.3, 0.05, 0.9, wood, deskX, deskTop - 0.025, deskZ, 0.012);
	for (const [dx, dz] of [[-1.08, -0.38], [1.08, -0.38], [-1.08, 0.38], [1.08, 0.38]]) boxAt(group, 0.05, deskTop - 0.05, 0.05, steel, deskX + dx, (deskTop - 0.05) / 2, deskZ + dz);
	// Chair, pushed in.
	const fabric = hardware({ color: 0x1d2b4f, roughness: 0.9 }, "fabric");
	boxAt(group, 0.5, 0.07, 0.48, fabric, deskX - 0.2, 0.47, deskZ + 0.95, 0.03);
	boxAt(group, 0.5, 0.55, 0.06, fabric, deskX - 0.2, 0.82, deskZ + 1.18, 0.03);
	boxAt(group, 0.04, 0.44, 0.04, steel, deskX - 0.2, 0.22, deskZ + 0.95);

	// The sketchbook, open flat; the pencil beside it.
	const sketch = canvasSurface(SKETCH_WIDTH, SKETCH_HEIGHT);
	const sketchPages = createSketch(sketch, content.sketch.text, { states: content.sketch.states });
	const SKETCH_TIME = 4; // seconds the pen takes, from the moment the camera gets to the book
	let sketchStart = -1;
	let sketchDone = false;
	let sketchShown = 0;
	let sketchAt = -1;
	const book = new Mesh(new PlaneGeometry(0.84, 0.3), hardware({ color: 0xffffff, map: sketch.texture, roughness: 0.9 }, "printed"));
	// The lamp and the room's light fall on the page, and white paper under that much light is nearly white itself, which
	// leaves the pen little to show against: the page is dimmed (see applyPalette) so the ink keeps its contrast.
	const bookMaterial = book.material as MeshStandardMaterial;
	book.rotation.x = -Math.PI / 2;
	book.rotation.z = 0.03;
	book.position.set(deskX - 0.32, deskTop + 0.011, deskZ + 0.14);
	group.add(book);
	// The cover, just under the pages and a little bigger.
	boxAt(group, 0.87, 0.009, 0.32, new MeshStandardMaterial({ color: 0x23324f, roughness: 0.7 }), deskX - 0.32, deskTop + 0.005, deskZ + 0.14).rotation.y = -0.03;
	const pencil = new Mesh(new CylinderGeometry(0.004, 0.004, 0.17, 8), hardware({ color: 0xe0a82a, roughness: 0.5 }, "plastic"));
	pencil.rotation.z = Math.PI / 2;
	pencil.rotation.y = 0.5;
	pencil.position.set(deskX + 0.16, deskTop + 0.006, deskZ + 0.26);
	group.add(pencil);

	// The monitor: the build guide on screen. It drifts while you look at it, and scrolls with the mouse wheel (screens.ts).
	const monitorX = deskX + 0.88;
	boxAt(group, 0.84, 0.52, 0.03, new MeshStandardMaterial({ color: 0x11141c, roughness: 0.4 }), monitorX, deskTop + 0.36, deskZ - 0.24, 0.01);
	const monitor = pageScreen({
		page: "guide",
		pixels: [1280, 760],
		size: [0.8, 0.475],
		scene: "research",
		frame: "browser",
		address: `${content.domain}/build-guide`,
		reducedMotion: ctx.reducedMotion,
		wake: () => ctx.wake(),
	});
	monitor.mesh.position.set(monitorX, deskTop + 0.36, deskZ - 0.223);
	group.add(monitor.mesh);
	boxAt(group, 0.06, 0.1, 0.06, steel, monitorX, deskTop + 0.05, deskZ - 0.26);
	boxAt(group, 0.26, 0.012, 0.18, steel, monitorX, deskTop + 0.006, deskZ - 0.24, 0.004);
	boxAt(group, 0.44, 0.02, 0.15, new MeshStandardMaterial({ color: 0x1b1f2a, roughness: 0.6 }), monitorX, deskTop + 0.01, deskZ + 0.12, 0.005);
	const mug = new Mesh(new CylinderGeometry(0.04, 0.036, 0.1, 20), hardware({ color: 0xf2f4f8, roughness: 0.35 }, "wrap"));
	mug.position.set(deskX - 0.95, deskTop + 0.05, deskZ - 0.15);
	group.add(mug);

	// The lamp: a base, an arm, a shade; it switches on as the first scene opens.
	const lampBase = new Mesh(new CylinderGeometry(0.09, 0.1, 0.025, 24), steel);
	lampBase.position.set(deskX - 0.78, deskTop + 0.012, deskZ - 0.22);
	group.add(lampBase);
	const arm = new Mesh(new CylinderGeometry(0.01, 0.01, 0.62, 8), steel);
	arm.position.set(deskX - 0.66, deskTop + 0.3, deskZ - 0.14);
	arm.rotation.z = -0.4;
	group.add(arm);
	const shade = new Mesh(new CylinderGeometry(0.05, 0.11, 0.13, 24, 1, true), hardware({ color: 0xe9eef7, roughness: 0.35, side: DoubleSide }, "plastic"));
	shade.position.set(deskX - 0.5, deskTop + 0.58, deskZ - 0.06);
	shade.rotation.z = 0.35;
	group.add(shade);
	const bulb = new Mesh(new SphereGeometry(0.03, 16, 12), new MeshBasicMaterial({ color: 0xfff0d0, toneMapped: false }));
	bulb.position.set(shade.position.x + 0.012, shade.position.y - 0.03, shade.position.z);
	group.add(bulb);
	const lamp = new SpotLight(0xffe6c0, 0, 4, 0.75, 0.7, 1.6);
	lamp.position.copy(bulb.position);
	lamp.target.position.set(deskX - 0.25, deskTop, deskZ + 0.12);
	group.add(lamp, lamp.target);

	// The logo on the wall above the desk, lit from below.
	const logoLight = imageTexture("/assets/jpl-logo-dark-480.webp");
	const logoDark = imageTexture("/assets/jpl-logo-light-480.webp");
	const logo = new Mesh(new PlaneGeometry(1.66, 0.6), new MeshBasicMaterial({ map: logoLight, transparent: true, toneMapped: false }));
	logo.position.set(deskX, 2.15, z0 + 0.02);
	group.add(logo);

	await tick();

	/* ---------- The stations, the project wall and the back wall ---------- */
	const stations = await buildStations(ctx, group, content);
	await tick();
	// The pooled point lights: the glow of what the camera is on, and a ceiling light above the camera.
	const accents: Record<string, LightSpec> = { ...stations.accents, research: { at: [monitorX, deskTop + 0.36, deskZ + 0.05], color: 0x9ccfff, dark: 1.2, light: 1.2, distance: 1.6, decay: 2 } };
	const overhead: Record<string, LightSpec> = {};
	for (const id of Object.keys(SHOTS)) overhead[id] = { at: [SHOTS[id].camera[0], h - 0.4, 1.5], color: 0xcfe3ff, dark: 4.5, light: 10, distance: 9, decay: 1.6 };
	const pool = createLightPool(group, accents, overhead);
	const ambience = buildAmbience(group);
	const props = buildProps(group);

	/* ---------- Fog: depth, and the far end of the room falls into navy ---------- */
	ctx.scene.fog = new Fog(0x050a1f, 7, 19);

	let palette: Palette | undefined;
	let lastTime = 0;
	// The screens whose pages scroll: the monitor here, the test bench's laptop and phone in stations.ts.
	const screens = [monitor, ...stations.screens];
	let busy = false;
	return {
		group,
		wall: stations.wall,
		screens,
		logo,
		busy: () => busy,
		finishSketch() {
			sketchDone = true;
		},
		update(state) {
			const { lamp: on, time, near } = state;
			const dt = Math.max(0, time - lastTime);
			stations.update(state, dt);
			ambience.update(state, dt);
			props.update(state, dt);
			lastTime = time;
			busy = false;
			for (const screen of screens) busy = screen.update(dt, near[screen.scene] ?? 0) || busy;
			// The lamp, and the room coming up with it.
			const level = on * on * (3 - 2 * on);
			lamp.intensity = 7 * level;
			(bulb.material as MeshBasicMaterial).color.setRGB(0.2 + 0.8 * level, 0.18 + 0.76 * level, 0.15 + 0.66 * level);
			sky.intensity = (palette?.dark ? 0.35 : 0.9) * (0.25 + 0.75 * level);
			pool.update(state.focus, level, !!palette?.dark);
			(logo.material as MeshBasicMaterial).color.setScalar(0.25 + 0.75 * level);

			// The sketch draws itself once the camera is at the book, over a few seconds (the strokes arrive a few times a
			// second at most), and stays drawn from then on, wherever the camera goes.
			if (sketchStart < 0 && (near.sketch ?? 0) > 0.6) sketchStart = time;
			const sketchWant = sketchDone ? 1 : sketchStart < 0 ? 0 : Math.min(1, (time - sketchStart) / SKETCH_TIME);
			if (sketchWant > sketchShown && (time - sketchAt > 0.05 || sketchWant >= 1)) {
				sketchShown = sketchWant;
				sketchAt = time;
				sketchPages.show(sketchWant);
			}

		},
		applyPalette(p) {
			palette = p;
			const dark = p.dark;
			wallMat.color.set(dark ? 0x0c1631 : 0xdfe7f5);
			ceilingMat.color.set(dark ? 0x0a1228 : 0xeef3fb);
			(floorMat as MeshStandardMaterial).color.set(dark ? 0x0a1022 : 0xbfc9dc);
			trimMat.color.set(dark ? 0x1b2a52 : 0xb8c5dd);
			bookMaterial.color.setScalar(dark ? 0.46 : 0.45);
			stations.applyPalette(p);
			ambience.applyPalette(p);
			(logo.material as MeshBasicMaterial).map = dark ? logoLight : logoDark;
			(logo.material as MeshBasicMaterial).needsUpdate = true;
			(ctx.scene.fog as Fog).color.set(dark ? 0x050a1f : 0xe6edf8);
			(ctx.scene.fog as Fog).near = dark ? 7 : 12;
			(ctx.scene.fog as Fog).far = dark ? 19 : 32;
			sky.color.set(dark ? 0x8fb4ff : 0xffffff);
			sky.groundColor.set(dark ? 0x0a1022 : 0xb9c4d8);
			// The stage's product lights ride on the camera; in a room they'd flatten it, so they stay low.
			ctx.lights.key.intensity = dark ? 0.55 : 1.1;
			ctx.lights.fill.intensity = dark ? 0.2 : 0.45;
			ctx.lights.rim.intensity = dark ? 0.35 : 0.5;
			ctx.scene.environmentIntensity = dark ? 0.22 : 0.6;
		},
	};
}

