/**
 * What makes the room feel lived in, without costing a light: drifting dust, pools of light on the floor under each
 * station (flat, glowing decals, not lights), and LED strips under the benches. All of it is unlit and cheap: a few
 * hundred points, a dozen flat planes, a handful of thin boxes.
 */
import {
	AdditiveBlending,
	BufferAttribute,
	BufferGeometry,
	CanvasTexture,
	Color,
	type Group,
	Mesh,
	MeshBasicMaterial,
	NormalBlending,
	PlaneGeometry,
	Points,
	PointsMaterial,
	SRGBColorSpace,
} from "three";
import type { Palette } from "../three/stage";
import { boxAt, ROOM } from "./room";
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

/** Where light pools on the floor, and in what colour: one per scene (the camera's focus fades it up). */
const POOLS: Record<string, { at: [number, number]; size: number; color: number }> = {
	title: { at: [-6, -1.7], size: 3.6, color: 0xffd9a0 },
	sketch: { at: [-6, -1.7], size: 3.2, color: 0xffd9a0 },
	research: { at: [-5.1, -1.5], size: 3.2, color: 0x9ccfff },
	build: { at: [-4.15, -1.9], size: 3.0, color: 0xffe2b8 },
	test: { at: [-4.0, -1.8], size: 3.2, color: 0x9fc8ff },
	robotics: { at: [-2.6, -2.0], size: 3.6, color: 0x2dd4bf },
	drones: { at: [-0.6, -1.9], size: 3.4, color: 0xffc20e },
	networks: { at: [1.4, -2.0], size: 3.2, color: 0x22d3ee },
	web: { at: [3.3, -1.9], size: 3.4, color: 0x8b5cf6 },
	wall: { at: [5.6, 1.0], size: 4.4, color: 0x6d6dff },
	standards: { at: [5.0, 5.2], size: 4.2, color: 0xfff4e0 },
	timeline: { at: [1.2, 5.6], size: 5.4, color: 0x5b7fd6 },
	crew: { at: [-2.4, 4.9], size: 4.2, color: 0xffd9a0 },
	contact: { at: [-5.6, 5.4], size: 3.4, color: 0x9fdcff },
};

/** LED strips under the benches: where (x, y, z), how long, colour. */
const STRIPS: [number, number, number, number, number][] = [
	[-2.6, 0.1, -2.1, 1.1, 0x2dd4bf],
	[-0.6, 0.8, -2.2, 1.5, 0xffc20e],
	[1.4, 0.04, -2.64, 0.62, 0x22d3ee],
	[3.3, 0.8, -2.2, 1.5, 0x8b5cf6],
	[-6, 0.72, -2.0, 2.2, 0xffb869],
];

export interface Ambience {
	update(state: RoomState, dt: number): void;
	applyPalette(p: Palette): void;
}

export function buildAmbience(parent: Group): Ambience {
	const { x0, x1, z0, z1, h } = ROOM;

	/* ---------- Dust ---------- */
	const COUNT = 260;
	const base = new Float32Array(COUNT * 3);
	const phase = new Float32Array(COUNT * 3);
	let seed = 5;
	const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	for (let i = 0; i < COUNT; i++) {
		base[i * 3] = x0 + 0.5 + rand() * (x1 - x0 - 1);
		base[i * 3 + 1] = 0.25 + rand() * (h - 0.6);
		base[i * 3 + 2] = z0 + 0.5 + rand() * (z1 - z0 - 1);
		phase[i * 3] = rand() * 6.28;
		phase[i * 3 + 1] = rand() * 6.28;
		phase[i * 3 + 2] = rand() * 6.28;
	}
	const positions = new Float32Array(base);
	const geometry = new BufferGeometry();
	geometry.setAttribute("position", new BufferAttribute(positions, 3));
	const dustMaterial = new PointsMaterial({ size: 0.028, map: softDot(), color: 0xbcd8ff, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true });
	const dust = new Points(geometry, dustMaterial);
	dust.frustumCulled = false;
	parent.add(dust);

	/* ---------- Floor light pools ---------- */
	const poolTexture = softDot();
	const pools = Object.entries(POOLS).map(([id, p]) => {
		// Well above the rug (a few millimetres apart, two flat surfaces take turns being in front, pixel by pixel: the streaks), and
			// drawn in front of it by the depth buffer's own offset as well.
			const material = new MeshBasicMaterial({ map: poolTexture, color: p.color, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
		const mesh = new Mesh(new PlaneGeometry(p.size, p.size), material);
		mesh.rotation.x = -Math.PI / 2;
		mesh.position.set(p.at[0], 0.02, p.at[1]);
		parent.add(mesh);
		return { id, material };
	});

	/* ---------- LED strips ---------- */
	const strips = STRIPS.map(([x, y, z, length, color]) => {
		const material = new MeshBasicMaterial({ color, toneMapped: false });
		boxAt(parent, length, 0.012, 0.012, material, x, y, z);
		return { material, color: new Color(color) };
	});

	let dark = true;
	let clock = 0;

	return {
		update({ focus, lamp }, dt) {
			clock += dt;
			const level = lamp * lamp * (3 - 2 * lamp);
			// Dust drifts a few centimetres either way, slowly and out of step.
			for (let i = 0; i < COUNT; i++) {
				const k = i * 3;
				positions[k] = base[k] + Math.sin(clock * 0.11 + phase[k]) * 0.18;
				positions[k + 1] = base[k + 1] + Math.sin(clock * 0.08 + phase[k + 1]) * 0.12;
				positions[k + 2] = base[k + 2] + Math.sin(clock * 0.1 + phase[k + 2]) * 0.18;
			}
			geometry.attributes.position.needsUpdate = true;
			dustMaterial.opacity = (dark ? 0.55 : 0) * level;
			for (const pool of pools) pool.material.opacity = (dark ? 0.42 : 0.16) * (focus[pool.id] ?? 0) * level;
			// The strips come up with the lamp.
			for (const strip of strips) strip.material.color.copy(strip.color).multiplyScalar(0.15 + 0.85 * level);
		},
		applyPalette(p) {
			dark = p.dark;
			for (const pool of pools) pool.material.blending = dark ? AdditiveBlending : NormalBlending;
		},
	};
}
