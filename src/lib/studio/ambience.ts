/**
 * What makes the room feel lit and lived in, without costing a light:
 *   - contact shadows: a soft dark footprint under everything that stands on the floor, a desk or a bench (one
 *     instanced draw call of a blurred rectangle), so nothing floats;
 *   - a warm glow on the floor under each scene's bench lamp (lights.ts), fading up with the camera's focus;
 *   - dust drifting in the lamp light, in the dark theme.
 * All of it is unlit and cheap: a few hundred points and a handful of flat planes.
 */
import {
	AdditiveBlending,
	BufferAttribute,
	BufferGeometry,
	CanvasTexture,
	type Group,
	InstancedMesh,
	Mesh,
	MeshBasicMaterial,
	NormalBlending,
	Object3D,
	PlaneGeometry,
	Points,
	PointsMaterial,
	SRGBColorSpace,
} from "three";
import type { Palette } from "../three/stage";
import { ROOM } from "./room";
import type { RoomState } from "./room";

/** A soft round sprite: white in the middle, nothing at the edge. */
function softDot() {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 64;
	const g = canvas.getContext("2d")!;
	const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
	gradient.addColorStop(0, "rgba(255,255,255,1)");
	gradient.addColorStop(0.35, "rgba(255,255,255,0.35)");
	gradient.addColorStop(1, "rgba(255,255,255,0)");
	g.fillStyle = gradient;
	g.fillRect(0, 0, 64, 64);
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	return texture;
}

/** A blurred rounded rectangle, black, its alpha the shadow: the middle 56% of the square is the object's footprint. */
function softRect() {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 128;
	const g = canvas.getContext("2d")!;
	g.filter = "blur(12px)";
	g.fillStyle = "#000";
	g.beginPath();
	g.roundRect(28, 28, 72, 72, 10);
	g.fill();
	return new CanvasTexture(canvas);
}
const FOOTPRINT = 1 / 0.56;

/** Where the warm glow sits on the floor under each scene's lamp: centre (x, z) and size (m). */
const POOLS: Record<string, { at: [number, number]; size: number }> = {
	title: { at: [-6, -1.9], size: 3.4 },
	sketch: { at: [-6, -1.9], size: 3.0 },
	research: { at: [-5.1, -1.8], size: 2.6 },
	build: { at: [-4.15, -1.9], size: 2.6 },
	test: { at: [-3.8, -1.9], size: 2.8 },
	web: { at: [-2.6, -1.9], size: 2.8 },
	robotics: { at: [-0.6, -2.0], size: 3.0 },
	drones: { at: [1.4, -1.9], size: 2.8 },
	networks: { at: [3.3, -2.1], size: 2.4 },
	standards: { at: [5.0, 5.3], size: 3.4 },
	crew: { at: [-2.4, 4.9], size: 3.8 },
	contact: { at: [-5.6, 5.5], size: 3.0 },
};

/** Contact shadows: centre x, height of the surface it lies on, centre z, footprint width and depth (m). (A function:
 * room.ts and this file import each other, so ROOM is not there yet while this module loads.) */
const shadowSpots = ({ z0, z1 } = ROOM): [number, number, number, number, number][] => [
	[-6, 0, -2.45, 2.2, 0.85], // the desk
	[-6.2, 0, -1.48, 0.55, 0.55], // its chair
	[-8.0, 0, z0 + 0.2, 0.92, 0.42], // the shelving
	[-8.15, 0, -1.65, 0.36, 0.36], // the floor plant
	[-6.78, 0.761, -2.67, 0.2, 0.2], // the lamp's base
	[-5.12, 0.761, -2.69, 0.3, 0.2], // the monitor's foot
	[-5.12, 0.761, -2.33, 0.46, 0.17], // the keyboard
	[-6.95, 0.761, -2.6, 0.1, 0.1], // the mug
	[-4.15, 0, -2.4, 1.0, 0.62], // the build bench
	[-2.6, 0, -2.6, 1.6, 0.8], // the test bench
	[-2.6, 0.851, -2.48, 0.46, 0.32], // its laptop
	[-0.6, 0, -2.55, 1.1, 0.86], // the robot cart
	[-0.56, 0.36, -2.55, 0.8, 0.7], // the robot on it
	[0.22, 0, -1.95, 0.54, 0.28], // the toolbox
	[1.4, 0, -2.6, 1.6, 0.8], // the drone bench
	[3.3, 0, -2.95, 0.74, 0.64], // the rack
	[-2.4, 0, 5.1, 2.1, 0.9], // the table
	[-3.95, 0, z1 - 0.5, 0.4, 0.4], // the plant by the window
	...[-4.05, -2.95, -1.85, -0.75].map((x): [number, number, number, number, number] => [x, 0, 5.85, 0.5, 0.5]), // the crew's chairs
];

