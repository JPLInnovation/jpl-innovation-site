/**
 * The studio room, blocked out in code (no downloaded model): one round workspace for the home page's camera to move
 * through. Metres, y up. The room spans x -8.5 to 8.5 and z -3.4 (front wall) to 6.4 (back wall), 3.4 m high.
 *
 *   Front wall, left to right:  the desk (lamp, sketchbook, monitor, keyboard, the logo on the wall above), then the
 *                               five work stations (robot cart, drone bench, software stand, switch rack, test bench), and the curved
 *                               project wall at the right-hand end.
 *   Back wall, right to left:   the whiteboard and binders, the long window, the team's table, the door. Above its sill
 *                               the back wall is glass, onto the city at night (backdrop.ts), except around the door
 *                               and behind the whiteboard and the binders.
 *
 * Everything on a screen or on paper is real: the build guide on the monitor and the F450's ground station on the test
 * bench's laptop are 4K screenshots of the live pages that scroll with the mouse wheel (screens.ts;
 * public/studio/screens/, scripts/studio-screens.py); the projects and portraits are the site's
 * own pictures. The sketchbook is the F450's design page, drawn stroke by stroke (sketch.ts).
 *
 * This file holds the shell, the desk and the shared helpers; the stations and the back wall are in stations.ts.
 */
