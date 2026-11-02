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
import {
	BoxGeometry,
	BufferAttribute,
	BufferGeometry,
	CanvasTexture,
	CatmullRomCurve3,
	CircleGeometry,
	Color,
	ConeGeometry,
	DirectionalLight,
	EquirectangularReflectionMapping,
	Fog,
	Group,
	HalfFloatType,
	HemisphereLight,
	InstancedMesh,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Object3D,
	PerspectiveCamera,
	PlaneGeometry,
	PMREMGenerator,
	Points,
	PointsMaterial,
	Quaternion,
	RepeatWrapping,
	Scene,
	SphereGeometry,
	SRGBColorSpace,
	type Texture,
	TextureLoader,
	Vector2,
	Vector3,
	WebGLRenderTarget,
	BackSide,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { type DroneRig, loadDrone } from "../three/models/drone";
import type { StageContext } from "../three/stage";
import { simLabel } from "../../text/studio";
import { asset, type Room } from "./room";

/** Every timing of the flight in one place to tune. Scroll positions are in scenes, from "test" (T) and "web" (W). */
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
	/** The speed along the route at shares of the clock (metres a unit, any scale: only the shape counts). */
	speed: [[0.06, 0], [0.16, 16], [0.3, 26], [0.38, 150], [0.76, 150], [0.87, 26], [0.965, 0]] as const,
};

/** The far pad. The drone stops in the air short of it, with the whole H in front of the camera. */
const PAD = new Vector3(8, 0, -232);
const ARRIVE = new Vector3(PAD.x, 3.6, PAD.z + 6.5);

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => x * x * (3 - 2 * x);
const span = (f: number, [a, b]: readonly number[]) => clamp01((f - a) / (b - a));

export interface SimFlight {
	/** Every frame, after the room's camera has been placed; takes the camera over during the dive and the pull out. */
	update(s: number): void;
	/** True while something changed that the stage has to draw. */
	busy(): boolean;
}

const load = (url: string) =>
	new Promise<Texture>((resolve, reject) =>
		new TextureLoader().load(
			asset(url),
			(t) => {
				t.colorSpace = SRGBColorSpace;
				resolve(t);
			},
			undefined,
			reject,
		),
	);

