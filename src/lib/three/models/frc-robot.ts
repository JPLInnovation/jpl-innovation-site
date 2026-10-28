/**
 * Team 10951's 2026 robot in 3D: the KitBot platform as the team built and modified it, from the team's own CAD export
 * (CAD/Modified Kitbot 2026 10951.glb; scripts/kitbot-cad.py). The real changes from the stock kit: the two intake
 * side fins removed, a reworked indexer (green wheels), an extended see-through hopper, and the Kraken X60 motors
 * that drive the indexer and launcher moved outside the side plate instead of inside the frame.
 *
 * frc-robot-cad.json is the CAD reduced to simple shapes (scripts/kitbot-cad.py turns the 142 MB export in CAD/,
 * which stays out of the repo, into these 50 KB):
 *   - round parts (wheels, rollers, motors, pulleys, gears, spacers) are their real side profile, revolved, and
 *     coloured section by section by the CAD material on their outside
 *   - everything else (plates, panels, bumpers, belts, frame rails, hood) is its real outline, extruded to its
 *     real thickness
 * Every part sits exactly where the CAD puts it, in the CAD's colours, except the hopper, which is see-through
 * (it's polycarbonate on the real robot) so the stored FUEL shows. Fasteners, bearings and small holes are left
 * out. Metres; y up; the intake end faces +z; wheels on y = 0.
 *
 * How FUEL moves: the intake rollers pull a ball off the floor and up the intake ramp into the hopper, whose floor
 * slopes back down to the feeder roller. To shoot, the feeder pushes it up between the rollers into the launcher
 * wheel, which flings it up the curved hood and out of the top.
 *
 * buildRobot() is the robot on its own, for the FRC page's scroll showcase (./frc-robot-showcase.ts); the default
 * export adds the idle tour of labels for the plain 3D viewer.
 */
