/**
 * Team 10951's 2026 KitBot in 3D, built from the team's Onshape CAD.
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
 */
import {
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
	PlaneGeometry,
	Shape,
	SphereGeometry,
	Vector2,
	Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { contactShadow, type Model, type StageContext, type StageView, standard, textTexture } from "../stage";
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

const BALL_R = 0.075; // FUEL: a 150 mm foam ball

export default async function createRobot(ctx: StageContext): Promise<Model> {
	const robot = new Group();
	ctx.root.add(robot);

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
			return new LatheGeometry(points, Math.min(48, Math.max(16, Math.round(r * 500)))).toNonIndexed();
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
			? new MeshStandardMaterial({ color: c, transparent: true, opacity: 0.28, roughness: 0.12, metalness: 0, depthWrite: false, side: DoubleSide })
			: standard(new Color(c), { roughness: 0.55, metalness: 0.15 }),
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
	for (const part of cad.parts) {
		const m = part.m;
		m4.fromArray([m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, m[9], m[10], m[11], 1]);
		const rotor = part.g ?? -1;
		if (rotor >= 0) m4.premultiply(new Matrix4().makeTranslation(0, -cad.rotors[rotor][0], -cad.rotors[rotor][1]));
		const key = `${rotor}:${part.c}`;
		const bucket = buckets.get(key) ?? { geometries: [], material: part.c, rotor };
		bucket.geometries.push(shapes[part.s].clone().applyMatrix4(m4));
		buckets.set(key, bucket);
	}
	for (const { geometries, material, rotor } of buckets.values()) {
		(rotor >= 0 ? rotors[rotor] : robot).add(new Mesh(mergeGeometries(geometries, false), materials[material]));
		geometries.forEach((g) => g.dispose());
	}
	shapes.forEach((g) => g.dispose());

	/* ---------- "KITBOT" on the bumpers, as in the CAD ---------- */
	await document.fonts.load('700 96px "Archivo Variable"').catch(() => undefined);
	const lettering = (text: string, width: number) => {
		const canvasWidth = text.length > 3 ? 560 : 280;
		const texture = textTexture(text, { width: canvasWidth, height: 120, font: '700 96px "Archivo Variable", "Arial", sans-serif', color: "#e8edf4" });
		return new Mesh(
			new PlaneGeometry(width, (width * 120) / canvasWidth), // letters ~66 mm tall, as on the CAD bumpers
			new MeshStandardMaterial({ map: texture, transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }),
		);
	};
	const decals: Array<[string, number, [number, number, number], number]> = [
		["KITBOT", 0.31, [0.4208, 0.137, 0.027], Math.PI / 2], // right side
		["KITBOT", 0.31, [-0.4208, 0.137, 0.027], -Math.PI / 2], // left side
		["KITBOT", 0.31, [0, 0.137, -0.4178], Math.PI], // back
		["KIT", 0.155, [-0.314, 0.137, 0.4178], 0], // front corners, either side of the intake
		["BOT", 0.155, [0.314, 0.137, 0.4178], 0],
	];
	for (const [text, width, [x, y, z], turn] of decals) {
		const mesh = lettering(text, width);
		mesh.position.set(x, y, z);
		mesh.rotation.y = turn;
		robot.add(mesh);
	}

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
	const ballMaterial = standard(0xffc20e, { roughness: 0.85 });
	const PERIOD = 5;
	const balls = [0, 0.5].map((offset) => {
		const ball = new Mesh(ballGeometry, ballMaterial);
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

	/* ---------- Floor and labels ---------- */
	const shadow = contactShadow(0.7);
	shadow.position.y = 0.002;
	robot.add(shadow);

	const anchor = ([x, y, z]: [number, number, number]) => {
		const point = new Object3D();
		point.position.set(x, y, z);
		robot.add(point);
		return point;
	};
	const a = cad.anchors;
	// One part is called out at a time, so labels never pile up.
	const tourClass = "opacity-0 transition-opacity duration-500 data-[on]:opacity-100";
	const tour = [
		ctx.label("Intake rollers", anchor([-0.12, a.intake[1] + 0.04, a.intake[2] + 0.06]), tourClass),
		ctx.label("Hopper", anchor([0, a.hopper[1] + 0.02, a.hopper[2]]), tourClass),
		ctx.label("Launcher wheel", anchor([0, a.launcher[1] + 0.07, a.launcher[2]]), tourClass),
		ctx.label("Hood", anchor([0, a.hood[1] + 0.12, a.hood[2]]), tourClass),
		ctx.label("CIM motors", anchor([a.cim[0] + 0.1, a.cim[1], a.cim[2]]), tourClass),
		ctx.label("Battery", anchor([a.battery[0], a.battery[1] + 0.06, a.battery[2]]), tourClass),
	];
	let shown = -1;

	// Still pose (reduced motion): one ball waiting in the hopper, one just launched.
	balls[0].ball.position.copy(intakePath.getPointAt(1));
	flight(balls[1].ball, 0.25);

	return {
		update(t, dt) {
			const current = dt === 0 ? -2 : Math.floor(t / 2.5) % tour.length;
			if (current !== shown) {
				shown = current;
				tour.forEach((el, i) => el.toggleAttribute("data-on", current === -2 || i === current));
			}
			if (dt === 0) return;
			// Positive rotation about x: a roller's underside moves back, its front face down.
			rotors[0].rotation.x += dt * 9; // intake rollers pull the ball in underneath
			rotors[1].rotation.x += dt * 9;
			rotors[2].rotation.x -= dt * 18; // launcher wheel: front face up, along the hood
			rotors[3].rotation.x -= dt * 8; // feeder pushes the ball forward into the launcher
			for (const { ball, offset } of balls) placeBall(ball, t + offset * PERIOD);
		},
		applyPalette(p) {
			(shadow.material as MeshBasicMaterial).opacity = p.dark ? 0.6 : 0.32;
		},
	};
}
