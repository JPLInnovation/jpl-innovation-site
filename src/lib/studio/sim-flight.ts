/**
 * The simulated flight, between the "test" scene and the test bench's laptop ("web"). It is a SIMULATION of the 3D model
 * in a made-up place, not footage: the drone has not flown, and every frame says so.
 *
 * A second small world (sky, ridges, fields, trees, two H pads, the real CAD) is drawn into one picture (`target`), live,
 * and shown on both the wall screen above the build bench and the camera feed of the laptop's ground station. All of it
 * follows the scroll, forwards and backwards:
 *
 *   wall screen   the drone lifts off its pad, seen from a chase camera
 *   dive          the room's camera flies at the wall screen until the picture is the whole window
 *   full window   the chase camera drops into the drone's Camera Module 3, flies on over the fields, arrives at the far H pad
 *   the cut       both screens show the same picture, inset to the window's own shape, so with one or the other filling
 *                 the window exactly, moving the room's camera from one to the other shows nothing at all
 *   pull out      back from the feed: the dashboard around it, the laptop, the room
 *
 * Drawn only while the scroll changes it. Its files load when the camera comes near.
 */
import { compileInSlices, uploadInSlices } from "../three/yield";
import {
	CircleGeometry,
	Group,
	HalfFloatType,
	Mesh,
	MeshBasicMaterial,
	Object3D,
	PerspectiveCamera,
	PlaneGeometry,
	Quaternion,
	CanvasTexture,
	SRGBColorSpace,
	Vector2,
	Vector3,
	WebGLRenderTarget,
} from "three";
import { type DroneRig, loadDrone } from "../three/models/drone";
import { createFlightWorld, type FlightWorld, newPose, PAD } from "../three/flight-world";
import type { StageContext } from "../three/stage";
import { simLabel } from "../../text/studio";
import type { Room } from "./room";

/**
 * Every timing of the flight in one place to tune. Scroll positions are in scenes, from "test" (T) and "web" (W). The
 * world, the route and the speeds along it are the drone page's too: src/lib/three/flight-world.ts.
 */