import {
	BoxGeometry,
	CanvasTexture,
	LinearFilter,
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
	Vector3,
	RepeatWrapping,
	SRGBColorSpace,
	type Texture,
	TextureLoader,
	Vector2,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { hardware } from "../three/finish";
import { tick } from "../three/yield";
import { deskSheets, type SketchText } from "../../text/studio";
import type { DroneRig } from "../three/models/drone";
import type { Palette, StageContext } from "../three/stage";
import { buildAmbience } from "./ambience";
import { buildBackdrop } from "./backdrop";
import { buildProps } from "./props";
import { createLightPool, type LightSpec } from "./lights";
import { BLANK, buildDeskSheets, type SheetPlace } from "./desk-sheets";
import { createSketch, paper, SKETCH_HEIGHT, SKETCH_WIDTH } from "./sketch";
import { type PageScreen, pageScreen } from "./screens";
import { buildStations, type Stations } from "./stations";
import { buildBench, type BuildBench } from "./build-bench";

export const ROOM = { x0: -8.5, x1: 8.5, z0: -3.4, z1: 6.4, h: 3.4 };
/** The desk (scenes 0 to 2): its middle and the height of its top; the sketchbook lies open on it at `book`. */
export const DESK = { x: -6, z: -2.45, top: 0.76, book: { x: -6.32, z: -2.31 } };
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
export const asset = (path: string) => `${BASE}${path}`;
type P3 = [number, number, number];
/**
 * The bench lamps (lights.ts): for each scene, where the light comes from (`at`), what it points at (`aim`), its power
 * (candela, dark theme), and how wide its cone is. Most hang from a real lamp you can see (FIXTURES); the rack, the
 * project wall and the back wall are lit from the ceiling, out of frame. The title and the sketch have the desk lamp.
 */
const LAMP = {
	build: { at: [-3.86, 1.16, -2.6] as P3, aim: [-4.12, 0.82, -2.38] as P3, power: 6, angle: 0.8 },
	test: { at: [-3.08, 1.33, -2.55] as P3, aim: [-2.62, 0.85, -2.45] as P3, power: 7, angle: 0.72 },
	robot: { at: [-0.22, 1.08, -2.72] as P3, aim: [-0.6, 0.42, -2.55] as P3, power: 8, angle: 0.8 },
	drone: { at: [0.96, 1.36, -2.62] as P3, aim: [1.42, 0.85, -2.55] as P3, power: 7, angle: 0.72 },
	crew: { at: [-2.4, 2.3, 5.0] as P3, aim: [-2.4, 0.75, 5.1] as P3, power: 22, angle: 0.75 },
};
/** The lamps you can see: a weighted base (or a ceiling cord), an arm, a shade aimed at the subject, a warm bulb. */
const FIXTURES: { base: P3; lamp: keyof typeof LAMP; hang?: boolean }[] = [
	{ base: [-3.74, 0.82, -2.66], lamp: "build" },
	{ base: [-3.28, 0.85, -2.88], lamp: "test" },
	{ base: [-0.05, 1.165, -3.26], lamp: "robot" }, // clamped to the pegboard's shelf
	{ base: [0.76, 0.85, -2.86], lamp: "drone" },
	{ base: [-2.4, 3.4, 5.1], lamp: "crew", hang: true }, // a pendant over the table
];
const sceneLamp = (lamp: (typeof LAMP)[keyof typeof LAMP], share = 1) => ({ ...lamp, power: lamp.power * share });
const SCENE_LAMPS: Record<string, { at: P3; aim: P3; power: number; angle: number }> = {
	build: LAMP.build,
	test: LAMP.build,
	simIn: LAMP.build,
	simFly: LAMP.test,
	simLand: LAMP.test,
	web: LAMP.test,
	robotics: LAMP.robot,
	drones: LAMP.drone,
	software: LAMP.drone,
	crew: LAMP.crew,
	research: sceneLamp(LAMP.build, 0.35),
	networks: { at: [3.3, 3.2, -1.5], aim: [3.3, 1.2, -2.7], power: 26, angle: 0.5 },
	wall: { at: [5.8, 3.3, 0.9], aim: [7.4, 1.2, 0.3], power: 10, angle: 0.8 },
	standards: { at: [5.0, 3.2, 5.0], aim: [5.0, 1.4, 6.35], power: 24, angle: 0.62 },
	timeline: { at: [1.2, 3.2, 4.8], aim: [1.2, 0.9, 6.2], power: 8, angle: 0.7 },
	contact: { at: [-5.6, 3.0, 5.4], aim: [-5.6, 1.0, 6.3], power: 9, angle: 0.6 },
};

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

/**
 * A real surface (Poly Haven, CC0; public/studio/tex/, sources in assets-src/room/polyhaven/): its colour, bumps and
 * shine, tiled. The floor's and the walls' colour maps are grey detail only, at a linear mean of 0.6, so the theme's
 * own colours (applyPalette) still decide the room's colour: set those through `tint`, which makes up the 0.6.
 */
export function surface(name: string, normalScale = 1) {
	const map = (kind: string, srgb: boolean) => {
		const texture = loader.load(asset(`/studio/tex/${name}-${kind}.webp`));
		texture.wrapS = texture.wrapT = RepeatWrapping;
		texture.anisotropy = 8;
		if (srgb) texture.colorSpace = SRGBColorSpace;
		return texture;
	};
	return { map: map("diff", true), normalMap: map("nor", false), normalScale: new Vector2(normalScale, normalScale), roughnessMap: map("rough", false) };
}
const woods = new Map<string, MeshStandardMaterial>();
/** Real wood (its own colour and grain), one material per kind for the whole room. */
export function woodMaterial(kind: "oak_veneer_01" | "walnut_veneer") {
	let material = woods.get(kind);
	if (!material) woods.set(kind, (material = hardware({ color: 0xd8d2cc, roughness: 0.55, ...surface(kind, 0.6) }, "plastic")));
	return material;
}
/** Sets a grey-detail surface's colour (a hex, as the theme gives it), making up for the detail map's 0.6. */
export const tint = (material: MeshStandardMaterial, hex: number) => material.color.set(hex).multiplyScalar(1 / 0.6);
/** Scales a plane's texture coordinates so its surface tiles every `tile` metres, whatever the plane's size. */
export function tiled<T extends PlaneGeometry>(geometry: T, tile: number): T {
	const { width, height } = geometry.parameters;
	const uv = geometry.getAttribute("uv");
	for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * width) / tile, (uv.getY(i) * height) / tile);
	return geometry;
}

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

/** A rod from `a` to `b`. */
function rod(parent: Group, a: Vector3, b: Vector3, radius: number, material: Material) {
	const d = b.clone().sub(a);
	const mesh = new Mesh(new CylinderGeometry(radius, radius, d.length(), 8), material);
	mesh.position.copy(a).addScaledVector(d, 0.5);
	mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
	parent.add(mesh);
}

