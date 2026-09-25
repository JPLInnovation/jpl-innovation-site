/**
 * The F450 4G drone in 3D, built from the parts list in src/data/drone.ts. Real scale (1 unit = 1 m):
 * 450 mm motor-to-motor diagonal and 10" (1045) props. Front is +z; the front arms are red like the real frame.
 * Props spin in the standard quad-X pattern: front-left and rear-right clockwise, the other two counter-clockwise.
 */
import {
	BoxGeometry,
	CircleGeometry,
	CylinderGeometry,
	DoubleSide,
	Group,
	Mesh,
	MeshBasicMaterial,
	type MeshStandardMaterial,
	type Object3D,
	TorusGeometry,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { contactShadow, type Model, type StageContext, type StageView, standard } from "../stage";

export const view: StageView = {
	camera: [0.6, 0.46, 0.84],
	target: [0, 0.02, 0],
	fov: 36,
	fitWidth: 0.8,
	spin: 0.18,
	minPolar: 0.35,
	maxPolar: 1.5,
};

const ARM_REACH = 0.225; // centre to motor (450 mm diagonal / 2)

export default function createDrone(ctx: StageContext): Model {
	const plateMaterial = standard(0x1d2430, { roughness: 0.6 });
	const frontArm = standard(0xd92b3a, { roughness: 0.45 });
	const rearArm = standard(0xe8ecf1, { roughness: 0.45 });
	const motorBell = standard(0x3a3f47, { metalness: 0.8, roughness: 0.3 });
	const propMaterial = standard(0x15171b, { roughness: 0.4 });
	const board = standard(0x0f1a2b, { roughness: 0.5 });
	const piGreen = standard(0x1f6f43, { roughness: 0.55 });
	const chip = standard(0x111316, { roughness: 0.35 });
	const modemWhite = standard(0xf1f3f5, { roughness: 0.4 });
	const battery = standard(0x2b2b2b, { roughness: 0.6 });
	const batteryLabel = standard(0xffc20e, { roughness: 0.6 });
	const escBlue = standard(0x1f5fd1, { roughness: 0.5 });
	const lens = standard(0x0b0d10, { metalness: 0.2, roughness: 0.1 });
	const led = standard(0x1daef1, { emissive: 0x1daef1, emissiveIntensity: 2 });

	const drone = new Group();
	ctx.root.add(drone);
	const add = (mesh: Mesh, x = 0, y = 0, z = 0, parent: Object3D = drone) => {
		mesh.position.set(x, y, z);
		parent.add(mesh);
		return mesh;
	};

	/* ---------- Frame: two octagonal plates and four arms ---------- */
	const plateGeometry = new CylinderGeometry(0.075, 0.075, 0.004, 8);
	for (const y of [0, 0.045]) {
		const plate = add(new Mesh(plateGeometry, plateMaterial), 0, y, 0);
		plate.rotation.y = Math.PI / 8;
	}
	const armGeometry = new BoxGeometry(0.03, 0.024, 0.2);
	const motors: Array<{ x: number; z: number; clockwise: boolean }> = [
		{ x: -1, z: 1, clockwise: true }, // front-left
		{ x: 1, z: 1, clockwise: false }, // front-right
		{ x: -1, z: -1, clockwise: false }, // rear-left
		{ x: 1, z: -1, clockwise: true }, // rear-right
	];
	const props: Array<{ group: Group; clockwise: boolean; disc: Mesh }> = [];
	const discMaterial = new MeshBasicMaterial({ color: 0x9fb4cc, transparent: true, opacity: 0.06, depthWrite: false, side: DoubleSide });
	const motorGeometry = new CylinderGeometry(0.014, 0.014, 0.026, 24);
	const bladeGeometry = new RoundedBoxGeometry(0.125, 0.003, 0.022, 2, 0.0015);
	const discGeometry = new CircleGeometry(0.127, 48);
	const escGeometry = new BoxGeometry(0.018, 0.008, 0.045);

	for (const m of motors) {
		const angle = Math.atan2(m.x, m.z);
		const arm = add(new Mesh(armGeometry, m.z > 0 ? frontArm : rearArm), 0, 0.022, 0);
		arm.rotation.y = angle;
		arm.position.set(Math.sin(angle) * 0.13, 0.022, Math.cos(angle) * 0.13);

		const mx = Math.sin(angle) * ARM_REACH;
		const mz = Math.cos(angle) * ARM_REACH;
		add(new Mesh(motorGeometry, motorBell), mx, 0.047, mz);
		const esc = add(new Mesh(escGeometry, escBlue), Math.sin(angle) * 0.11, 0.004, Math.cos(angle) * 0.11);
		esc.rotation.y = angle;

		const prop = new Group();
		prop.position.set(mx, 0.064, mz);
		drone.add(prop);
		for (const side of [-1, 1]) {
			const blade = new Mesh(bladeGeometry, propMaterial);
			blade.position.x = side * 0.0635;
			blade.rotation.x = side * 0.14; // blade pitch
			prop.add(blade);
		}
		const disc = new Mesh(discGeometry, discMaterial);
		disc.rotation.x = -Math.PI / 2;
		disc.position.set(mx, 0.064, mz);
		drone.add(disc);
		props.push({ group: prop, clockwise: m.clockwise, disc });
	}

	/* ---------- Electronics ---------- */
	// MicoAir H743 flight controller (30 × 30 mm) with a status LED
	const fc = add(new Mesh(new BoxGeometry(0.036, 0.006, 0.036), board), 0, 0.05, 0.005);
	const statusLed = add(new Mesh(new BoxGeometry(0.004, 0.003, 0.004), led), 0.012, 0.0045, 0.012, fc);

	// Raspberry Pi Zero 2 W (65 × 30 mm) behind the flight controller
	const pi = add(new Mesh(new BoxGeometry(0.065, 0.004, 0.03), piGreen), 0, 0.052, -0.045);
	add(new Mesh(new BoxGeometry(0.012, 0.003, 0.012), chip), 0, 0.0035, 0, pi);

	// Camera Module 3 on the front edge, looking forward
	const camera = new Group();
	camera.position.set(0, 0.03, 0.078);
	drone.add(camera);
	add(new Mesh(new BoxGeometry(0.025, 0.024, 0.003), piGreen), 0, 0, 0, camera);
	const lensMesh = add(new Mesh(new CylinderGeometry(0.0045, 0.0045, 0.006, 16), lens), 0, 0.002, 0.004, camera);
	lensMesh.rotation.x = Math.PI / 2;

	// ZTE MF833 4G USB modem on the side, with signal rings
	add(new Mesh(new RoundedBoxGeometry(0.03, 0.012, 0.09, 2, 0.004), modemWhite), 0.062, 0.058, -0.02);
	const rings = [0, 1, 2].map(() => {
		const ring = new Mesh(
			new TorusGeometry(0.02, 0.0012, 8, 48),
			new MeshBasicMaterial({ color: 0x5cc8ff, transparent: true, opacity: 0, depthWrite: false }),
		);
		ring.rotation.x = Math.PI / 2;
		ring.position.set(0.062, 0.07, -0.02);
		drone.add(ring);
		return ring;
	});

	// 3S 2200 mAh LiPo strapped under the bottom plate
	const pack = add(new Mesh(new RoundedBoxGeometry(0.034, 0.025, 0.105, 2, 0.004), battery), 0, -0.016, 0);
	add(new Mesh(new BoxGeometry(0.0345, 0.012, 0.03), batteryLabel), 0, 0.001, 0, pack);
	for (const z of [-0.03, 0.03]) add(new Mesh(new BoxGeometry(0.04, 0.028, 0.008), standard(0x111111)), 0, -0.016, z);

	/* ---------- Floor and labels ---------- */
	const shadow = contactShadow(0.3, 0.3);
	shadow.position.y = -0.12;
	ctx.root.add(shadow);

	// Labels hang off points at the outer edge of each part, so they spread out instead of stacking in the middle.
	const anchor = (x: number, y: number, z: number) => {
		const point = new Group();
		point.position.set(x, y, z);
		drone.add(point);
		return point;
	};
	// One part is called out at a time (a guided tour), so labels never pile up on a model this small.
	const tourClass = "opacity-0 transition-opacity duration-500 data-[on]:opacity-100";
	const tour = [
		ctx.label("MicoAir H743 flight controller", anchor(-0.02, 0.1, 0.03), tourClass),
		ctx.label("Raspberry Pi Zero 2 W", anchor(0, 0.08, -0.11), tourClass),
		ctx.label("Camera Module 3", anchor(0, 0.02, 0.14), tourClass),
		ctx.label("ZTE MF833 4G modem", anchor(0.14, 0.07, -0.02), tourClass),
		ctx.label("3S 2200 mAh LiPo", anchor(0, -0.065, 0), tourClass),
	];
	let shown = -1;

	return {
		update(t, dt) {
			// Still frame (reduced motion) shows every label; otherwise one at a time, 2.5 s each.
			const current = dt === 0 ? -2 : Math.floor(t / 2.5) % tour.length;
			if (current !== shown) {
				shown = current;
				tour.forEach((el, i) => el.toggleAttribute("data-on", current === -2 || i === current));
			}
			// Hover: a slow bob with a little sway.
			drone.position.y = Math.sin(t * 1.6) * 0.012;
			drone.rotation.z = Math.sin(t * 0.9) * 0.035;
			drone.rotation.x = Math.sin(t * 0.7 + 1) * 0.03;
			if (dt > 0) {
				for (const { group, clockwise } of props) group.rotation.y += (clockwise ? -1 : 1) * dt * 30;
			}
			for (const { disc } of props) (disc.material as MeshBasicMaterial).opacity = dt > 0 ? 0.06 : 0;
			(statusLed.material as MeshStandardMaterial).emissiveIntensity = Math.sin(t * 5) > 0.2 ? 2.4 : 0.2;
			rings.forEach((ring, i) => {
				const phase = ((t * 0.7 + i / 3) % 1 + 1) % 1;
				ring.scale.setScalar(1 + phase * 3);
				ring.position.y = 0.07 + phase * 0.03;
				(ring.material as MeshBasicMaterial).opacity = dt > 0 ? (1 - phase) * 0.8 : 0;
			});
		},
		applyPalette(p) {
			(shadow.material as MeshBasicMaterial).opacity = p.dark ? 0.55 : 0.28;
		},
	};
}