export interface Ambience {
	update(state: RoomState, dt: number): void;
	applyPalette(p: Palette): void;
}

export function buildAmbience(parent: Group): Ambience {
	const { x0, x1, z0, h } = ROOM;
	const SHADOWS = shadowSpots();

	/* ---------- Contact shadows ---------- */
	const shadowMat = new MeshBasicMaterial({ color: 0x000000, map: softRect(), transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
	const shadows = new InstancedMesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), shadowMat, SHADOWS.length);
	const place = new Object3D();
	SHADOWS.forEach(([x, y, z, w, d], i) => {
		place.position.set(x, y + (y ? 0.003 : 0.009), z); // (on the floor: above the rug)
		place.scale.set(w * FOOTPRINT, 1, d * FOOTPRINT);
		place.updateMatrix();
		shadows.setMatrixAt(i, place.matrix);
	});
	shadows.renderOrder = 1;
	parent.add(shadows);

	/* ---------- Dust ---------- */
	const COUNT = 200;
	const base = new Float32Array(COUNT * 3);
	const phase = new Float32Array(COUNT * 3);
	let seed = 5;
	const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	for (let i = 0; i < COUNT; i++) {
		base[i * 3] = x0 + 0.5 + rand() * (x1 - x0 - 1);
		base[i * 3 + 1] = 0.25 + rand() * (h - 0.6);
		base[i * 3 + 2] = z0 + 0.5 + rand() * (2.5 - z0);
		phase[i * 3] = rand() * 6.28;
		phase[i * 3 + 1] = rand() * 6.28;
		phase[i * 3 + 2] = rand() * 6.28;
	}
	const positions = new Float32Array(base);
	const geometry = new BufferGeometry();
	geometry.setAttribute("position", new BufferAttribute(positions, 3));
	const dustMaterial = new PointsMaterial({ size: 0.02, map: softDot(), color: 0xffd9a8, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true });
	const dust = new Points(geometry, dustMaterial);
	dust.frustumCulled = false;
	parent.add(dust);

	/* ---------- The lamps' glow on the floor ---------- */
	const poolTexture = softDot();
	const pools = Object.entries(POOLS).map(([id, p]) => {
		// Drawn in front of the rug by the depth buffer's own offset (two flat surfaces a few millimetres apart flicker).
		const material = new MeshBasicMaterial({ map: poolTexture, color: 0xffc98a, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
		const mesh = new Mesh(new PlaneGeometry(p.size, p.size), material);
		mesh.rotation.x = -Math.PI / 2;
		mesh.position.set(p.at[0], 0.02, p.at[1]);
		parent.add(mesh);
		return { id, material };
	});

	let dark = true;
	let clock = 0;

	return {
		update({ focus, lamp }, dt) {
			clock += dt;
			const level = lamp * lamp * (3 - 2 * lamp);
			// Dust drifts a few centimetres either way, slowly and out of step (only drawn in the dark theme).
			if (dark) {
				for (let i = 0; i < COUNT; i++) {
					const k = i * 3;
					positions[k] = base[k] + Math.sin(clock * 0.11 + phase[k]) * 0.18;
					positions[k + 1] = base[k + 1] + Math.sin(clock * 0.08 + phase[k + 1]) * 0.12;
					positions[k + 2] = base[k + 2] + Math.sin(clock * 0.1 + phase[k + 2]) * 0.18;
				}
				geometry.attributes.position.needsUpdate = true;
			}
			dustMaterial.opacity = (dark ? 0.35 : 0) * level;
			for (const pool of pools) pool.material.opacity = (dark ? 0.22 : 0.1) * (focus[pool.id] ?? 0) * level;
			shadowMat.opacity = (dark ? 0.55 : 0.32) * (0.4 + 0.6 * level);
		},
		applyPalette(p) {
			dark = p.dark;
			dust.visible = dark;
			for (const pool of pools) pool.material.blending = dark ? AdditiveBlending : NormalBlending;
		},
	};
}
