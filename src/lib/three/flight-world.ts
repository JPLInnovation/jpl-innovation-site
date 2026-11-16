/**
 * The made-up place the F450 flies over in simulation: a dusk sky, four ridges far off, farm fields with trees and a few
 * plain buildings, town lights on the horizon, and two H pads. Nothing here is a real place, and the drone has not flown:
 * whoever shows it says so on screen.
 *
 * One world, two users: the studio's simulated flight (src/lib/studio/sim-flight.ts, drawn into the wall screen and the
 * laptop) and the drone page's chapter (src/lib/three/models/drone-chapter.ts, drawn behind the drone). Both fly the same
 * route at the same speeds: `pose(f)` is where the drone is at `f` (0 to 1) of the flight's clock.
 *
 * Seeded: the same land every time. Built only when asked (its files are ~40 KB of WebP).
 */
import {
	BackSide,
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
	HemisphereLight,
	InstancedMesh,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Object3D,
	PlaneGeometry,
	type PMREMGenerator,
	Points,
	PointsMaterial,
	RepeatWrapping,
	Scene,
	SphereGeometry,
	SRGBColorSpace,
	type Texture,
	TextureLoader,
	Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** The far pad. The drone stops in the air short of it, with the whole H in front of its camera. */
export const PAD = new Vector3(8, 0, -232);
export const ARRIVE = new Vector3(PAD.x, 3.6, PAD.z + 6.5);
/** The low dusk sun's colour, for anything lit to match the place. */
export const SUN = 0xffd2a6;

/** The speed along the route at shares of the flight's clock (any unit: only the shape counts; 150 is the cruise). */
const SPEED = [[0.06, 0], [0.16, 16], [0.3, 26], [0.38, 150], [0.76, 150], [0.87, 26], [0.965, 0]] as const;
const CRUISE = 150;

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => x * x * (3 - 2 * x);

const load = (url: string) =>
	new Promise<Texture>((resolve, reject) =>
		new TextureLoader().load(
			`${BASE}${url}`,
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

/** Where the drone is at a moment of the flight. */
export interface FlightPose {
	/** On the route (metres; the first pad is at the origin, y up). */
	point: Vector3;
	/** Level, unit length: the way it is flying. */
	dir: Vector3;
	/** Its heading about y (radians; 0 = facing +z, the model's front). */
	yaw: number;
	/** Nose down with the speed, and into the turns (radians; apply in the order YXZ with `yaw`). */
	pitch: number;
	bank: number;
	/** Its speed, as a share of the cruise (0 to 1). */
	speed: number;
}

export interface FlightWorld {
	scene: Scene;
	/** The reflections both the world and the drone use: a blurred dusk (Poly Haven, Kiara 9 Dusk, CC0). */
	environment: Texture;
	/** The drone at `f` (0 to 1) of the flight's clock: off the first pad, out over the fields, to a hover by the far pad. */
	pose(f: number, out: FlightPose): FlightPose;
}

export const newPose = (): FlightPose => ({ point: new Vector3(), dir: new Vector3(0, 0, -1), yaw: Math.PI, pitch: 0, bank: 0, speed: 0 });

/** The speed at `f` of the clock, as a share of the cruise. */
export function speedAt(f: number) {
	if (f <= SPEED[0][0] || f >= SPEED[SPEED.length - 1][0]) return 0;
	for (let i = 1; i < SPEED.length; i++) {
		if (f <= SPEED[i][0]) return (SPEED[i - 1][1] + (SPEED[i][1] - SPEED[i - 1][1]) * smooth((f - SPEED[i - 1][0]) / (SPEED[i][0] - SPEED[i - 1][0]))) / CRUISE;
	}
	return 0;
}

/**
 * Builds the world. `pmrem`: the stage's own reflection maker, and env.webp 1024 px wide on purpose (a 256 px cube, as
 * the studio room's): then the reflection shader is the one already built. A new maker, or any other size, compiles it
 * again, which froze the page for ~300 ms (Direct3D).
 */
export async function createFlightWorld(pmrem: PMREMGenerator): Promise<FlightWorld> {
	const [env, ...ridges] = await Promise.all(["/chapter/drone/env.webp", "/chapter/drone/dusk-1.webp", "/chapter/drone/dusk-2.webp", "/chapter/drone/dusk-3.webp", "/chapter/drone/dusk-4.webp"].map(load));
	const world = new Scene();
	world.fog = new Fog(0x4a3a50, 90, 1700);
	env.mapping = EquirectangularReflectionMapping;
	const environment = pmrem.fromEquirectangular(env).texture;
	env.dispose();
	world.environment = environment;
	world.environmentIntensity = 0.9;
	world.add(new HemisphereLight(0xc9d6ff, 0x2b2230, 0.8));
	const sun = new DirectionalLight(SUN, 2.2);
	sun.position.set(-4, 3, -6);
	world.add(sun);
	const rim = new DirectionalLight(0x9fd3ff, 1.4);
	rim.position.set(3, 2, 4);
	world.add(rim);

	// The sky: a dusk, and four ridges far away.
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

	// The route: straight up off the first pad, out over the fields, and down to a hover by the far pad.
	const route = new CatmullRomCurve3(
		[[0, 0, 0], [0, 1.4, 0], [0, 7, -1], [0.6, 15, -10], [6, 19, -42], [20, 20, -92], [-4, 18, -142], [2, 15, -186], [ARRIVE.x, 9, ARRIVE.z + 16], [ARRIVE.x, 5, ARRIVE.z + 5], [ARRIVE.x, ARRIVE.y, ARRIVE.z]].map(([x, y, z]) => new Vector3(x, y, z)),
		false,
		"centripetal",
	);
	route.arcLengthDivisions = 800;
	const routeLength = route.getLength();
	/** Metres along the route at each 1/512 of the clock: the integral of the speed. */
	const along = new Float32Array(513);
	let sum = 0;
	for (let i = 1; i <= 512; i++) along[i] = sum += speedAt(i / 512) * CRUISE;
	for (let i = 1; i <= 512; i++) along[i] *= routeLength / sum;

	const ahead = new Vector3();
	return {
		scene: world,
		environment,
		pose(f, out) {
			const k = Math.min(512, Math.floor(f * 512));
			const distance = along[k] + (f * 512 - k) * ((along[Math.min(512, k + 1)] ?? 0) - along[k]);
			const u = clamp01(distance / routeLength);
			const { point, dir } = out;
			route.getPointAt(u, point);
			route.getPointAt(Math.min(1, u + 10 / routeLength), ahead);
			dir.subVectors(ahead, point).setY(0);
			if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
			dir.normalize();
			const v = speedAt(f);
			// Yaw along the route; nose down with the speed; into the turns.
			out.yaw = Math.atan2(dir.x, dir.z);
			route.getPointAt(Math.min(1, u + 26 / routeLength), ahead);
			ahead.sub(point).setY(0).normalize();
			out.bank = (dir.x * ahead.z - dir.z * ahead.x) * 0.9 * v;
			out.pitch = 0.2 * v;
			out.speed = v;
			return out;
		},
	};
}
