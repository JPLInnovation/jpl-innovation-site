/**
 * The F450 for the drone page's scroll showcase (src/components/showcase.tsx, words in src/text/showcase/drone.ts):
 * the same model as the hero (./drone.ts), a camera stop per feature, and every triangle tagged with the feature it
 * belongs to so the rest of the drone can fade back (src/lib/three/showcase.ts).
 *
 * Everything is found by part name in the CAD export's part boxes (header.parts in f450-cad.bin), at load time, so
 * the stops follow the parts when the 3D layout changes. If a part is renamed, fix its name in PARTS below.
 *
 * f450-cad.bin merges triangles by material across parts, so the parts are found again here, once: each connected
 * piece of a mesh goes to the smallest part box that holds all of it. Pieces are connected through shared vertices,
 * so no vertex is ever claimed by two features.
 */
import { BufferAttribute, type Mesh, MeshBasicMaterial, MeshStandardMaterial, type Object3D, Vector3 } from "three";
import type { ShowcaseModel, ShowcaseStop } from "../showcase";
import { contactShadow, type StageContext, type StageView } from "../stage";
import { type DroneRig, loadDrone } from "./drone";

type V3 = [number, number, number];

/**
 * CAD part names per feature id (the ids in src/text/showcase/drone.ts). `look`: the camera frames these and the
 * label hangs off them (none = the whole drone). `also`: more parts that keep their colour on that stop. Parts in no
 * list are the frame. The first feature is the overview: the whole drone stays in colour.
 * Names missing from the model are skipped, so the lists hold the names of both the October 16 layout and the newer
 * one (Pi on its own holder, battery in a printed case, FC on a damping plate).
 */
const PARTS: Record<string, { look: string[]; also?: string[] }> = {
	overview: { look: [] },
	"flight-controller": {
		look: ["Flight controller"],
		also: [
			"Damper plate (upper)",
			"Damper plate (lower)",
			"FC deck (printed)",
			"Rubber grommet",
			"IO board",
			"Receiver",
			"Receiver cradle (printed)",
			"Receiver pins",
			"Receiver antennas",
			"Antenna coax",
			"SBUS plug",
			"SBUS cable",
			"8-pin FC cable",
		],
	},
	motors: {
		look: [
			"Motors and props",
			"motor_front_right",
			"motor_front_left",
			"motor_rear_right",
			"motor_rear_left",
			"prop_front_right",
			"prop_front_left",
			"prop_rear_right",
			"prop_rear_left",
		],
		also: ["Arms and ESCs", "ESC power leads", "ESC signal leads", "Motor phase wires"],
	},
	power: {
		look: ["Battery", "Battery case (printed)"],
		also: [
			"Battery strap",
			"Matek BEC12S-PRO pads",
			"BEC sleeve (printed)",
			"XT60 and on/off switch",
			"Battery lead",
			"Balance lead",
			"LiPo voltage alarm",
			"Buzzer",
			"Buzzer wires",
			"Matek BEC12S-PRO",
			"BEC feed",
			"USB-C power cable",
			"IO feed",
			"Bottom plate (PDB)",
			"Landing gear",
		],
	},
	camera: {
		look: ["Camera case (printed)"],
		also: [
			"Camera Module 3 board",
			"Camera Module 3 lens",
			"Camera Module 3 connector",
			"Camera ribbon",
			"Tilt mount (printed)",
			"M2 x 6 self-tapping screw",
			"M3 x 8 lock screw",
			"M3 x 45 hinge bolt",
			"M3 x 12 base bolt",
			"M3 washer",
			"M3 nyloc nut",
		],
	},
	"video-link": {
		look: ["ZTE MF833 4G stick", "Raspberry Pi 4", "Pi 4 case (ABS)"],
		also: [
			"MF833 sleeve (printed)",
			"Pi case holder (printed)",
			"Pi 4 USB",
			"Pi 4 USB-C",
			"Pi 4 Ethernet",
			"Pi 4 micro HDMI",
			"Pi 4 CAMERA connector",
			"Modem extension",
			"FC → Pi USB",
		],
	},
};