const LOOK = {
	/** The picture's clock runs from this far before T to this far before W. */
	from: -0.45,
	to: 0.8,
	/** The dive: from T + from to T + to. */
	dive: { from: 0.1, to: 0.85 },
	/** The pull out: from W - from to W - to. */
	out: { from: 0.8, to: 0.05 },
	/** The camera's flight, as shares of the picture's clock. */
	spinUp: [0, 0.06],
	intoLens: [0.3, 0.42],
	lookAtPad: [0.76, 0.87],
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => x * x * (3 - 2 * x);
const span = (f: number, [a, b]: readonly number[]) => clamp01((f - a) / (b - a));

export interface SimFlight {
	/** Every frame, after the room's camera has been placed; takes the camera over during the dive and the pull out. */
	update(s: number): void;
	/** True while something changed that the stage has to draw. */
	busy(): boolean;
	/** The laptop's ground station is open (src/components/Studio.astro): the flight plays at `f` (0 to 1) of its clock instead of following the scroll; null gives it back. */
	play(f: number | null): void;
	/** Where the drone is now, for the ground station's telemetry; undefined until the flight has loaded. */
	sample(): { x: number; y: number; z: number; yaw: number } | undefined;
	/** Where the room's camera stands for the laptop's feed to be exactly the window. */
	feedPose(at: Vector3, q: Quaternion): void;
	/**
	 * Builds the flight's world now, if it isn't yet: the engine calls this the first time the room is at rest. Building
	 * it (its sky, its shaders) froze the camera for ~100 ms when it was left until the scroll neared the bench.
	 */
	prepare(): Promise<void>;
}

/** The label on every frame, and the camera's brackets once the picture is the drone's own view. */
function buildOverlay(camera: PerspectiveCamera) {
	const label = document.createElement("canvas");
	label.width = 1024;
	label.height = 200;
	const paintLabel = () => {
		const g = label.getContext("2d")!;
		g.clearRect(0, 0, 1024, 200);
		g.fillStyle = "rgba(8,12,24,0.72)";
		g.strokeStyle = "rgba(255,194,14,0.95)";
		g.lineWidth = 5;
		g.beginPath();
		g.roundRect(6, 6, 1012, 188, 22);
		g.fill();
		g.stroke();
		g.fillStyle = "#ffc20e";
		g.beginPath();
		g.arc(62, 64, 17, 0, Math.PI * 2);
		g.fill();
		g.font = '800 62px "Archivo Variable", "Archivo", system-ui, sans-serif';
		g.fillStyle = "#ffe08a";
		g.textBaseline = "middle";
		g.fillText(simLabel.heading, 100, 68);
		g.font = '500 44px "Archivo Variable", "Archivo", system-ui, sans-serif';
		g.fillStyle = "#e6edf8";
		g.fillText(simLabel.note, 34, 146);
	};
	paintLabel();
	const labelMesh = new Mesh(new PlaneGeometry(1, 200 / 1024), new MeshBasicMaterial({ map: new CanvasTexture(label), transparent: true, depthTest: false, fog: false }));
	(labelMesh.material as MeshBasicMaterial).map!.colorSpace = SRGBColorSpace;
	labelMesh.renderOrder = 10;
	camera.add(labelMesh);

	const brackets = document.createElement("canvas");
	brackets.width = 1024;
	brackets.height = 640;
	const g = brackets.getContext("2d")!;
	g.strokeStyle = "rgba(242,238,223,0.9)"; // paper white
	g.lineWidth = 5;
	g.lineCap = "round";
	for (const [x, y, dx, dy] of [[300, 180, 1, 1], [724, 180, -1, 1], [300, 460, 1, -1], [724, 460, -1, -1]]) {
		g.beginPath();
		g.moveTo(x + dx * 70, y);
		g.lineTo(x, y);
		g.lineTo(x, y + dy * 70);
		g.stroke();
	}
	g.beginPath();
	g.arc(512, 320, 8, 0, Math.PI * 2);
	g.stroke();
	g.font = '600 26px "Archivo Variable", "Archivo", system-ui, sans-serif';
	g.fillStyle = "rgba(242,238,223,0.95)";
	g.textAlign = "center";
	g.fillText(simLabel.camera, 512, 140);
	const bracketMesh = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: new CanvasTexture(brackets), transparent: true, depthTest: false, fog: false, opacity: 0 }));
	(bracketMesh.material as MeshBasicMaterial).map!.colorSpace = SRGBColorSpace;
	bracketMesh.renderOrder = 10;
	camera.add(bracketMesh);

	return {
		fit(aspect: number) {
			const depth = 1;
			const h = 2 * depth * Math.tan((camera.fov * Math.PI) / 360);
			const w = h * aspect;
			const width = w * 0.27;
			labelMesh.scale.setScalar(width);
			labelMesh.position.set(-w / 2 + width / 2 + w * 0.025, h / 2 - (width * 200) / 1024 / 2 - h * 0.1, -depth);
			bracketMesh.scale.set(w, h, 1);
			bracketMesh.position.set(0, 0, -depth);
		},
		brackets(on: number) {
			(bracketMesh.material as MeshBasicMaterial).opacity = on;
		},
	};
}

