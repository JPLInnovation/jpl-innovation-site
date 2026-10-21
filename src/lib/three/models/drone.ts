/**
 * The F450 4G drone in 3D: the build guide's 3D layout (public/work/drone/3d-layout/) exactly as it exports itself,
 * so every part, wire, screw and the camera's printed tilt mount are where the layout puts them.
 *
 * f450-cad.bin is CAD/f450-drone.glb (the layout page's "Download 3D files" zip) reduced by scripts/f450-cad.mjs:
 * triangles merged by material, the four props split off to spin, 16-bit positions, gzipped. Run that script again
 * after a new export. Metres; y up; the front (the red arms, the camera) faces +z.
 *
 * buildDrone() makes the drone itself, for whatever shows it: the drone page's 3D (createDrone, below) and its
 * intro (src/scripts/drone-splash.ts).
 */
import {
	BoxGeometry,
	BufferAttribute,
	BufferGeometry,
	CircleGeometry,
	Color,
	DoubleSide,
	FrontSide,
	Group,
	Mesh,
	MeshBasicMaterial,
	type MeshStandardMaterial,
	Object3D,
	TorusGeometry,
	Vector3,
} from "three";
import { contactShadow, type Model, type StageContext, type StageView, standard } from "../stage";
import cadUrl from "./f450-cad.bin?url";

export const view: StageView = {
	camera: [-0.68, 0.52, 0.64],
	target: [0, -0.04, 0],
	fov: 36,
	fitWidth: 0.72,
	spin: 0.18,
	minPolar: 0.35,
	maxPolar: 1.85,
};

/** What scripts/f450-cad.mjs writes at the front of f450-cad.bin. */
interface CadHeader {
	centre: number[];
	half: number[];
	/** Colour "#rrggbb", roughness, metalness; `o` opacity, `ds` double-sided. */
	materials: Array<{ c: string; r: number; m: number; o?: number; ds?: number }>;
	/** Where each prop turns (x, 0, z). */
	hubs: number[][];
	/** One mesh each: material, hub (-1 = fixed to the frame), vertices, indices, 1 when the indices are 32-bit. */
	groups: Array<{ m: number; h: number; n: number; i: number; w: number }>;
	/** Bounding box per part name: min x y z, max x y z. */
	parts: Record<string, number[]>;
	/** The camera lens glass: its middle and the way it looks. */
	lens: { p: number[]; d: number[] };
}

const pad4 = (n: number) => (n + 3) & ~3;

let cad: Promise<{ header: CadHeader; buffer: ArrayBuffer; body: number }> | undefined;
/** Fetch and unzip the model once; the intro and the page's 3D share it. */
function loadCad() {
	cad ??= fetch(cadUrl)
		.then(async (res) => {
			if (!res.ok) throw new Error(`${cadUrl}: ${res.status}`);
			let buffer = await res.arrayBuffer();
			// Gzipped, unless the server already unzipped it on the way.
			if (new Uint8Array(buffer, 0, 2).join() === "31,139") {
				buffer = await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
			}
			const headerLength = new DataView(buffer).getUint32(0, true);
			const header: CadHeader = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, headerLength)));
			return { header, buffer, body: 4 + headerLength };
		})
		.catch((error) => {
			cad = undefined; // try again next time
			throw error;
		});
	return cad;
}

/** Points just outside the main parts, where their labels hang. */
type Spot = "fc" | "io" | "rx" | "cam" | "lipo" | "pi" | "bec" | "modem";

export interface DroneRig {
	/** The whole drone, in metres. */
	model: Group;
	/** Spins the props, blinks the FC's LED and pulses the 4G rings. dt = 0 for a still frame. */
	animate(t: number, dt: number): void;
	/** An object at a point in the drone's own space, which moves with it. */
	anchor(x: number, y: number, z: number): Object3D;
	spots: Record<Spot, [number, number, number]>;
	/** At the camera's lens glass; its +z axis looks out the way the camera does. */
	lens: Object3D;
	/** The lowest point of the landing legs. */
	floor: number;
	/** Bounding box per CAD part name (min x y z, max x y z), for finding which part a triangle belongs to. */
	parts: Record<string, number[]>;
}

