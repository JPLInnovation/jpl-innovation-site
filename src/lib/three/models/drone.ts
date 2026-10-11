/**
 * The F450 4G drone in 3D, following the build guide's interactive 3D layout (public/work/drone/3d-layout/): the same
 * parts, sizes, places and wires, without that page's controls. It is built in the layout's millimetres (y up, front −z),
 * then scaled to metres and turned half a turn so the front (the red arms) faces +z.
 * Flight parts sit on the top plate, power wiring between the plates and an ESC under each arm; the battery, Pi 4,
 * Matek BEC, C920-C and 4G stick hang under the frame on tall legs. Props spin as in INAV's default (props-in):
 * front-left and rear-right clockwise. The layout's GPS mast (a later upgrade), spin arrows and CG marker are left out.
 */
import {
	BoxGeometry,
	type BufferGeometry,
	CatmullRomCurve3,
	CircleGeometry,
	CylinderGeometry,
	DoubleSide,
	EdgesGeometry,
	ExtrudeGeometry,
	Group,
	LineBasicMaterial,
	LineSegments,
	type Material,
	Mesh,
	MeshBasicMaterial,
	type MeshStandardMaterial,
	type Object3D,
	Path,
	Shape,
	ShapeGeometry,
	SphereGeometry,
	TorusGeometry,
	TubeGeometry,
	Vector3,
} from "three";
import { contactShadow, type Model, type StageContext, type StageView, standard } from "../stage";

export const view: StageView = {
	camera: [-0.76, 0.58, 0.71],
	target: [0, -0.06, 0],
	fov: 36,
	fitWidth: 0.8,
	spin: 0.18,
	minPolar: 0.35,
	maxPolar: 1.85,
};

/* Layout sizes, in mm */
const GROUND = -220; // the floor under the feet
const TY = 43.2; // top face of the top plate
const FCZ = 33; // flight controller centre, behind the IO board
const R_MOTOR = 227.5; // centre to motor: 455 mm motor to motor
const R_ROOT = 50; // centre to arm root
const LM = R_MOTOR - R_ROOT;
const PROP_R = 127; // 10-inch props

const COL = {
	pcb: 0x1d2925,
	pcbTop: 0x2a312f,
	gold: 0xc9a54b,
	pad: 0xd9dcd8,
	red: 0xc8302b,
	white: 0xe9e7e0,
	black: 0x1e2220,
	motor: 0x3b4040,
	steel: 0xb7bcbc,
	prop: 0x272b2a,
	bec: 0x1d58b8,
	fcpcb: 0x232a3d,
	rx: 0x2b2b2b,
	yellow: 0xe9b323,
	case: 0x262a29,
	lens: 0x0d1012,
};
/** Wire colours, as in the layout's legend. */
const WIRE = {
	red: 0xd7261e,
	black: 0x1f2321,
	signal: 0x2563eb,
	sbus: 0x8642d6,
	uart: 0x0a879f,
	usb: 0x2f3432,
	net: 0xbf3d78,
	coax: 0x2b2b2b,
	phase: [0x1b1d1c, 0xc23b2b, 0xd7a51e],
};
const UP = new Vector3(0, 1, 0);

type Hole = { x: number; z: number; r?: number; w?: number; d?: number };
type MaterialOptions = { r?: number; m?: number; op?: number };

/** A flat outline in (x, z) with round or slot holes, extruded into a plate th mm thick on y = 0. */
function plateGeometry(points: number[][], holes: Hole[], th = 1.6) {
	const shape = new Shape();
	shape.moveTo(points[0][0], points[0][1]);
	for (const [x, z] of points.slice(1)) shape.lineTo(x, z);
	shape.closePath();
	for (const { x, z, r, w = 0, d = 0 } of holes) {
		const hole = new Path();
		if (r) hole.absarc(x, z, r, 0, Math.PI * 2, true);
		else {
			const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, rr = (Math.min(w, d) / 2) * 0.95;
			hole.moveTo(x0 + rr, z0);
			hole.lineTo(x1 - rr, z0);
			hole.quadraticCurveTo(x1, z0, x1, z0 + rr);
			hole.lineTo(x1, z1 - rr);
			hole.quadraticCurveTo(x1, z1, x1 - rr, z1);
			hole.lineTo(x0 + rr, z1);
			hole.quadraticCurveTo(x0, z1, x0, z1 - rr);
			hole.lineTo(x0, z0 + rr);
			hole.quadraticCurveTo(x0, z0, x0 + rr, z0);
		}
		shape.holes.push(hole);
	}
	const geometry = new ExtrudeGeometry(shape, { depth: th, bevelEnabled: false, curveSegments: 10 });
	geometry.rotateX(Math.PI / 2);
	geometry.translate(0, th, 0); // shape (x, z) → world (x, 0..th, z)
	return geometry;
}