export function createSim(ctx: StageContext, room: Room, ids: readonly string[]): SimFlight {
	const T = ids.indexOf("test");
	const W = ids.indexOf("web");
	const laptop = room.screens.find((screen) => screen.scene === "web");
	const box = laptop?.feedBox;
	if (T < 0 || W < 0 || !laptop || !box) return { update() {}, busy: () => false, play() {}, sample: () => undefined, feedPose() {}, prepare: () => Promise.resolve() };
	const start = T + LOOK.from;
	const end = W - LOOK.to;
	const { renderer, camera } = ctx;

	// The picture. HalfFloat keeps the dusk sky free of bands; both screens tone map it the same way (FEED_GLSL, screens.ts).
	const scale = ctx.tier === "high" ? 1 : ctx.tier === "medium" ? 0.8 : 0.6;
	const target = new WebGLRenderTarget(16, 10, { type: HalfFloatType, samples: ctx.tier === "low" ? 0 : 4 });

	const view = new PerspectiveCamera(50, 1.6, 0.06, 4200);
	const overlay = buildOverlay(view);

	let world: FlightWorld | undefined;
	let rig: DroneRig | undefined;
	const holder = new Group();
	let shadow: Mesh | undefined;
	let state: "idle" | "loading" | "ready" = "idle";
	let dirty = false;
	let lastSig = "";
	let lastClock = 0;
	let playF: number | null = null;

	const build = async () => {
		state = "loading";
		const [built, drone] = await Promise.all([createFlightWorld(ctx.pmrem), loadDrone()]);
		world = built;
		rig = drone;
		const scene = world.scene;
		scene.add(view);
		rig.model.position.y = -rig.floor;
		holder.add(rig.model);
		scene.add(holder);
		shadow = new Mesh(new CircleGeometry(0.34, 32), new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
		shadow.rotation.x = -Math.PI / 2;
		scene.add(shadow);

		// Build its shaders now, so the first frame of the flight never stutters.
		rig.animate(0, 0.0001, 0.03);
		await compileInSlices(renderer, scene, view, target);
		await uploadInSlices(renderer, scene);

		state = "ready";
		dirty = true;
		lastSig = "";
		ctx.wake();
	};

	const pose = newPose();
	const { point, dir } = pose;
	const side = new Vector3();
	const chase = new Vector3();
	const up = new Vector3(0, 1, 0);
	const lensAt = new Vector3();
	const lensQ = new Quaternion();
	const chaseQ = new Quaternion();
	const padQ = new Quaternion();
	const padLook = new Object3D();
	const flip = new Quaternion().setFromAxisAngle(up, Math.PI);

	/** The flight at `f` of its clock: moves the drone and the picture's camera, then draws the picture. */
	const draw = (f: number, aspect: number) => {
		world!.pose(f, pose);
		holder.position.copy(point);
		holder.rotation.set(0, 0, 0);
		holder.rotation.order = "YXZ";
		holder.rotation.set(pose.pitch, pose.yaw, pose.bank);
		holder.updateMatrixWorld(true);
		const clock = f * 12;
		const spin = span(f, LOOK.spinUp);
		rig!.animate(clock, Math.abs(clock - lastClock) || 0.0001, Math.max(0.03, spin));
		lastClock = clock;
		shadow!.position.set(point.x, 0.05, point.z);
		(shadow!.material as MeshBasicMaterial).opacity = 0.42 * clamp01(1 - point.y / 8);

		// The chase camera: low beside the pad at first, then behind and above as it climbs.
		const climb = smooth(clamp01(point.y / 14));
		side.set(dir.z, 0, -dir.x);
		chase.copy(point).addScaledVector(dir, -2.2 - 0.3 * climb).addScaledVector(side, 1.3 - 0.95 * climb);
		chase.y = Math.max(0.4, point.y + 0.15 + 0.4 * climb);
		view.position.copy(chase);
		view.up.copy(up);
		view.lookAt(point.x + dir.x * 0.6 * climb, point.y + 0.12, point.z + dir.z * 0.6 * climb);
		chaseQ.copy(view.quaternion);

		// Into the lens, then the camera's own view; at the end it tips down to the pad, as the tilt mount would.
		rig!.lens.updateWorldMatrix(true, false);
		rig!.lens.getWorldPosition(lensAt);
		rig!.lens.getWorldQuaternion(lensQ).multiply(flip);
		const inLens = smooth(span(f, LOOK.intoLens));
		view.position.lerpVectors(chase, lensAt, inLens);
		view.quaternion.slerpQuaternions(chaseQ, lensQ, inLens);
		const down = smooth(span(f, LOOK.lookAtPad));
		if (down > 0) {
			padLook.position.copy(view.position);
			padLook.up.copy(up);
			// (the camera looks along +z of padLook once flipped: aim its back at the pad)
			padLook.lookAt(view.position.x * 2 - PAD.x, view.position.y * 2 + 0.2, view.position.z * 2 - PAD.z);
			padQ.copy(padLook.quaternion);
			view.quaternion.slerp(padQ, down);
		}
		holder.visible = inLens < 0.93;
		overlay.brackets(smooth(clamp01((inLens - 0.85) / 0.15)));
		overlay.fit(aspect);
		view.aspect = aspect;
		view.updateProjectionMatrix();
		view.updateMatrixWorld(true);

		const before = renderer.getRenderTarget();
		renderer.setRenderTarget(target);
		renderer.clear();
		renderer.render(world!.scene, view);
		renderer.setRenderTarget(before);
	};

	const drawing = new Vector2();
	const fillAt = new Vector3();
	const fillQ = new Quaternion();
	const local = new Vector3();
	/** Where the room's camera stands for this flat rectangle on `mesh` to be exactly the window, in the picture's shape. */
	const fill = (mesh: Mesh, x: number, y: number, w: number, h: number) => {
		const aspect = camera.aspect;
		const inner = w / h > aspect ? h : w / aspect;
		const d = inner / 2 / Math.tan((camera.fov * Math.PI) / 360);
		mesh.updateWorldMatrix(true, false);
		fillAt.copy(mesh.localToWorld(local.set(x, y, d)));
		mesh.getWorldQuaternion(fillQ);
	};
	const fromAt = new Vector3();
	const fromQ = new Quaternion();

	let building: Promise<void> | undefined;
	const prepare = () =>
		(building ??= build().catch((error) => {
			console.warn("Studio: the simulated flight did not load.", error);
		}));

	return {
		prepare,
		update(s) {
			const near = playF !== null || (s > T - 1.6 && s < W + 1.6);
			// (well ahead of the bench, so all of this is done by the time anyone can see it)
			if (playF !== null || (s > T - 3.2 && s < W + 1.6)) void prepare(); // (and anyway, if the room never came to rest)
			const ready = state === "ready";
			room.bench.screen.feed(ready ? target.texture : null, camera.aspect);
			laptop.feed(ready ? target.texture : null, camera.aspect);
			laptop.hold(s > T - 0.5 && s < W + 0.6);

			if (ready && near) {
				const size = renderer.getDrawingBufferSize(drawing);
				const h = Math.min(1440, Math.round(size.y * scale));
				const w = Math.round(h * camera.aspect);
				if (target.width !== w || target.height !== h) {
					target.setSize(w, h);
					lastSig = "";
				}
				const f = playF ?? clamp01((s - start) / (end - start));
				const sig = `${f.toFixed(5)}|${camera.aspect.toFixed(4)}|${w}`;
				if (sig !== lastSig) {
					lastSig = sig;
					draw(f, camera.aspect);
				}
				dirty = false;
			}

			// The room's camera: at the wall screen until the cut, at the laptop's feed after it.
			if (s <= T || s >= W) return;
			const cut = W - LOOK.out.from;
			fromAt.copy(camera.position);
			fromQ.copy(camera.quaternion);
			if (s < cut) {
				const { mesh, width, height } = room.bench.screen;
				fill(mesh, 0, 0, width, height);
				const a = smoothest(clamp01((s - T - LOOK.dive.from) / (LOOK.dive.to - LOOK.dive.from)));
				camera.position.lerpVectors(fromAt, fillAt, a);
				camera.quaternion.slerpQuaternions(fromQ, fillQ, a);
			} else {
				fill(laptop.mesh, box.x, box.y, box.width, box.height);
				const a = smoothest(clamp01((s - cut) / (LOOK.out.from - LOOK.out.to)));
				camera.position.lerpVectors(fillAt, fromAt, a);
				camera.quaternion.slerpQuaternions(fillQ, fromQ, a);
			}
		},
		busy: () => dirty || state === "loading" || playF !== null,
		play(f) {
			playF = f;
		},
		sample: () => (state === "ready" ? { x: pose.point.x, y: pose.point.y, z: pose.point.z, yaw: pose.yaw } : undefined),
		feedPose(at, q) {
			fill(laptop.mesh, box.x, box.y, box.width, box.height);
			at.copy(fillAt);
			q.copy(fillQ);
		},
	};
}

const smoothest = (x: number) => x * x * x * (x * (6 * x - 15) + 10);
