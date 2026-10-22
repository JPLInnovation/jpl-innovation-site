/**
 * Set dressing: the small things that make the room look worked in (shelving with bins, a plant, a rug, a toolbox,
 * a parts shelf over the drone bench, laptops on the team's table, a badge on a lanyard by the door). Plain shapes in
 * the room's own materials, placed so they sit in frame beside each scene's subject and never in front of it.
 * Positions are metres in the room's space (room.ts: the front wall is z = -3.4, the back wall z = 6.4).
 */
import {
	CylinderGeometry,
	DoubleSide,
	Group,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PlaneGeometry,
	SphereGeometry,
	TorusGeometry,
} from "three";
import { hardware } from "../three/finish";
import { boxAt, canvasSurface, imageTexture, ROOM } from "./room";
import type { RoomState } from "./room";

export interface Props {
	update(state: RoomState, dt: number): void;
}

const mat = (color: number, roughness = 0.6, finish: Parameters<typeof hardware>[1] = "plastic") => hardware({ color, roughness }, finish);

export function buildProps(parent: Group): Props {
	const { z0, z1 } = ROOM;
	const steel = hardware({ color: 0x2d3446, roughness: 0.4, metalness: 0.7 }, "anodised");
	const wood = hardware({ color: 0x5b4636, roughness: 0.55 }, "plastic");
	const kraft = mat(0xb08a5a, 0.85, "printed");
	const accents = [0x22d3ee, 0xffc20e, 0x8b5cf6, 0x34d399, 0xf0596b, 0x3b82f6].map((c) => mat(c, 0.5));

	/** A potted plant: a tapered pot and a handful of leaves. */
	const plant = (x: number, y: number, z: number, scale = 1) => {
		const g = new Group();
		g.position.set(x, y, z);
		g.scale.setScalar(scale);
		parent.add(g);
		const pot = new Mesh(new CylinderGeometry(0.15, 0.11, 0.22, 20), mat(0xe9eef7, 0.4, "plastic"));
		pot.position.y = 0.11;
		g.add(pot);
		const soil = new Mesh(new CylinderGeometry(0.135, 0.135, 0.02, 20), mat(0x2a2118, 0.95));
		soil.position.y = 0.225;
		g.add(soil);
		const leaf = hardware({ color: 0x2f8f5b, roughness: 0.7, side: DoubleSide }, "fabric");
		for (let i = 0; i < 9; i++) {
			const a = (i / 9) * Math.PI * 2;
			const tilt = 0.45 + (i % 3) * 0.18;
			const stem = new Mesh(new SphereGeometry(0.1, 10, 8), leaf);
			stem.scale.set(0.5, 1.6 + (i % 3) * 0.35, 0.18);
			stem.position.set(Math.sin(a) * 0.07, 0.4 + (i % 3) * 0.06, Math.cos(a) * 0.07);
			stem.rotation.set(Math.cos(a) * tilt, 0, -Math.sin(a) * tilt);
			g.add(stem);
		}
		return g;
	};

	/** Open shelving: two uprights, boards, and what sits on them. */
	const shelving = (x: number, z: number, width: number, boards: number[], depth = 0.34) => {
		for (const sx of [-1, 1]) boxAt(parent, 0.04, boards[boards.length - 1] + 0.12, depth, steel, x + sx * (width / 2 - 0.02), (boards[boards.length - 1] + 0.12) / 2, z);
		for (const y of boards) boxAt(parent, width, 0.03, depth, wood, x, y, z, 0.006);
		boxAt(parent, width - 0.08, boards[boards.length - 1] + 0.1, 0.01, mat(0x111a33, 0.9), x, (boards[boards.length - 1] + 0.1) / 2 + 0.02, z - depth / 2 + 0.005); // the back panel
	};

	/* ---------- The storage shelving by the desk (the title scene's frame, left of the desk) ---------- */
	const sx = -8.0;
	const sz = z0 + 0.2;
	shelving(sx, sz, 0.9, [0.12, 0.55, 0.98, 1.41, 1.84]);
	// Floor shelf: two big bins.
	boxAt(parent, 0.36, 0.28, 0.28, accents[0], sx - 0.2, 0.28, sz, 0.02);
	boxAt(parent, 0.36, 0.28, 0.28, accents[2], sx + 0.2, 0.28, sz, 0.02);
	// Second: a row of binders.
	[0x1d4ed8, 0x0f766e, 0xb45309, 0x7c3aed, 0xbe123c, 0x334155].forEach((c, i) => boxAt(parent, 0.07, 0.3, 0.24, mat(c, 0.55), sx - 0.33 + i * 0.1, 0.72, sz, 0.005));
	// Third: cardboard boxes.
	boxAt(parent, 0.3, 0.22, 0.26, kraft, sx - 0.22, 1.12, sz, 0.01);
	boxAt(parent, 0.26, 0.16, 0.26, kraft, sx + 0.18, 1.09, sz, 0.01);
	boxAt(parent, 0.2, 0.12, 0.2, kraft, sx + 0.18, 1.23, sz, 0.01);
	// Fourth: small bins in the team's colours.
	for (let i = 0; i < 4; i++) boxAt(parent, 0.17, 0.12, 0.24, accents[(i + 1) % accents.length], sx - 0.3 + i * 0.2, 1.5, sz, 0.015);
	// Top: a small plant.
	plant(sx, 1.86, sz, 0.55);
	// And a taller one on the floor beside the desk.
	plant(-7.3, 0, z0 + 0.45, 1.5);

	/* ---------- A rug under the desk ---------- */
	const rugFace = canvasSurface(512, 352);
	{
		const { g } = rugFace;
		g.fillStyle = "#16213f";
		g.fillRect(0, 0, 512, 352);
		g.strokeStyle = "#22d3ee";
		g.globalAlpha = 0.55;
		g.lineWidth = 5;
		g.strokeRect(24, 24, 464, 304);
		g.globalAlpha = 0.28;
		g.lineWidth = 2;
		g.strokeRect(44, 44, 424, 264);
		g.globalAlpha = 0.18;
		for (let i = 0; i < 9; i++) {
			g.beginPath();
			g.moveTo(64 + i * 48, 64);
			g.lineTo(64 + i * 48, 288);
			g.stroke();
		}
		rugFace.redraw();
	}
	const rug = new Mesh(new PlaneGeometry(3.0, 2.1), new MeshStandardMaterial({ map: rugFace.texture, roughness: 1 }));
	rug.rotation.x = -Math.PI / 2;
	rug.position.set(-6, 0.006, z0 + 1.45);
	parent.add(rug);

	/* ---------- Robotics: a toolbox and spare wheels ---------- */
	const red = mat(0xc8283a, 0.45);
	boxAt(parent, 0.52, 0.22, 0.26, red, -1.78, 0.11, -1.95, 0.02);
	boxAt(parent, 0.5, 0.05, 0.24, mat(0x9a1f2e, 0.45), -1.78, 0.245, -1.95, 0.015);
	const handle = new Mesh(new TorusGeometry(0.06, 0.008, 8, 16, Math.PI), steel);
	handle.position.set(-1.78, 0.27, -1.95);
	parent.add(handle);
	const tire = mat(0x14171f, 0.9, "rubber");
	for (let i = 0; i < 3; i++) {
		const wheel = new Mesh(new CylinderGeometry(0.1, 0.1, 0.05, 20), tire);
		wheel.position.set(-3.75, 0.03 + i * 0.052, -3.0);
		parent.add(wheel);
	}

	/* ---------- Drones: a parts shelf over the bench ---------- */
	const px = -1.25;
	boxAt(parent, 1.5, 0.03, 0.26, wood, px, 1.5, z0 + 0.15, 0.006);
	boxAt(parent, 1.5, 0.03, 0.26, wood, px, 1.9, z0 + 0.15, 0.006);
	for (const bx of [-0.62, 0.62]) boxAt(parent, 0.03, 0.46, 0.04, steel, px + bx, 1.7, z0 + 0.06);
	// LiPo bags, flat, with a red label each; a stack of prop packs; a coil of wire.
	for (let i = 0; i < 3; i++) {
		boxAt(parent, 0.14, 0.05, 0.1, mat(0x161a24, 0.5, "wrap"), px - 0.5 + i * 0.17, 1.545, z0 + 0.15, 0.01);
		boxAt(parent, 0.06, 0.004, 0.04, red, px - 0.5 + i * 0.17, 1.572, z0 + 0.15);
	}
	for (let i = 0; i < 3; i++) boxAt(parent, 0.22, 0.015, 0.12, mat(0x1d2b4f, 0.5), px + 0.12, 1.53 + i * 0.016, z0 + 0.15, 0.003);
	const coil = new Mesh(new TorusGeometry(0.05, 0.016, 8, 20), mat(0xf0596b, 0.5));
	coil.rotation.x = Math.PI / 2;
	coil.position.set(px + 0.5, 1.55, z0 + 0.15);
	parent.add(coil);
	// Upper shelf: bins.
	for (let i = 0; i < 5; i++) boxAt(parent, 0.2, 0.13, 0.2, accents[i % accents.length], px - 0.55 + i * 0.27, 1.975, z0 + 0.15, 0.015);

	/* ---------- Web: a mug and a notebook by the laptop ---------- */
	const mug = new Mesh(new CylinderGeometry(0.04, 0.036, 0.1, 20), mat(0xf2f4f8, 0.35, "wrap"));
	mug.position.set(3.3 - 0.62, 0.9, -2.75);
	parent.add(mug);
	boxAt(parent, 0.2, 0.016, 0.28, mat(0xf4efe2, 0.9, "printed"), 3.3 + 0.62, 0.858, -2.78, 0.003).rotation.y = -0.3;

	/* ---------- Networks: a cable spool at the rack's foot ---------- */
	const spool = new Mesh(new CylinderGeometry(0.11, 0.11, 0.12, 20), mat(0xc8283a, 0.5));
	spool.position.set(1.85, 0.06, -2.2);
	parent.add(spool);
	const spoolCore = new Mesh(new CylinderGeometry(0.045, 0.045, 0.14, 12), steel);
	spoolCore.position.copy(spool.position);
	parent.add(spoolCore);

	/* ---------- The crew's table: two laptops, notebooks, a plant ---------- */
	const alu = hardware({ color: 0xb4bccb, roughness: 0.32, metalness: 0.85 }, "anodised");
	const screenGlow = new MeshBasicMaterial({ color: 0x1a2a52, toneMapped: false });
	const tableTop = 0.77;
	for (const [x, turn] of [[-3.05, 0.25], [-1.75, -0.2]] as const) {
		const laptop = new Group();
		laptop.position.set(x, tableTop, 4.78);
		laptop.rotation.y = Math.PI + turn;
		parent.add(laptop);
		boxAt(laptop, 0.34, 0.012, 0.23, alu, 0, 0.006, 0, 0.005);
		const lid = new Group();
		lid.position.set(0, 0.012, -0.11);
		lid.rotation.x = -0.32;
		laptop.add(lid);
		boxAt(lid, 0.34, 0.22, 0.008, alu, 0, 0.11, 0, 0.004);
		const screen = new Mesh(new PlaneGeometry(0.32, 0.2), screenGlow);
		screen.position.set(0, 0.11, 0.005);
		lid.add(screen);
	}
	boxAt(parent, 0.17, 0.014, 0.23, mat(0xf4efe2, 0.9, "printed"), -2.4, tableTop + 0.007, 5.0, 0.003).rotation.y = 0.5;
	boxAt(parent, 0.17, 0.014, 0.23, mat(0x23324f, 0.7), -2.15, tableTop + 0.007, 4.95, 0.003).rotation.y = -0.2;
	plant(-3.95, 0, z1 - 0.5, 1.4);

	/* ---------- The window sill: a small plant ---------- */
	plant(2.55, 0.9, z1 - 0.22, 0.6);

	/* ---------- The door: a mat, and a badge on a lanyard from a hook rail ---------- */
	const doorX = -5.6;
	boxAt(parent, 0.9, 0.012, 0.5, mat(0x1c2540, 1, "fabric"), doorX, 0.006, z1 - 0.55, 0.004);
	boxAt(parent, 0.5, 0.03, 0.03, steel, doorX + 1.15, 1.72, z1 - 0.025);
	const badgeHolder = new Group();
	badgeHolder.position.set(doorX + 1.15, 1.72, z1 - 0.06);
	parent.add(badgeHolder);
	boxAt(badgeHolder, 0.012, 0.34, 0.004, mat(0x3b4fd8, 0.6, "fabric"), 0, -0.17, 0);
	const badgeFace = new Mesh(new PlaneGeometry(0.11, 0.15), new MeshBasicMaterial({ map: imageTexture("/assets/jpl-logo-dark-480.webp"), transparent: true, toneMapped: false }));
	badgeFace.rotation.y = Math.PI;
	badgeFace.position.set(0, -0.44, -0.004);
	badgeHolder.add(badgeFace);
	boxAt(badgeHolder, 0.12, 0.16, 0.006, mat(0x0b1226, 0.5), 0, -0.44, 0.002, 0.008);

	let sway = 0;
	return {
		update(_state, dt) {
			// The badge sways on its lanyard in the draught of the door.
			sway += dt;
			badgeHolder.rotation.z = Math.sin(sway * 0.9) * 0.05;
		},
	};
}