/** One arm: the F450's lattice side profile, extruded 28 mm wide and tapered toward the motor. Runs along +x from the root. */
function armGeometry() {
	const tip = LM + 21;
	const outline = [[0, 1.6], [36, 1.6], [44, 16], [LM - 18, 25], [tip, 25], [tip, 37], [0, 41.6]];
	const shape = new Shape();
	shape.moveTo(outline[0][0], outline[0][1]);
	for (const [u, y] of outline.slice(1)) shape.lineTo(u, y);
	shape.closePath();
	const top = (u: number) => 41.6 + (37 - 41.6) * (u / tip);
	const bottom = (u: number) => (u < 44 ? 1.6 : 16 + (25 - 16) * ((u - 44) / (LM - 18 - 44)));
	// Triangular windows, alternately point up and point down
	const step = 21, m = 3.2;
	for (let u0 = 52, k = 0; u0 + step < LM - 26; u0 += step, k++) {
		const u1 = u0 + step, mid = (u0 + u1) / 2, hole = new Path();
		if (k % 2 === 0) {
			hole.moveTo(u0 + m * 1.6, bottom(u0) + m);
			hole.lineTo(u1 - m * 1.6, bottom(u1) + m);
			hole.lineTo(mid, top(mid) - m);
		} else {
			hole.moveTo(u0 + m * 1.6, top(u0) - m);
			hole.lineTo(mid, bottom(mid) + m);
			hole.lineTo(u1 - m * 1.6, top(u1) - m);
		}
		hole.closePath();
		shape.holes.push(hole);
	}
	const geometry = new ExtrudeGeometry(shape, { depth: 28, bevelEnabled: false, curveSegments: 4 });
	geometry.translate(0, 0, -14);
	const position = geometry.attributes.position;
	for (let i = 0; i < position.count; i++) {
		const u = position.getX(i);
		position.setZ(i, position.getZ(i) * (1 - 0.24 * Math.min(1, Math.max(0, u / tip))));
	}
	geometry.computeVertexNormals();
	return geometry;
}

/** One prop blade from the hub out along +x, curved like a 1045 blade and pitched by pitchSign. */
function bladeGeometry(length: number, pitchSign: number) {
	const shape = new Shape();
	shape.moveTo(7, -3);
	for (let i = 0; i <= 14; i++) {
		const r = 7 + ((length - 7) * i) / 14;
		shape.lineTo(r, 9 * Math.sin(Math.PI * (r / length) ** 0.75) + 3);
	}
	for (let i = 14; i >= 0; i--) {
		const r = 7 + ((length - 7) * i) / 14;
		shape.lineTo(r, -(5 * Math.sin(Math.PI * (r / length) ** 0.8) + 2.5));
	}
	shape.closePath();
	const geometry = new ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: false, curveSegments: 3 });
	geometry.translate(0, 0, -0.8);
	geometry.rotateX(Math.PI / 2);
	geometry.rotateX(pitchSign * 0.17);
	return geometry;
}

/** A cable along a smooth path through the points. */
function cableGeometry(points: Vector3[], r: number) {
	const curve = new CatmullRomCurve3(points, false, "centripetal");
	return new TubeGeometry(curve, Math.max(16, Math.min(320, Math.round(curve.getLength() / 2.2))), r, 7, false);
}

/** A red and black power pair twisted along the path, one turn per 22 mm. */
function twistedPairGeometry(points: Vector3[], r: number) {
	const curve = new CatmullRomCurve3(points, false, "centripetal");
	const length = curve.getLength();
	const n = Math.max(24, Math.min(240, Math.round(length / 1.6)));
	const frames = curve.computeFrenetFrames(n, false);
	const a: Vector3[] = [];
	const b: Vector3[] = [];
	for (let i = 0; i <= n; i++) {
		const u = i / n, p = curve.getPointAt(u), twist = (2 * Math.PI * u * length) / 22;
		const offset = frames.normals[i].clone().multiplyScalar(Math.cos(twist) * r * 1.02).addScaledVector(frames.binormals[i], Math.sin(twist) * r * 1.02);
		a.push(p.clone().add(offset));
		b.push(p.clone().sub(offset));
	}
	return [a, b].map((side) => new TubeGeometry(new CatmullRomCurve3(side), n * 2, r, 7, false));
}