export async function loadDrone(): Promise<DroneRig> {
	const { header, buffer, body } = await loadCad();
	const model = new Group();

	const materials = header.materials.map(({ c, r, m, o, ds }) =>
		standard(new Color(c), {
			roughness: r,
			metalness: m,
			transparent: o !== undefined,
			opacity: o ?? 1,
			depthWrite: o === undefined, // the BEC's see-through sleeve must not hide what's inside it
			side: ds ? DoubleSide : FrontSide,
		}),
	);

	/* ---------- Meshes: the frame's, then each prop's around its own motor ---------- */
	const hubs = header.hubs.map(([x, , z]) => {
		const hub = new Group();
		hub.position.set(x, 0, z);
		model.add(hub);
		return hub;
	});
	let at = body;
	for (const g of header.groups) {
		const q = new Int16Array(buffer, at, g.n * 3);
		at += pad4(g.n * 6);
		const normal = new Int8Array(buffer, at, g.n * 3);
		at += pad4(g.n * 3);
		const index = g.w ? new Uint32Array(buffer, at, g.i) : new Uint16Array(buffer, at, g.i);
		at += pad4(g.i * (g.w ? 4 : 2));
		const origin = g.h >= 0 ? header.hubs[g.h] : [0, 0, 0];
		const position = new Float32Array(g.n * 3);
		for (let i = 0; i < position.length; i++) {
			const d = i % 3;
			position[i] = header.centre[d] + (q[i] / 32767) * header.half[d] - origin[d];
		}
		const geometry = new BufferGeometry();
		geometry.setAttribute("position", new BufferAttribute(position, 3));
		geometry.setAttribute("normal", new BufferAttribute(normal, 3, true));
		geometry.setIndex(new BufferAttribute(index, 1));
		const mesh = new Mesh(geometry, materials[g.m]);
		if (header.materials[g.m].o !== undefined) mesh.renderOrder = 1;
		(g.h >= 0 ? hubs[g.h] : model).add(mesh);
	}
	// Props spin in the quad-X pattern: front-left and rear-right clockwise (seen from above), the others counter-clockwise.
	const props = hubs.map((hub, i) => ({ hub, clockwise: header.hubs[i][0] * header.hubs[i][2] > 0 }));

	/* ---------- Where things are ---------- */
	const part = (name: string) => {
		const b = header.parts[name];
		if (!b) throw new Error(`f450-cad.bin has no part called "${name}"`);
		return { lo: b.slice(0, 3), hi: b.slice(3), mid: [0, 1, 2].map((d) => (b[d] + b[d + 3]) / 2) };
	};
	const fc = part("Flight controller");
	const modem = part("ZTE MF833 4G stick");
	const above = (name: string, by: number): [number, number, number] => {
		const p = part(name);
		return [p.mid[0], p.hi[1] + by, p.mid[2]];
	};
	const below = (name: string, by: number): [number, number, number] => {
		const p = part(name);
		return [p.mid[0], p.lo[1] - by, p.mid[2]];
	};
	const cam = part("Camera case (printed)");
	const bec = part("Matek BEC12S-PRO");
	const spots: DroneRig["spots"] = {
		fc: above("Flight controller", 0.026),
		io: above("IO board", 0.022),
		rx: above("Receiver", 0.022),
		cam: [cam.mid[0], cam.lo[1] - 0.012, cam.hi[2] + 0.025],
		lipo: below("Battery", 0.02),
		pi: below("Pi 4 case (ABS)", 0.02),
		bec: [bec.hi[0] + 0.03, bec.mid[1], bec.mid[2]], // outboard: the BEC rides on the left side of the Pi case
		modem: [modem.hi[0] + 0.03, modem.mid[1], modem.mid[2]],
	};
	const lens = new Object3D();
	lens.position.fromArray(header.lens.p);
	lens.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...(header.lens.d as [number, number, number])));
	model.add(lens);

	/* ---------- Extras the layout doesn't export: prop discs, the FC's blinking LED, the 4G stick's signal rings ---------- */
	const disc = new CircleGeometry(0.127, 48);
	const discMaterial = new MeshBasicMaterial({ color: 0x8fa39a, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide });
	for (const [x, , z] of header.hubs) {
		const d = new Mesh(disc, discMaterial);
		d.rotation.x = -Math.PI / 2;
		d.position.set(x, 0.071, z);
		model.add(d);
	}
	const led = new Mesh(new BoxGeometry(0.003, 0.001, 0.003), standard(0x1daef1, { emissive: 0x1daef1, emissiveIntensity: 2 }));
	led.position.set(fc.mid[0] - 0.011, fc.lo[1] + 0.0075, fc.mid[2] + 0.011);
	model.add(led);
	const ringGeometry = new TorusGeometry(0.02, 0.0012, 8, 48);
	const rings = [0, 1, 2].map(() => {
		const ring = new Mesh(ringGeometry, new MeshBasicMaterial({ color: 0x5cc8ff, transparent: true, opacity: 0, depthWrite: false }));
		ring.rotation.x = Math.PI / 2;
		model.add(ring);
		return ring;
	});

	return {
		model,
		lens,
		spots,
		floor: part("Landing gear").lo[1],
		parts: header.parts,
		animate(t, dt) {
			if (dt > 0) for (const { hub, clockwise } of props) hub.rotation.y += (clockwise ? -1 : 1) * dt * 30;
			discMaterial.opacity = dt > 0 ? 0.06 : 0;
			(led.material as MeshStandardMaterial).emissiveIntensity = Math.sin(t * 5) > 0.2 ? 2.4 : 0.2;
			rings.forEach((ring, i) => {
				const phase = (((t * 0.7 + i / 3) % 1) + 1) % 1;
				ring.scale.setScalar(1 + phase * 3);
				ring.position.set(modem.mid[0], modem.hi[1] + phase * 0.03, modem.mid[2]);
				(ring.material as MeshBasicMaterial).opacity = dt > 0 ? (1 - phase) * 0.8 : 0;
			});
		},
		anchor(x, y, z) {
			const point = new Group();
			point.position.set(x, y, z);
			model.add(point);
			return point;
		},
	};
}

