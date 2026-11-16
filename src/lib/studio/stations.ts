/**
 * The rest of the studio, after the desk (room.ts): the five work stations against the front wall, the curved wall of
 * projects at the right-hand end, and along the back wall the whiteboard, the window, the team's table and the door.
 * Metres, y up; positions match the camera's shots in scenes.ts.
 *
 *   Robotics   the KitBot on a low rolling cart, a pegboard of tools behind it (the robot's own CAD, frc-robot.ts)
 *   Drones     the F450 on a landing mat, powered up on the bench (its LED blinks; it has not flown, so it never lifts off) (drone.ts)
 *   Software   a small stand with a PC and a monitor, Lifetime Server on its screen
 *   Networks   a switch rack with blinking port lights and patch cables
 *   Testing    the test bench: a laptop on the F450's ground station (its page scrolls with the mouse wheel; screens.ts)
 *              and an easel whiteboard with the bench test. Its scene id stays "web" (links and the camera use it).
 *   The wall   one panel per project, on an arc, in front of a curved LED video wall; they turn to face the camera one
 *              after another
 *   Standards  the whiteboard (the standards and the three steps, written out as the scene opens) and the binders
 *   Timeline   the long window: night sky in the dark theme, dusk in the light one; a year on each pane
 *   The crew   the table, two chairs, a portrait screen behind each
 *   Contact    the door, ajar, light beyond it, a lit sign over it
 *
 * The robot and the drone load their CAD in the background; the room is complete without them. Their shaders and
 * textures are made ready with the room's (engine.ts, ready), which waits for both (`loaded`).
 */
import {
	CatmullRomCurve3,
	Color,
	CylinderGeometry,
	DoubleSide,
	ExtrudeGeometry,
	Group,
	InstancedMesh,
	Matrix4,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Object3D,
	PlaneGeometry,
	ShaderMaterial,
	ShapeGeometry,
	TubeGeometry,
	Vector3,
} from "three";
import { hardware } from "../three/finish";
import { tick } from "../three/yield";
import type { DroneRig } from "../three/models/drone";
import type { Palette, StageContext } from "../three/stage";
import { boxAt, canvasSurface, imageTexture, loadImage, ROOM, screenMaterial, woodMaterial } from "./room";
import { type PageScreen, pageScreen } from "./screens";
import type { LightSpec } from "./lights";
import { cover, cutCorners, cutCornerSurface, projectFace } from "./panels";
import { benchBoard } from "../../text/studio";
import type { RoomContent, RoomState } from "./room";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => {
	const t = clamp01(x);
	return t * t * (3 - 2 * t);
};

export interface Stations {
	/** The glow of each scene's subject, for the pooled lights (lights.ts). */
	accents: Record<string, LightSpec>;
	/** The project wall's panels, for the pointer: the engine casts a ray at `screens`, and tells the one under it with `hover`. */
	wall: { screens: Mesh[]; hover(index: number): void };
	/** The test bench's laptop and phone, whose pages scroll (the room updates them with the monitor). */
	screens: PageScreen[];
	/** The drone bench's F450, once it has loaded (the opening hook's desk drone shares its geometry). */
	drone(): DroneRig | undefined;
	/** What the camera can fly into (src/lib/studio/devices.ts): the robot on its cart, the rack and the laptop. */
	robot: { holder: Group; center: Vector3; explode(amount: number): void; turn(angle: number): void };
	rack: { group: Group; center: Vector3 };
	laptop: Group;
	/** Settles once the robot's and the drone's CAD are in (or have failed): the studio's loading screen waits for it. */
	loaded: Promise<unknown>;
	/** The software stand's monitor (Lifetime on it): the camera flies in until it fills the window. */
	software: Mesh;
	/** The F450 on its bench: arm it and its props spin up for a few seconds, then wind down. It never lifts off. */
	bench: { holder: Group; arm(): void; busy(): boolean };
	update(state: RoomState, dt: number): void;
	applyPalette(p: Palette): void;
}

/** Wraps `text` into lines that fit `width` at the current font. */
function wrap(g: CanvasRenderingContext2D, text: string, width: number) {
	const lines: string[] = [];
	let line = "";
	for (const word of text.split(/\s+/)) {
		const next = line ? `${line} ${word}` : word;
		if (g.measureText(next).width > width && line) {
			lines.push(line);
			line = word;
		} else line = next;
	}
	if (line) lines.push(line);
	return lines;
}

/** Live screens redraw at most this often (seconds): about 20 times a second. */
export const SCREEN_STEP = 0.05;
const FONT = '"Archivo Variable", "Archivo", system-ui, sans-serif';
/** Handwriting (the sketchbook's Caveat, public/fonts): the whiteboards and the names on the crew's photos. */
const HAND = '"Caveat", "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';

