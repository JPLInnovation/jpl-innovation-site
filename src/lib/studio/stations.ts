/**
 * The rest of the studio, after the desk (room.ts): the four work stations against the front wall, the curved wall of
 * projects at the right-hand end, and along the back wall the whiteboard, the window, the team's table and the door.
 * Metres, y up; positions match the camera's shots in scenes.ts.
 *
 *   Robotics   the KitBot on a low rolling cart, a pegboard of tools behind it (the robot's own CAD, frc-robot.ts)
 *   Drones     the F450 on a landing mat; it lifts off and hovers while its scene is in view (drone.ts)
 *   Networks   a switch rack with blinking port lights and patch cables
 *   Web        a laptop on the bench, scrolling this site (public/studio/site.webp)
 *   The wall   one panel per project, on an arc; they turn to face the camera one after another
 *   Standards  the whiteboard (the standards and the three steps, written out as the scene opens) and the binders
 *   Timeline   the long window: night sky in the dark theme, dusk in the light one; a year on each pane
 *   The crew   the table, two chairs, a portrait screen behind each
 *   Contact    the door, ajar, light beyond it, a lit sign over it
 *
 * The robot and the drone load their CAD in the background; the room is complete without them.
 */
import {
	CatmullRomCurve3,
	Color,
	CylinderGeometry,
	DoubleSide,
	Group,
	InstancedMesh,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Object3D,
	PlaneGeometry,
	TubeGeometry,
	Vector3,
} from "three";
import { hardware } from "../three/finish";
import type { Palette, StageContext } from "../three/stage";
import { boxAt, canvasSurface, loadImage, ROOM, screenMaterial } from "./room";
import type { LightSpec } from "./lights";
import type { RoomContent, RoomState } from "./room";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => {
	const t = clamp01(x);
	return t * t * (3 - 2 * t);
};

export interface Stations {
	/** The glow of each scene's subject, for the pooled lights (lights.ts). */
	accents: Record<string, LightSpec>;
	update(state: RoomState, dt: number): void;
	applyPalette(p: Palette): void;
}

