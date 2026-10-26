/**
 * The build bench, between the desk and the robot cart: where the F450 goes together and gets tested (the "build" and
 * "test" scenes, after Research). Metres, y up.
 *
 *   Build   as the camera comes to the bench, the drone assembles piece by piece from its real CAD (every connected
 *           piece flies in from its exploded place, bottom to top: the same exploded view the opening hook plays,
 *           hook-blueprint.ts), in step with the scroll, and backwards when you scroll back.
 *   Test    the drone sits whole on the bench (its props still: it has only been bench tested). On the wall above it a
 *           screen plays a SIMULATED flight of the 3D model, scrubbed by the scroll: higher the further you go. The
 *           clip (rendered at 4K; a 1080p copy for the lower tiers) says "SIMULATION · 3D model · not flown yet" on every frame
 *           (public/studio/sim/, scripts/sim-flight.py),
 *           and the scene's text says it too.
 *
 * The opening hook's drone stands on this bench too (not on the sketchbook): while it is there, the bench's own drone
 * stays hidden (`occupied`).
 */
import { Color, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, VideoTexture, type Object3D } from "three";
import { hardware } from "../three/finish";
import type { DroneRig } from "../three/models/drone";
import type { StageContext } from "../three/stage";
import { explodePieces } from "./hook-blueprint";
import { type DissolveUniforms, dissolveMaterials } from "./hook-dissolve";
import type { LightSpec } from "./lights";
import { asset, boxAt, canvasSurface, ROOM, type RoomState } from "./room";

/** Where the bench stands: its middle (x, z) and the height of its top. */
export const BENCH = { x: -4.15, z: -2.4, top: 0.82, width: 1.0, depth: 0.62 };

/** Every position and timing of the bench in one place to tune. */
export const BENCH_LOOK = {
	/** The drone's spot on the bench mat and its turn (it faces the camera a little from the left). */
	drone: { x: BENCH.x + 0.02, z: BENCH.z + 0.02, turn: 0.55 },
	/** Build: over how much of the scroll before the build scene the drone assembles (in scenes), and when it is whole. */
	build: { from: -0.75, to: 0.05 },
	/** Test: the clip runs from this far before the test scene to this far after it (in scenes). */
	clip: { from: -0.45, to: 0.55, url4k: "/studio/sim/flight-sim-4k.mp4", url: "/studio/sim/flight-sim-1080.mp4", seconds: 5 },
	/** The screen on the front wall above the bench: middle height and width (16:9). */
	screen: { y: 1.5, width: 1.3 },
	spread: 0.32,
};