export default function createDrone(ctx: StageContext): Model {
	const drone = new Group(); // bobs and sways
	ctx.root.add(drone);
	const layout = new Group(); // the layout's millimetres, turned so its front (−z) faces +z
	layout.scale.setScalar(0.001);
	layout.rotation.y = Math.PI;
	drone.add(layout);

	const M = (color: number, { r = 0.62, m = 0, op = 1 }: MaterialOptions = {}) =>
		standard(color, { roughness: r, metalness: m, transparent: op < 1, opacity: op });
	const add = (geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0, parent: Object3D = layout) => {
		const mesh = new Mesh(geometry, material);
		mesh.position.set(x, y, z);
		parent.add(mesh);
		return mesh;
	};
	const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);
	const cyl = (r: number, h: number, segments = 24) => new CylinderGeometry(r, r, h, segments);
	const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
	/** One colour: a single cable. Two: a twisted power pair. */
	const wire = (colors: number[], r: number, points: Vector3[]) => {
		const geometries = colors.length === 2 ? twistedPairGeometry(points, r) : [cableGeometry(points, r)];
		geometries.forEach((g, i) => add(g, M(colors[i], { r: 0.55 })));
	};
	const padMaterial = M(COL.pad, { r: 0.35, m: 0.6 });

	/* ---------- Frame: the bottom plate (it's the PDB) and the top plate, with gold-plated edges ---------- */
	const gold = new LineBasicMaterial({ color: COL.gold });
	const plate = (points: number[][], holes: Hole[], color: number, y: number) => {
		const mesh = add(plateGeometry(points, holes), M(color, { r: 0.5 }), 0, y, 0);
		mesh.add(new LineSegments(new EdgesGeometry(mesh.geometry, 30), gold));
	};
	plate(
		[[-26, -90], [26, -90], [32, -84], [32, -56], [42, -56], [56, -42], [56, 42], [42, 56], [32, 56], [32, 84], [26, 90], [-26, 90], [-32, 84], [-32, 56], [-42, 56], [-56, 42], [-56, -42], [-42, -56], [-32, -56], [-32, -84]],
		[
			{ x: -15, z: -74, w: 6, d: 22 }, { x: 15, z: -74, w: 6, d: 22 }, { x: -15, z: 74, w: 6, d: 22 }, { x: 15, z: 74, w: 6, d: 22 },
			{ x: 0, z: -47, w: 44, d: 12 }, { x: 0, z: 47, w: 44, d: 12 }, { x: -48, z: 0, w: 9, d: 40 }, { x: 48, z: 0, w: 9, d: 40 },
			{ x: -12, z: 0, w: 5, d: 44 }, { x: 0, z: 0, w: 5, d: 52 }, { x: 12, z: 0, w: 5, d: 44 },
		],
		COL.pcb,
		0,
	);
	// Pad pairs: centre x, z and the direction of the + pad. B: battery in, IO: to the IO board, U: to the BEC, two spare.
	for (const [x, z, dx, dz] of [[-37, 0, 0, -1], [23, -23, 1, 1], [23, 23, -1, 1], [-23, -23, 1, -1], [-23, 23, 1, 1]]) {
		const d = v(dx, 0, dz).normalize();
		for (const s of [7.5, -7.5]) add(box(8, 0.6, 8), padMaterial, x + d.x * s, 1.9, z + d.z * s).rotation.y = Math.atan2(d.x, d.z);
		add(box(4, 0.4, 4), M(0x8a8f8b, { r: 0.5, m: 0.4 }), x, 1.8, z);
	}
	plate(
		[[-42, -56], [42, -56], [56, -42], [56, 42], [42, 56], [-42, 56], [-56, 42], [-56, -42]],
		[
			{ x: 0, z: 0, r: 13 }, { x: 22, z: -22, r: 6 }, { x: -22, z: -22, r: 6 }, { x: 22, z: 22, r: 6 }, { x: -22, z: 22, r: 6 },
			{ x: 0, z: 54, w: 22, d: 6 }, { x: -36, z: 0, w: 6, d: 20 }, { x: 36, z: 0, w: 6, d: 20 },
		],
		COL.pcbTop,
		41.6,
	);

	/* ---------- Arms, motors, ESCs, props and their wires ---------- */
	// INAV's numbering, with x to the right and z to the back
	const motors = [
		{ n: 1, sx: 1, sz: 1, cw: true }, // rear right
		{ n: 2, sx: 1, sz: -1, cw: false }, // front right
		{ n: 3, sx: -1, sz: 1, cw: false }, // rear left
		{ n: 4, sx: -1, sz: -1, cw: true }, // front left
	];
	const ioPads = [[-15, -18], [15, -18], [-15, 2], [15, 2]]; // ESC power pads on the IO board
	const arm = armGeometry();
	const propMaterial = M(COL.prop, { r: 0.45, op: 0.93 });
	const disc = new CircleGeometry(PROP_R, 64);
	const discMaterial = new MeshBasicMaterial({ color: 0x8fa39a, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide });
	const props: Array<{ hub: Group; cw: boolean }> = [];
	for (const motor of motors) {
		const dir = v(motor.sx, 0, motor.sz).normalize();
		const side = v(-dir.z, 0, dir.x);
		const yaw = Math.atan2(-dir.z, dir.x);
		const armColor = motor.sz < 0 ? COL.red : COL.white;
		add(arm, M(armColor, { r: 0.7 }), dir.x * R_ROOT, 0, dir.z * R_ROOT).rotation.y = yaw;
		const at = dir.clone().multiplyScalar(R_MOTOR);
		add(cyl(20.5, 4, 32), M(armColor, { r: 0.7 }), at.x, 35, at.z);
		// Motor: mount cross, copper stator band, bell, prop adapter
		add(cyl(13.8, 5, 28), M(0x2c3030, { r: 0.4, m: 0.5 }), at.x, 39.5, at.z);
		add(cyl(13.2, 3, 28), M(0xb87333, { r: 0.4, m: 0.6 }), at.x, 43.5, at.z);
		add(cyl(13.9, 18, 28), M(COL.motor, { r: 0.32, m: 0.75 }), at.x, 54, at.z);
		add(cyl(4.2, 9, 16), M(COL.steel, { r: 0.25, m: 0.9 }), at.x, 67.5, at.z);
		// ESC under the arm, about two thirds of the way out, with its label
		const esc = dir.clone().multiplyScalar(150);
		add(box(48, 9, 25), M(COL.black, { r: 0.55 }), esc.x, 14, esc.z).rotation.y = yaw;
		add(box(30, 0.3, 14), M(0xd9ddd9, { r: 0.8 }), esc.x, 9.4, esc.z).rotation.y = yaw;
		// Prop: two blades and a nut on a hub that spins
		const hub = new Group();
		hub.position.set(at.x, 71, at.z);
		hub.rotation.y = motor.n * 0.7;
		layout.add(hub);
		const blade = bladeGeometry(PROP_R, motor.cw ? 1 : -1);
		add(blade, propMaterial, 0, 0, 0, hub);
		add(blade, propMaterial, 0, 0, 0, hub).rotation.y = Math.PI;
		add(cyl(5, 6, 16), M(COL.steel, { r: 0.25, m: 0.9 }), 0, 3, 0, hub);
		add(disc, discMaterial, at.x, 71, at.z).rotation.x = -Math.PI / 2;
		props.push({ hub, cw: motor.cw });
		// ESC power to the IO board, signal to its servo header, three phase wires to the motor
		const escIn = esc.clone().addScaledVector(dir, -24);
		const escOut = esc.clone().addScaledVector(dir, 24);
		const out = (r: number, y: number, s = 0) => v(dir.x * r + side.x * s, y, dir.z * r + side.z * s);
		const [px, pz] = ioPads[[3, 1, 2, 0][motor.n - 1]];
		wire([WIRE.red, WIRE.black], 1.15, [v(escIn.x, 13, escIn.z), out(92, 14), out(56, 24), out(33, 36), out(31.1, 44), out(25, 49), v(px, 50.6, pz)]);
		const hx = -13 + (motor.n - 1) * 3.6;
		wire([WIRE.signal], 0.6, [v(escIn.x + side.x * 9, 12, escIn.z + side.z * 9), out(95, 20, 9), out(60, 30, 5), out(36, 38, 2), out(31.1, 44.5, 2), out(24, 51), v(hx, 56, -21), v(hx, 57.6, -25)]);
		WIRE.phase.forEach((color, i) => {
			const k = i - 1;
			wire([color], 0.75, [v(escOut.x + side.x * k * 4, 14, escOut.z + side.z * k * 4), out(R_MOTOR - 34, 22, k * 3), out(R_MOTOR - 15, 30, k * 3), out(R_MOTOR - 9, 38, k * 3)]);
		});
	}

	/* ---------- On the top plate ---------- */
	// IO board at the centre, the power hub: servo headers at the front, the 8-pin connector toward the FC, ESC and battery pads
	add(box(38, 1.6, 42), M(0x3b4552, { r: 0.45 }), 0, TY + 5.8, -8);
	add(box(30, 8, 7), M(0x111312, { r: 0.6 }), 0, TY + 10.6, -26);
	add(box(14, 5, 5), M(0xf3f1ea, { r: 0.6 }), 0, TY + 9.1, 10);
	for (const [x, z] of ioPads) add(box(6, 0.5, 6), padMaterial, x, TY + 6.9, z);
	add(box(6, 0.6, 9), padMaterial, 16, TY + 6.9, -9);
	for (const [x, z] of [[-15, -25], [15, -25], [-15, 9], [15, 9]]) add(cyl(1.6, 5, 8), M(0xd8d4c8), x, TY + 2.5, z);
	// Flight controller on rubber grommets behind it: arrow forward, USB-C at the rear, a blinking status LED
	add(box(36, 1.6, 36), M(COL.fcpcb, { r: 0.45 }), 0, TY + 7, FCZ);
	add(box(12, 1.6, 12), M(0x0d0f12, { r: 0.4 }), 0, TY + 8.6, FCZ);
	add(box(9, 3.2, 7.5), M(COL.steel, { r: 0.3, m: 0.85 }), 6, TY + 9.4, FCZ + 15);
	const arrowShape = new Shape();
	arrowShape.moveTo(0, 9);
	for (const [x, y] of [[-5, 2], [-1.8, 2], [-1.8, -8], [1.8, -8], [1.8, 2], [5, 2]]) arrowShape.lineTo(x, y);
	arrowShape.closePath();
	const arrow = new ShapeGeometry(arrowShape);
	arrow.rotateX(-Math.PI / 2); // the tip (+y in the shape) points forward (−z)
	add(arrow, M(0xf2f2ee, { r: 0.8 }), -11, TY + 7.85, FCZ - 4);
	for (const [x, z] of [[-15.25, -15.25], [15.25, -15.25], [-15.25, 15.25], [15.25, 15.25]]) add(cyl(3.2, 5.4, 12), M(0x111312, { r: 0.9 }), x, TY + 3.5, FCZ + z);
	const statusLed = add(box(3, 1, 3), standard(0x1daef1, { emissive: 0x1daef1, emissiveIntensity: 2 }), 11, TY + 8.3, FCZ - 11);
	// MC7RE receiver at the front right, antenna B standing in its tube, the buzzer at the rear left
	add(box(30, 10, 18), M(COL.rx, { r: 0.6 }), 33, TY + 6, -40);
	add(box(22, 0.4, 10), M(0x3c69b0, { r: 0.6 }), 33, TY + 11.2, -40);
	add(cyl(2.4, 70, 12), M(0xf4f4f0, { r: 0.3, op: 0.7 }), 46, TY + 37, -18);
	add(cyl(3, 18, 12), M(0xe8e4d8, { r: 0.6 }), 46, TY + 9, -18);
	add(cyl(6, 9, 20), M(0x161817, { r: 0.5 }), -36, TY + 4.5, 34);

	/* ---------- Tall landing gear ---------- */
	const legTop = (sx: number, sz: number) => v(sx * 36, -1, sz * 36);
	const legFoot = (sx: number, sz: number) => v(sx * 92, GROUND + 6, sz * 92);
	const legMaterial = M(0x1b1e1d, { r: 0.5 });
	for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
		const a = legTop(sx, sz), b = legFoot(sx, sz), mid = a.clone().lerp(b, 0.5);
		add(cyl(4.2, a.distanceTo(b), 12), legMaterial, mid.x, mid.y, mid.z).quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
		add(new SphereGeometry(6.5, 16, 12), legMaterial, b.x, b.y, b.z);
	}

	/* ---------- Under the frame ---------- */
	// 3S LiPo at the centre, strapped, sliding fore and aft to balance
	add(box(34, 25, 105), M(0x18191b, { r: 0.55 }), 0, -13.5, -19);
	add(box(34.6, 25.4, 30), M(0xb8312b, { r: 0.6 }), 0, -13.5, -38);
	add(box(36.4, 26, 18), M(0x232624, { r: 0.9 }), 0, -13.2, -12);
	// XT60 pair and the battery's on/off switch, on the left
	add(box(16, 8, 15.5), M(COL.yellow, { r: 0.5 }), -34, -12, 26);
	add(box(16, 8, 15.5), M(COL.yellow, { r: 0.5 }), -34, -12, 10.5);
	add(box(30, 11, 14), M(0x1d1f22, { r: 0.5 }), -40, -6.5, -14);
	add(box(8, 5, 4), M(0xc8302b, { r: 0.45 }), -45, -6.5, -21.5);
	// Pi 4 in its aluminium case at the rear: fan facing down, USB and Ethernet on the left end, USB-C power at the back
	const piCase = { x: 0, y: -17, z: 80, w: 97, h: 30, d: 68 };
	add(box(piCase.w, piCase.h, piCase.d), M(COL.case, { r: 0.5, m: 0.35 }), piCase.x, piCase.y, piCase.z);
	add(cyl(15, 0.8, 32), M(0x101211, { r: 0.8 }), 8, piCase.y - piCase.h / 2 - 0.4, piCase.z);
	const portX = piCase.x - piCase.w / 2 - 0.4;
	for (const [y, z, color] of [[-9, 58, 0x0b0c0c], [-24, 58, 0x0b0c0c], [-9, 76, 0x2563eb], [-24, 76, 0x2563eb]]) add(box(1, 6, 13), M(color, { r: 0.6 }), portX, y, z);
	add(box(1, 13, 16), M(0x9aa09e, { r: 0.4, m: 0.6 }), portX, -17, 97);
	add(box(9, 3.5, 1), M(0x0b0c0c, { r: 0.6 }), 30, -20, piCase.z + piCase.d / 2 + 0.4);
	// Matek BEC12S-PRO on the Pi's right end, pads IN · G · G · OUT along its front edge
	const BEC = { x: piCase.w / 2 + 2.3, y: -17, z: 78 };
	const becPad = { in: -8, g1: -11.8, g2: -15.6, out: -19.4 };
	add(box(1.6, 24, 35), M(COL.bec, { r: 0.45 }), BEC.x, BEC.y, BEC.z);
	add(box(4.5, 9, 9), M(0x8e9392, { r: 0.35, m: 0.7 }), BEC.x + 3, BEC.y - 2, BEC.z + 6);
	for (const y of Object.values(becPad)) add(box(0.4, 2.4, 3), padMaterial, BEC.x + 0.9, y, BEC.z - 15.5);
	// Logitech C920-C on its bracket at the front, tilted 12° down
	const camera = new Group();
	camera.position.set(0, -28, -110);
	camera.rotation.x = (-12 * Math.PI) / 180;
	layout.add(camera);
	add(box(94, 29, 24), M(0x141617, { r: 0.4 }), 0, 0, 0, camera);
	add(cyl(9.5, 3, 28), M(COL.lens, { r: 0.15, m: 0.4 }), 0, 0, -12.6, camera).rotation.x = Math.PI / 2;
	add(new TorusGeometry(10, 1.1, 8, 28), M(0x6b7270, { r: 0.3, m: 0.8 }), 0, 0, -14, camera);
	add(box(8, 3, 1), M(0xe8e9e8, { r: 0.6 }), -32, 6, -12.3, camera);
	add(box(30, 14, 3), M(0x2d3230, { r: 0.5, m: 0.4 }), 0, -6.6, -84);
	add(box(30, 3, 26), M(0x2d3230, { r: 0.5, m: 0.4 }), 0, -12.5, -96);
	// Plugs: the FC's USB cable in a blue port, USB-C power, the webcam's 90° adapter, the modem extension
	add(box(12, 7.5, 13), M(0x2a2e2c, { r: 0.5 }), portX - 6, -9, 76);
	add(box(9, 4, 13), M(0x161817, { r: 0.5 }), 30, -20, 121);
	add(box(14, 9, 14), M(0x161817, { r: 0.5 }), portX - 7, -24, 58);
	add(box(12, 7.5, 13), M(0x161817, { r: 0.5 }), portX - 6, -9, 58);
	// ZTE MF833 tied along the rear-left leg
	const legA = legTop(-1, 1), legB = legFoot(-1, 1), legDir = legB.clone().sub(legA).normalize();
	const modemAt = legA.clone().lerp(legB, 0.52).add(v(-9, 0, 9));
	add(box(28, 85, 11), M(0xf1f0ec, { r: 0.5 }), modemAt.x, modemAt.y, modemAt.z).quaternion.setFromUnitVectors(UP, legDir.clone().negate());
	const modemTop = modemAt.clone().addScaledVector(legDir, -44);
	// 4G signal rings rising from the modem
	const ringGeometry = new TorusGeometry(20, 1.2, 8, 48);
	const rings = [0, 1, 2].map(() => {
		const ring = add(ringGeometry, new MeshBasicMaterial({ color: 0x5cc8ff, transparent: true, opacity: 0, depthWrite: false }), modemAt.x, modemAt.y, modemAt.z);
		ring.rotation.x = Math.PI / 2;
		return ring;
	});

	/* ---------- The rest of the wiring ---------- */
	// Battery → XT60 → switch → pair B
	wire([WIRE.red, WIRE.black], 1.7, [v(-8, -8, 33.5), v(-18, -10, 41), v(-32, -12, 41), v(-34, -12, 34)]);
	wire([WIRE.red, WIRE.black], 1.7, [v(-34, -12, 2.6), v(-32, -10, -5), v(-27, -7, -11), v(-24.6, -6.5, -14)]);
	wire([WIRE.red, WIRE.black], 1.7, [v(-55.4, -6.5, -14), v(-59, -4, -12), v(-50, -1, -8), v(-48, 1.5, -5), v(-43, 2.8, -2), v(-39, 2.8, 0)]);
	// Pair IO → the IO board's battery pads (12 AWG)
	wire([WIRE.red, WIRE.black], 1.75, [v(23, 2.8, -23), v(25, 16, -24), v(22, 34, -22), v(22, 44, -22), v(19, 50.5, -14), v(16, 50.6, -9)]);
	// Pair U → BEC IN and G (20 AWG), then BEC OUT and G → USB-C cable → the Pi
	const inY = (becPad.in + becPad.g1) / 2, outY = (becPad.out + becPad.g2) / 2;
	wire([WIRE.red, WIRE.black], 0.85, [v(23, 2.6, 23), v(36, 3.5, 32), v(54, 2, 44), v(57, -2, 52), v(BEC.x + 2, inY + 1, BEC.z - 19), v(BEC.x + 1.2, inY, BEC.z - 15.8)]);
	wire([WIRE.black], 1.8, [v(BEC.x + 1.2, outY, BEC.z - 15.8), v(BEC.x + 7, -24, BEC.z - 20), v(BEC.x + 8, -31, 92), v(46, -30, 126), v(30, -20, 128)]);
	// Top plate: the 8-pin cable to the FC, SBUS to the receiver, the buzzer
	wire([WIRE.uart], 1.1, [v(0, TY + 9, 12.5), v(-4, TY + 15, 13.5), v(-6, TY + 13, FCZ - 18), v(-6, TY + 8.6, FCZ - 15)]);
	wire([WIRE.sbus], 1, [v(18.5, TY + 8, FCZ + 4), v(28, TY + 11, FCZ - 4), v(34, TY + 12, 0), v(33, TY + 9, -30)]);
	wire([WIRE.signal], 0.55, [v(-32, TY + 6, 31), v(-24, TY + 8, 30), v(-18.5, TY + 8, 28)]);
	// Antenna A flat along the front-right arm, antenna B up its tube
	const frontRight = v(1, 0, -1).normalize();
	wire([WIRE.coax], 1.6, [v(48, TY + 4, -40), v(58, 41, -54), frontRight.clone().multiplyScalar(88).setY(39.4), frontRight.clone().multiplyScalar(150).setY(38.6)]);
	wire([WIRE.coax], 0.7, [v(42, TY + 4, -33), v(46, TY + 12, -22), v(46, TY + 70, -18)]);
	// FC USB-C → over the rear edge → the Pi's blue USB 3 port
	wire([WIRE.usb], 2, [v(6, TY + 9.4, FCZ + 21), v(4, TY + 6, 54), v(2, 36, 55), v(-20, 20, 60), v(-44, 5, 64), v(-56, -5, 71), v(-60, -9, 76), v(portX - 10, -9, 76)]);
	// Webcam cable, coiled flat under the battery, to a black USB 2 port
	const coil = Array.from({ length: 29 }, (_, i) => {
		const t = (i / 28) * Math.PI * 2;
		return v(-22 * Math.sin(t), -30.5, -40 + 26 * Math.sin(t) * Math.cos(t) - 12 * Math.cos(t));
	});
	wire([WIRE.usb], 1.9, [v(-40, -26, -104), v(-36, -30, -84), v(-18, -32, -70), ...coil, v(-24, -31, -2), v(-56, -30, 30), v(-62, -27, 50), v(portX - 14, -24, 58)]);
	// Modem extension: black USB 2 port → down the rear-left leg
	wire([WIRE.net], 2.3, [v(portX - 12, -9, 58), v(portX - 18, -10, 58), v(-66, -24, 56), v(modemTop.x + 4, modemTop.y + 18, modemTop.z - 4), v(modemTop.x, modemTop.y + 2, modemTop.z)]);

	/* ---------- Floor and labels ---------- */
	const shadow = contactShadow(0.24, 0.3);
	shadow.position.y = -0.235;
	ctx.root.add(shadow);

	// Labels hang off points just outside each part, so they don't cover it.
	const anchor = (x: number, y: number, z: number) => {
		const point = new Group();
		point.position.set(x, y, z);
		layout.add(point);
		return point;
	};
	// One part is called out at a time (a guided tour). The still frame (reduced motion) shows only the four marked
	// `still`, which sit apart from the starting camera; all eight at once would pile up in the middle.
	const tourClass = "opacity-0 transition-opacity duration-500 data-[on]:opacity-100";
	const tour = [
		{ el: ctx.label("MicoAir743 V2 flight controller", anchor(0, TY + 26, FCZ + 7), tourClass), still: true },
		{ el: ctx.label("IO board, the power hub", anchor(0, TY + 22, -8), tourClass) },
		{ el: ctx.label("MC7RE receiver", anchor(40, TY + 22, -46), tourClass) },
		{ el: ctx.label("Logitech C920-C webcam", anchor(0, -62, -140), tourClass), still: true },
		{ el: ctx.label("3S 2200 mAh LiPo", anchor(0, -45, -40), tourClass) },
		{ el: ctx.label("Raspberry Pi 4", anchor(0, -50, 110), tourClass), still: true },
		{ el: ctx.label("Matek BEC for the Pi", anchor(BEC.x + 24, -17, BEC.z), tourClass) },
		{ el: ctx.label("ZTE MF833 4G modem", anchor(-100, -150, 100), tourClass), still: true },
	];
	let shown = -1;

	return {
		update(t, dt) {
			// Still frame: the `still` labels; otherwise one label at a time, 2.5 s each.
			const current = dt === 0 ? -2 : Math.floor(t / 2.5) % tour.length;
			if (current !== shown) {
				shown = current;
				tour.forEach(({ el, still }, i) => el.toggleAttribute("data-on", current === -2 ? !!still : i === current));
			}
			// Hover: a slow bob with a little sway.
			drone.position.y = Math.sin(t * 1.6) * 0.012;
			drone.rotation.z = Math.sin(t * 0.9) * 0.035;
			drone.rotation.x = Math.sin(t * 0.7 + 1) * 0.03;
			if (dt > 0) {
				for (const { hub, cw } of props) hub.rotation.y += (cw ? -1 : 1) * dt * 30;
			}
			discMaterial.opacity = dt > 0 ? 0.06 : 0;
			(statusLed.material as MeshStandardMaterial).emissiveIntensity = Math.sin(t * 5) > 0.2 ? 2.4 : 0.2;
			rings.forEach((ring, i) => {
				const phase = ((t * 0.7 + i / 3) % 1 + 1) % 1;
				ring.scale.setScalar(1 + phase * 3);
				ring.position.y = modemAt.y + phase * 30;
				(ring.material as MeshBasicMaterial).opacity = dt > 0 ? (1 - phase) * 0.8 : 0;
			});
		},
		applyPalette(p) {
			(shadow.material as MeshBasicMaterial).opacity = p.dark ? 0.55 : 0.28;
		},
	};
}