/** Built in slices (`tick`), so the page stays responsive while the room comes up. */
export async function buildStations(ctx: StageContext, parent: Group, content: RoomContent): Promise<Stations> {
	const group = new Group();
	parent.add(group);
	const { z0, z1 } = ROOM;
	const benchTop = 0.85;

	const bench = hardware({ color: 0x2a3550, roughness: 0.6 }, "plastic");
	const steel = hardware({ color: 0x2d3446, roughness: 0.4, metalness: 0.7 }, "anodised");
	const dark = new MeshStandardMaterial({ color: 0x141a28, roughness: 0.5 });
	const wood = woodMaterial("oak_veneer_01");
	const themed: { mat: MeshStandardMaterial; dark: number; light: number }[] = [
		{ mat: bench as MeshStandardMaterial, dark: 0x5d6479, light: 0xd9d2bc },
	];

	/** A workbench: a top on four legs, its top surface at `benchTop`. */
	const workbench = (x: number, w = 1.6, d = 0.8, z = -2.6) => {
		boxAt(group, w, 0.05, d, bench, x, benchTop - 0.025, z, 0.01);
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxAt(group, 0.045, benchTop - 0.05, 0.045, steel, x + sx * (w / 2 - 0.06), (benchTop - 0.05) / 2, z + sz * (d / 2 - 0.06));
	};

	/* ================================================================== */
	/* Robotics: the KitBot on a cart                                      */
	/* ================================================================== */
	const robotX = -0.6;
	const cartTop = 0.36;
	boxAt(group, 1.1, 0.04, 0.86, steel, robotX, cartTop - 0.02, -2.55, 0.008);
	boxAt(group, 1.1, 0.03, 0.86, steel, robotX, 0.12, -2.55, 0.008);
	for (const sx of [-1, 1])
		for (const sz of [-1, 1]) {
			boxAt(group, 0.03, cartTop - 0.08, 0.03, steel, robotX + sx * 0.52, cartTop / 2 + 0.02, -2.55 + sz * 0.4);
			const caster = new Mesh(new CylinderGeometry(0.035, 0.035, 0.03, 16), dark);
			caster.rotation.z = Math.PI / 2;
			caster.position.set(robotX + sx * 0.5, 0.035, -2.55 + sz * 0.38);
			group.add(caster);
		}
	// Pegboard behind it, with tools hung on it.
	const peg = canvasSurface(512, 320);
	const pegboard = new Mesh(new PlaneGeometry(1.7, 1.06), hardware({ color: 0xffffff, map: peg.texture, roughness: 0.85 }, "printed"));
	pegboard.position.set(robotX, 1.45, z0 + 0.02);
	group.add(pegboard);
	const drawPeg = (darkTheme: boolean) => {
		const { g, canvas } = peg;
		g.fillStyle = darkTheme ? "#1a2442" : "#b9c6dc";
		g.fillRect(0, 0, canvas.width, canvas.height);
		g.fillStyle = darkTheme ? "#0b1124" : "#8e9cb6";
		for (let y = 12; y < canvas.height; y += 20) for (let x = 12; x < canvas.width; x += 20) g.fillRect(x - 2, y - 2, 4, 4);
		peg.redraw();
	};
	const toolMat = hardware({ color: 0xc8283a, roughness: 0.45 }, "plastic");
	const toolMetal = hardware({ color: 0xb8c0cc, roughness: 0.3, metalness: 0.9 }, "metal");
	for (const [i, x] of [-0.62, -0.42, -0.22, 0.18, 0.4, 0.62].entries()) {
		const len = 0.18 + (i % 3) * 0.06;
		boxAt(group, 0.025, len * 0.45, 0.02, toolMat, robotX + x, 1.62 - len * 0.2, z0 + 0.05, 0.006);
		boxAt(group, 0.012, len * 0.6, 0.012, toolMetal, robotX + x, 1.62 - len * 0.72, z0 + 0.05);
	}
	boxAt(group, 0.5, 0.025, 0.12, steel, robotX, 1.15, z0 + 0.08); // a shelf
	for (const [i, c] of [0xf5d042, 0x2f7ce6, 0xf2eedf].entries()) boxAt(group, 0.1, 0.07, 0.08, hardware({ color: c, roughness: 0.5 }, "plastic"), robotX - 0.15 + i * 0.15, 1.2, z0 + 0.08, 0.01);

	let robot: { model: Group; animate(t: number, dt: number): void; applyPalette(p: { dark: boolean }): void } | undefined;
	// Taking the robot apart (the cart's device): every CAD part's instance slides out from the robot's middle, along the
	// line from the middle to the part, so the robot opens like an exploded drawing. The parts' poses are read once, on
	// the first use, and put back exactly at 0.
	let parts: { mesh: InstancedMesh; index: number; base: Matrix4; out: Vector3 }[] | undefined;
	let explodedBy = 0;
	const shifted = new Matrix4();
	const explode = (amount: number) => {
		if (!robot || amount === explodedBy) return;
		if (!parts) {
			parts = [];
			const middle = new Vector3();
			const centre = new Vector3();
			const found: { mesh: InstancedMesh; index: number; base: Matrix4; at: Vector3 }[] = [];
			robot.model.traverse((o) => {
				const mesh = o as InstancedMesh;
				if (!mesh.isInstancedMesh) return;
				mesh.geometry.computeBoundingBox();
				mesh.geometry.boundingBox!.getCenter(centre);
				for (let i = 0; i < mesh.count; i++) {
					const base = new Matrix4();
					mesh.getMatrixAt(i, base);
					const at = centre.clone().applyMatrix4(base);
					middle.add(at);
					found.push({ mesh, index: i, base, at });
				}
			});
			middle.divideScalar(Math.max(1, found.length));
			for (const f of found) parts.push({ mesh: f.mesh, index: f.index, base: f.base, out: f.at.sub(middle).multiply(new Vector3(0.75, 0.6, 0.75)) });
		}
		explodedBy = amount;
		const e = amount * amount * (3 - 2 * amount);
		for (const part of parts) {
			part.mesh.setMatrixAt(part.index, shifted.makeTranslation(part.out.x * e, part.out.y * e + 0.12 * e, part.out.z * e).multiply(part.base));
			part.mesh.instanceMatrix.needsUpdate = true;
			if (amount > 0) part.mesh.frustumCulled = false; // (its bounds are the assembled robot's)
		}
	};
	const robotHolder = new Group();
	robotHolder.position.set(robotX + 0.04, cartTop, -2.55);
	robotHolder.rotation.y = -0.55;
	group.add(robotHolder);
	const robotLoaded = import("../three/models/frc-robot")
		.then(({ buildRobot }) => buildRobot(robotHolder))
		.then((rig) => {
			robot = rig;
			if (palette) rig.applyPalette(palette);
		})
		.catch((error) => console.warn("Studio: the robot did not load.", error));

	await tick();

	/* ================================================================== */
	/* Drones: the F450 on a landing mat                                   */
	/* ================================================================== */
	const droneX = 1.4;
	workbench(droneX);
	const mat = canvasSurface(256, 256);
	{
		const { g } = mat;
		g.fillStyle = "#1b2233";
		g.fillRect(0, 0, 256, 256);
		g.strokeStyle = "#ffc20e";
		g.lineWidth = 8;
		g.beginPath();
		g.arc(128, 128, 104, 0, Math.PI * 2);
		g.stroke();
		g.fillStyle = "#ffc20e";
		g.font = `800 120px ${FONT}`;
		g.textAlign = "center";
		g.textBaseline = "middle";
		g.fillText("H", 128, 136);
		mat.redraw();
	}
	const pad = new Mesh(new PlaneGeometry(0.7, 0.7), hardware({ color: 0xffffff, map: mat.texture, roughness: 0.9 }, "rubber"));
	pad.rotation.x = -Math.PI / 2;
	pad.position.set(droneX, benchTop + 0.002, -2.55);
	group.add(pad);
	const droneHolder = new Group();
	droneHolder.position.set(droneX, benchTop, -2.55);
	droneHolder.rotation.y = 0.5;
	group.add(droneHolder);
	let drone: DroneRig | undefined;
	const droneLoaded = import("../three/models/drone")
		.then(({ loadDrone }) => loadDrone())
		.then((rig) => {
			drone = rig;
			rig.model.position.y = -rig.floor;
			droneHolder.add(rig.model);
		})
		.catch((error) => console.warn("Studio: the drone did not load.", error));
	// A battery charger and a spare pack beside it.
	boxAt(group, 0.16, 0.06, 0.12, dark, droneX + 0.55, benchTop + 0.03, -2.75, 0.01);
	boxAt(group, 0.14, 0.035, 0.05, hardware({ color: 0x24324f, roughness: 0.3 }, "wrap"), droneX + 0.55, benchTop + 0.018, -2.5, 0.008);

	await tick();

	/* ================================================================== */
	/* Software: a small stand between the drones and the rack, with      */
	/* Lifetime on its monitor                                             */
	/* ================================================================== */
	const softX = 2.58;
	const softZ = -2.7;
	workbench(softX, 0.6, 0.6, softZ);
	boxAt(group, 0.5, 0.325, 0.025, dark, softX, benchTop + 0.27, softZ - 0.16, 0.008);
	// Its screen: Lifetime Server's own dashboard (the screenshot on the Lifetime page), 16:10 like the screen; entered,
	// that window runs live, to be used (LifetimeDay.astro in hand mode, src/pages/index.astro).
	const softScreen = new Mesh(new PlaneGeometry(0.47, 0.294), screenMaterial(imageTexture("/assets/lifetime/server.webp")));
	softScreen.position.set(softX, benchTop + 0.27, softZ - 0.146);
	group.add(softScreen);
	boxAt(group, 0.05, 0.11, 0.05, steel, softX, benchTop + 0.055, softZ - 0.18);
	boxAt(group, 0.2, 0.01, 0.14, steel, softX, benchTop + 0.005, softZ - 0.17, 0.004);
	boxAt(group, 0.36, 0.018, 0.12, dark, softX, benchTop + 0.009, softZ + 0.1, 0.005); // the keyboard
	boxAt(group, 0.09, 0.3, 0.26, dark, softX + 0.21, 0.15, softZ - 0.05, 0.008); // the PC, on the floor under the stand

	await tick();

	/* ================================================================== */
	/* Networks: the switch rack                                           */
	/* ================================================================== */
	const rackX = 3.3;
	const rackZ = -2.95;
	const rackFront = rackZ + 0.31;
	const rack = new Group();
	group.add(rack);
	for (const sx of [-1, 1]) boxAt(rack, 0.05, 1.9, 0.6, dark, rackX + sx * 0.33, 0.95, rackZ);
	boxAt(rack, 0.7, 0.05, 0.6, dark, rackX, 1.875, rackZ);
	boxAt(rack, 0.7, 0.08, 0.6, dark, rackX, 0.04, rackZ);
	boxAt(rack, 0.62, 1.8, 0.02, new MeshStandardMaterial({ color: 0x0a0d14, roughness: 0.8 }), rackX, 0.95, rackZ - 0.29);
	const deviceMat = hardware({ color: 0x3a4152, roughness: 0.35, metalness: 0.6 }, "metal");
	const faceMat = new MeshStandardMaterial({ color: 0x1d2230, roughness: 0.45 });
	const portMat = new MeshStandardMaterial({ color: 0x07090e, roughness: 0.6 });
	// Devices from the top: patch panel, two switches, a router, a firewall, the server.
	const units = [
		{ y: 1.72, h: 0.045, ports: 24 },
		{ y: 1.62, h: 0.045, ports: 24 },
		{ y: 1.52, h: 0.045, ports: 24 },
		{ y: 1.38, h: 0.09, ports: 8 },
		{ y: 1.24, h: 0.09, ports: 6 },
		{ y: 0.9, h: 0.3, ports: 4 },
	];
	const leds: { x: number; y: number; phase: number; rate: number; color: Color }[] = [];
	const ledColors = [new Color(0x7cc47f), new Color(0x7cc47f), new Color(0xf5b942), new Color(0x2f7ce6)]; // link, link, activity, the brand blue
	for (const [u, unit] of units.entries()) {
		boxAt(rack, 0.6, unit.h, 0.5, deviceMat, rackX, unit.y, rackZ + 0.02, 0.004);
		boxAt(rack, 0.6, unit.h, 0.006, faceMat, rackX, unit.y, rackFront - 0.03);
		const row = Math.min(unit.ports, 24);
		for (let p = 0; p < row; p++) {
			const px = rackX - 0.22 + (0.44 * p) / Math.max(1, row - 1);
			if (unit.ports <= 8) boxAt(rack, 0.03, 0.022, 0.01, portMat, px, unit.y, rackFront - 0.025);
			else boxAt(rack, 0.014, 0.014, 0.01, portMat, px, unit.y - 0.006, rackFront - 0.025);
			leds.push({ x: px, y: unit.y + (unit.ports <= 8 ? 0.022 : 0.013), phase: (u * 31 + p * 7.3) % 6.28, rate: 2 + ((p * 13 + u * 5) % 9), color: ledColors[(p + u) % 4] });
		}
	}
	const ledMesh = new InstancedMesh(new PlaneGeometry(0.008, 0.005), new MeshBasicMaterial({ toneMapped: false }), leds.length);
	const dummy = new Object3D();
	leds.forEach((led, i) => {
		dummy.position.set(led.x, led.y, rackFront - 0.019);
		dummy.updateMatrix();
		ledMesh.setMatrixAt(i, dummy.matrix);
		ledMesh.setColorAt(i, led.color);
	});
	rack.add(ledMesh);
	// Patch cables between the patch panel and the switches, in the site's chart colours.
	const cableColors = [0x1f5fd1, 0xb87a00, 0x8fb8f5, 0xc8283a, 0x1f5fd1, 0xf5d042];
	for (let c = 0; c < 10; c++) {
		const from = rackX - 0.2 + c * 0.044;
		const to = rackX - 0.21 + ((c * 7) % 10) * 0.046;
		const lower = c % 2 ? 1.62 : 1.52;
		const curve = new CatmullRomCurve3([
			new Vector3(from, 1.712, rackFront - 0.02),
			new Vector3(from, 1.69, rackFront + 0.035),
			new Vector3((from + to) / 2, (1.72 + lower) / 2, rackFront + 0.06 + (c % 3) * 0.01),
			new Vector3(to, lower + 0.02, rackFront + 0.035),
			new Vector3(to, lower - 0.006, rackFront - 0.02),
		]);
		rack.add(new Mesh(new TubeGeometry(curve, 24, 0.0035, 6), hardware({ color: cableColors[c % cableColors.length], roughness: 0.5 }, "plastic")));
	}

	await tick();

	/* ================================================================== */
	/* Testing & upgrades: the laptop and the easel whiteboard             */
	/* ================================================================== */
	const webX = -2.6;
	workbench(webX);
	const laptopZ = -2.5;
	const aluminium = hardware({ color: 0xb4bccb, roughness: 0.32, metalness: 0.85 }, "anodised");
	boxAt(group, 0.44, 0.016, 0.3, aluminium, webX, benchTop + 0.008, laptopZ + 0.02, 0.006);
	boxAt(group, 0.38, 0.002, 0.13, dark, webX, benchTop + 0.017, laptopZ - 0.01);
	const lid = new Group();
	lid.position.set(webX, benchTop + 0.016, laptopZ - 0.13);
	lid.rotation.x = -0.28;
	group.add(lid);
	boxAt(lid, 0.44, 0.29, 0.01, aluminium, 0, 0.145, -0.006, 0.006);
	// The laptop: the F450's ground station (Camera POV), with the flight data from a test.
	const laptop = pageScreen({
		page: "pov",
		size: [0.41, 0.262],
		scene: "web",
		address: `${content.domain}/work/drone/camera-pov`,
		background: "#0b1220",
		feedRect: [15.4, 121, 828, 532], // the dashboard's camera feed (public/studio/screens/pov-0.jpg): the flight lands in it
		reducedMotion: ctx.reducedMotion,
		wake: () => ctx.wake(),
	});
	laptop.mesh.position.set(0, 0.147, 0);
	lid.add(laptop.mesh);

	// Beside it, a small whiteboard on an easel: the F450's bench test, written by hand (src/text/studio.ts, benchBoard).
	const easel = new Group();
	easel.position.set(webX + 0.36, benchTop, laptopZ - 0.22);
	easel.rotation.y = -0.16;
	group.add(easel);
	const boardW = 0.22;
	const boardH = 0.29;
	const sheet = canvasSurface(900, 1186);
	const face = new Group();
	face.position.set(0, 0.04 + boardH / 2, 0);
	face.rotation.x = -0.18;
	easel.add(face);
	boxAt(face, boardW + 0.018, boardH + 0.018, 0.01, aluminium, 0, 0, -0.007, 0.004);
	const easelBoard = new Mesh(new PlaneGeometry(boardW, boardH), hardware({ color: 0xffffff, map: sheet.texture, roughness: 0.75 }, "printed")); // matte: a gloss would wash the marker out
	face.add(easelBoard);
	// The light theme's room is bright enough to wash a white board out: dimmed there so the marker keeps its contrast.
	themed.push({ mat: easelBoard.material as MeshStandardMaterial, dark: 0xffffff, light: 0x9da3ad });
	boxAt(easel, boardW + 0.03, 0.012, 0.04, aluminium, 0, 0.03, 0.035, 0.003); // the marker tray
	const leg = boxAt(easel, 0.014, boardH + 0.03, 0.01, aluminium, 0, (boardH + 0.03) / 2, -0.12);
	leg.rotation.x = 0.3;
	for (const [i, c] of [0x1d4ed8, 0x15803d, 0xc8283a].entries()) {
		const marker = new Mesh(new CylinderGeometry(0.006, 0.006, 0.09, 10), hardware({ color: c, roughness: 0.4 }, "plastic"));
		marker.rotation.z = Math.PI / 2;
		marker.position.set(-0.05 + i * 0.045, 0.043, 0.04);
		easel.add(marker);
	}
	const drawBench = () => {
		const { g } = sheet;
		const w = 900;
		const h = 1186;
		g.fillStyle = "#f8f9fb";
		g.fillRect(0, 0, w, h);
		// The ghost of an old drawing that was wiped off, as on any well-used whiteboard.
		g.strokeStyle = "rgba(29, 78, 216, 0.05)";
		g.lineWidth = 14;
		g.beginPath();
		g.ellipse(640, 980, 180, 90, -0.2, 0, Math.PI * 2);
		g.stroke();
		/** A line of handwriting, tilted a hair either way so it doesn't look typed. */
		const hand = (text: string, x: number, y: number, size: number, colour: string, tilt: number) => {
			g.save();
			g.translate(x, y);
			g.rotate(tilt);
			g.fillStyle = colour;
			g.font = `700 ${size}px ${HAND}`;
			g.fillText(text, 0, 0);
			g.restore();
		};
		const stroke = (colour: string, width: number, draw: () => void) => {
			g.strokeStyle = colour;
			g.lineWidth = width;
			g.lineCap = "round";
			g.lineJoin = "round";
			g.beginPath();
			draw();
			g.stroke();
		};
		g.textBaseline = "alphabetic";
		hand(benchBoard.title, 58, 118, 96, "#1f5fc4", -0.02);
		stroke("#1f5fc4", 6, () => {
			g.moveTo(58, 146);
			g.bezierCurveTo(240, 160, 420, 132, 640, 144);
		});
		let y = 250;
		benchBoard.passed.forEach((item, i) => {
			stroke("#15803d", 9, () => {
				g.moveTo(66, y - 26);
				g.lineTo(88, y - 2);
				g.lineTo(124, y - 52);
			});
			hand(item, 150, y, 66, "#111827", (i % 2 ? 1 : -1) * 0.012);
			y += 94;
		});
		y += 34;
		hand(benchBoard.nextHeading, 58, y, 74, "#c8283a", -0.015);
		stroke("#c8283a", 5, () => {
			g.moveTo(58, y + 14);
			g.lineTo(200, y + 10);
		});
		y += 96;
		benchBoard.next.forEach((item, i) => {
			stroke("#111827", 5, () => g.roundRect(68, y - 46, 46, 46, 8));
			hand(item, 150, y, 62, "#374151", (i % 2 ? -1 : 1) * 0.012);
			y += 90;
		});
		sheet.redraw();
	};
	drawBench();
	document.fonts?.load(`700 96px "Caveat"`).then(drawBench, () => undefined); // again in the handwriting, once it is in

	await tick();

	/* ================================================================== */
	/* The wall: one panel per project, three above and two below, on an arc */
	/* ================================================================== */
	// The arc's centre is where the camera stands for this scene (scenes.ts), so every panel is the same distance away.
	const arc = { x: 3.6, z: 1.0, r: 3.9, step: 0.231, y: 1.45, row: 0.73, scale: 0.685 };
	// Behind the panels, the curved wall is an LED video wall, switched on: slow bands of the brand's blue and a little
	// yellow drift across it, a blueprint grid scrolls, a scan line sweeps down, and the LEDs' dot pattern shows up close.
	// Drawn in its shader (nothing to download); it moves only while its scene is near (uTime, set in update).
	const ledWall = new ShaderMaterial({
		side: DoubleSide,
		uniforms: { uTime: { value: 0 }, uLevel: { value: 1 } },
		vertexShader: `
			varying vec2 vUv;
			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}`,
		fragmentShader: `
			uniform float uTime;
			uniform float uLevel;
			varying vec2 vUv;
			const vec2 SIZE = vec2(${((arc.r + 0.2) * 1.2).toFixed(2)}, 2.6); // the wall in metres
			void main() {
				vec2 p = vUv * SIZE;
				float t = uTime;
				// the light: two slow bands, the brand's blue and a little of its yellow
				float b1 = sin(p.x * 0.9 + t * 0.22 + sin(p.y * 1.3 - t * 0.18) * 1.2);
				float b2 = sin(p.x * 0.55 - t * 0.15 + p.y * 0.8);
				vec3 col = vec3(0.012, 0.022, 0.085);
				col = mix(col, vec3(0.06, 0.22, 0.70), smoothstep(0.15, 1.0, b1) * 0.5);
				col += vec3(0.90, 0.66, 0.08) * smoothstep(0.82, 1.0, b2) * 0.07; // added, not mixed: no grey between blue and yellow
				// a blueprint grid, 25 cm, scrolling slowly sideways
				vec2 g = p * 4.0 + vec2(t * 0.06, 0.0);
				vec2 d = abs(fract(g) - 0.5) / fwidth(g);
				float line = 1.0 - clamp(min(d.x, d.y) - 0.5 * fwidth(g.x) * 0.0, 0.0, 1.0);
				col += vec3(0.20, 0.38, 0.85) * line * 0.12;
				// a scan line sweeping down every 14 s
				float scan = exp(-pow((vUv.y - (1.0 - fract(t / 14.0))) * 28.0, 2.0));
				col += vec3(0.30, 0.50, 1.00) * scan * 0.07;
				// the LEDs: round dots 4 cm apart, softened by their own size on screen (no shimmer far away)
				vec2 led = fract(p * 25.0) - 0.5;
				float w = fwidth(p.x * 25.0);
				float dotOn = 1.0 - smoothstep(0.30 - w, 0.42 + w, length(led));
				col *= mix(1.0, 0.62 + 0.38 * dotOn, clamp(1.0 - w * 2.0, 0.0, 1.0));
				// its edges darker, like a screen's bezel falloff
				float edge = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x) * smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
				gl_FragColor = vec4(col * (0.25 + 0.75 * edge) * uLevel * 0.62, 1.0);
				#include <colorspace_fragment>
			}`,
	});
	const wallBack = new Mesh(new CylinderGeometry(arc.r + 0.2, arc.r + 0.2, 2.6, 48, 1, true, Math.PI / 2 - 0.6, 1.2), ledWall);
	wallBack.position.set(arc.x, 1.3, arc.z);
	group.add(wallBack);
	// The panel under the pointer (-1: none) lifts toward the camera, glows at its edge and brightens; the others dim a little.
	let hovered = -1;
	let wallHover = 0;
	// Read left to right and top to bottom (the camera looks along +x, so its right is +z): the top row holds one more
	// than the bottom when the count is odd, and each row is centred, so five sit three over two like bricks.
	const topCount = Math.ceil(content.projects.length / 2);
	const panels = content.projects.map((project, i) => {
		const top = i < topCount;
		const inRow = top ? topCount : content.projects.length - topCount;
		const angle = ((top ? i : i - topCount) - (inRow - 1) / 2) * arc.step;
		const y = arc.y + (top ? arc.row / 2 : -arc.row / 2);
		const holder = new Group();
		const bx = arc.x + Math.cos(angle) * arc.r;
		const bz = arc.z + Math.sin(angle) * arc.r;
		holder.position.set(bx, y, bz);
		// Facing the arc's centre.
		holder.rotation.y = -Math.PI / 2 - angle;
		group.add(holder);
		// A poster with cut corners (panels.ts): its frame, its face, and the glow behind it on hover, all in that outline.
		const face = projectFace(project);
		const frame = new Mesh(new ExtrudeGeometry(cutCorners(1.25, 0.894), { depth: 0.04, bevelEnabled: false }), dark);
		frame.position.z = -0.05;
		holder.add(frame);
		const screen = new Mesh(cutCornerSurface(1.2, 0.844), screenMaterial(face.texture));
		holder.add(screen);
		const edge = new Mesh(new ShapeGeometry(cutCorners(1.32, 0.96)), new MeshBasicMaterial({ color: 0xf5d042, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
		edge.position.z = -0.06;
		holder.add(edge);
		return { holder, base: holder.rotation.y, y, screen, edge, bx, bz, toward: [-Math.cos(angle), -Math.sin(angle)] as const, hover: 0 };
	});

	/* ================================================================== */
	/* Standards: the whiteboard and the binders                           */
	/* ================================================================== */
	const boardX = 5.0;
	const board = canvasSurface(2400, 1320);
	const whiteboard = new Mesh(new PlaneGeometry(2.3, 1.265), hardware({ color: 0xffffff, map: board.texture, roughness: 0.25 }, "plastic"));
	whiteboard.position.set(boardX, 1.55, z1 - 0.036);
	themed.push({ mat: whiteboard.material as MeshStandardMaterial, dark: 0xffffff, light: 0xb2b8c2 }); // (as the easel's)
	whiteboard.rotation.y = Math.PI;
	group.add(whiteboard);
	// The board is drawn once, written out in full; the writing appears in the shader instead, a front moving down the
	// rows, then across the sticky notes. (Redrawing and uploading the 2400 px canvas per step stalled frames ~30 ms.)
	const boardWrite = { value: 0 };
	{
		const m = whiteboard.material as MeshStandardMaterial;
		const before = m.onBeforeCompile;
		const notesTop = 838 / 1320; // the sticky notes' row, with the red circle (drawBoard), as a share of the height
		const rows = 2 + content.standards.items.length;
		const split = rows / (rows + content.standards.steps.length);
		m.onBeforeCompile = (shader, renderer) => {
			before.call(m, shader, renderer);
			shader.uniforms.uWrite = boardWrite;
			shader.fragmentShader = shader.fragmentShader.replace("void main() {", "uniform float uWrite;\nvoid main() {").replace(
				"#include <map_fragment>",
				`#include <map_fragment>
				float boardY = 1.0 - vMapUv.y;
				float rowFront = uWrite / ${split.toFixed(4)} * ${(notesTop + 0.03).toFixed(4)};
				float noteFront = (uWrite - ${split.toFixed(4)}) / ${(1 - split).toFixed(4)} * 1.06;
				float boardHide = boardY < ${notesTop.toFixed(4)} ? smoothstep(rowFront - 0.03, rowFront, boardY) : smoothstep(noteFront - 0.06, noteFront, vMapUv.x);
				diffuseColor.rgb = mix(diffuseColor.rgb, diffuse * vec3(0.930, 0.939, 0.965), boardHide); // the board's own white (#f7f8fb)`,
			);
		};
		const key = m.customProgramCacheKey.bind(m);
		m.customProgramCacheKey = () => key() + "|board-write";
	}
	boxAt(group, 2.38, 1.34, 0.03, steel, boardX, 1.55, z1 - 0.015);
	boxAt(group, 2.0, 0.03, 0.08, steel, boardX, 0.89, z1 - 0.06);
	for (const [i, c] of [0x1d4ed8, 0xc8283a, 0x111827].entries()) {
		const marker = new Mesh(new CylinderGeometry(0.009, 0.009, 0.12, 10), hardware({ color: c, roughness: 0.4 }, "plastic"));
		marker.rotation.z = Math.PI / 2;
		marker.position.set(boardX - 0.6 + i * 0.16, 0.92, z1 - 0.07);
		group.add(marker);
	}
	// Written in marker (the sketchbook's handwriting, Caveat): the standards with hand-drawn ticks, then the three steps
	// on sticky notes, joined by hand-drawn arrows. Each line appears in turn, as if being written, as the scene opens.
	const drawBoard = (progress: number) => {
		const { g } = board;
		const bw = 2400;
		const bh = 1320;
		g.fillStyle = "#f7f8fb";
		g.fillRect(0, 0, bw, bh);
		// The ghost of something wiped off long ago.
		g.strokeStyle = "rgba(29, 78, 216, 0.04)";
		g.lineWidth = 22;
		g.beginPath();
		g.ellipse(1900, 300, 320, 120, 0.15, 0, Math.PI * 2);
		g.stroke();
		const s = content.standards;
		const lines = 2 + s.items.length + s.steps.length;
		let shown = progress * lines;
		const write = (draw: () => void) => {
			if (shown <= 0) return;
			g.globalAlpha = clamp01(shown);
			draw();
			g.globalAlpha = 1;
			shown -= 1;
		};
		const pen = (colour: string, width: number, draw: () => void) => {
			g.strokeStyle = colour;
			g.lineWidth = width;
			g.lineCap = "round";
			g.lineJoin = "round";
			g.beginPath();
			draw();
			g.stroke();
		};
		const hand = (text: string, x: number, y: number, size: number, colour: string, tilt = 0, weight = 700) => {
			g.save();
			g.translate(x, y);
			g.rotate(tilt);
			g.fillStyle = colour;
			g.font = `${weight} ${size}px ${HAND}`;
			g.fillText(text, 0, 0);
			g.restore();
		};
		g.textBaseline = "alphabetic";
		write(() => {
			hand(s.heading, 110, 170, 128, "#1f5fc4", -0.012);
			pen("#1f5fc4", 9, () => {
				g.moveTo(112, 206);
				g.bezierCurveTo(500, 222, 900, 192, 1340, 208);
			});
		});
		let y = 340;
		s.items.forEach((item, i) =>
			write(() => {
				pen("#15803d", 12, () => {
					g.moveTo(118, y - 34);
					g.lineTo(146, y - 4);
					g.lineTo(196, y - 72);
				});
				g.font = `600 76px ${HAND}`;
				const rows = wrap(g, item, 2000);
				rows.forEach((row, k) => hand(row, 240, y + k * 84, 76, "#1f2937", (i % 2 ? 1 : -1) * 0.006, 600));
				y += 84 * rows.length + 56;
			}),
		);
		// The three steps, on sticky notes; the last one (where a project ends up) circled in red.
		const colours = ["#f5d042", "#f2eedf", "#bcd3f5"]; // the brand yellow, paper, a pale brand blue
		const noteW = 470;
		const noteH = 330;
		const top = 900;
		s.steps.forEach((step, i) =>
			write(() => {
				const x = 150 + i * 790;
				const tilt = [-0.035, 0.02, -0.015][i % 3];
				g.save();
				g.translate(x + noteW / 2, top + noteH / 2);
				g.rotate(tilt);
				// The note's shadow: a few soft offset layers, not shadowBlur (a blur this size costs ~30 ms a redraw).
				for (const [grow, alpha] of [[14, 0.04], [8, 0.06], [3, 0.08]]) {
					g.fillStyle = `rgba(15, 23, 42, ${alpha})`;
					g.fillRect(-noteW / 2 - grow, -noteH / 2 - grow + 12, noteW + grow * 2, noteH + grow * 2);
				}
				g.fillStyle = colours[i % colours.length];
				g.fillRect(-noteW / 2, -noteH / 2, noteW, noteH);
				g.fillStyle = "rgba(0, 0, 0, 0.05)"; // the sticky strip along the top
				g.fillRect(-noteW / 2, -noteH / 2, noteW, 46);
				g.fillStyle = "#111827";
				const label = `${i + 1}. ${step}`;
				let size = 92;
				g.font = `700 ${size}px ${HAND}`;
				while (g.measureText(label).width > noteW - 60 && size > 50) g.font = `700 ${(size -= 4)}px ${HAND}`;
				g.textAlign = "center";
				g.fillText(label, 0, 34);
				g.textAlign = "start";
				g.restore();
				if (i === s.steps.length - 1) {
					pen("#c8283a", 8, () => g.ellipse(x + noteW / 2, top + noteH / 2, noteW * 0.62, noteH * 0.66, -0.04, 0.2, Math.PI * 2.05));
				}
				if (i < s.steps.length - 1) {
					const ax = x + noteW + 40;
					const ay = top + noteH / 2;
					pen("#1d4ed8", 9, () => {
						g.moveTo(ax, ay + 10);
						g.quadraticCurveTo(ax + 120, ay - 50, ax + 230, ay);
						g.moveTo(ax + 230, ay);
						g.lineTo(ax + 190, ay - 34);
						g.moveTo(ax + 230, ay);
						g.lineTo(ax + 186, ay + 22);
					});
				}
			}),
		);
		board.redraw();
	};
	drawBoard(1);
	document.fonts?.load(`700 128px "Caveat"`).then(() => drawBoard(1), () => undefined);
	// The shelf of binders to the whiteboard's left (seen from the room).
	const shelfX = boardX + 1.75;
	boxAt(group, 0.9, 0.03, 0.3, wood, shelfX, 1.0, z1 - 0.16);
	boxAt(group, 0.9, 0.03, 0.3, wood, shelfX, 1.5, z1 - 0.16);
	const binderColors = [0x1f5fc4, 0x0a174e, 0xa98500, 0x2f7ce6, 0xf5d042, 0x1b2d6e, 0x3d4770]; // the palette
	for (const [row, y] of [1.0, 1.5].entries())
		binderColors.forEach((c, i) => {
			if ((i + row) % 5 === 4) return;
			const binder = boxAt(group, 0.075, 0.32, 0.26, hardware({ color: c, roughness: 0.55 }, "plastic"), shelfX - 0.36 + i * 0.1, y + 0.175, z1 - 0.17, 0.006);
			binder.rotation.z = i === 6 ? 0.18 : 0;
		});

	await tick();

	/* ================================================================== */
	/* Timeline: the long window                                           */
	/* ================================================================== */
	const winX = 1.2;
	const winW = 3.8;
	const winH = 1.4;
	const winY = 1.62;
	const sky = canvasSurface(2048, 760);
	// Clear glass now: the city outside shows through (backdrop.ts), with a year on each pane.
	const windowGlass = new Mesh(new PlaneGeometry(winW, winH), new MeshBasicMaterial({ map: sky.texture, toneMapped: false, transparent: true, depthWrite: false }));
	windowGlass.position.set(winX, winY, z1 - 0.01);
	windowGlass.rotation.y = Math.PI;
	group.add(windowGlass);
	const frameMat = hardware({ color: 0x1b2440, roughness: 0.5, metalness: 0.3 }, "anodised");
	themed.push({ mat: frameMat as MeshStandardMaterial, dark: 0x13235f, light: 0xfffdf4 });
	boxAt(group, winW + 0.12, 0.06, 0.1, frameMat, winX, winY + winH / 2 + 0.03, z1 - 0.05);
	boxAt(group, winW + 0.2, 0.05, 0.22, frameMat, winX, winY - winH / 2 - 0.025, z1 - 0.1);
	const panes = content.milestones.length || 6;
	for (let i = 0; i <= panes; i++) boxAt(group, 0.045, winH, 0.07, frameMat, winX + winW / 2 - (winW * i) / panes, winY, z1 - 0.04);
	const drawSky = (darkTheme: boolean) => {
		const { g, canvas } = sky;
		const w = canvas.width;
		const h = canvas.height;
		// Clear: the sky and the city are outside now (backdrop.ts); only the years are painted on the glass.
		g.clearRect(0, 0, w, h);
		g.shadowColor = darkTheme ? "rgba(0,0,0,0.6)" : "rgba(10,17,36,0.45)";
		g.shadowBlur = 8;
		// The years, one on each pane, read from inside the room (left to right).
		const paneW = w / panes;
		content.milestones.forEach((m, i) => {
			const cx = paneW * i + paneW / 2;
			g.font = `800 64px ${FONT}`;
			g.textAlign = "center";
			g.fillStyle = m.state === "future" ? "rgba(255,255,255,0.55)" : "#ffffff";
			g.fillText(m.year, cx, 120);
			if (m.state === "now") {
				g.fillStyle = "#ffc20e";
				g.beginPath();
				g.arc(cx, 160, 12, 0, Math.PI * 2);
				g.fill();
			}
			g.textAlign = "start";
		});
		sky.redraw();
	};

	await tick();

	/* ================================================================== */
	/* The crew: the table, the chairs and the portraits                   */
	/* ================================================================== */
	const tableX = -2.4;
	const tableZ = 5.1;
	boxAt(group, 2.2, 0.05, 0.95, woodMaterial("walnut_veneer"), tableX, 0.745, tableZ, 0.015);
	for (const sx of [-1, 1]) boxAt(group, 0.06, 0.72, 0.8, steel, tableX + sx * 0.95, 0.36, tableZ);
	boxAt(group, 0.3, 0.012, 0.22, hardware({ color: 0xf4efe2, roughness: 0.9 }, "printed"), tableX - 0.3, 0.776, tableZ - 0.1, 0.004).rotation.y = 0.2;
	const tableMug = new Mesh(new CylinderGeometry(0.04, 0.036, 0.1, 20), hardware({ color: 0x2f7ce6, roughness: 0.35 }, "wrap"));
	tableMug.position.set(tableX + 0.45, 0.82, tableZ - 0.15);
	group.add(tableMug);
	const chairFabric = hardware({ color: 0x1d2b4f, roughness: 0.9 }, "fabric");
	const portraits = content.portraits.slice(0, 4);
	portraits.forEach((person, i) => {
		const x = tableX + (i - (portraits.length - 1) / 2) * 1.1;
		boxAt(group, 0.5, 0.07, 0.48, chairFabric, x, 0.47, tableZ + 0.75, 0.03);
		boxAt(group, 0.5, 0.6, 0.06, chairFabric, x, 0.84, tableZ + 1.0, 0.03);
		boxAt(group, 0.04, 0.44, 0.04, steel, x, 0.22, tableZ + 0.75);
		// The portrait on the wall behind the chair: an instant photo taped up, a little crooked, the name written on it by
		// hand and the role under it.
		const photo = canvasSurface(1120, 1360);
		const draw = (img?: HTMLImageElement) => {
			const { g } = photo;
			g.fillStyle = "#f6f7f4";
			g.fillRect(0, 0, 1120, 1360);
			if (img) cover(g, img, 64, 64, 992, 992);
			else {
				g.fillStyle = "#1b2747";
				g.fillRect(64, 64, 992, 992);
			}
			g.strokeStyle = "rgba(0, 0, 0, 0.08)";
			g.lineWidth = 2;
			g.strokeRect(64, 64, 992, 992);
			g.textAlign = "center";
			g.textBaseline = "alphabetic";
			g.fillStyle = "#14213d";
			g.font = `700 150px ${HAND}`;
			g.save();
			g.translate(560, 1210);
			g.rotate(-0.015);
			g.fillText(person.name, 0, 0);
			g.restore();
			g.fillStyle = "#475569";
			g.font = `500 44px ${FONT}`;
			g.fillText(person.role, 560, 1300);
			g.textAlign = "start";
			photo.redraw();
		};
		let picture: HTMLImageElement | undefined;
		draw();
		loadImage(person.img).then((img) => draw((picture = img)), () => undefined);
		document.fonts?.load(`700 150px "Caveat"`).then(() => draw(picture), () => undefined);
		const tilt = i % 2 ? 0.045 : -0.035;
		const holder = new Group();
		holder.position.set(x, 1.62, z1 - 0.025);
		holder.rotation.set(0, Math.PI, tilt);
		group.add(holder);
		// A soft shadow on the wall, then the photo, then a strip of tape across its top edge.
		const shade = new Mesh(new PlaneGeometry(0.6, 0.72), new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
		shade.position.set(-0.012, -0.016, -0.006);
		holder.add(shade);
		// (A little light of its own: the back wall is dim, and a photo should read as paper, not grey.)
		const screen = new Mesh(new PlaneGeometry(0.56, 0.68), hardware({ color: 0xffffff, map: photo.texture, emissive: 0xffffff, emissiveMap: photo.texture, emissiveIntensity: 0.45, roughness: 0.85 }, "printed"));
		holder.add(screen);
		const tape = new Mesh(new PlaneGeometry(0.17, 0.05), new MeshStandardMaterial({ color: i % 2 ? 0xf2eedf : 0xf5d042, roughness: 0.7, transparent: true, opacity: 0.78 }));
		tape.position.set(0, 0.335, 0.004);
		tape.rotation.z = -tilt * 1.6;
		holder.add(tape);
	});

	await tick();

	/* ================================================================== */
	/* Contact: the door and its sign                                      */
	/* ================================================================== */
	const doorX = -5.6;
	const beyond = new Mesh(new PlaneGeometry(1.0, 2.1), new MeshBasicMaterial({ color: 0xbfe9ff, toneMapped: false }));
	beyond.position.set(doorX, 1.05, z1 + 0.005);
	beyond.rotation.y = Math.PI;
	group.add(beyond);
	boxAt(group, 0.08, 2.2, 0.14, frameMat, doorX - 0.54, 1.1, z1 - 0.04);
	boxAt(group, 0.08, 2.2, 0.14, frameMat, doorX + 0.54, 1.1, z1 - 0.04);
	boxAt(group, 1.16, 0.08, 0.14, frameMat, doorX, 2.2, z1 - 0.04);
	const doorPivot = new Group();
	doorPivot.position.set(doorX + 0.5, 0, z1 - 0.05);
	group.add(doorPivot);
	const doorMat = hardware({ color: 0x24345e, roughness: 0.85 }, "plastic"); // matte: a painted door, no hotspot
	themed.push({ mat: doorMat as MeshStandardMaterial, dark: 0x1b2d6e, light: 0x3d4770 });
	boxAt(doorPivot, 0.98, 2.08, 0.045, doorMat, -0.49, 1.04, 0);
	const handle = new Mesh(new CylinderGeometry(0.012, 0.012, 0.14, 10), toolMetal);
	handle.rotation.z = Math.PI / 2;
	handle.position.set(-0.86, 1.0, -0.04);
	doorPivot.add(handle);
	const sign = canvasSurface(720, 180);
	{
		const { g } = sign;
		g.fillStyle = "#06102a";
		g.fillRect(0, 0, 720, 180);
		g.fillStyle = "#f5d042";
		g.font = `900 92px ${FONT}`;
		g.textAlign = "center";
		g.textBaseline = "middle";
		g.fillText(content.sign, 360, 96);
		sign.redraw();
	}
	const signMesh = new Mesh(new PlaneGeometry(0.96, 0.24), new MeshBasicMaterial({ map: sign.texture, toneMapped: false }));
	signMesh.position.set(doorX, 2.5, z1 - 0.06);
	signMesh.rotation.y = Math.PI;
	group.add(signMesh);
	boxAt(group, 1.02, 0.3, 0.04, dark, doorX, 2.5, z1 - 0.03, 0.01);

	/* ================================================================== */
	/* Per frame                                                           */
	/* ================================================================== */
	let palette: Palette | undefined;
	let clock = 0;
	const ARMED_FOR = 4; // seconds the props run once armed
	let armedUntil = -1;
	let propSpin = 0;
	const ledColor = new Color();
	let ledTimer = 0;

	// What lights each scene's subject (the pooled lights slide between these as the camera moves).
	const accents: Record<string, LightSpec> = {
		networks: { at: [rackX, 1.4, rackFront + 0.3], color: 0xb8c8ff, dark: 0.5, light: 0.5, distance: 1.4, decay: 2 },
		web: { at: [webX, benchTop + 0.25, laptopZ + 0.3], color: 0x9ccfff, dark: 0.9, light: 0.9, distance: 1.4, decay: 2 },
		software: { at: [softX, benchTop + 0.3, softZ + 0.35], color: 0x9ccfff, dark: 0.9, light: 0.9, distance: 1.4, decay: 2 },
		standards: { at: [boardX, 2.75, z1 - 0.7], color: 0xfff4e0, dark: 2.2, light: 3, distance: 3.2, decay: 1.6 },
		contact: { at: [doorX, 2.1, z1 - 1.8], color: 0xffe6a8, dark: 1.2, light: 3, distance: 4, decay: 1.6 },
	};

	return {
		accents,
		screens: [laptop],
		drone: () => drone,
		robot: {
			holder: robotHolder,
			center: new Vector3(robotX + 0.04, cartTop + 0.3, -2.55),
			explode,
			turn: (angle) => (robotHolder.rotation.y = -0.55 + angle),
		},
		rack: { group: rack, center: new Vector3(rackX, 1.45, rackFront) },
		laptop: lid,
		loaded: Promise.allSettled([robotLoaded, droneLoaded]),
		software: softScreen,
		bench: {
			holder: droneHolder,
			arm: () => (armedUntil = clock + ARMED_FOR),
			busy: () => propSpin > 0 || clock < armedUntil,
		},
		wall: {
			screens: panels.map((panel) => panel.screen),
			hover(index) {
				hovered = index;
			},
		},
		update({ near, lamp }, dt) {
			clock += dt;
			const level = lamp * lamp * (3 - 2 * lamp);

			// Robot: rollers turn while its scene is in view (not while it is apart: they would snap back together).
			if (robot && explodedBy === 0 && (near.robotics ?? 0) > 0.05) robot.animate(clock, dt * (near.robotics ?? 0));

			// Drone: stays on its mat. The build is not finished and it has not flown, so the room does not show it flying:
			// powered up on the bench, the flight controller's LED blinking; armed, its props spin up, then wind down.
			const armed = clock < armedUntil ? 1 : 0;
			propSpin += (armed - propSpin) * (1 - Math.exp(-(armed ? 1.8 : 1.1) * dt));
			if (propSpin < 0.004) propSpin = 0;
			drone?.animate(clock, propSpin > 0 ? dt : 0, propSpin);

			// Rack: the port lights blink (a few times a second, not every frame).
			ledTimer += dt;
			const net = near.networks ?? 0;
			if (ledTimer > 0.08 && (net > 0.02 || ledTimer > 1)) {
				ledTimer = 0;
				leds.forEach((led, i) => {
					const on = Math.sin(clock * led.rate + led.phase) > -0.3 ? 1 : 0.15;
					ledMesh.setColorAt(i, ledColor.copy(led.color).multiplyScalar(on * (0.35 + 0.65 * level)));
				});
				ledMesh.instanceColor!.needsUpdate = true;
			}


			// The wall: the panels turn to face the camera, one after another, as the scene opens.
			const wallIn = near.wall ?? 0;
			// Its video wall plays while its scene is near, and comes up with the room's lamp.
			if (wallIn > 0.01) ledWall.uniforms.uTime.value += dt;
			ledWall.uniforms.uLevel.value = 0.3 + 0.7 * level;
			const settle = 1 - Math.exp(-14 * dt);
			wallHover += ((hovered >= 0 ? 1 : 0) - wallHover) * settle;
			panels.forEach((panel, i) => {
				const turn = ease(wallIn * 1.6 - i * 0.15);
				panel.hover += ((hovered === i ? 1 : 0) - panel.hover) * settle;
				const h = panel.hover;
				panel.holder.rotation.y = panel.base + (1 - turn) * 0.5;
				panel.holder.position.set(panel.bx + panel.toward[0] * 0.12 * h, panel.y - (1 - turn) * 0.04, panel.bz + panel.toward[1] * 0.12 * h);
				panel.holder.scale.setScalar(arc.scale * (1 + 0.03 * h));
				(panel.screen.material as MeshBasicMaterial).color.setScalar(1 - 0.3 * wallHover * (1 - h));
				(panel.edge.material as MeshBasicMaterial).opacity = h;
			});

			// The whiteboard writes itself out.
			boardWrite.value = Math.min(1, (near.standards ?? 0) * 1.2);

			// The door opens a little as its scene comes in; the light beyond it comes up.
			const door = near.contact ?? 0;
			doorPivot.rotation.y = -ease(door) * 0.55;
			(signMesh.material as MeshBasicMaterial).color.setScalar(0.35 + 0.65 * level);
		},
		applyPalette(p) {
			palette = p;
			for (const panel of panels) {
				const edge = panel.edge.material as MeshBasicMaterial;
				edge.color.set(p.dark ? 0xf5d042 : 0x1f5fc4);
							}
			for (const { mat, dark: d, light } of themed) mat.color.set(p.dark ? d : light);
			robot?.applyPalette(p);
			drawPeg(p.dark);
			drawSky(p.dark);
			(beyond.material as MeshBasicMaterial).color.set(p.dark ? 0xffe6a8 : 0xfff3d6);
		},
	};
}