export interface BuildBench {
	accents: Record<string, LightSpec>;
	/** Set by the opening hook while its drone stands on the bench. */
	occupied: { value: boolean };
	/** The drone's footprint on the bench (x0, x1, z0, z1), for the never-on-paper check. */
	footprint: { x0: number; x1: number; z0: number; z1: number };
	update(state: RoomState, ids: readonly string[], source: DroneRig | undefined): void;
	applyPalette(dark: boolean): void;
	busy(): boolean;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => x * x * (3 - 2 * x);

export function buildBench(ctx: StageContext, group: Group): BuildBench {
	const { x, z, top, width, depth } = BENCH;
	const benchMat = hardware({ color: 0x2a3550, roughness: 0.6 }, "plastic") as MeshStandardMaterial;
	const steel = hardware({ color: 0x2d3446, roughness: 0.4, metalness: 0.7 }, "anodised");
	boxAt(group, width, 0.05, depth, benchMat, x, top - 0.025, z, 0.01);
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxAt(group, 0.045, top - 0.05, 0.045, steel, x + sx * (width / 2 - 0.06), (top - 0.05) / 2, z + sz * (depth / 2 - 0.06));
	boxAt(group, width - 0.12, 0.02, depth - 0.12, steel, x, 0.16, z, 0.004); // a shelf underneath

	// A green cutting mat with its centimetre grid, under the drone.
	const mat = canvasSurface(1024, 640);
	{
		const { g } = mat;
		g.fillStyle = "#1f5d4a";
		g.fillRect(0, 0, 1024, 640);
		g.strokeStyle = "rgba(220,240,230,0.18)";
		g.lineWidth = 1;
		for (let i = 0; i <= 1024; i += 13) (g.beginPath(), g.moveTo(i, 0), g.lineTo(i, 640), g.stroke());
		for (let i = 0; i <= 640; i += 13) (g.beginPath(), g.moveTo(0, i), g.lineTo(1024, i), g.stroke());
		g.strokeStyle = "rgba(230,245,235,0.42)";
		g.lineWidth = 2;
		for (let i = 0; i <= 1024; i += 130) (g.beginPath(), g.moveTo(i, 0), g.lineTo(i, 640), g.stroke());
		for (let i = 0; i <= 640; i += 130) (g.beginPath(), g.moveTo(0, i), g.lineTo(1024, i), g.stroke());
		g.strokeStyle = "rgba(230,245,235,0.3)";
		g.beginPath();
		g.moveTo(0, 640);
		g.lineTo(640, 0);
		g.stroke();
		mat.redraw();
	}
	const cutMat = new Mesh(new PlaneGeometry(0.8, 0.5), hardware({ color: 0xffffff, map: mat.texture, roughness: 0.85 }, "rubber"));
	cutMat.rotation.x = -Math.PI / 2;
	cutMat.position.set(x, top + 0.002, z + 0.02);
	group.add(cutMat);
	// Tools beside it: a screwdriver and a small tray of screws.
	const red = hardware({ color: 0xc8283a, roughness: 0.45 }, "plastic");
	const metal = hardware({ color: 0xb8c0cc, roughness: 0.3, metalness: 0.9 }, "metal");
	const dark = new MeshStandardMaterial({ color: 0x141a28, roughness: 0.5 });
	boxAt(group, 0.1, 0.022, 0.022, red, x + 0.44, top + 0.011, z + 0.2, 0.008).rotation.y = 0.4;
	boxAt(group, 0.08, 0.005, 0.005, metal, x + 0.36, top + 0.011, z + 0.23).rotation.y = 0.4;
	boxAt(group, 0.12, 0.025, 0.08, dark, x + 0.4, top + 0.0125, z - 0.18, 0.006);

	// The screen on the front wall: a thin bezel, the simulated flight on it.
	const sw = BENCH_LOOK.screen.width;
	const sh = (sw * 9) / 16;
	boxAt(group, sw + 0.04, sh + 0.04, 0.03, new MeshStandardMaterial({ color: 0x0c0f16, roughness: 0.4 }), x, BENCH_LOOK.screen.y, ROOM.z0 + 0.03, 0.008);
	const poster = canvasSurface(960, 540);
	{
		const { g } = poster;
		g.fillStyle = "#0b1220";
		g.fillRect(0, 0, 960, 540);
		g.strokeStyle = "rgba(255,194,14,0.9)";
		g.lineWidth = 3;
		g.strokeRect(22, 20, 372, 62);
		g.fillStyle = "#ffd65a";
		g.font = "700 24px ui-monospace, monospace";
		g.fillText("SIMULATION", 58, 52);
		g.fillStyle = "#e1e8f5";
		g.font = "16px ui-monospace, monospace";
		g.fillText("3D model · not flown yet", 58, 74);
		poster.redraw();
	}
	const screenMat = new MeshBasicMaterial({ map: poster.texture, toneMapped: false });
	const screen = new Mesh(new PlaneGeometry(sw, sh), screenMat);
	screen.position.set(x, BENCH_LOOK.screen.y, ROOM.z0 + 0.047);
	group.add(screen);
	// The clip loads only once the camera nears the bench; it never plays on its own, the scroll sets its time.
	let video: HTMLVideoElement | undefined;
	let videoTexture: VideoTexture | undefined;
	let ready = false;
	let lastSet = -1;
	let seeking = false;
	const load = () => {
		if (video) return;
		video = document.createElement("video");
		video.muted = true;
		video.playsInline = true;
		video.preload = "auto";
		video.crossOrigin = "anonymous";
		// 4K on the high quality tier, 1080p otherwise: each scrubbed frame is uploaded to the GPU, and 4K is 4× the pixels.
		video.src = asset(ctx.tier === "high" ? BENCH_LOOK.clip.url4k : BENCH_LOOK.clip.url);
		video.addEventListener("loadeddata", () => {
			ready = true;
			videoTexture = new VideoTexture(video!);
			videoTexture.colorSpace = SRGBColorSpace;
			screenMat.map = videoTexture;
			screenMat.needsUpdate = true;
			ctx.wake();
		});
		video.addEventListener("seeked", () => {
			seeking = false;
			if (videoTexture) videoTexture.needsUpdate = true;
			ctx.wake();
		});
		video.load();
	};

	// The bench's own drone: a clone of the drone bench's (shared geometry), with the exploded view to play backwards.
	const holder = new Group();
	holder.position.set(BENCH_LOOK.drone.x, top + 0.004, BENCH_LOOK.drone.z);
	holder.rotation.y = BENCH_LOOK.drone.turn;
	holder.visible = false;
	group.add(holder);
	let drone: Object3D | undefined;
	const uniforms: DissolveUniforms = { uHookCut: { value: 100 }, uHookEdge: { value: new Color(0x6fdcff) }, uHookAssemble: { value: 1 } };
	const occupied = { value: false };
	let screenGlow = 0;
	let moving = false;

	return {
		occupied,
		footprint: { x0: BENCH_LOOK.drone.x - 0.3, x1: BENCH_LOOK.drone.x + 0.3, z0: BENCH_LOOK.drone.z - 0.3, z1: BENCH_LOOK.drone.z + 0.3 },
		accents: {
			build: { at: [x - 0.1, top + 0.7, z + 0.6], color: 0xffe2b8, dark: 2.2, light: 2.0, distance: 2.4, decay: 2 },
			test: { at: [x, BENCH_LOOK.screen.y, z + 0.9], color: 0x9fc8ff, dark: 1.6, light: 1.4, distance: 2.6, decay: 2 },
		},
		update(state, ids, source) {
			const s = state.position;
			const bi = ids.indexOf("build");
			const ti = ids.indexOf("test");
			moving = false;
			if (bi < 0 || ti < 0) return;
			// Load the clip a scene ahead.
			if (s > bi - 1.2 && s < ti + 2) load();
			if (!drone && source) {
				drone = source.model.clone(true);
				holder.add(drone);
				holder.updateMatrixWorld(true);
				dissolveMaterials(drone, uniforms);
				explodePieces(drone, BENCH_LOOK.spread);
			}
			// Build: 0 = nothing yet, 1 = whole; follows the scroll both ways (the loop's far side counts as before).
			const a = s > ti + 3 ? 1 : smooth(clamp01((s - (bi + BENCH_LOOK.build.from)) / (BENCH_LOOK.build.to - BENCH_LOOK.build.from)));
			const nearBench = s > bi - 1.5 && s < ti + 3;
			holder.visible = !!drone && !occupied.value && nearBench && a > 0.002;
			uniforms.uHookAssemble.value = a;
			moving = a > 0.002 && a < 0.998;
			// Test: the clip's time follows the scroll.
			const c = clamp01((s - (ti + BENCH_LOOK.clip.from)) / (BENCH_LOOK.clip.to - BENCH_LOOK.clip.from));
			if (video && ready && !seeking) {
				const t = Math.min(BENCH_LOOK.clip.seconds - 0.04, c * BENCH_LOOK.clip.seconds);
				if (Math.abs(t - lastSet) > 1 / 60) {
					lastSet = t;
					seeking = true;
					video.currentTime = t;
				}
			}
			// The screen glows up as the camera comes to it.
			screenGlow = clamp01(1.4 - Math.abs(s - ti) * 1.2);
			screenMat.color.setScalar(0.25 + 0.75 * screenGlow);
		},
		applyPalette(darkTheme) {
			benchMat.color.set(darkTheme ? 0x2a3550 : 0xc9d3e6);
		},
		busy: () => moving || seeking,
	};
}