/**
 * How each stop frames its `look` box. `at` (where the camera aims) and `label` are points in the box: -1..1 across
 * it on each axis, with ±1 for the label meaning just outside that face. `from` is the direction the camera looks from,
 * as an offset from `at` (y up, the drone's front, with the red arms and the camera, toward +z); how far back it sits
 * is worked out for the stage, so the whole drone always fits and no part is cut off (src/lib/three/showcase.ts).
 */
const FRAMING: Record<string, { at?: V3; from: V3; label: V3 }> = {
	// The drone chapter's first three beats (src/components/DroneChapter.astro): the whole drone, no label.
	prologue: { from: [-0.55, 0.1, -0.82], label: [0, 0, 0] }, // low, behind on the left: a silhouette against the rim light
	stakes: { from: [0, -0.26, 0.97], label: [0, 0, 0] }, // (replaced by the close-up on the lens, below)
	reveal: { from: [0.66, 0.38, 0.78], label: [0, 0, 0] }, // up and round to the front right, as the lights come up
	overview: { from: [-0.73, 0.57, 0.66], label: [0.7, 0.15, 0.45] }, // the hero's three-quarter view
	"flight-controller": { from: [-0.2, 0.55, 0.27], label: [1.4, 0.8, 0] }, // high, looking down at the top plate
	motors: { at: [-0.56, -0.35, 0.4], from: [-0.36, 0.09, -0.1], label: [-0.6, 1.5, 0.52] }, // low, beside the front-left (red) arm
	power: { at: [0, -1, 0], from: [-0.5, -0.09, -0.27], label: [-1.5, -1.2, 0] }, // from below the belly
	camera: { at: [0, -0.4, -1.5], from: [0.1, -0.02, 0.26], label: [0, -0.9, 1.35] }, // low at the front, looking up at the mount
	"video-link": { at: [0, 0.2, 0], from: [0.37, -0.06, -0.47], label: [1.1, 0, -0.6] }, // from the rear, low
};

const LABEL_GAP = 0.015; // metres outside a face, for label coordinates of ±1

/**
 * Exploded view: how far apart the drone is on each stop (0 = assembled, 1 = fully apart). The stack is easiest to
 * read pulled apart on the flight controller (the FC on its damping plates over the top plate) and the power stop
 * (the battery, its case and the PDB under the frame). The opening beat also starts fully apart and settles together.
 */
const EXPLODE: Record<string, number> = { "flight-controller": 0.45, power: 0.5 };
/** Per axis: how far each part moves from the middle of the drone, as a share of how far its centre already is.
 *  Mostly up and down, so the layers of the stack separate; a little outward, so the arms clear the plates. */
const SPREAD: V3 = [0.45, 2.1, 0.45];

/** The stops that show the whole drone in colour: the overview, and the chapter's first three beats. */
const WHOLE = ["prologue", "stakes", "reveal", "overview"];
/** Metres from the camera lens for the chapter's close-up on it (the stakes). */
const LENS_CLOSE = 0.42;

/** Extras drone.ts adds outside the CAD export, by geometry: the prop discs (motors) and the 4G stick's rings. */
const EXTRAS: Record<string, string> = { CircleGeometry: "motors", TorusGeometry: "video-link" };

/** Only the camera before the model has loaded; the showcase moves it straight to the right stop. How many pixels it
 * renders comes from the stage's quality tier (stage.ts). */
export const view: StageView = { camera: FRAMING.overview.from, target: [0, 0, 0], fov: 36, orbit: false };

const DISC_OPACITY = 0.4; // the spinning props' blur discs, as a share of the hero's: a hint of motion, not a shape

type Box = { lo: number[]; hi: number[] };
const size = ({ lo, hi }: Box) => (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]);

