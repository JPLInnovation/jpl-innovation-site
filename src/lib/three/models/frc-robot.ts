/** Full source GLB geometry, with shared instances; no reconstructed shapes. */
import {
	CatmullRomCurve3,
	Group,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	type MeshBasicMaterial,
	Object3D,
	SphereGeometry,
	Vector3,
} from "three";
import { EXTENSION, loadExactRobot, turnAbout } from "./robot-exact";
import { hardware } from "../finish";
import { contactShadow, type Model, type StageContext, type StageView } from "../stage";
import anchors from "./robot-anchors.json";

export const view: StageView = {
	camera: [1.3, 0.95, 1.45],
	target: [0, 0.22, 0],
	fov: 34,
	spin: 0.22,
	minPolar: 0.5,
	maxPolar: 1.45,
	fitWidth: 1.25,
};

/** Reference points for the illustrative FUEL path, in site coordinates. */
export const robotAnchors = anchors as unknown as Record<string, [number, number, number]>;

const BALL_R = 0.075; // FUEL: a 150 mm foam ball
/**
 * The hopper extension's axis, from the arcs of the groove walls in the CAD (fitted to the walls alone, without their end
 * caps). The right groove's centre: both clamp bolts sit on its arc, while the left groove is cut 8.3 mm further back. No pin is drawn there.
 */
const HINGE = { y: 0.2888, z: -0.2772 };

type V3 = [number, number, number];

/** One CAD part, as buildRobot's `tag` sees it. */
export interface RobotPart {
	name: string;
	/** CAD colour, "#rrggbb". */
	color: string;
	/** Drawn see-through (the hopper). */
	clear: boolean;
	/** The roller shaft it turns with (index into `rotors` in the CAD file: intake, second intake, launcher, feeder), or -1. */
	rotor: number;
	/** Bounds in the robot's space, metres. */
	lo: V3;
	hi: V3;
}

export interface RobotRig {
	motion(active: boolean): void;
	isolate(feature: number): void;
	/** The whole robot, in metres, with its floor shadow. */
	model: Group;
	/** Named points in the CAD (intake, launcher, hood, hopper, cim, battery). */
	anchors: Record<string, V3>;
	/** An object at a point in the robot's own space, which moves with it. */
	anchor(at: V3): Object3D;
	/** The two FUEL balls (they share one material). */
	balls: Mesh[];
	/** The materials drawn in a CAD colour ("#rrggbb"), and the team numbers on the bumpers as "numbers". */
	materials(color: string): MeshStandardMaterial[];
	/** Turns the intake, indexer and flywheel rollers. */
	spin(dt: number): void;
	/** Swings the hopper extension: degrees from the CAD's open pose. */
	extension(degrees: number): void;
	/** Materials of their own for these parts (./robot-exact.ts). */
	own(test: (part: RobotPart) => boolean): MeshStandardMaterial[];
	/** Lifts one feature's parts and pushes the rest back, 0 to 1. */
	highlight(feature: number, level: number): void;
	/** FUEL rolling down the hopper, fed into the launcher and flung out, looped and staggered. */
	shoot(t: number): void;
	/** Moves the illustrative FUEL and turns the rollers. dt = 0 for a still frame. */
	animate(t: number, dt: number): void;
	/** Deterministically poses FUEL at `t` seconds into the demonstration. */
	pose(t: number): void;

	applyPalette(p: { dark: boolean }): void;
}

/**
 * Builds the robot into `parent`. With `tag`, every vertex of every CAD part gets a `feature` attribute (the number
 * `tag` returns for its part, in CAD order), and the bumper numbers get 0, for the scroll showcase's fading
 * (src/lib/three/showcase.ts).
 */