export default async function createDrone(ctx: StageContext): Promise<Model> {
	const drone = new Group(); // bobs and sways
	ctx.root.add(drone);
	const rig = await loadDrone();
	drone.add(rig.model);

	const shadow = contactShadow(0.24, 0.3);
	shadow.position.y = rig.floor - 0.002;
	ctx.root.add(shadow);

	// Labels hang off points just outside each part. One part is called out at a time (a guided tour). The still frame
	// (reduced motion) shows only the four marked `still`, which sit apart in the starting view; all eight at once
	// would pile up in the middle.
	const tourClass = "opacity-0 transition-opacity duration-500 data-[on]:opacity-100";
	const label = (text: string, spot: Spot, still = false) => ({ el: ctx.label(text, rig.anchor(...rig.spots[spot]), tourClass), still });
	const tour = [
		label("MicoAir743 V2 flight controller", "fc", true),
		label("IO board, the power hub", "io"),
		label("MC7RE receiver", "rx", true),
		label("Camera Module 3 on its tilt mount", "cam", true),
		label("3S 2200 mAh LiPo", "lipo"),
		label("Raspberry Pi 4", "pi"),
		label("Matek BEC for the Pi", "bec", true),
		label("ZTE MF833 4G modem", "modem"),
	];
	let shown = -1;

	return {
		update(t, dt) {
			// Still frame: the `still` labels; otherwise one label at a time, 2.5 s each.
			const current = dt === 0 ? -2 : Math.floor(t / 2.5) % tour.length;
			if (current !== shown) {
				shown = current;
				tour.forEach(({ el, still }, i) => el.toggleAttribute("data-on", current === -2 ? still : i === current));
			}
			// Hover: a slow bob with a little sway.
			drone.position.y = Math.sin(t * 1.6) * 0.012;
			drone.rotation.z = Math.sin(t * 0.9) * 0.035;
			drone.rotation.x = Math.sin(t * 0.7 + 1) * 0.03;
			rig.animate(t, dt);
		},
		applyPalette(p) {
			(shadow.material as MeshBasicMaterial).opacity = p.dark ? 0.55 : 0.28;
		},
	};
}