/**
 * Adds a `feature` attribute (0 = frame, n = the nth feature's parts) and an `explode` attribute (where each part
 * goes in the exploded view, as an offset) to every CAD mesh of the drone. `centre`: the middle of the drone; parts
 * whose box spans most of the drone (all four arms, all four motors) move by each piece's own centre instead.
 */
function tagFeatures(model: Object3D, boxes: Array<Box & { feature: number }>, extras: Record<string, number>, centre: V3, span: V3) {
	const E = 2e-4; // the boxes are rounded to 0.1 mm
	const holds = (b: Box, lo: number[], hi: number[]) => [0, 1, 2].every((d) => lo[d] >= b.lo[d] - E && hi[d] <= b.hi[d] + E);
	const motors = extras.CircleGeometry ?? 0; // the spinning props sit on their own hubs, away from their part box

	model.traverse((object) => {
		const mesh = object as Mesh;
		if (!mesh.isMesh) return;
		const extra = extras[mesh.geometry.type];
		// Otherwise CAD meshes only, which sit where they were exported (the FC's LED is placed, so it's left out).
		if (extra === undefined && (!(mesh.material instanceof MeshStandardMaterial) || mesh.position.lengthSq() > 0)) return;
		const position = mesh.geometry.getAttribute("position");
		const index = mesh.geometry.getIndex();
		const feature = new Float32Array(position.count);
		const explode = new Float32Array(position.count * 3);
		if (extra !== undefined) feature.fill(extra);
		else if (mesh.parent !== model) feature.fill(motors);
		else if (index) {
			// Connected pieces (union-find over the triangles' vertices)...
			const root = Int32Array.from({ length: position.count }, (_, i) => i);
			const find = (v: number) => {
				while (root[v] !== v) v = root[v] = root[root[v]];
				return v;
			};
			for (let t = 0; t < index.count; t += 3) {
				const r = find(index.getX(t));
				root[find(index.getX(t + 1))] = r;
				root[find(index.getX(t + 2))] = r;
			}
			// ...their bounds...
			const bounds = new Map<number, Box>();
			for (let v = 0; v < position.count; v++) {
				const p = [position.getX(v), position.getY(v), position.getZ(v)];
				const r = find(v);
				const box = bounds.get(r);
				if (!box) bounds.set(r, { lo: [...p], hi: [...p] });
				else for (let d = 0; d < 3; d++) (box.lo[d] = Math.min(box.lo[d], p[d])), (box.hi[d] = Math.max(box.hi[d], p[d]));
			}
			// ...and the smallest part box that holds each piece whole.
			const pieceFeature = new Map<number, number>();
			const pieceShift = new Map<number, V3>();
			for (const [r, { lo, hi }] of bounds) {
				const box = boxes.find((b) => holds(b, lo, hi));
				pieceFeature.set(r, box?.feature ?? 0);
				const part = box ?? { lo, hi };
				// A part with one of each in every corner (arms, motors, legs, their wires) moves as four: each corner's
				// pieces go together, toward that corner.
				const anchor = [0, 1, 2].map((d) => {
					const mid = (part.lo[d] + part.hi[d]) / 2;
					const extent = part.hi[d] - part.lo[d];
					if (d === 1 || extent < 0.55 * span[d]) return mid; // up and down, every part moves as one
					const side = (lo[d] + hi[d]) / 2 - mid;
					return Math.abs(side) < 0.08 * extent ? mid : mid + Math.sign(side) * extent * 0.3;
				});
				pieceShift.set(r, [0, 1, 2].map((d) => (anchor[d] - centre[d]) * SPREAD[d]) as V3);
			}
			for (let v = 0; v < position.count; v++) {
				const r = find(v);
				feature[v] = pieceFeature.get(r)!;
				explode.set(pieceShift.get(r)!, v * 3);
			}
		}
		mesh.geometry.setAttribute("feature", new BufferAttribute(feature, 1));
		mesh.geometry.setAttribute("explode", new BufferAttribute(explode, 3));
	});
}