export async function buildRobot(parent: Object3D, tag?: (parts: RobotPart[]) => number[]): Promise<RobotRig> {
	const robot = new Group();
	parent.add(robot);

	const { materials, colors, isolate, motion, spin, group, own, highlight } = await loadExactRobot(robot, tag);
	const placeExtension = group((p) => EXTENSION.test(p.name));
	const swing = new Matrix4();
	let swung = 0;

	/* ---------- Team number on the bumpers ----------
	 * The stock kit's bumpers are moulded with "KITBOT"; the real, modified robot's CAD instead carries the team's own
	 * "10951"/"51"/"109" lettering as its own parts ("Right Bumper lettering 10951", etc.), already placed and shaped
	 * to the real bumpers, so no separate decal is drawn here: those parts render like any other CAD piece above.
	 * `numbers` stays empty for callers (the drivetrain stop's highlight, frc-robot-showcase.ts) that ask for it. */
	const numbers: MeshStandardMaterial[] = [];

	/* ---------- FUEL: floor -> intake -> hopper -> feeder -> launcher wheel -> up the hood ---------- */
	const at = (z: number, y: number) => new Vector3(0, y, z);
	// Ball centres (side view: z forward, y up), clear of the rollers and ramps except for a little squash.
	const intakePath = new CatmullRomCurve3([
		at(0.64, BALL_R), at(0.45, BALL_R), at(0.33, 0.085), at(0.275, 0.115), at(0.225, 0.165),
		at(0.17, 0.22), at(0.12, 0.25), at(0.07, 0.265), at(0.03, 0.275),
	]);
	const feedPath = new CatmullRomCurve3([
		at(0.03, 0.275), at(0.1, 0.255), at(0.16, 0.27), at(0.195, 0.33), at(0.225, 0.4), at(0.245, 0.458),
		at(0.24, 0.51), at(0.225, 0.56),
	]);
	const exit = feedPath.getPointAt(1);
	const exitDir = feedPath.getTangentAt(1);
	// Slow-motion arc that peaks about 30 cm above the hood, inside the frame.
	const flight = (ball: Mesh, s: number) =>
		ball.position.set(0, exit.y + exitDir.y * 0.9 * s - 0.7 * s * s, exit.z + exitDir.z * 0.9 * s);

	const ballGeometry = new SphereGeometry(BALL_R, 24, 16);
	const ballMaterial = hardware({ color: 0xffc20e, roughness: 0.85 }, "foam");
	const PERIOD = 5;
	const balls = [0, 0.5].map((offset) => {
		const ball = new Mesh(ballGeometry, ballMaterial);
		ball.userData.shadow = false; // it moves: the floor shadow is drawn once
		robot.add(ball);
		return { ball, offset };
	});
	// The demonstration: from inside the hopper, down the sloped floor to the feeder, then the launcher's path above.
	const rollPath = new CatmullRomCurve3([at(-0.19, 0.4), at(-0.17, 0.315), at(-0.08, 0.288), at(0, 0.268), at(0.03, 0.275)]);
	const placeShot = (ball: Mesh, t: number) => {
		const phase = t % PERIOD;
		ball.visible = phase < 2.85;
		ball.scale.setScalar(1);
		if (phase < 1.6) {
			const u = phase / 1.6;
			ball.position.copy(rollPath.getPointAt(u * u));
			ball.scale.setScalar(Math.min(1, phase / 0.25));
			ball.rotation.x = t * 7;
		} else if (phase < 2.2) {
			const u = (phase - 1.6) / 0.6;
			ball.position.copy(feedPath.getPointAt(u * u));
			ball.scale.setScalar(u > 0.45 && u < 0.95 ? 0.86 : 1);
			ball.rotation.x = t * 18;
		} else if (phase < 2.85) {
			const s = phase - 2.2;
			flight(ball, s * 0.7); // gone before it reaches the top of the window
			ball.scale.setScalar(s < 0.4 ? 1 : 1 - (s - 0.4) / 0.25);
		}
	};
	const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
	const placeBall = (ball: Mesh, t: number) => {
		const phase = t % PERIOD;
		ball.visible = phase < 3.9;
		ball.scale.setScalar(1);
		if (phase < 1.5) {
			ball.position.copy(intakePath.getPointAt(easeInOut(phase / 1.5)));
			ball.scale.setScalar(Math.min(1, phase / 0.3));
			ball.rotation.x = -t * 9;
		} else if (phase < 2.2) {
			ball.position.copy(intakePath.getPointAt(1)); // waits in the hopper, against the feeder
		} else if (phase < 2.8) {
			const u = (phase - 2.2) / 0.6;
			ball.position.copy(feedPath.getPointAt(u * u)); // speeds up as the launcher wheel grabs it
			ball.scale.setScalar(u > 0.45 && u < 0.95 ? 0.86 : 1); // squashed between the wheel and the hood
			ball.rotation.x = t * 18;
		} else if (phase < 3.9) {
			const s = phase - 2.8;
			flight(ball, s);
			ball.scale.setScalar(s < 0.8 ? 1 : 1 - (s - 0.8) / 0.3);
		}
	};

	/* ---------- Floor ---------- */
	const shadow = contactShadow(0.75, 0.35, 0.5);
	shadow.position.y = 0.002;
	robot.add(shadow);

	const anchor = ([x, y, z]: V3) => {
		const point = new Object3D();
		point.position.set(x, y, z);
		robot.add(point);
		return point;
	};

	// Still pose (reduced motion): one ball waiting in the hopper, one just launched.
	balls[0].ball.position.copy(intakePath.getPointAt(1));
	flight(balls[1].ball, 0.25);

	return {
		model: robot,
		isolate,
	motion,
		anchors: robotAnchors,
		anchor,
		balls: balls.map((b) => b.ball),
		materials: (color) => (color === "numbers" ? numbers : materials.filter((_, i) => colors[i] === color)),
		spin,
		own,
		highlight,
		extension(degrees) {
			if (degrees === swung) return;
			swung = degrees;
			placeExtension(turnAbout(swing, (degrees * Math.PI) / 180, HINGE.y, HINGE.z));
		},
		shoot(t) {
			for (const { ball, offset } of balls) placeShot(ball, t + offset * PERIOD);
		},
		animate(t, dt) {
			if (dt === 0) return;
			spin(dt);
			for (const { ball, offset } of balls) placeBall(ball, t + offset * PERIOD);
		},
		pose(t) {
			for (const { ball, offset } of balls) placeBall(ball, t + offset * PERIOD);
		},
		applyPalette(p) {
			(shadow.material as MeshBasicMaterial).opacity = p.dark ? 0.6 : 0.32;
		},
	};
}