/** The land the flight crosses. Seeded: the same every time. Nothing here is a real place. */
function buildLand(world: Scene) {
	let seed = 7;
	const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	const G = 2048;
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = G;
	const g = canvas.getContext("2d")!;
	g.fillStyle = "#2b3027";
	g.fillRect(0, 0, G, G);
	// Farm fields of many sizes with soft edges, hedges between them and a few tracks.
	const fields = ["#3a4230", "#47462f", "#34402f", "#4d4b33", "#2f3a2c", "#413f2e", "#38462f"];
	g.filter = "blur(2.5px)";
	for (let y = 0; y < G; ) {
		const rowH = 70 + rnd() * 130;
		for (let x = 0; x < G; ) {
			const w = 80 + rnd() * 190;
			g.fillStyle = fields[Math.floor(rnd() * fields.length)];
			g.fillRect(x, y, w + 2, rowH + 2);
			g.fillStyle = "rgba(20,28,18,0.75)";
			g.fillRect(x, y, w, 2.5);
			g.fillRect(x, y, 2.5, rowH);
			x += w;
		}
		y += rowH;
	}
	g.filter = "none";
	for (let k = 0; k < 16000; k++) {
		g.fillStyle = rnd() < 0.5 ? "rgba(24,32,20,0.35)" : "rgba(92,96,64,0.22)";
		g.beginPath();
		g.arc(rnd() * G, rnd() * G, 0.8 + rnd() * 3.5, 0, 7);
		g.fill();
	}
	g.strokeStyle = "rgba(112,106,90,0.8)";
	for (let k = 0; k < 9; k++) {
		g.lineWidth = 2 + rnd() * 3;
		const across = rnd() < 0.5;
		const c = rnd() * G;
		g.beginPath();
		if (across) {
			g.moveTo(0, c);
			g.bezierCurveTo(G * 0.3, c + (rnd() - 0.5) * 300, G * 0.7, c + (rnd() - 0.5) * 300, G, c);
		} else {
			g.moveTo(c, 0);
			g.bezierCurveTo(c + (rnd() - 0.5) * 300, G * 0.3, c + (rnd() - 0.5) * 300, G * 0.7, c, G);
		}
		g.stroke();
	}
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.anisotropy = 16;
	texture.wrapS = texture.wrapT = RepeatWrapping;
	texture.repeat.set(8, 8);
	const ground = new Mesh(new PlaneGeometry(6000, 6000), new MeshStandardMaterial({ map: texture, roughness: 1 }));
	ground.rotation.x = -Math.PI / 2;
	world.add(ground);

	// Grass up close: a fine speckle over the fields, for the low end of the flight.
	const fine = document.createElement("canvas");
	fine.width = fine.height = 256;
	const f = fine.getContext("2d")!;
	for (let k = 0; k < 2600; k++) {
		f.fillStyle = `rgba(${rnd() < 0.5 ? "12,18,10" : "96,104,72"},${0.14 + rnd() * 0.3})`;
		f.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2);
	}
	const fineTexture = new CanvasTexture(fine);
	fineTexture.colorSpace = SRGBColorSpace;
	fineTexture.wrapS = fineTexture.wrapT = RepeatWrapping;
	fineTexture.repeat.set(220, 220);
	fineTexture.anisotropy = 16;
	const grass = new Mesh(new PlaneGeometry(900, 900), new MeshBasicMaterial({ map: fineTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
	grass.rotation.x = -Math.PI / 2;
	grass.position.set(0, 0.01, -150);
	world.add(grass);

	// Trees and a few plain buildings, for the sense of speed. None near the pads.
	const dummy = new Object3D();
	const clear = (x: number, z: number) => Math.hypot(x, z) > 26 && Math.hypot(x - PAD.x, z - PAD.z) > 30;
	// Three cones stacked, a little uneven, so they read as firs and not as party hats.
	const tiers = [
		new ConeGeometry(1.9, 3.6, 8).translate(0, 2.2, 0),
		new ConeGeometry(1.45, 3.2, 8).rotateY(0.4).translate(0, 3.9, 0),
		new ConeGeometry(0.95, 2.8, 7).rotateY(0.9).translate(0, 5.5, 0),
	];
	const trees = new InstancedMesh(mergeGeometries(tiers), new MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), 800);
	const shade = new Color();
	for (let i = 0; i < trees.count; i++) {
		let x = 0;
		let z = 0;
		do {
			x = (rnd() - 0.5) * 420;
			z = 70 - rnd() * 520;
		} while (!clear(x, z));
		const size = 0.7 + rnd() * 1.1;
		dummy.position.set(x, 0, z);
		dummy.rotation.y = rnd() * 6.28;
		dummy.scale.setScalar(size);
		dummy.updateMatrix();
		trees.setMatrixAt(i, dummy.matrix);
		trees.setColorAt(i, shade.setRGB(0.028 + rnd() * 0.02, 0.05 + rnd() * 0.03, 0.03 + rnd() * 0.015));
	}
	world.add(trees);
	const blocks = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), 46);
	for (let i = 0; i < blocks.count; i++) {
		let x = 0;
		let z = 0;
		do {
			x = (rnd() - 0.5) * 460;
			z = 40 - rnd() * 560;
		} while (!clear(x, z) || Math.abs(x) < 40);
		const h = 4 + rnd() * 9;
		dummy.rotation.y = 0;
		dummy.position.set(x, h / 2, z);
		dummy.scale.set(7 + rnd() * 9, h, 7 + rnd() * 9);
		dummy.updateMatrix();
		blocks.setMatrixAt(i, dummy.matrix);
		blocks.setColorAt(i, shade.setRGB(0.3 + rnd() * 0.16, 0.27 + rnd() * 0.14, 0.26 + rnd() * 0.12));
	}
	world.add(blocks);

	// Town lights far off, like a town seen at dusk.
	const count = 5000;
	const lights = new Float32Array(count * 3);
	const towns = Array.from({ length: 14 }, () => {
		const a = rnd() * Math.PI * 2;
		const r = 500 + rnd() * 1400;
		return [Math.cos(a) * r, Math.sin(a) * r - 500, 40 + rnd() * 160];
	});
	for (let i = 0; i < count; i++) {
		const t = towns[Math.floor(rnd() * towns.length)];
		const a = rnd() * Math.PI * 2;
		const r = rnd() ** 0.6 * t[2];
		lights.set([t[0] + Math.cos(a) * r, 0.4, t[1] + Math.sin(a) * r], i * 3);
	}
	const points = new BufferGeometry();
	points.setAttribute("position", new BufferAttribute(lights, 3));
	world.add(new Points(points, new PointsMaterial({ color: 0xffc98a, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0.7, fog: false })));
}

