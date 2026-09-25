/**
 * Simplified 3D model of Team 10951's 2026 robot, modelled on public/assets/FRCnew.jpg.
 * Not CAD: proportions are approximate. ~1 unit = 1 m (a 28" × 28" frame).
 *
 * A game piece is picked up by the intake, carried up the indexer and launched by the shooter, on a loop.
 */
import {
	BoxGeometry,
	CatmullRomCurve3,
	CylinderGeometry,
	DoubleSide,
	ExtrudeGeometry,
	Group,
	Mesh,
	type MeshBasicMaterial,
	MeshStandardMaterial,
	PlaneGeometry,
	Shape,
	SphereGeometry,
	Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { contactShadow, type Model, type StageContext, type StageView, standard, textTexture } from "../stage";

export const view: StageView = {
	camera: [1.55, 0.95, 1.75],
	target: [0, 0.26, 0],
	fov: 34,
	spin: 0.22,
	minPolar: 0.55,
	maxPolar: 1.45,
};

const X_AXIS = Math.PI / 2; // rotate a y-axis cylinder onto the x axis

export default function createRobot(ctx: StageContext): Model {
	const aluminium = standard(0xc5ccd6, { metalness: 0.85, roughness: 0.35 });
	const darkAluminium = standard(0x2a2f37, { metalness: 0.6, roughness: 0.45 });
	const rubber = standard(0x16181c, { roughness: 0.92 });
	const bumperFabric = standard(0x1f4fd1, { roughness: 0.8 });
	const red = standard(0xd6333b, { roughness: 0.6 });
	const green = standard(0x3ca55c, { roughness: 0.7 });
	const white = standard(0xeef1f4, { roughness: 0.5 });
	const black = standard(0x15181d, { roughness: 0.5 });
	const blue = standard(0x1f4fd1, { roughness: 0.5 });
	const polycarbonate = new MeshStandardMaterial({
		color: 0xdfeaf5,
		transparent: true,
		opacity: 0.16,
		roughness: 0.08,
		depthWrite: false,
		side: DoubleSide,
	});
	const ballMaterial = standard(0xffc20e, { roughness: 0.85 });
	const signalLight = standard(0xff7a00, { emissive: 0xff7a00, emissiveIntensity: 2 });

	const robot = new Group();
	ctx.root.add(robot);
	const add = (geometry: ConstructorParameters<typeof Mesh>[0], material: MeshStandardMaterial, x = 0, y = 0, z = 0, parent: Group = robot) => {
		const mesh = new Mesh(geometry, material);
		mesh.position.set(x, y, z);
		parent.add(mesh);
		return mesh;
	};

	/* ---------- Drivetrain: frame, belly pan, six wheels ---------- */
	const drivetrain = new Group();
	robot.add(drivetrain);
	for (const x of [-0.33, 0.33, -0.235, 0.235]) add(new BoxGeometry(0.05, 0.05, 0.72), aluminium, x, 0.1, 0, drivetrain);
	for (const z of [-0.335, 0.335]) add(new BoxGeometry(0.61, 0.05, 0.05), aluminium, 0, 0.1, z, drivetrain);
	add(new BoxGeometry(0.62, 0.006, 0.66), darkAluminium, 0, 0.078, 0, drivetrain);

	const wheels: Mesh[] = [];
	const wheelGeometry = new CylinderGeometry(0.051, 0.051, 0.035, 28);
	const hubGeometry = new CylinderGeometry(0.02, 0.02, 0.037, 12);
	for (const x of [-0.285, 0.285]) {
		for (const z of [-0.24, 0, 0.24]) {
			const wheel = add(wheelGeometry, rubber, x, 0.051, z, drivetrain);
			wheel.rotation.z = X_AXIS;
			const hub = new Mesh(hubGeometry, aluminium);
			wheel.add(hub);
			wheels.push(wheel);
		}
	}
	// Gearboxes with drive motors
	const motorGeometry = new CylinderGeometry(0.03, 0.03, 0.1, 20);
	for (const x of [-0.235, 0.235]) {
		add(new BoxGeometry(0.07, 0.07, 0.09), darkAluminium, x * 0.72, 0.14, 0, drivetrain);
		const motor = add(motorGeometry, black, x * 0.72, 0.14, 0.1, drivetrain);
		motor.rotation.x = X_AXIS;
	}

	/* ---------- Bumpers with the team number ---------- */
	const sideBumper = new RoundedBoxGeometry(0.075, 0.12, 0.87, 3, 0.03);
	const endBumper = new RoundedBoxGeometry(0.71, 0.12, 0.075, 3, 0.03);
	add(sideBumper, bumperFabric, -0.3925, 0.115, 0);
	add(sideBumper, bumperFabric, 0.3925, 0.115, 0);
	add(endBumper, bumperFabric, 0, 0.115, -0.3925);
	add(endBumper, bumperFabric, 0, 0.115, 0.3925);
	const numberTexture = textTexture("10951");
	const numberMaterial = new MeshStandardMaterial({ map: numberTexture, transparent: true, roughness: 0.8, depthWrite: false });
	const numberGeometry = new PlaneGeometry(0.4, 0.1);
	const numbers: Array<[number, number, number, number]> = [
		[0.4305, 0.115, 0, Math.PI / 2],
		[-0.4305, 0.115, 0, -Math.PI / 2],
		[0, 0.115, -0.4305, Math.PI],
		[0, 0.115, 0.4305, 0],
	];
	for (const [x, y, z, rotation] of numbers) {
		const plane = new Mesh(numberGeometry, numberMaterial);
		plane.position.set(x, y, z);
		plane.rotation.y = rotation;
		robot.add(plane);
	}

	/* ---------- Intake: red star wheels and green compliant wheels ---------- */
	const intake = new Group();
	robot.add(intake);
	for (const x of [-0.3, 0.3]) add(new BoxGeometry(0.012, 0.2, 0.3), black, x, 0.2, 0.42, intake);

	const star = new Shape();
	const points = 8;
	for (let i = 0; i <= points * 2; i++) {
		const r = i % 2 === 0 ? 0.05 : 0.027;
		const a = (i / (points * 2)) * Math.PI * 2;
		if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
		else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
	}
	const starGeometry = new ExtrudeGeometry(star, { depth: 0.014, bevelEnabled: false });
	starGeometry.translate(0, 0, -0.007);
	const shaftGeometry = new CylinderGeometry(0.008, 0.008, 0.6, 10);

	const makeRoller = (y: number, z: number) => {
		const roller = new Group();
		roller.position.set(0, y, z);
		const shaft = new Mesh(shaftGeometry, aluminium);
		shaft.rotation.z = X_AXIS;
		roller.add(shaft);
		intake.add(roller);
		return roller;
	};
	const lowRoller = makeRoller(0.13, 0.52);
	for (const x of [-0.22, -0.11, 0, 0.11, 0.22]) {
		const wheel = new Mesh(starGeometry, red);
		wheel.position.x = x;
		wheel.rotation.y = Math.PI / 2;
		lowRoller.add(wheel);
	}
	const highRoller = makeRoller(0.25, 0.46);
	const compliantGeometry = new CylinderGeometry(0.036, 0.036, 0.024, 18);
	for (const x of [-0.18, -0.06, 0.06, 0.18]) {
		const wheel = new Mesh(compliantGeometry, green);
		wheel.position.x = x;
		wheel.rotation.z = X_AXIS;
		highRoller.add(wheel);
	}

	/* ---------- Indexer: curved ribs (white / blue / black) and belt rollers ---------- */
	const indexer = new Group();
	indexer.position.set(0, 0.12, 0);
	robot.add(indexer);
	const rib = new Shape();
	rib.moveTo(0.3, 0);
	rib.absarc(0, 0, 0.3, 0, Math.PI / 2, false);
	rib.lineTo(0, 0.255);
	rib.absarc(0, 0, 0.255, Math.PI / 2, 0, true);
	rib.closePath();
	const ribGeometry = new ExtrudeGeometry(rib, { depth: 0.012, bevelEnabled: false, curveSegments: 24 });
	const ribColors = [white, blue, black];
	[-0.18, -0.108, -0.036, 0.036, 0.108, 0.18].forEach((x, i) => {
		const mesh = new Mesh(ribGeometry, ribColors[i % 3]);
		mesh.rotation.y = -Math.PI / 2;
		mesh.position.x = x + 0.006;
		indexer.add(mesh);
	});
	const beltRollers: Mesh[] = [];
	const beltGeometry = new CylinderGeometry(0.02, 0.02, 0.37, 14);
	for (const degrees of [18, 45, 72]) {
		const a = (degrees * Math.PI) / 180;
		const roller = new Mesh(beltGeometry, black);
		roller.rotation.z = X_AXIS;
		roller.position.set(0, Math.sin(a) * 0.2775, Math.cos(a) * 0.2775);
		indexer.add(roller);
		beltRollers.push(roller);
	}
	// Mechanism motor (a Kraken, as on the real robot)
	const krakenCap = new CylinderGeometry(0.031, 0.031, 0.012, 20);
	const indexerMotor = add(motorGeometry, black, 0.25, 0.3, 0.2);
	indexerMotor.rotation.z = X_AXIS;
	const cap = new Mesh(krakenCap, aluminium);
	cap.position.y = -0.05;
	indexerMotor.add(cap);

	/* ---------- Hopper and shooter ---------- */
	add(new BoxGeometry(0.42, 0.2, 0.34), polycarbonate, 0, 0.53, -0.08);
	const shooter = new Group();
	shooter.position.set(0, 0.47, -0.24);
	robot.add(shooter);
	const shooterShaft = new Mesh(new CylinderGeometry(0.01, 0.01, 0.4, 10), aluminium);
	shooterShaft.rotation.z = X_AXIS;
	shooter.add(shooterShaft);
	const flywheels = new Group();
	shooter.add(flywheels);
	const flywheelGeometry = new CylinderGeometry(0.045, 0.045, 0.1, 28);
	for (const x of [-0.09, 0.09]) {
		const wheel = new Mesh(flywheelGeometry, darkAluminium);
		wheel.rotation.z = X_AXIS;
		wheel.position.x = x;
		flywheels.add(wheel);
	}
	const hood = new Mesh(new CylinderGeometry(0.1, 0.1, 0.34, 24, 1, true, Math.PI / 2 - 0.2, Math.PI / 2 + 0.5), aluminium);
	hood.material = hood.material.clone();
	(hood.material as MeshStandardMaterial).side = DoubleSide;
	hood.rotation.z = X_AXIS;
	shooter.add(hood);
	const shooterMotor = new Mesh(motorGeometry, black);
	shooterMotor.rotation.z = X_AXIS;
	shooterMotor.position.x = 0.25;
	shooter.add(shooterMotor);

	/* ---------- Controls: roboRIO (2026 season; SystemCore replaces it after) and robot signal light ---------- */
	add(new BoxGeometry(0.14, 0.03, 0.1), standard(0xc8ccd2, { metalness: 0.4, roughness: 0.4 }), 0, 0.095, -0.2);
	const rsl = add(new CylinderGeometry(0.02, 0.02, 0.035, 16), signalLight, -0.21, 0.58, 0.14);

	/* ---------- Game pieces ---------- */
	const path = new CatmullRomCurve3([
		new Vector3(0, 0.075, 1.0),
		new Vector3(0, 0.085, 0.66),
		new Vector3(0, 0.15, 0.5),
		...[20, 50, 80].map((d) => {
			const a = (d * Math.PI) / 180;
			return new Vector3(0, 0.12 + Math.sin(a) * 0.2775, Math.cos(a) * 0.2775);
		}),
		new Vector3(0, 0.47, -0.08),
		new Vector3(0, 0.52, -0.25),
	]);
	const ballGeometry = new SphereGeometry(0.075, 24, 16);
	const balls = [0, 0.5].map((offset) => {
		const ball = new Mesh(ballGeometry, ballMaterial);
		robot.add(ball);
		return { ball, offset };
	});
	const PERIOD = 3.6;
	const launch = new Vector3(0, 0.52, -0.25);
	const placeBall = (ball: Mesh, t: number) => {
		const phase = t % PERIOD;
		if (phase < 2.2) {
			const u = phase / 2.2;
			ball.position.copy(path.getPointAt(u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2));
			ball.scale.setScalar(Math.min(1, phase / 0.25));
			ball.rotation.x -= 0.12;
			ball.visible = true;
		} else if (phase < 3.0) {
			const s = phase - 2.2;
			ball.position.set(0, launch.y + 3.0 * s - 4.9 * s * s, launch.z - 3.2 * s);
			ball.scale.setScalar(1 - Math.max(0, (s - 0.55) / 0.25));
			ball.visible = true;
		} else {
			ball.visible = false;
		}
	};

	/* ---------- Floor, labels ---------- */
	const shadow = contactShadow(0.85);
	robot.add(shadow);
	ctx.label("Intake", lowRoller, "max-sm:hidden");
	ctx.label("Indexer", beltRollers[1], "max-sm:hidden");
	ctx.label("Shooter", flywheels, "max-sm:hidden");
	ctx.label("6-wheel drive", wheels[2], "max-sm:hidden");

	// Still pose (reduced motion): one ball mid-indexer.
	balls[0].ball.position.copy(path.getPointAt(0.62));
	balls[1].ball.visible = false;

	return {
		update(t, dt) {
			if (dt === 0) return;
			for (const wheel of wheels) wheel.rotation.x -= dt * 2.4;
			lowRoller.rotation.x -= dt * 9;
			highRoller.rotation.x -= dt * 9;
			for (const roller of beltRollers) roller.rotation.x -= dt * 7;
			flywheels.rotation.x -= dt * 26;
			(rsl.material as MeshStandardMaterial).emissiveIntensity = Math.sin(t * 7) > 0 ? 2.2 : 0.15;
			for (const { ball, offset } of balls) placeBall(ball, t + offset * PERIOD);
		},
		applyPalette(p) {
			(shadow.material as MeshBasicMaterial).opacity = p.dark ? 0.6 : 0.32;
		},
	};
}