export default async function createRobot(ctx: StageContext): Promise<Model> {
	const rig = await buildRobot(ctx.root);
	const a = rig.anchors;
	// One part is called out at a time, so labels never pile up.
	const tourClass = "opacity-0 transition-opacity duration-500 data-[on]:opacity-100";
	const tour = [
		ctx.label("Intake rollers", rig.anchor([-0.12, a.intake[1] + 0.04, a.intake[2] + 0.06]), tourClass),
		ctx.label("Hopper", rig.anchor([0, a.hopper[1] + 0.02, a.hopper[2]]), tourClass),
		ctx.label("Launcher wheel", rig.anchor([0, a.launcher[1] + 0.07, a.launcher[2]]), tourClass),
		ctx.label("Hood", rig.anchor([0, a.hood[1] + 0.12, a.hood[2]]), tourClass),
		ctx.label("CIM motors", rig.anchor([a.cim[0] + 0.1, a.cim[1], a.cim[2]]), tourClass),
		ctx.label("Battery", rig.anchor([a.battery[0], a.battery[1] + 0.06, a.battery[2]]), tourClass),
	];
	let shown = -1;

	return {
		update(t, dt) {
			const current = dt === 0 ? -2 : Math.floor(t / 2.5) % tour.length;
			if (current !== shown) {
				shown = current;
				tour.forEach((el, i) => el.toggleAttribute("data-on", current === -2 || i === current));
			}
			rig.animate(t, dt);
		},
		applyPalette: (p) => rig.applyPalette(p),
	};
}