import {
	BufferAttribute,
	type BufferGeometry,
	CatmullRomCurve3,
	Color,
	DoubleSide,
	ExtrudeGeometry,
	Group,
	LatheGeometry,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	type MeshBasicMaterial,
	Object3D,
	Path,
	Shape,
	SphereGeometry,
	Vector2,
	Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { type Finish, hardware } from "../finish";
import { contactShadow, type Model, type StageContext, type StageView } from "../stage";
import cadJson from "./frc-robot-cad.json";

export const view: StageView = {
	camera: [1.3, 0.95, 1.45],
	target: [0, 0.22, 0],
	fov: 34,
	spin: 0.22,
	minPolar: 0.5,
	maxPolar: 1.45,
	fitWidth: 1.25,
};

interface CadData {
	/** CAD colours, "#rrggbb". */
	materials: string[];
	/** Materials drawn see-through: the hopper, so the FUEL inside shows. */
	clear: number[];
	/** Lathe: p = [radius, height, ...]. Extrude: o = outer loops, h = holes ([x, y, ...]), d = depth, r = rounded edges. */
	shapes: Array<{ p: number[] } | { o: number[][]; h: number[][]; d: number; r?: number }>;
	/** Roller shafts (y, z), intake first: intake, second intake roller, launcher, feeder. */
	rotors: [number, number][];
	anchors: Record<string, [number, number, number]>;
	/** s = shape, c = material, m = 3x4 matrix (column-major) into site coordinates, g = rotor index. */
	parts: Array<{ s: number; c: number; m: number[]; g?: number }>;
}
const cad = cadJson as unknown as CadData;

/** Named points in the CAD (intake, launcher, hood, hopper, cim, battery), metres. */
export const robotAnchors = cad.anchors as Record<string, [number, number, number]>;

const BALL_R = 0.075; // FUEL: a 150 mm foam ball

/**
 * How a CAD colour is lit. The CAD names no materials, so this only reads the colour: the bumper blue is cloth,
 * near-black is rubber and plastic, plain mid greys are bare aluminium, everything else (white panels, coloured
 * parts) is plastic. The colour itself is always the CAD's.
 */
function finishOf(hex: string): Finish {
	if (hex === "#1651b0") return "fabric";
	const c = new Color(hex);
	const max = Math.max(c.r, c.g, c.b);
	const min = Math.min(c.r, c.g, c.b);
	const value = c.getHSL({ h: 0, s: 0, l: 0 }).l;
	if (max - min < 0.04 && value > 0.12 && value < 0.55) return "anodised"; // linear values: about #646464 to #c4c4c4
	if (value <= 0.12) return "rubber";
	return "plastic";
}

type V3 = [number, number, number];

/** One CAD part, as buildRobot's `tag` sees it. */
export interface RobotPart {
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
	/** Spins the rollers and moves the FUEL. dt = 0 for a still frame. */
	animate(t: number, dt: number): void;
	/** Puts the FUEL where it is at `t` seconds into its loop, without moving anything else. */
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

	/* ---------- CAD parts ---------- */
	const pairs = (flat: number[]) => {
		const out: Vector2[] = [];
		for (let i = 0; i < flat.length; i += 2) out.push(new Vector2(flat[i], flat[i + 1]));
		return out;
	};
	const inside = (p: Vector2, poly: Vector2[]) => {
		let c = false;
		for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
			const a = poly[i], b = poly[j];
			if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
		}
		return c;
	};
	const shapes: BufferGeometry[] = cad.shapes.map((s) => {
		if ("p" in s) {
			const points = pairs(s.p);
			const r = Math.max(...points.map((p) => p.x));
			// More segments than before (was 16-48): round parts (wheels, pulleys, motors) are seen close up on this
			// page's pinned scroll, where a visibly faceted edge reads as low quality; this stays cheap because only
			// the round parts' segment count grows, not the frame and panel geometry around them.
			return new LatheGeometry(points, Math.min(64, Math.max(20, Math.round(r * 650)))).toNonIndexed();
		}
		const outers = s.o.map(pairs);
		const list = outers.map((o) => new Shape(o));
		for (const h of s.h) {
			const points = pairs(h);
			list[Math.max(0, outers.findIndex((o) => inside(points[0], o)))].holes.push(new Path(points));
		}
		if (s.r) {
			// Pool-noodle bumpers: round the top and bottom edges without growing the outline.
			const g = new ExtrudeGeometry(list, {
				depth: s.d - 2 * s.r,
				bevelEnabled: true,
				bevelThickness: s.r,
				bevelSize: s.r,
				bevelOffset: -s.r,
				bevelSegments: 4,
				curveSegments: 1,
			});
			return g.translate(0, 0, s.r);
		}
		return new ExtrudeGeometry(list, { depth: s.d, bevelEnabled: false, curveSegments: 1 });
	});
	const materials = cad.materials.map((c, i) =>
		cad.clear.includes(i)
			? hardware({ color: c, transparent: true, opacity: 0.28, roughness: 0.12, metalness: 0, depthWrite: false, side: DoubleSide }, "clear")
			: hardware({ color: new Color(c), roughness: 0.55, metalness: 0.15 }, finishOf(c)),
	);

	// The roller shafts spin, with everything mounted on them.
	const rotors = cad.rotors.map(([y, z]) => {
		const g = new Group();
		g.position.set(0, y, z);
		robot.add(g);
		return g;
	});
	const buckets = new Map<string, { geometries: BufferGeometry[]; material: number; rotor: number }>();
	const m4 = new Matrix4();
	const placed = cad.parts.map((part) => {
		const m = part.m;
		m4.fromArray([m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, m[9], m[10], m[11], 1]);
		return shapes[part.s].clone().applyMatrix4(m4);
	});
	const features = tag?.(
		placed.map((geometry, i) => {
			geometry.computeBoundingBox();
			const { min, max } = geometry.boundingBox!;
			const c = cad.parts[i].c;
			return { color: cad.materials[c], clear: cad.clear.includes(c), rotor: cad.parts[i].g ?? -1, lo: min.toArray(), hi: max.toArray() };
		}),
	);
	cad.parts.forEach((part, i) => {
		const geometry = placed[i];
		const rotor = part.g ?? -1;
		if (rotor >= 0) geometry.translate(0, -cad.rotors[rotor][0], -cad.rotors[rotor][1]);
		if (features) {
			const count = geometry.getAttribute("position").count;
			geometry.setAttribute("feature", new BufferAttribute(new Float32Array(count).fill(features[i] ?? 0), 1));
		}
		const key = `${rotor}:${part.c}`;
		const bucket = buckets.get(key) ?? { geometries: [], material: part.c, rotor };
		bucket.geometries.push(geometry);
		buckets.set(key, bucket);
	});
	for (const { geometries, material, rotor } of buckets.values()) {
		(rotor >= 0 ? rotors[rotor] : robot).add(new Mesh(mergeGeometries(geometries, false), materials[material]));
		geometries.forEach((g) => g.dispose());
	}
	shapes.forEach((g) => g.dispose());

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
	const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
	const placeBall = (ball: Mesh, t: number) => {
		const phase = t % PERIOD;
		ball.visible = phase < 3.9;
		ball.scale.setScalar(1);
		if (phase < 1.5) {
			ball.position.copy(intakePath.getPointAt(easeInOut(phase / 1.5)));
			ball.scale.setScalar(Math.min(1, phase / 0.3));
			ball.rotation.x -= 0.12;
		} else if (phase < 2.2) {
			ball.position.copy(intakePath.getPointAt(1)); // waits in the hopper, against the feeder
		} else if (phase < 2.8) {
			const u = (phase - 2.2) / 0.6;
			ball.position.copy(feedPath.getPointAt(u * u)); // speeds up as the launcher wheel grabs it
			ball.scale.setScalar(u > 0.45 && u < 0.95 ? 0.86 : 1); // squashed between the wheel and the hood
			ball.rotation.x += 0.3;
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
		anchors: robotAnchors,
		anchor,
		balls: balls.map((b) => b.ball),
		materials: (color) => (color === "numbers" ? numbers : materials.filter((_, i) => cad.materials[i] === color)),
		animate(t, dt) {
			if (dt === 0) return;
			// Positive rotation about x: a roller's underside moves back, its front face down.
			rotors[0].rotation.x += dt * 9; // intake rollers pull the ball in underneath
			rotors[1].rotation.x += dt * 9;
			rotors[2].rotation.x -= dt * 18; // launcher wheel: front face up, along the hood
			rotors[3].rotation.x -= dt * 8; // feeder pushes the ball forward into the launcher
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