/** An H pad: `radius` metres, on a square of concrete, with a ring of lights if it is the one the drone flies to. */
function buildPad(world: Scene, at: Vector3, radius: number, lit: boolean) {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 1024;
	const g = canvas.getContext("2d")!;
	g.fillStyle = "#20283a";
	g.fillRect(0, 0, 1024, 1024);
	g.strokeStyle = "#ffc20e";
	g.lineWidth = 34;
	g.beginPath();
	g.arc(512, 512, 440, 0, Math.PI * 2);
	g.stroke();
	g.fillStyle = "#ffc20e";
	g.font = "900 560px Arial, sans-serif";
	g.textAlign = "center";
	g.textBaseline = "middle";
	g.fillText("H", 512, 540);
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.anisotropy = 16;
	const apron = new Mesh(new PlaneGeometry(radius * 3.4, radius * 3.4), new MeshStandardMaterial({ color: 0x4a4d52, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
	apron.rotation.x = -Math.PI / 2;
	apron.position.set(at.x, 0.02, at.z);
	world.add(apron);
	const pad = new Mesh(new CircleGeometry(radius, 64), new MeshStandardMaterial({ map: texture, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
	pad.rotation.x = -Math.PI / 2;
	pad.position.set(at.x, 0.03, at.z);
	world.add(pad);
	if (!lit) return;
	const bulb = new MeshBasicMaterial({ color: new Color(6, 3.4, 1) });
	const ball = new SphereGeometry(0.07, 10, 8);
	for (let i = 0; i < 16; i++) {
		const a = (i / 16) * Math.PI * 2;
		const light = new Mesh(ball, bulb);
		light.position.set(at.x + Math.cos(a) * radius * 1.12, 0.09, at.z + Math.sin(a) * radius * 1.12);
		world.add(light);
	}
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
		g.font = '800 62px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
		g.fillStyle = "#ffe08a";
		g.textBaseline = "middle";
		g.fillText(simLabel.heading, 100, 68);
		g.font = '500 44px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
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
	g.strokeStyle = "rgba(134,239,172,0.95)";
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
	g.font = '600 26px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
	g.fillStyle = "rgba(190,250,210,0.95)";
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
	if (T < 0 || W < 0 || !laptop || !box) return { update() {}, busy: () => false };
	const start = T + LOOK.from;
	const end = W - LOOK.to;
	const { renderer, camera } = ctx;

	// The picture. HalfFloat keeps the dusk sky free of bands; both screens tone map it the same way (FEED_GLSL, screens.ts).
	const scale = ctx.tier === "high" ? 1 : ctx.tier === "medium" ? 0.8 : 0.6;
	const target = new WebGLRenderTarget(16, 10, { type: HalfFloatType, samples: ctx.tier === "low" ? 0 : 4 });

	const world = new Scene();
	world.fog = new Fog(0x4a3a50, 90, 1700);
	const view = new PerspectiveCamera(50, 1.6, 0.06, 4200);
	world.add(view);
	const overlay = buildOverlay(view);

	let rig: DroneRig | undefined;
	const holder = new Group();
	let shadow: Mesh | undefined;
	let route: CatmullRomCurve3 | undefined;
	let routeLength = 1;
	/** Metres along the route at each 1/512 of the clock: the integral of the speed. */
	const along = new Float32Array(513);
	let state: "idle" | "loading" | "ready" = "idle";
	let dirty = false;
	let lastSig = "";
	let lastClock = 0;

	const speedAt = (f: number) => {
		const keys = LOOK.speed;
		if (f <= keys[0][0] || f >= keys[keys.length - 1][0]) return 0;
		for (let i = 1; i < keys.length; i++) {
			if (f <= keys[i][0]) return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * smooth((f - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]));
		}
		return 0;
	};

	const build = async () => {
		state = "loading";
		const [env, ...ridges] = await Promise.all(["/chapter/drone/env.webp", "/chapter/drone/dusk-1.webp", "/chapter/drone/dusk-2.webp", "/chapter/drone/dusk-3.webp", "/chapter/drone/dusk-4.webp"].map(load));
		rig = await loadDrone();
		env.mapping = EquirectangularReflectionMapping;
		const pmrem = new PMREMGenerator(renderer);
		world.environment = pmrem.fromEquirectangular(env).texture;
		world.environmentIntensity = 0.9;
		pmrem.dispose();
		world.add(new HemisphereLight(0xc9d6ff, 0x2b2230, 0.8));
		const sun = new DirectionalLight(0xffd2a6, 2.2);
		sun.position.set(-4, 3, -6);
		world.add(sun);
		const rim = new DirectionalLight(0x9fd3ff, 1.4);
		rim.position.set(3, 2, 4);
		world.add(rim);

		// The sky: the drone chapter's dusk, and its four ridges far away.
		const sky = document.createElement("canvas");
		sky.width = 4;
		sky.height = 512;
		const g = sky.getContext("2d")!;
		const gradient = g.createLinearGradient(0, 0, 0, 512);
		for (const [at, colour] of [[0, "#0d1330"], [0.32, "#28305e"], [0.44, "#6a4a78"], [0.5, "#d9876a"], [0.53, "#e9a77a"], [0.6, "#3a3248"], [1, "#141821"]] as const) gradient.addColorStop(at, colour);
		g.fillStyle = gradient;
		g.fillRect(0, 0, 4, 512);
		const skyTexture = new CanvasTexture(sky);
		skyTexture.colorSpace = SRGBColorSpace;
		world.add(new Mesh(new SphereGeometry(3400, 32, 24), new MeshBasicMaterial({ map: skyTexture, side: BackSide, fog: false, depthWrite: false })));
		ridges.forEach((texture, i) => {
			const z = -[2600, 2100, 1700, 1400][i];
			const w = -z * 3.2;
			const ridge = new Mesh(new PlaneGeometry(w, w * 0.5625), new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, fog: false }));
			ridge.position.set(0, w * 0.5625 * 0.3, z);
			world.add(ridge);
		});

		buildLand(world);
		buildPad(world, new Vector3(), 0.9, false);
		buildPad(world, PAD, 2.6, true);

		rig.model.position.y = -rig.floor;
		holder.add(rig.model);
		world.add(holder);
		shadow = new Mesh(new CircleGeometry(0.34, 32), new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
		shadow.rotation.x = -Math.PI / 2;
		world.add(shadow);

		// The route: straight up off the first pad, out over the fields, and down to a hover by the far pad.
		route = new CatmullRomCurve3(
			[[0, 0, 0], [0, 1.4, 0], [0, 7, -1], [0.6, 15, -10], [6, 19, -42], [20, 20, -92], [-4, 18, -142], [2, 15, -186], [ARRIVE.x, 9, ARRIVE.z + 16], [ARRIVE.x, 5, ARRIVE.z + 5], [ARRIVE.x, ARRIVE.y, ARRIVE.z]].map(([x, y, z]) => new Vector3(x, y, z)),
			false,
			"centripetal",
		);
		route.arcLengthDivisions = 800;
		routeLength = route.getLength();
		let sum = 0;
		for (let i = 1; i <= 512; i++) along[i] = sum += speedAt(i / 512);
		for (let i = 1; i <= 512; i++) along[i] *= routeLength / sum;

		// Build its shaders now, so the first frame of the flight never stutters.
		rig.animate(0, 0.0001, 0.03);
		await renderer.compileAsync(world, view);

		state = "ready";
		dirty = true;
		lastSig = "";
		ctx.wake();
	};

	const point = new Vector3();
	const ahead = new Vector3();
	const dir = new Vector3();
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
		const distance = along[Math.min(512, Math.floor(f * 512))] + (f * 512 - Math.floor(f * 512)) * ((along[Math.min(512, Math.floor(f * 512) + 1)] ?? 0) - along[Math.min(512, Math.floor(f * 512))]);
		const u = clamp01(distance / routeLength);
		route!.getPointAt(u, point);
		route!.getPointAt(Math.min(1, u + 10 / routeLength), ahead);
		dir.subVectors(ahead, point).setY(0);
		if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
		dir.normalize();
		const v = speedAt(f) / 150;
		// Yaw along the route; nose down with the speed; into the turns.
		const yaw = Math.atan2(dir.x, dir.z);
		route!.getPointAt(Math.min(1, u + 26 / routeLength), ahead);
		ahead.sub(point).setY(0).normalize();
		const bank = (dir.x * ahead.z - dir.z * ahead.x) * 0.9 * v;
		holder.position.copy(point);
		holder.rotation.set(0, 0, 0);
		holder.rotation.order = "YXZ";
		holder.rotation.set(0.2 * v, yaw, bank);
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
		renderer.render(world, view);
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

	return {
		update(s) {
			const near = s > T - 1.6 && s < W + 1.6;
			// (well ahead of the bench, so all of this is done by the time anyone can see it)
			if (s > T - 3.2 && s < W + 1.6 && state === "idle") build().catch((error) => console.warn("Studio: the simulated flight did not load.", error));
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
				const f = clamp01((s - start) / (end - start));
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
		busy: () => dirty || state === "loading",
	};
}

const smoothest = (x: number) => x * x * x * (x * (6 * x - 15) + 10);
