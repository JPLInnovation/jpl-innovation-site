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
import { BufferAttribute, type Mesh, MeshBasicMaterial, MeshStandardMaterial, type Object3D } from "three";
import type { ShowcaseModel, ShowcaseStop } from "../showcase";
import { contactShadow, type StageContext, type StageView } from "../stage";
import { loadDrone } from "./drone";

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
		look: ["Motors and props"],
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
	overview: { from: [-0.73, 0.57, 0.66], label: [0.7, 0.15, 0.45] }, // the hero's three-quarter view
	"flight-controller": { from: [-0.2, 0.55, 0.27], label: [1.4, 0.8, 0] }, // high, looking down at the top plate
	motors: { at: [-0.56, -0.35, 0.4], from: [-0.36, 0.09, -0.1], label: [-0.6, 1.5, 0.52] }, // low, beside the front-left (red) arm
	power: { at: [0, -1, 0], from: [-0.5, -0.09, -0.27], label: [-1.5, -1.2, 0] }, // from below the belly
	camera: { at: [0, -0.4, -1.5], from: [0.1, -0.02, 0.26], label: [0, -0.9, 1.35] }, // low at the front, looking up at the mount
	"video-link": { at: [0, 0.2, 0], from: [0.37, -0.06, -0.47], label: [1.1, 0, -0.6] }, // from the rear, low
};

const LABEL_GAP = 0.015; // metres outside a face, for label coordinates of ±1

/** Extras drone.ts adds outside the CAD export, by geometry: the prop discs (motors) and the 4G stick's rings. */
const EXTRAS: Record<string, string> = { CircleGeometry: "motors", TorusGeometry: "video-link" };

/** Only the camera before the model has loaded; the showcase moves it straight to the right stop. The stage is large,
 * so it renders at no more than 1.5x the CSS pixels to hold 60 fps on a laptop. */
export const view: StageView = { camera: FRAMING.overview.from, target: [0, 0, 0], fov: 36, orbit: false, pixelRatio: 1.5 };

const DISC_OPACITY = 0.6; // the spinning props' blur discs, as a share of the hero's: a hint of motion, not a shape

type Box = { lo: number[]; hi: number[] };
const size = ({ lo, hi }: Box) => (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]);

/** Adds a `feature` attribute (0 = frame, n = the nth feature's parts) to every CAD mesh of the drone. */
function tagFeatures(model: Object3D, boxes: Array<Box & { feature: number }>, extras: Record<string, number>) {
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
			for (const [r, { lo, hi }] of bounds) pieceFeature.set(r, boxes.find((b) => holds(b, lo, hi))?.feature ?? 0);
			for (let v = 0; v < position.count; v++) feature[v] = pieceFeature.get(find(v))!;
		}
		mesh.geometry.setAttribute("feature", new BufferAttribute(feature, 1));
	});
}

/** `ids`: the features in the order the page shows them. */
export default async function createDroneShowcase(ctx: StageContext, ids: string[]): Promise<ShowcaseModel> {
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
		};
	});

	// Feature n's parts get n; the overview (0) shares 0 with the frame, since it keeps everything in colour.
	const featureOf = new Map<string, number>();
	ids.forEach((id, n) => [...partsOf(id).look, ...(partsOf(id).also ?? [])].forEach((name) => featureOf.set(name, n)));
	const boxes = parts.map((p) => ({ ...p, feature: featureOf.get(p.name) ?? 0 })).sort((a, b) => size(a) - size(b));
	const extras = Object.fromEntries(Object.entries(EXTRAS).map(([type, id]) => [type, Math.max(0, ids.indexOf(id))]));
	tagFeatures(rig.model, boxes, extras);
	ctx.root.add(rig.model);

	const shadow = contactShadow(0.24, 0.3);
	shadow.position.y = rig.floor - 0.002;
	ctx.root.add(shadow);

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
		rig.animate(t, dt);
		for (const ring of rings) ring.opacity *= signal;
		if (discs) discs.opacity *= DISC_OPACITY;
	};

	return {
		stops,
		floor: rig.floor,
		focus(weights) {
			signal = videoLink < 0 ? 0 : weights[videoLink];
			for (const ring of rings) ring.visible = signal > 0.01;
		},
		update,
		pose() {
			update(0.35, 1e-3); // the rings part way out, for the 4G video link's still
			if (discs) discs.opacity = 0; // and no blur discs: nothing spins in a still
		},
		applyPalette(p) {
			(shadow.material as MeshBasicMaterial).opacity = p.dark ? 0.55 : 0.28;
		},
	};
}