/** The bench lamps you can see (FIXTURES). Returns their bulbs' one material, for the room to bring up with the lamp. */
function buildFixtures(parent: Group, metal: Material) {
	const shadeMat = hardware({ color: 0xe9e4d6, roughness: 0.4, side: DoubleSide }, "plastic");
	const bulbMat = new MeshBasicMaterial({ color: 0xfff0d0, toneMapped: false });
	for (const { base, lamp, hang } of FIXTURES) {
		const { at, aim } = LAMP[lamp];
		const b = new Vector3(...base);
		const head = new Vector3(...at);
		const toward = new Vector3(...aim).sub(head).normalize();
		if (hang) rod(parent, b, head, 0.004, metal);
		else {
			const foot = new Mesh(new CylinderGeometry(0.06, 0.07, 0.022, 24), metal);
			foot.position.copy(b).setY(b.y + 0.011);
			parent.add(foot);
			const elbow = new Vector3(b.x + (head.x - b.x) * 0.15, head.y + 0.14, b.z + (head.z - b.z) * 0.15);
			rod(parent, b, elbow, 0.008, metal);
			rod(parent, elbow, head, 0.008, metal);
		}
		const shade = new Mesh(new CylinderGeometry(0.03, hang ? 0.13 : 0.075, hang ? 0.14 : 0.1, 24, 1, true), shadeMat);
		shade.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), toward);
		shade.position.copy(head).addScaledVector(toward, hang ? 0.03 : 0.015);
		parent.add(shade);
		const bulb = new Mesh(new SphereGeometry(hang ? 0.035 : 0.022, 12, 8), bulbMat);
		bulb.position.copy(head).addScaledVector(toward, hang ? 0.05 : 0.035);
		parent.add(bulb);
	}
	return bulbMat;
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
	/** The scenes' ids, in the order the camera visits them. */
	ids: readonly string[];
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
	/** The line under the logo on the wall (src/text/site.ts). */
	slogan: string;
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
	/** The drone bench's F450, once loaded (the opening hook's desk drone shares its geometry). */
	stationDrone(): DroneRig | undefined;
	/** The build bench (build-bench.ts): the opening hook's drone stands on it, and says so with `occupied`. */
	bench: BuildBench;
	/** What the camera can fly into (devices.ts). */
	parts: { monitor: PageScreen; robot: Stations["robot"]; rack: Stations["rack"]; laptop: Group; drone: Stations["bench"] };
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
	// Real plaster and concrete (surface()), tinted by the theme (applyPalette).
	const plaster = surface("painted_plaster_wall", 0.5);
	const wallMat = new MeshStandardMaterial({ ...plaster, roughness: 0.92 });
	tint(wallMat, 0x0a174e);
	// Matte, and plain: a clear coat would mirror the bright generated environment at grazing angles (a pale band).
	const floorMat = new MeshStandardMaterial({ ...surface("concrete_floor_01", 0.7), roughness: 0.85, envMapIntensity: 0.35 });
	tint(floorMat, 0x071038);
	const ceilingMat = new MeshStandardMaterial({ ...plaster, roughness: 1 });
	tint(ceilingMat, 0x081240);
	const WALL_TILE = 2.4; // metres per repeat of the plaster
	const floor = new Mesh(tiled(new PlaneGeometry(width, depth), 2), floorMat);
	floor.rotation.x = -Math.PI / 2;
	floor.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
	group.add(floor);
	const ceiling = new Mesh(tiled(new PlaneGeometry(width, depth), WALL_TILE), ceilingMat);
	ceiling.rotation.x = Math.PI / 2;
	ceiling.position.set((x0 + x1) / 2, h, (z0 + z1) / 2);
	group.add(ceiling);
	const wall = (w: number, x: number, z: number, turn: number) => {
		const mesh = new Mesh(tiled(new PlaneGeometry(w, h), WALL_TILE), wallMat);
		mesh.position.set(x, h / 2, z);
		mesh.rotation.y = turn;
		group.add(mesh);
		return mesh;
	};
	wall(width, 0, z0, 0); // front, facing +z
	// The back wall: solid below the sill, around the door and its sign, and behind the whiteboard and the binders
	// (stations.ts); glass everywhere else, onto the night outside (backdrop.ts).
	const SILL = 0.85;
	const piers: [number, number][] = [
		[-6.3, -4.2], // the door, its sign and the badge by it
		[3.7, 7.4], // the whiteboard and the shelf of binders
	];
	const backPlane = (a: number, b: number, y0: number, y1: number, material: Material) => {
		const mesh = new Mesh(tiled(new PlaneGeometry(b - a, y1 - y0), WALL_TILE), material);
		mesh.position.set((a + b) / 2, (y0 + y1) / 2, z1);
		mesh.rotation.y = Math.PI;
		group.add(mesh);
		return mesh;
	};
	backPlane(x0, x1, 0, SILL, wallMat);
	for (const [a, b] of piers) backPlane(a, b, SILL, h, wallMat);
	const glassMat = new MeshStandardMaterial({ color: 0x0b1424, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.14, depthWrite: false });
	const mullionMat = new MeshStandardMaterial({ color: 0x1b2440, roughness: 0.5, metalness: 0.3 });
	const edges = [x0, ...piers.flat(), x1];
	for (let i = 0; i < edges.length; i += 2) {
		const [a, b] = [edges[i], edges[i + 1]];
		backPlane(a, b, SILL, h, glassMat);
		boxAt(group, b - a, 0.06, 0.14, mullionMat, (a + b) / 2, SILL, z1 - 0.06); // the sill
		boxAt(group, b - a, 0.05, 0.08, mullionMat, (a + b) / 2, h - 0.03, z1 - 0.04); // the head
	}
	// Mullions, clear of the long window (it has its own, stations.ts) and of the portraits' middles.
	for (const x of [-7.4, -3.55, -1.6]) boxAt(group, 0.05, h - SILL, 0.08, mullionMat, x, SILL + (h - SILL) / 2, z1 - 0.04);
	const backdrop = buildBackdrop(group);
	wall(depth, x0, (z0 + z1) / 2, Math.PI / 2);
	wall(depth, x1, (z0 + z1) / 2, -Math.PI / 2);
	// A skirting line and ceiling light strips: the room's lines, which make the camera's moves readable.
	const trimMat = new MeshStandardMaterial({ color: 0x1b2a52, roughness: 0.6 });
	boxAt(group, width, 0.08, 0.02, trimMat, 0, 0.04, z0 + 0.01);
	boxAt(group, width, 0.08, 0.02, trimMat, 0, 0.04, z1 - 0.01);
	const stripMat = new MeshBasicMaterial({ color: 0xfff1c2, toneMapped: false }); // warm white
	for (let x = -7; x <= 7; x += 3.5) boxAt(group, 2.4, 0.03, 0.08, stripMat, x, h - 0.02, 1.5);

	/* ---------- Lights: a dim sky; the desk lamp does the work in scene 0, then the pooled lights (lights.ts) ---------- */
	const sky = new HemisphereLight(0x8fb4ff, 0x071038, 0.4);
	group.add(sky);

	await tick();

	/* ---------- The desk (scene 0 to 2) ---------- */
	const deskX = DESK.x;
	const deskZ = DESK.z;
	const deskTop = DESK.top;
	const wood = woodMaterial("oak_veneer_01");
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
	// The page is drawn in full once; `order` holds each stroke's place in the drawing order, and the shader shows the
	// ink up to the pen's place (sketch.ts). Nothing is sent to the graphics card while the pen moves.
	const orderCanvas = document.createElement("canvas");
	orderCanvas.width = SKETCH_WIDTH / 2;
	orderCanvas.height = SKETCH_HEIGHT / 2;
	const orderTexture = new CanvasTexture(orderCanvas);
	orderTexture.generateMipmaps = false;
	orderTexture.minFilter = LinearFilter;
	const blank = canvasSurface(SKETCH_WIDTH, SKETCH_HEIGHT); // the same pages with nothing on them yet
	paper(blank.g);
	blank.redraw();
	createSketch(sketch, content.sketch.text, { states: content.sketch.states }, { g: orderCanvas.getContext("2d")!, redraw: () => (orderTexture.needsUpdate = true) }).show(1);
	const SKETCH_TIME = 4; // seconds the pen takes, from the moment the camera gets to the book
	let sketchStart = -1;
	let sketchDone = false;
	const sketchShow = { value: 0 };
	const book = new Mesh(new PlaneGeometry(0.84, 0.3), hardware({ color: 0xffffff, map: sketch.texture, roughness: 0.9 }, "printed"));
	// The lamp and the room's light fall on the page, and white paper under that much light is nearly white itself, which
	// leaves the pen little to show against: the page is dimmed (see applyPalette) so the ink keeps its contrast.
	const bookMaterial = book.material as MeshStandardMaterial;
	{
		const before = bookMaterial.onBeforeCompile;
		bookMaterial.onBeforeCompile = (shader, renderer) => {
			before.call(bookMaterial, shader, renderer);
			shader.uniforms.uShow = sketchShow;
			shader.uniforms.uOrder = { value: orderTexture };
			shader.uniforms.uBlank = { value: blank.texture };
			shader.fragmentShader = shader.fragmentShader.replace("void main() {", "uniform float uShow;\nuniform sampler2D uOrder;\nuniform sampler2D uBlank;\nvoid main() {").replace(
				"#include <map_fragment>",
				`#include <map_fragment>
				float inkAt = texture2D(uOrder, vMapUv).r;
				float inkHide = smoothstep(uShow - 0.012, uShow, inkAt) * step(inkAt, 0.99);
				diffuseColor.rgb = mix(diffuseColor.rgb, diffuse * texture2D(uBlank, vMapUv).rgb, inkHide); // the blank page under it`,
			);
		};
	}
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

	// The loose sheets around the book (never on it) and the corkboard of pinned pages between the shelving and the logo (desk-sheets.ts).
	const B = BLANK;
	const sheetPlaces: SheetPlace[] = [
		// The desk, left of the book: the parts list (with the coffee ring), on a pile.
		{ slot: B, on: "desk", x: -7.0, y: -2.29, turn: 0.3 },
		{ slot: B, on: "desk", x: -6.99, y: -2.27, turn: 0.17, layer: 1 },
		{ slot: 7, on: "desk", x: -7.0, y: -2.27, turn: 0.22, layer: 2, lift: 0.012 },
		// Behind the book: power, the top view (on two blanks), the flight controller.
		{ slot: 1, on: "desk", x: -6.5, y: -2.66, turn: -0.12 },
		{ slot: B, on: "desk", x: -6.14, y: -2.67, turn: 0.2, layer: 1 },
		{ slot: 0, on: "desk", x: -6.15, y: -2.66, turn: 0.1, layer: 2 },
		{ slot: 5, on: "desk", x: -5.78, y: -2.63, turn: -0.25, layer: 3 },
		// Right of the book: the battery under the tilt mount (its corner lifting), by the pencil.
		{ slot: 9, on: "desk", x: -5.67, y: -2.33, turn: 0.08 },
		{ slot: 4, on: "desk", x: -5.62, y: -2.26, turn: 0.35, layer: 1, lift: 0.016 },
		// In front of the keyboard: the props.
		{ slot: 6, on: "desk", x: -4.99, y: -2.12, turn: -0.3, layer: 1, lift: 0.01 },
		// The corkboard, between the shelving and the logo: the video and control paths, the legs, the 4G stick, the ideas.
		{ slot: 2, on: "wall", x: -7.35, y: 2.12, turn: 0.04, lift: 0.004 },
		{ slot: 3, on: "wall", x: -7.03, y: 2.13, turn: -0.03, lift: 0.004 },
		{ slot: 8, on: "wall", x: -7.34, y: 1.78, turn: 0.05, lift: 0.004, layer: 1 },
		{ slot: 10, on: "wall", x: -7.02, y: 1.76, turn: -0.06, lift: 0.004, layer: 1 },
		{ slot: B, on: "wall", x: -7.33, y: 1.49, turn: -0.08 },
		{ slot: 11, on: "wall", x: -7.17, y: 1.47, turn: 0.03, lift: 0.004, layer: 2 },
	];
	const deskSheetSet = buildDeskSheets(deskSheets, sheetPlaces, deskTop, z0, { x: -7.19, y: 1.81, w: 0.64, h: 1.0 });
	group.add(deskSheetSet.group);

	// The monitor: the build guide on screen. It drifts while you look at it, and scrolls with the mouse wheel (screens.ts).
	const monitorX = deskX + 0.88;
	boxAt(group, 0.84, 0.52, 0.03, new MeshStandardMaterial({ color: 0x11141c, roughness: 0.4 }), monitorX, deskTop + 0.36, deskZ - 0.24, 0.01);
	const monitor = pageScreen({
		page: "guide",
		size: [0.8, 0.475],
		scene: "research",
		address: `${content.domain}/build-guide`,
		background: "#ecf0ee",
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
	const lamp = new SpotLight(0xffd59a, 0, 5, 0.95, 0.95, 1.6);
	lamp.position.copy(bulb.position);
	lamp.target.position.set(deskX - 0.25, deskTop, deskZ + 0.12);
	group.add(lamp, lamp.target);

	// The logo on the wall above the desk, lit from below.
	const logoLight = imageTexture("/assets/jpl-logo-dark-480.webp");
	const logoDark = imageTexture("/assets/jpl-logo-light-480.webp");
	const logo = new Mesh(new PlaneGeometry(1.66, 0.6), new MeshBasicMaterial({ map: logoLight, transparent: true, toneMapped: false }));
	logo.position.set(deskX, 2.15, z0 + 0.02);
	group.add(logo);
	// The slogan under it, as on the opening page: white type, tinted for the theme, and only there once the lamp is on.
	const sloganFace = canvasSurface(1600, 160);
	const drawSlogan = () => {
		const { g } = sloganFace;
		g.clearRect(0, 0, 1600, 160);
		g.fillStyle = "#ffffff";
		g.textAlign = "center";
		g.textBaseline = "middle";
		g.font = '800 expanded 84px "Archivo Variable", "Archivo", system-ui, sans-serif';
		g.fillText(content.slogan, 800, 84, 1560);
		sloganFace.redraw();
	};
	drawSlogan();
	document.fonts?.ready.then(drawSlogan);
	const slogan = new Mesh(
		new PlaneGeometry(1.66, 0.166),
		new MeshBasicMaterial({ map: sloganFace.texture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
	);
	slogan.position.set(deskX, 1.76, z0 + 0.02);
	group.add(slogan);

	await tick();

	/* ---------- The stations, the project wall and the back wall ---------- */
	const stations = await buildStations(ctx, group, content);
	const bench = buildBench(ctx, group);
	await tick();
	// The pooled point lights: the glow of what the camera is on, and a ceiling light above the camera.
	const accents: Record<string, LightSpec> = { ...stations.accents, ...bench.accents, research: { at: [monitorX, deskTop + 0.36, deskZ + 0.05], color: 0x9ccfff, dark: 1.2, light: 1.2, distance: 1.6, decay: 2 } };
	// The bench lamps: a warm spot over each scene's subject (lights.ts), hung toward the room so the pool spills forward.
	const lamps: Record<string, LightSpec> = {};
	for (const [id, l] of Object.entries(SCENE_LAMPS)) lamps[id] = { at: l.at, aim: l.aim, angle: l.angle, color: 0xffcf96, dark: l.power, light: l.power * 0.5, distance: 6, decay: 2 };
	const bulbs = buildFixtures(group, steel);
	const pool = createLightPool(group, accents, lamps);
	const ambience = buildAmbience(group);
	const props = buildProps(group);

	/* ---------- Fog: depth, and the far end of the room falls into navy ---------- */
	ctx.scene.fog = new Fog(0x050c2e, 7, 19);

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
		stationDrone: stations.drone,
		bench,
		parts: { monitor, robot: stations.robot, rack: stations.rack, laptop: stations.laptop, drone: stations.bench },
		busy: () => busy || bench.busy() || stations.bench.busy() || (sketchStart >= 0 && sketchShow.value < 1),
		finishSketch() {
			sketchDone = true;
		},
		update(state) {
			const { lamp: on, time, near } = state;
			const dt = Math.max(0, time - lastTime);
			stations.update(state, dt);
			bench.update(state, state.ids, stations.drone());
			backdrop.update();
			ambience.update(state, dt);
			props.update(state, dt);
			lastTime = time;
			busy = false;
			for (const screen of screens) busy = screen.update(dt, near[screen.scene] ?? 0) || busy;
			// The lamp, and the room coming up with it.
			const level = on * on * (3 - 2 * on);
			lamp.intensity = (palette?.dark === false ? 9 : 16) * level;
			(bulb.material as MeshBasicMaterial).color.setRGB(0.2 + 0.8 * level, 0.18 + 0.76 * level, 0.15 + 0.66 * level);
			bulbs.color.copy((bulb.material as MeshBasicMaterial).color);
			sky.intensity = (palette?.dark ? 0.09 : 0.8) * (0.25 + 0.75 * level);
			pool.update(state.focus, level, !!palette?.dark);
			(logo.material as MeshBasicMaterial).color.setScalar(0.25 + 0.75 * level);
			(slogan.material as MeshBasicMaterial).opacity = level;

			// The sketch draws itself once the camera is at the book, over a few seconds, and stays drawn from then on,
			// wherever the camera goes.
			if (sketchStart < 0 && (near.sketch ?? 0) > 0.6) sketchStart = time;
			sketchShow.value = sketchDone ? 1 : sketchStart < 0 ? 0 : Math.min(1, (time - sketchStart) / SKETCH_TIME);

		},
		applyPalette(p) {
			palette = p;
			const dark = p.dark;
			tint(wallMat, dark ? 0x1c2756 : 0xf2eedf); // the site's navy and paper
			tint(ceilingMat, dark ? 0x121a3c : 0xfaf7ec);
			tint(floorMat, dark ? 0x2a3044 : 0xd9d2bc);
			trimMat.color.set(dark ? 0x1b2d6e : 0xd6cfb6);
			glassMat.color.set(dark ? 0x0a174e : 0xf5f1e4);
			glassMat.opacity = dark ? 0.14 : 0.1;
			mullionMat.color.set(dark ? 0x13235f : 0xfffdf4);
			backdrop.applyPalette(dark);
			bookMaterial.color.setScalar(dark ? 0.46 : 0.45);
			deskSheetSet.applyPalette(dark);
			stations.applyPalette(p);
			bench.applyPalette(dark);
			ambience.applyPalette(p);
			(logo.material as MeshBasicMaterial).map = dark ? logoLight : logoDark;
			(logo.material as MeshBasicMaterial).needsUpdate = true;
			(slogan.material as MeshBasicMaterial).color.set(dark ? 0xf2eedf : 0x0a174e);
			(ctx.scene.fog as Fog).color.set(dark ? 0x02050f : 0xf2eedf);
			(ctx.scene.fog as Fog).near = dark ? 5 : 12;
			(ctx.scene.fog as Fog).far = dark ? 16 : 32;
			sky.color.set(dark ? 0x8fb4ff : 0xffffff);
			sky.groundColor.set(dark ? 0x071038 : 0xd6cfb6);
			// The stage's product lights ride on the camera; in a room they'd flatten it, so they stay low.
			ctx.lights.key.intensity = dark ? 0.1 : 0.9;
			ctx.lights.fill.intensity = dark ? 0.04 : 0.35;
			ctx.lights.rim.intensity = dark ? 0.08 : 0.4;
			ctx.scene.environmentIntensity = dark ? 0.07 : 0.5;
		},
	};
}