export interface DroneShowcaseOptions {
	/** The props turn only at this stop (and as the camera nears it); by default they always turn. */
	spinAt?: string;
	/** false: no blinking FC LED (the chapter shows only what the page states). */
	led?: boolean;
}

/** `ids`: the features in the order the page shows them. */
export default async function createDroneShowcase(
	ctx: StageContext,
	ids: string[],
	options: DroneShowcaseOptions = {},
): Promise<ShowcaseModel & { rig: DroneRig }> {
	const rig = await loadDrone();
	const parts = Object.entries(rig.parts).map(([name, b]) => ({ name, lo: b.slice(0, 3), hi: b.slice(3) }));
	const all: Box = {
		lo: [0, 1, 2].map((d) => Math.min(...parts.map((p) => p.lo[d]))),
		hi: [0, 1, 2].map((d) => Math.max(...parts.map((p) => p.hi[d]))),
	};
	/** The box around those of these parts the model has; the whole drone when it has none of them. */
	const around = (names: string[]): Box => {
		const found = parts.filter((p) => names.includes(p.name));
		if (!found.length) return all;
		return {
			lo: [0, 1, 2].map((d) => Math.min(...found.map((p) => p.lo[d]))),
			hi: [0, 1, 2].map((d) => Math.max(...found.map((p) => p.hi[d]))),
		};
	};
	const point = ({ lo, hi }: Box, rel: V3, gap = 0) =>
		rel.map((r, d) => (lo[d] + hi[d]) / 2 + r * ((hi[d] - lo[d]) / 2 + gap)) as V3;
	const centre = point(all, [0, 0, 0]);
	const span = [0, 1, 2].map((d) => all.hi[d] - all.lo[d]) as V3;
	const shiftOf = (box: Box) => point(box, [0, 0, 0]).map((v, d) => (v - centre[d]) * SPREAD[d]) as V3;

	// A feature added to the text without a stop here gets the overview's camera and no parts of its own.
	const partsOf = (id: string) => PARTS[id] ?? { look: [] };

	const stops: ShowcaseStop[] = ids.map((id) => {
		const framing = FRAMING[id] ?? FRAMING.overview;
		const box = around(partsOf(id).look);
		const target = point(box, framing.at ?? [0, 0, 0]);
		return {
			target,
			camera: target.map((v, d) => v + framing.from[d]) as V3,
			label: point(box, framing.label, LABEL_GAP),
			labelShift: box === all ? undefined : shiftOf(box),
		};
	});
	// The chapter's stakes: close in on the camera's lens glass, from straight in front of it.
	const close = ids.indexOf("stakes");
	if (close >= 0) {
		const glass = rig.lens.position;
		const out = new Vector3(0, 0, 1).applyQuaternion(rig.lens.quaternion);
		stops[close] = {
			target: glass.toArray() as V3,
			camera: glass.clone().addScaledVector(out, LENS_CLOSE).toArray() as V3,
			label: glass.toArray() as V3,
			distance: LENS_CLOSE,
		};
	}
	const spinAt = options.spinAt ? ids.indexOf(options.spinAt) : -1;
	let spin = spinAt >= 0 ? 0 : 1;

	// Feature n's parts get n; the overview (0) shares 0 with the frame, since it keeps everything in colour.
	const featureOf = new Map<string, number>();
	ids.forEach((id, n) => [...partsOf(id).look, ...(partsOf(id).also ?? [])].forEach((name) => featureOf.set(name, n)));
	const boxes = parts.map((p) => ({ ...p, feature: featureOf.get(p.name) ?? 0 })).sort((a, b) => size(a) - size(b));
	const extras = Object.fromEntries(Object.entries(EXTRAS).map(([type, id]) => [type, Math.max(0, ids.indexOf(id))]));
	tagFeatures(rig.model, boxes, extras, centre, span);
	ctx.root.add(rig.model);

	const shadow = contactShadow(0.42, 0.3, 0.25);
	shadow.position.y = rig.floor - 0.002;
	ctx.root.add(shadow);
	let shadowOpacity = 0.3;

	// What the exploded view moves by hand: the props' hubs and blur discs (they spin, so they can't carry a fixed
	// offset in their vertices) go with the motors; the FC's little LED hides.
	const motorsBox = around(PARTS.motors.look);
	const movers: Array<{ object: Object3D; home: Vector3; shift: Vector3 }> = [];
	let led: Object3D | undefined;
	rig.model.children.forEach((object) => {
		const mesh = object as Mesh;
		const hub = !mesh.isMesh && object.children.length > 0;
		const disc = mesh.isMesh && mesh.geometry.type === "CircleGeometry";
		if (mesh.isMesh && mesh.geometry.type === "BoxGeometry") led = mesh;
		if (!hub && !disc) return;
		const p = object.position;
		const y = (motorsBox.lo[1] + motorsBox.hi[1]) / 2;
		movers.push({
			object,
			home: p.clone(),
			shift: new Vector3((p.x - centre[0]) * SPREAD[0], (y - centre[1]) * SPREAD[1], (p.z - centre[2]) * SPREAD[2]),
		});
	});
	let pulled = 0;
	let drawn = -1;
	const pullApart = (amount: number) => {
		pulled = amount;
		if (Math.abs(amount - drawn) < 1e-4) return;
		drawn = amount;
		for (const m of movers) m.object.position.copy(m.home).addScaledVector(m.shift, amount);
		if (led) led.visible = options.led !== false && amount < 0.02;
		// The floor shadow is the assembled drone's: it lightens as the parts lift away from it.
		(shadow.material as MeshBasicMaterial).opacity = shadowOpacity * (1 - 0.6 * smooth(amount));
	};
	const smooth = (x: number) => x * x * (3 - 2 * x);
	const explode = ids.map((id) => EXPLODE[id] ?? 0);

	// The opening beat: a light sweeps across the drone while its parts settle together.
	const key = ctx.lights.key;
	const keyHome = key.position.clone();

	// The 4G stick's signal rings belong to the video link: they show on its stop only (and fade in and out with it).
	const rings: MeshBasicMaterial[] = [];
	let discs: MeshBasicMaterial | undefined;
	rig.model.traverse((object) => {
		const mesh = object as Mesh;
		if (!mesh.isMesh || !(mesh.material instanceof MeshBasicMaterial)) return;
		if (mesh.geometry.type === "TorusGeometry") rings.push(mesh.material);
		if (mesh.geometry.type === "CircleGeometry") discs = mesh.material;
	});
	const videoLink = ids.indexOf("video-link");
	let signal = 0;
	const update = (t: number, dt: number) => {
		rig.animate(t, dt, spin);
		for (const ring of rings) ring.opacity *= signal;
		if (discs) discs.opacity *= DISC_OPACITY;
	};

	return {
		rig,
		stops,
		floor: rig.floor,
		explode,
		whole: WHOLE.map((id) => ids.indexOf(id)).filter((i) => i >= 0),
		opening(progress) {
			const k = smooth(Math.min(1, Math.max(0, progress)));
			key.position.set(keyHome.x + (1 - k) * 9, keyHome.y - (1 - k) * 2.5, keyHome.z);
			return 1 - k;
		},
		focus(weights, amount) {
			signal = videoLink < 0 ? 0 : weights[videoLink];
			if (spinAt >= 0) spin = smooth(weights[spinAt]);
			for (const ring of rings) ring.visible = signal > 0.01;
			pullApart(amount);
		},
		update,
		pose() {
			update(0.35, 1e-3); // the rings part way out, for the 4G video link's still
			if (discs) discs.opacity = 0; // and no blur discs: nothing spins in a still
		},
		applyPalette(p) {
			shadowOpacity = p.dark ? 0.55 : 0.28;
			drawn = -1;
			pullApart(pulled);
		},
	};
}