/** Draws `img` into the box, cropped to fill it (like CSS object-fit: cover). */
function cover(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
	const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
	const sw = w / scale;
	const sh = h / scale;
	g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
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
const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

export function buildStations(ctx: StageContext, parent: Group, content: RoomContent): Stations {
	const group = new Group();
	parent.add(group);
	const { z0, z1 } = ROOM;
	const benchTop = 0.85;

	const bench = hardware({ color: 0x2a3550, roughness: 0.6 }, "plastic");
	const steel = hardware({ color: 0x2d3446, roughness: 0.4, metalness: 0.7 }, "anodised");
	const dark = new MeshStandardMaterial({ color: 0x141a28, roughness: 0.5 });
	const wood = hardware({ color: 0x5b4636, roughness: 0.55 }, "plastic");
	const themed: { mat: MeshStandardMaterial; dark: number; light: number }[] = [
		{ mat: bench as MeshStandardMaterial, dark: 0x2a3550, light: 0xc9d3e6 },
	];

	/** A workbench: a top on four legs, its top surface at `benchTop`. */
	const workbench = (x: number, w = 1.6, d = 0.8, z = -2.6) => {
		boxAt(group, w, 0.05, d, bench, x, benchTop - 0.025, z, 0.01);
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxAt(group, 0.045, benchTop - 0.05, 0.045, steel, x + sx * (w / 2 - 0.06), (benchTop - 0.05) / 2, z + sz * (d / 2 - 0.06));
	};

	/* ================================================================== */
	/* Robotics: the KitBot on a cart                                      */
	/* ================================================================== */
	const robotX = -2.6;
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
	for (const [i, c] of [0xffc20e, 0x1f5fd1, 0x34d399].entries()) boxAt(group, 0.1, 0.07, 0.08, hardware({ color: c, roughness: 0.5 }, "plastic"), robotX - 0.15 + i * 0.15, 1.2, z0 + 0.08, 0.01);

	let robot: { animate(t: number, dt: number): void; applyPalette(p: { dark: boolean }): void } | undefined;
	const robotHolder = new Group();
	robotHolder.position.set(robotX + 0.04, cartTop, -2.55);
	robotHolder.rotation.y = -0.55;
	group.add(robotHolder);
	import("../three/models/frc-robot")
		.then(({ buildRobot }) => buildRobot(robotHolder))
		.then((rig) => {
			robot = rig;
			if (palette) rig.applyPalette(palette);
			ctx.precompile();
		})
		.catch((error) => console.warn("Studio: the robot did not load.", error));

	/* ================================================================== */
	/* Drones: the F450 on a landing mat                                   */
	/* ================================================================== */
	const droneX = -0.6;
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
	let drone: { animate(t: number, dt: number): void; model: Group; floor: number } | undefined;
	import("../three/models/drone")
		.then(({ loadDrone }) => loadDrone())
		.then((rig) => {
			drone = rig;
			rig.model.position.y = -rig.floor;
			droneHolder.add(rig.model);
			ctx.precompile();
		})
		.catch((error) => console.warn("Studio: the drone did not load.", error));
	// A battery charger and a spare pack beside it.
	boxAt(group, 0.16, 0.06, 0.12, dark, droneX + 0.55, benchTop + 0.03, -2.75, 0.01);
	boxAt(group, 0.14, 0.035, 0.05, hardware({ color: 0x24324f, roughness: 0.3 }, "wrap"), droneX + 0.55, benchTop + 0.018, -2.5, 0.008);
	let lift = 0;

	/* ================================================================== */
	/* Networks: the switch rack                                           */
	/* ================================================================== */
	const rackX = 1.4;
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
	const ledColors = [new Color(0x34d399), new Color(0x34d399), new Color(0xffc20e), new Color(0x22d3ee)];
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
	const cableColors = [0x1f5fd1, 0xb87a00, 0x7a4bd0, 0xc8283a, 0x1f5fd1, 0x34d399];
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

	/* ================================================================== */
	/* Web: the laptop                                                     */
	/* ================================================================== */
	const webX = 3.3;
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
	const web = canvasSurface(1280, 820);
	let site: HTMLImageElement | undefined;
	loadImage("/studio/site.webp").then((img) => (site = img), () => undefined);
	const webScreen = new Mesh(new PlaneGeometry(0.41, 0.262), screenMaterial(web.texture));
	webScreen.position.set(0, 0.147, 0);
	lid.add(webScreen);
	// A phone standing beside it, on the same page.
	const phone = new Group();
	phone.position.set(webX + 0.42, benchTop, laptopZ - 0.05);
	phone.rotation.set(-0.2, -0.35, 0);
	group.add(phone);
	boxAt(phone, 0.075, 0.155, 0.008, dark, 0, 0.08, 0, 0.008);
	const phoneScreen = new Mesh(new PlaneGeometry(0.068, 0.145), screenMaterial(web.texture));
	phoneScreen.position.set(0, 0.08, 0.0045);
	phone.add(phoneScreen);
	let webDrawn = false;
	let webAt = -1;

	/* ================================================================== */
	/* The wall: one panel per project, two rows on an arc                 */
	/* ================================================================== */
	// The arc's centre is where the camera stands for this scene (scenes.ts), so every panel is the same distance away.
	const arc = { x: 3.6, z: 1.0, r: 3.9, step: 0.35, y: 1.45, row: 0.98 };
	const wallBack = new Mesh(
		new CylinderGeometry(arc.r + 0.2, arc.r + 0.2, 2.6, 48, 1, true, Math.PI / 2 - 0.6, 1.2),
		new MeshStandardMaterial({ color: 0x0e1834, roughness: 0.9, side: DoubleSide }),
	);
	wallBack.position.set(arc.x, 1.3, arc.z);
	group.add(wallBack);
	themed.push({ mat: wallBack.material as MeshStandardMaterial, dark: 0x0e1834, light: 0xd3dcec });
	const panels = content.projects.map((project, i) => {
		// Two to a row, read left to right and top to bottom (the camera looks along +x, so its right is +z).
		const angle = ((i % 2) - 0.5) * arc.step;
		const y = arc.y + (Math.floor(i / 2) === 0 ? arc.row / 2 : -arc.row / 2);
		const holder = new Group();
		holder.position.set(arc.x + Math.cos(angle) * arc.r, y, arc.z + Math.sin(angle) * arc.r);
		// Facing the arc's centre.
		holder.rotation.y = -Math.PI / 2 - angle;
		group.add(holder);
		const face = canvasSurface(1024, 720);
		const draw = (img?: HTMLImageElement) => {
			const { g } = face;
			g.fillStyle = "#0b1226";
			g.fillRect(0, 0, 1024, 720);
			if (img) cover(g, img, 0, 0, 1024, 560);
			else {
				g.fillStyle = "#16224a";
				g.fillRect(0, 0, 1024, 560);
			}
			const fade = g.createLinearGradient(0, 420, 0, 560);
			fade.addColorStop(0, "rgba(11,18,38,0)");
			fade.addColorStop(1, "rgba(11,18,38,0.85)");
			g.fillStyle = fade;
			g.fillRect(0, 420, 1024, 140);
			g.fillStyle = "#f3f6fc";
			g.font = `800 64px ${FONT}`;
			g.textBaseline = "alphabetic";
			g.fillText(project.title, 40, 640);
			if (project.badge) {
				g.font = `500 30px ${MONO}`;
				const w = g.measureText(project.badge).width;
				g.fillStyle = "rgba(255,255,255,0.1)";
				g.beginPath();
				g.roundRect(40, 668, w + 56, 40, 20);
				g.fill();
				g.fillStyle = "#ffc20e";
				g.beginPath();
				g.arc(62, 688, 7, 0, Math.PI * 2);
				g.fill();
				g.fillStyle = "#cfe0ff";
				g.fillText(project.badge, 80, 699);
			}
			face.redraw();
		};
		draw();
		loadImage(project.img).then(draw, () => undefined);
		boxAt(holder, 1.24, 0.9, 0.04, dark, 0, 0, -0.03, 0.01);
		const screen = new Mesh(new PlaneGeometry(1.2, 0.844), screenMaterial(face.texture));
		holder.add(screen);
		return { holder, base: holder.rotation.y, y, screen };
	});

	/* ================================================================== */
	/* Standards: the whiteboard and the binders                           */
	/* ================================================================== */
	const boardX = 5.0;
	const board = canvasSurface(1600, 880);
	const whiteboard = new Mesh(new PlaneGeometry(2.3, 1.265), hardware({ color: 0xffffff, map: board.texture, roughness: 0.25 }, "plastic"));
	whiteboard.position.set(boardX, 1.55, z1 - 0.036);
	whiteboard.rotation.y = Math.PI;
	group.add(whiteboard);
	boxAt(group, 2.38, 1.34, 0.03, steel, boardX, 1.55, z1 - 0.015);
	boxAt(group, 2.0, 0.03, 0.08, steel, boardX, 0.89, z1 - 0.06);
	for (const [i, c] of [0x1d4ed8, 0xc8283a, 0x111827].entries()) {
		const marker = new Mesh(new CylinderGeometry(0.009, 0.009, 0.12, 10), hardware({ color: c, roughness: 0.4 }, "plastic"));
		marker.rotation.z = Math.PI / 2;
		marker.position.set(boardX - 0.6 + i * 0.16, 0.92, z1 - 0.07);
		group.add(marker);
	}
	let boardDrawn = -1;
	const drawBoard = (progress: number) => {
		const { g } = board;
		g.fillStyle = "#f7f8fb";
		g.fillRect(0, 0, 1600, 880);
		const s = content.standards;
		// Each line appears in order, like it is being written.
		const lines = 2 + s.items.length + s.steps.length;
		let shown = progress * lines;
		const write = (draw: () => void) => {
			if (shown <= 0) return;
			g.globalAlpha = clamp01(shown);
			draw();
			g.globalAlpha = 1;
			shown -= 1;
		};
		g.textBaseline = "alphabetic";
		write(() => {
			g.fillStyle = "#1d4ed8";
			g.font = `italic 700 58px ${FONT}`;
			g.fillText(s.heading, 70, 110);
		});
		s.items.forEach((item, i) =>
			write(() => {
				const y = 200 + i * 120;
				g.strokeStyle = "#15803d";
				g.lineWidth = 7;
				g.lineCap = "round";
				g.beginPath();
				g.moveTo(74, y - 18);
				g.lineTo(92, y);
				g.lineTo(124, y - 40);
				g.stroke();
				g.fillStyle = "#111827";
				g.font = `italic 500 40px ${FONT}`;
				wrap(g, item, 1380).forEach((l, k) => g.fillText(l, 150, y + k * 48));
			}),
		);
		write(() => {
			g.strokeStyle = "#111827";
			g.lineWidth = 3;
			g.beginPath();
			g.moveTo(70, 600);
			g.lineTo(1530, 600);
			g.stroke();
		});
		s.steps.forEach((step, i) =>
			write(() => {
				const x = 90 + i * 500;
				const last = i === s.steps.length - 1;
				g.strokeStyle = last ? "#c8283a" : "#1d4ed8";
				g.lineWidth = last ? 6 : 4;
				g.beginPath();
				g.roundRect(x, 650, 400, 150, 30);
				g.stroke();
				g.fillStyle = "#111827";
				g.font = `italic 600 44px ${FONT}`;
				g.fillText(`${i + 1}. ${step}`, x + 30, 740);
				if (i < s.steps.length - 1) {
					g.strokeStyle = "#111827";
					g.lineWidth = 4;
					g.beginPath();
					g.moveTo(x + 415, 725);
					g.lineTo(x + 485, 725);
					g.lineTo(x + 465, 708);
					g.moveTo(x + 485, 725);
					g.lineTo(x + 465, 742);
					g.stroke();
				}
			}),
		);
		board.redraw();
	};
	drawBoard(0);
	// The shelf of binders to the whiteboard's left (seen from the room).
	const shelfX = boardX + 1.75;
	boxAt(group, 0.9, 0.03, 0.3, wood, shelfX, 1.0, z1 - 0.16);
	boxAt(group, 0.9, 0.03, 0.3, wood, shelfX, 1.5, z1 - 0.16);
	const binderColors = [0x1d4ed8, 0x0f766e, 0xb45309, 0x7c3aed, 0xbe123c, 0x1d4ed8, 0x334155];
	for (const [row, y] of [1.0, 1.5].entries())
		binderColors.forEach((c, i) => {
			if ((i + row) % 5 === 4) return;
			const binder = boxAt(group, 0.075, 0.32, 0.26, hardware({ color: c, roughness: 0.55 }, "plastic"), shelfX - 0.36 + i * 0.1, y + 0.175, z1 - 0.17, 0.006);
			binder.rotation.z = i === 6 ? 0.18 : 0;
		});

	/* ================================================================== */
	/* Timeline: the long window                                           */
	/* ================================================================== */
	const winX = 1.2;
	const winW = 3.8;
	const winH = 1.4;
	const winY = 1.62;
	const sky = canvasSurface(2048, 760);
	const windowGlass = new Mesh(new PlaneGeometry(winW, winH), new MeshBasicMaterial({ map: sky.texture, toneMapped: false }));
	windowGlass.position.set(winX, winY, z1 - 0.01);
	windowGlass.rotation.y = Math.PI;
	group.add(windowGlass);
	const frameMat = hardware({ color: 0x1b2440, roughness: 0.5, metalness: 0.3 }, "anodised");
	themed.push({ mat: frameMat as MeshStandardMaterial, dark: 0x1b2440, light: 0xf2f5fa });
	boxAt(group, winW + 0.12, 0.06, 0.1, frameMat, winX, winY + winH / 2 + 0.03, z1 - 0.05);
	boxAt(group, winW + 0.2, 0.05, 0.22, frameMat, winX, winY - winH / 2 - 0.025, z1 - 0.1);
	const panes = content.milestones.length || 6;
	for (let i = 0; i <= panes; i++) boxAt(group, 0.045, winH, 0.07, frameMat, winX + winW / 2 - (winW * i) / panes, winY, z1 - 0.04);
	const drawSky = (darkTheme: boolean) => {
		const { g, canvas } = sky;
		const w = canvas.width;
		const h = canvas.height;
		const gradient = g.createLinearGradient(0, 0, 0, h);
		if (darkTheme) {
			gradient.addColorStop(0, "#030616");
			gradient.addColorStop(0.7, "#0b1640");
			gradient.addColorStop(1, "#1e2a6a");
		} else {
			gradient.addColorStop(0, "#5b7fd6");
			gradient.addColorStop(0.65, "#f0a8b8");
			gradient.addColorStop(1, "#ffd59a");
		}
		g.fillStyle = gradient;
		g.fillRect(0, 0, w, h);
		let seed = 7;
		const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
		for (let i = 0; i < (darkTheme ? 520 : 70); i++) {
			const x = rand() * w;
			const y = rand() * h * 0.8;
			const r = rand() < 0.08 ? 2.4 : 1.2;
			g.globalAlpha = darkTheme ? 0.4 + rand() * 0.6 : 0.5 + rand() * 0.4;
			g.fillStyle = darkTheme ? "#e6eeff" : "#ffffff";
			g.beginPath();
			g.arc(x, y, r, 0, Math.PI * 2);
			g.fill();
		}
		g.globalAlpha = 1;
		// A city skyline at the bottom, Ho Chi Minh City at night (or at dusk).
		g.fillStyle = darkTheme ? "#050816" : "#3b3f6b";
		let x = 0;
		while (x < w) {
			const bw = 40 + rand() * 90;
			const bh = 50 + rand() * 150;
			g.fillRect(x, h - bh, bw, bh);
			g.fillStyle = darkTheme ? "rgba(255,214,140,0.7)" : "rgba(255,230,180,0.55)";
			for (let wy = h - bh + 12; wy < h - 10; wy += 18) for (let wx = x + 8; wx < x + bw - 8; wx += 14) if (rand() < 0.35) g.fillRect(wx, wy, 5, 7);
			g.fillStyle = darkTheme ? "#050816" : "#3b3f6b";
			x += bw + 4;
		}
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

	/* ================================================================== */
	/* The crew: the table, the chairs and the portraits                   */
	/* ================================================================== */
	const tableX = -2.4;
	const tableZ = 5.1;
	boxAt(group, 2.2, 0.05, 0.95, wood, tableX, 0.745, tableZ, 0.015);
	for (const sx of [-1, 1]) boxAt(group, 0.06, 0.72, 0.8, steel, tableX + sx * 0.95, 0.36, tableZ);
	boxAt(group, 0.3, 0.012, 0.22, hardware({ color: 0xf4efe2, roughness: 0.9 }, "printed"), tableX - 0.3, 0.776, tableZ - 0.1, 0.004).rotation.y = 0.2;
	const tableMug = new Mesh(new CylinderGeometry(0.04, 0.036, 0.1, 20), hardware({ color: 0x1d4ed8, roughness: 0.35 }, "wrap"));
	tableMug.position.set(tableX + 0.45, 0.82, tableZ - 0.15);
	group.add(tableMug);
	const chairFabric = hardware({ color: 0x1d2b4f, roughness: 0.9 }, "fabric");
	const portraits = content.portraits.slice(0, 4);
	portraits.forEach((person, i) => {
		const x = tableX + (i - (portraits.length - 1) / 2) * 1.1;
		boxAt(group, 0.5, 0.07, 0.48, chairFabric, x, 0.47, tableZ + 0.75, 0.03);
		boxAt(group, 0.5, 0.6, 0.06, chairFabric, x, 0.84, tableZ + 1.0, 0.03);
		boxAt(group, 0.04, 0.44, 0.04, steel, x, 0.22, tableZ + 0.75);
		// The portrait screen on the wall behind the chair.
		const face = canvasSurface(600, 800);
		const draw = (img?: HTMLImageElement) => {
			const { g } = face;
			g.fillStyle = "#0b1226";
			g.fillRect(0, 0, 600, 800);
			if (img) cover(g, img, 0, 0, 600, 640);
			g.fillStyle = "#0b1226";
			g.fillRect(0, 640, 600, 160);
			g.fillStyle = "#f3f6fc";
			g.font = `800 46px ${FONT}`;
			g.fillText(person.name, 32, 706);
			g.fillStyle = "#67e8f9";
			g.font = `500 28px ${MONO}`;
			g.fillText(person.role, 32, 756);
			face.redraw();
		};
		draw();
		loadImage(person.img).then(draw, () => undefined);
		boxAt(group, 0.62, 0.8, 0.03, dark, x, 1.6, z1 - 0.02, 0.01);
		const screen = new Mesh(new PlaneGeometry(0.57, 0.76), screenMaterial(face.texture));
		screen.position.set(x, 1.6, z1 - 0.04);
		screen.rotation.y = Math.PI;
		group.add(screen);
	});

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
	const doorMat = hardware({ color: 0x24345e, roughness: 0.5 }, "plastic");
	themed.push({ mat: doorMat as MeshStandardMaterial, dark: 0x24345e, light: 0x9fb2d6 });
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
		g.fillStyle = "#67e8f9";
		g.shadowColor = "#22d3ee";
		g.shadowBlur = 28;
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
	const ledColor = new Color();
	let ledTimer = 0;

	// What lights each scene's subject (the pooled lights slide between these as the camera moves).
	const accents: Record<string, LightSpec> = {
		networks: { at: [rackX, 1.4, rackFront + 0.3], color: 0x5eead4, dark: 0.9, light: 0.9, distance: 1.4, decay: 2 },
		web: { at: [webX, benchTop + 0.25, laptopZ + 0.3], color: 0x9ccfff, dark: 0.9, light: 0.9, distance: 1.4, decay: 2 },
		standards: { at: [boardX, 2.75, z1 - 0.7], color: 0xfff4e0, dark: 2.2, light: 3, distance: 3.2, decay: 1.6 },
		contact: { at: [doorX, 1.2, z1 - 0.5], color: 0x9fdcff, dark: 3, light: 5, distance: 4, decay: 1.6 },
	};

	return {
		accents,
		update({ near, lamp }, dt) {
			clock += dt;
			const level = lamp * lamp * (3 - 2 * lamp);

			// Robot: rollers turn while its scene is in view.
			if (robot && (near.robotics ?? 0) > 0.05) robot.animate(clock, dt * (near.robotics ?? 0));

			// Drone: lifts off its mat and hovers while in view; props spin up first.
			const flying = near.drones ?? 0;
			lift += ((flying > 0.6 ? 1 : 0) - lift) * Math.min(1, dt * 1.6);
			if (drone) {
				drone.animate(clock, flying > 0.05 ? dt : 0);
				droneHolder.position.y = benchTop + ease(lift) * (0.22 + Math.sin(clock * 1.7) * 0.015);
				droneHolder.rotation.z = Math.sin(clock * 1.1) * 0.025 * lift;
			}

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

			// Laptop: the site scrolls while its scene is in view.
			const w = near.web ?? 0;
			// (Redrawn about 20 times a second: a full-size texture upload every frame is the costly part.)
			if ((w > 0.02 && clock - webAt > SCREEN_STEP) || (!webDrawn && site)) {
				webAt = clock;
				drawPage(web.g, site, clock * 60 * Math.min(1, w * 1.5));
				web.redraw();
				webDrawn = !!site;
			}

			// The wall: the panels turn to face the camera, one after another, as the scene opens.
			const wallIn = near.wall ?? 0;
			panels.forEach((panel, i) => {
				const turn = ease(wallIn * 1.6 - i * 0.15);
				panel.holder.rotation.y = panel.base + (1 - turn) * 0.5;
				panel.holder.position.y = panel.y - (1 - turn) * 0.04;
			});

			// The whiteboard writes itself out.
			const written = Math.round(Math.min(1, (near.standards ?? 0) * 1.2) * 60) / 60;
			if (written !== boardDrawn) {
				boardDrawn = written;
				drawBoard(written);
			}

			// The door opens a little as its scene comes in; the light beyond it comes up.
			const door = near.contact ?? 0;
			doorPivot.rotation.y = -ease(door) * 0.55;
			(signMesh.material as MeshBasicMaterial).color.setScalar(0.35 + 0.65 * level);
		},
		applyPalette(p) {
			palette = p;
			for (const { mat, dark: d, light } of themed) mat.color.set(p.dark ? d : light);
			robot?.applyPalette(p);
			drawPeg(p.dark);
			drawSky(p.dark);
			(beyond.material as MeshBasicMaterial).color.set(p.dark ? 0x8fd8ff : 0xfff3d6);
		},
	};
}

/** The laptop's screen: this site, scrolled `scroll` pixels down and back up. */
function drawPage(g: CanvasRenderingContext2D, page: HTMLImageElement | undefined, scroll: number) {
	const { width: w, height: h } = g.canvas;
	g.fillStyle = "#050a1f";
	g.fillRect(0, 0, w, h);
	const bar = 52;
	if (page) {
		const scale = w / page.naturalWidth;
		const pageH = page.naturalHeight * scale;
		const max = Math.max(1, pageH - (h - bar));
		const y = scroll % (max * 2);
		g.drawImage(page, 0, bar - (y < max ? y : max * 2 - y), w, pageH);
	}
	g.fillStyle = "#1f2430";
	g.fillRect(0, 0, w, bar);
	g.fillStyle = "#2c3343";
	g.fillRect(90, 11, w - 120, bar - 22);
	g.fillStyle = "#c5cee0";
	g.font = `500 20px ${FONT}`;
	g.textBaseline = "middle";
	g.fillText("jpl-innovation.github.io", 110, bar / 2 + 1);
}
