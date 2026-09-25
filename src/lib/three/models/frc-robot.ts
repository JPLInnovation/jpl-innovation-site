/**
 * Team 10951's 2026 robot in 3D: the official 2026 FRC KitBot layout with the team's modifications.
 *   KitBot layout: FIRST's 2026 KitBot Instruction Guide (Fuel Mechanism, Intake Base, Hopper).
 *   Team changes: photos in website-old-main/image (front: FRCnew.jpg, FRC.JPG; back: modifiedkitbot.jpg).
 * Simplified, not CAD. ~1 unit = 1 m. The robot's front (intake) faces +z; its left side is +x.
 *
 * How FUEL moves, as on the KitBot: the front intake rollers pull it off the floor and back into the clear
 * hopper. To shoot, the feeder lifts it into the launcher roller, which flings it along the hood and out of the
 * top, up and forward toward the goal. The hood wraps only the back of the launcher (about 100 degrees), so the
 * ball leaves at about 45 degrees instead of being carried over the top and backward.
 *
 * What's modelled: the aluminium frame with perforated rails and tan tread wheels; the intake (tan compliant
 * wheels under red star wheels); clear Fuel Mechanism side plates; the blue-flap/green-wheel feeder; the banded
 * launcher roller under the white/blue/black hood plates; Kraken X60s; the red robot signal light; the Limelight;
 * and the clear rear hopper with the "10951 Saigon South Dragons" decal. The roboRIO (2026 only, SystemCore
 * after) and the power hub sit under the hopper floor.
 */
import {
	BoxGeometry,
	CanvasTexture,
	CatmullRomCurve3,
	CylinderGeometry,
	DoubleSide,
	ExtrudeGeometry,
	Group,
	type Material,
	Mesh,
	type MeshBasicMaterial,
	MeshStandardMaterial,
	type Object3D,
	PlaneGeometry,
	RepeatWrapping,
	Shape,
	SphereGeometry,
	SRGBColorSpace,
	Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { contactShadow, type Model, type StageContext, type StageView, standard } from "../stage";

export const view: StageView = {
	camera: [1.5, 1.0, 1.75],
	target: [0, 0.36, 0.1],
	fov: 34,
	spin: 0.22,
	minPolar: 0.5,
	maxPolar: 1.45,
	fitWidth: 1.35,
};

const X_AXIS = Math.PI / 2; // rotate a y-axis cylinder onto the x axis
const FONT = '"Archivo Variable", "Arial Black", sans-serif';
const LOGO = "/assets/10951.jpg";
const DEG = Math.PI / 180;

/** Launcher roller axis, in the side view (z forward, y up). */
const LAUNCHER = { y: 0.55, z: 0.03, r: 0.05 };
/** Hood: an arc behind the launcher, from the top-back (exit) to below the axis (entry). */
const HOOD = { from: 130 * DEG, to: 230 * DEG, inner: 0.195, outer: 0.23 };
const BALL_R = 0.075;
/** Ball centre while it rides between the launcher and the hood. */
const RIDE = LAUNCHER.r + BALL_R;
/** Where the ball leaves the hood, and its direction of travel there (tangent to the arc). */
const EXIT_ANGLE = 135 * DEG;

export default function createRobot(ctx: StageContext): Model {
	/* ---------- Materials ---------- */
	const railTextures: CanvasTexture[] = [];
	const perforated = (length: number) => {
		const texture = perforatedTexture();
		texture.repeat.set(Math.max(1, Math.round(length / 0.1)), 1);
		railTextures.push(texture);
		return standard(0xffffff, { map: texture, metalness: 0.75, roughness: 0.38 });
	};
	const aluminium = standard(0xc9ced6, { metalness: 0.85, roughness: 0.32 });
	const plywood = standard(0xb39468, { roughness: 0.85 });
	const tread = standard(0xd9ccb0, { roughness: 0.85 });
	const hubGrey = standard(0x4a4f57, { metalness: 0.4, roughness: 0.5 });
	const black = standard(0x16181c, { roughness: 0.5 });
	const white = standard(0xeef1f4, { roughness: 0.45 });
	const blue = standard(0x2146c7, { roughness: 0.5 });
	const red = standard(0xd9303a, { roughness: 0.55 });
	const green = standard(0x2fb553, { roughness: 0.6 });
	const tan = standard(0xb9ab93, { roughness: 0.8 });
	const clear = new MeshStandardMaterial({
		color: 0xdfeaf5,
		transparent: true,
		opacity: 0.16,
		roughness: 0.06,
		depthWrite: false,
		side: DoubleSide,
	});
	const ballMaterial = standard(0xffc20e, { roughness: 0.85 });
	const signal = standard(0xff3b30, { emissive: 0xff3b30, emissiveIntensity: 2 });
	const limelightLed = standard(0x3dff7a, { emissive: 0x3dff7a, emissiveIntensity: 1.6 });

	const robot = new Group();
	ctx.root.add(robot);
	const add = (geometry: ConstructorParameters<typeof Mesh>[0], material: Material, x = 0, y = 0, z = 0, parent: Object3D = robot) => {
		const mesh = new Mesh(geometry, material);
		mesh.position.set(x, y, z);
		parent.add(mesh);
		return mesh;
	};
	const onX = <T extends Mesh>(mesh: T) => {
		mesh.rotation.z = X_AXIS;
		return mesh;
	};
	/** A roller: a group on the x axis at (y, z) with a thin shaft, spun by rotating the group about x. */
	const roller = (y: number, z: number, shaft: Material = black) => {
		const group = new Group();
		group.position.set(0, y, z);
		robot.add(group);
		onX(add(new CylinderGeometry(0.008, 0.008, 0.62, 10), shaft, 0, 0, 0, group));
		return group;
	};
	/** A point on a circle around the launcher axis, in the side view. */
	const aroundLauncher = (angle: number, radius: number) =>
		new Vector3(0, LAUNCHER.y + Math.sin(angle) * radius, LAUNCHER.z + Math.cos(angle) * radius);

	/* ---------- AM14U6 frame (front rail cut open for FUEL), wheels, belly pan ---------- */
	for (const x of [-0.325, 0.325]) add(new BoxGeometry(0.05, 0.1, 0.74), perforated(0.74), x, 0.1, 0);
	add(new BoxGeometry(0.6, 0.1, 0.05), perforated(0.6), 0, 0.1, -0.345);
	add(new BoxGeometry(0.5, 0.08, 0.04), perforated(0.5), 0, 0.09, 0.335); // low front cross member
	for (const x of [-0.3, 0.3]) add(new BoxGeometry(0.1, 0.11, 0.12), perforated(0.12), x, 0.1, 0.36); // front rail stubs
	add(new BoxGeometry(0.44, 0.012, 0.64), plywood, 0, 0.156, -0.03);

	const wheelGeometry = new CylinderGeometry(0.076, 0.076, 0.04, 32);
	const hubGeometry = new CylinderGeometry(0.03, 0.03, 0.042, 16);
	for (const x of [-0.262, 0.262]) {
		for (const z of [-0.25, 0, 0.25]) {
			const wheel = onX(add(wheelGeometry, tread, x, 0.076, z));
			wheel.add(new Mesh(hubGeometry, hubGrey));
		}
	}

	// The round "Dragons" sticker on the front cross member
	const stickerMaterial = new MeshStandardMaterial({ transparent: true, opacity: 0, roughness: 0.6 });
	add(new PlaneGeometry(0.07, 0.07), stickerMaterial, 0.02, 0.09, 0.3555);
	loadImage(LOGO).then((img) => {
		if (!img) return;
		stickerMaterial.map = circleTexture(img);
		stickerMaterial.opacity = 1;
		stickerMaterial.needsUpdate = true;
		ctx.invalidate();
	});

	/* ---------- Intake: lower shaft of tan compliant wheels, upper shaft of red star flaps ---------- */
	const lowRoller = roller(0.105, 0.445);
	const compliant = new CylinderGeometry(0.03, 0.03, 0.02, 20);
	for (const x of [-0.22, -0.13, -0.04, 0.05, 0.14, 0.23]) {
		for (const dx of [-0.011, 0.011]) onX(add(compliant, tan, x + dx, 0, 0, lowRoller));
	}

	const starGeometry = starWheel(0.055, 0.022, 8, 0.012);
	const starRoller = roller(0.19, 0.4);
	for (const x of [-0.2, -0.05, 0.1]) {
		const star = add(starGeometry, red, x, 0, 0, starRoller);
		star.rotation.y = Math.PI / 2;
	}
	for (const x of [-0.125, 0.025]) onX(add(new CylinderGeometry(0.032, 0.032, 0.03, 20), black, x, 0, 0, starRoller));
	const blueStar = add(starGeometry, blue, 0.2, 0, 0, starRoller);
	blueStar.rotation.y = Math.PI / 2;
	onX(add(new CylinderGeometry(0.014, 0.014, 0.03, 12), red, 0.2, 0, 0, starRoller));

	/* ---------- Fuel Mechanism: clear side plates with the KitBot's wavy front edge ---------- */
	const plate = new Shape(); // shape x = world z (forward), shape y = world y
	plate.moveTo(-0.12, 0.155);
	plate.lineTo(0.35, 0.155);
	plate.lineTo(0.35, 0.29);
	plate.quadraticCurveTo(0.25, 0.37, 0.29, 0.49); // the waist above the intake
	plate.lineTo(0.3, 0.57);
	plate.quadraticCurveTo(0.3, 0.66, 0.2, 0.66);
	plate.lineTo(-0.12, 0.66);
	plate.closePath();
	const plateGeometry = new ExtrudeGeometry(plate, { depth: 0.006, bevelEnabled: false, curveSegments: 14 });
	for (const x of [-0.318, 0.324]) {
		const side = add(plateGeometry, clear, x, 0, 0);
		side.rotation.y = -Math.PI / 2; // shape x -> world z, extrusion -> world -x
	}

	// Feeder: blue flaps alternating with green compliant wheels. Lifts FUEL from the hopper into the launcher.
	const feeder = roller(0.36, 0.1, aluminium);
	const flapGeometry = starWheel(0.05, 0.012, 8, 0.008);
	const greenWheel = new CylinderGeometry(0.035, 0.035, 0.035, 24);
	for (let i = 0; i < 9; i++) {
		const x = -0.24 + i * 0.06;
		if (i % 2 === 0) {
			const flap = add(flapGeometry, blue, x, 0, 0, feeder);
			flap.rotation.y = Math.PI / 2;
		} else {
			onX(add(greenWheel, green, x, 0, 0, feeder));
		}
	}

	// Launcher: the banded roller (black with blue / green / red bands), top surface spinning forward.
	const launcher = roller(LAUNCHER.y, LAUNCHER.z);
	onX(add(new CylinderGeometry(LAUNCHER.r, LAUNCHER.r, 0.58, 32), black, 0, 0, 0, launcher));
	const bandGeometry = new CylinderGeometry(LAUNCHER.r + 0.0005, LAUNCHER.r + 0.0005, 0.024, 32);
	const bands: Array<[number, Material]> = [[-0.23, blue], [-0.16, green], [-0.05, red], [0.0, red], [0.1, green], [0.21, blue]];
	for (const [x, material] of bands) onX(add(bandGeometry, material, x, 0, 0, launcher));

	// Hood: the team's eight white/blue/black plates on three tie-rods (the KitBot hood uses two plates on
	// three churros). A shallow arc behind the launcher, so FUEL leaves up and forward.
	const hoodShape = new Shape();
	hoodShape.moveTo(Math.cos(HOOD.from) * HOOD.outer, Math.sin(HOOD.from) * HOOD.outer);
	hoodShape.absarc(0, 0, HOOD.outer, HOOD.from, HOOD.to, false);
	hoodShape.lineTo(Math.cos(HOOD.to) * HOOD.inner, Math.sin(HOOD.to) * HOOD.inner);
	hoodShape.absarc(0, 0, HOOD.inner, HOOD.to, HOOD.from, true);
	hoodShape.closePath();
	const hoodGeometry = new ExtrudeGeometry(hoodShape, { depth: 0.012, bevelEnabled: false, curveSegments: 20 });
	const hood = new Group();
	hood.position.set(0, LAUNCHER.y, LAUNCHER.z);
	robot.add(hood);
	[white, blue, white, black, black, white, blue, white].forEach((material, i) => {
		const arc = add(hoodGeometry, material, -0.27 + i * 0.077 + 0.006, 0, 0, hood);
		arc.rotation.y = -Math.PI / 2;
	});
	const hoodRodRadius = (HOOD.inner + HOOD.outer) / 2;
	for (const degrees of [145, 180, 215]) {
		const a = degrees * DEG;
		const y = Math.sin(a) * hoodRodRadius;
		const z = Math.cos(a) * hoodRodRadius;
		onX(add(new CylinderGeometry(0.008, 0.008, 0.64, 10), black, 0, y, z, hood));
		for (const x of [-0.19, 0.04, 0.2]) onX(add(new CylinderGeometry(0.012, 0.012, 0.05, 12), white, x, y, z, hood));
	}

	/* ---------- Left side (+x): Kraken X60s on the launcher and feeder, intake belt pulley ---------- */
	const krakenGeometry = new CylinderGeometry(0.03, 0.03, 0.1, 24);
	const capGeometry = new CylinderGeometry(0.031, 0.031, 0.012, 24);
	const krakens = [
		[0.38, LAUNCHER.y, LAUNCHER.z],
		[0.38, 0.36, 0.1],
	].map(([x, y, z]) => {
		const motor = onX(add(krakenGeometry, black, x, y, z));
		add(capGeometry, aluminium, 0, 0.05, 0, motor);
		return motor;
	});
	onX(add(new CylinderGeometry(0.05, 0.05, 0.016, 32), black, 0.345, 0.19, 0.4)); // intake belt pulley
	add(new BoxGeometry(0.075, 0.035, 0.05), white, 0.29, 0.678, 0.0);
	add(new BoxGeometry(0.01, 0.036, 0.05), standard(0xff8a1f, { roughness: 0.5 }), 0.33, 0.678, 0.0);

	// Right side: robot signal light on top of the side plate
	const rsl = new Group();
	rsl.position.set(-0.3, 0.66, 0.08);
	robot.add(rsl);
	add(new CylinderGeometry(0.02, 0.022, 0.022, 20), black, 0, 0.011, 0, rsl);
	const dome = add(new SphereGeometry(0.022, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), signal, 0, 0.022, 0, rsl);

	/* ---------- Limelight: on the left side plate, lens facing forward ---------- */
	const limelight = new Group();
	limelight.position.set(0.28, 0.69, 0.15);
	robot.add(limelight);
	add(new RoundedBoxGeometry(0.09, 0.055, 0.032, 2, 0.006), black, 0, 0, 0, limelight);
	const lens = add(new CylinderGeometry(0.011, 0.011, 0.006, 20), standard(0x0a0c10, { metalness: 0.3, roughness: 0.08 }), -0.012, 0.004, 0.017, limelight);
	lens.rotation.x = Math.PI / 2;
	for (const [dx, dy] of [[0.018, 0.012], [0.03, 0.012], [0.018, -0.006], [0.03, -0.006]]) {
		add(new BoxGeometry(0.006, 0.006, 0.002), limelightLed, dx, dy, 0.0165, limelight);
	}

	/* ---------- Rear hopper: clear floor, sides and back with the team decal ---------- */
	const HOPPER_FLOOR = 0.2;
	add(new BoxGeometry(0.62, 0.004, 0.3), clear, 0, HOPPER_FLOOR, -0.25);
	const hopperSide = new Shape();
	hopperSide.moveTo(-0.4, 0.155);
	hopperSide.lineTo(-0.12, 0.155);
	hopperSide.lineTo(-0.12, 0.56);
	hopperSide.quadraticCurveTo(-0.22, 0.52, -0.3, 0.49);
	hopperSide.lineTo(-0.4, 0.48);
	hopperSide.closePath();
	const hopperSideGeometry = new ExtrudeGeometry(hopperSide, { depth: 0.005, bevelEnabled: false, curveSegments: 12 });
	for (const x of [-0.352, 0.357]) {
		const side = add(hopperSideGeometry, clear, x, 0, 0);
		side.rotation.y = -Math.PI / 2;
	}
	add(new PlaneGeometry(0.71, 0.325), clear, 0, 0.3175, -0.4);
	const decalMaterial = new MeshStandardMaterial({ transparent: true, opacity: 0, roughness: 0.5, depthWrite: false });
	const decal = add(new PlaneGeometry(0.66, 0.27), decalMaterial, 0, 0.32, -0.402);
	decal.rotation.y = Math.PI; // faces backwards
	drawDecal().then((texture) => {
		decalMaterial.map = texture;
		decalMaterial.opacity = 1;
		decalMaterial.needsUpdate = true;
		ctx.invalidate();
	});

	// Under the hopper floor: Power Distribution Hub (red breakers) and the roboRIO (2026 season)
	add(new BoxGeometry(0.22, 0.03, 0.1), standard(0x2b2f36, { roughness: 0.5 }), 0.06, 0.177, -0.2);
	for (let i = 0; i < 10; i++) add(new BoxGeometry(0.012, 0.006, 0.03), red, -0.025 + i * 0.019, 0.195, -0.2);
	add(new BoxGeometry(0.14, 0.028, 0.1), standard(0xc8ccd2, { metalness: 0.4, roughness: 0.4 }), -0.15, 0.176, -0.31);

	/* ---------- FUEL: intake -> hopper -> feeder -> launcher -> out the front ---------- */
	const ballGeometry = new SphereGeometry(BALL_R, 24, 16);
	const resting = HOPPER_FLOOR + BALL_R;
	for (const [x, z] of [[-0.15, -0.33], [0.15, -0.33]]) add(ballGeometry, ballMaterial, x, resting, z);

	// 1. Off the floor at the front, under the intake rollers and the feeder, into the hopper.
	const intakePath = new CatmullRomCurve3([
		new Vector3(0, BALL_R, 1.0),
		new Vector3(0, 0.08, 0.62),
		new Vector3(0, 0.15, 0.47),
		new Vector3(0, 0.2, 0.33),
		new Vector3(0, 0.235, 0.15),
		new Vector3(0, 0.255, -0.02),
		new Vector3(0, resting, -0.2),
	]);
	// 2. Forward again under the hood's tail, up past the feeder, then pinched between launcher and hood.
	const liftPath = new CatmullRomCurve3([
		new Vector3(0, resting, -0.2),
		new Vector3(0, 0.282, -0.11),
		new Vector3(0, 0.34, -0.05),
		...[250, 215, 180, EXIT_ANGLE / DEG].map((d) => aroundLauncher(d * DEG, RIDE)),
	]);
	// 3. Leaves tangent to the hood, up and forward (~45 degrees), in a slow-motion arc.
	const exit = aroundLauncher(EXIT_ANGLE, RIDE);
	const launch = { z: Math.sin(EXIT_ANGLE) * 1.5, y: -Math.cos(EXIT_ANGLE) * 1.5, g: 1.4 };
	const flight = (ball: Mesh, s: number) => ball.position.set(0, exit.y + launch.y * s - launch.g * s * s, exit.z + launch.z * s);

	const PERIOD = 5;
	const balls = [0, 0.5].map((offset) => ({ ball: add(ballGeometry, ballMaterial), offset }));
	const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
	const placeBall = (ball: Mesh, t: number) => {
		const phase = t % PERIOD;
		ball.visible = phase < 3.6;
		ball.scale.setScalar(1);
		if (phase < 1.4) {
			ball.position.copy(intakePath.getPointAt(easeInOut(phase / 1.4)));
			ball.scale.setScalar(Math.min(1, phase / 0.25));
			ball.rotation.x -= 0.1;
		} else if (phase < 2.0) {
			ball.position.copy(intakePath.getPointAt(1)); // waits in the hopper
		} else if (phase < 2.6) {
			const u = (phase - 2.0) / 0.6;
			ball.position.copy(liftPath.getPointAt(u * u)); // speeds up as the launcher grabs it
			ball.rotation.x += 0.25;
		} else if (phase < 3.6) {
			const s = phase - 2.6;
			flight(ball, s);
			ball.scale.setScalar(s < 0.75 ? 1 : 1 - (s - 0.75) / 0.25); // fades out past the frame
		}
	};

	/* ---------- Floor and labels ---------- */
	const shadow = contactShadow(0.85);
	robot.add(shadow);

	// One part is called out at a time, so labels never pile up.
	const tourClass = "opacity-0 transition-opacity duration-500 data-[on]:opacity-100";
	const tour = [
		ctx.label("Intake rollers", starRoller, tourClass),
		ctx.label("Clear hopper", new Vector3(0, 0.52, -0.3), tourClass),
		ctx.label("Feeder", new Vector3(-0.2, 0.36, 0.14), tourClass),
		ctx.label("Launcher and hood", aroundLauncher(160 * DEG, 0.33), tourClass),
		ctx.label("Limelight camera", limelight, tourClass),
		ctx.label("Kraken X60", krakens[0], tourClass),
	];
	let shown = -1;

	// Still pose (reduced motion): one ball just launched, one waiting in the hopper.
	flight(balls[0].ball, 0.28);
	balls[1].ball.position.copy(intakePath.getPointAt(1));

	return {
		update(t, dt) {
			const current = dt === 0 ? -2 : Math.floor(t / 2.5) % tour.length;
			if (current !== shown) {
				shown = current;
				tour.forEach((el, i) => el.toggleAttribute("data-on", current === -2 || i === current));
			}
			if (dt === 0) return;
			// Positive rotation about x: a roller's underside moves back, its top forward, its rear face up.
			lowRoller.rotation.x += dt * 9;
			starRoller.rotation.x += dt * 9;
			feeder.rotation.x += dt * 8;
			launcher.rotation.x += dt * 16;
			(dome.material as MeshStandardMaterial).emissiveIntensity = Math.sin(t * 7) > 0 ? 2.4 : 0.2;
			for (const { ball, offset } of balls) placeBall(ball, t + offset * PERIOD);
		},
		applyPalette(p) {
			(shadow.material as MeshBasicMaterial).opacity = p.dark ? 0.6 : 0.32;
		},
		dispose() {
			railTextures.forEach((t) => t.dispose());
		},
	};
}

/* ------------------------------------------------------------------ */
/* Textures and shapes                                                 */
/* ------------------------------------------------------------------ */

/** Aluminium with a row of holes, like KitBot / REV channel. Repeats along the rail. */
function perforatedTexture() {
	const canvas = document.createElement("canvas");
	canvas.width = 64;
	canvas.height = 64;
	const c = canvas.getContext("2d")!;
	c.fillStyle = "#c9cfd6";
	c.fillRect(0, 0, 64, 64);
	c.fillStyle = "#6b727c";
	for (const y of [20, 44]) {
		c.beginPath();
		c.arc(32, y, 7, 0, Math.PI * 2);
		c.fill();
	}
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.wrapS = texture.wrapT = RepeatWrapping;
	return texture;
}

/** A flat star wheel (points around a hub), extruded and centred on its axis. */
function starWheel(outer: number, inner: number, points: number, depth: number) {
	const s = new Shape();
	for (let i = 0; i <= points * 2; i++) {
		const r = i % 2 === 0 ? outer : inner;
		const a = (i / (points * 2)) * Math.PI * 2;
		if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
		else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
	}
	const geometry = new ExtrudeGeometry(s, { depth, bevelEnabled: false });
	geometry.translate(0, 0, -depth / 2);
	return geometry;
}

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
function loadImage(src: string) {
	if (!imageCache.has(src)) {
		imageCache.set(
			src,
			new Promise((resolve) => {
				const img = new Image();
				img.onload = () => resolve(img);
				img.onerror = () => resolve(null);
				img.src = src;
			}),
		);
	}
	return imageCache.get(src)!;
}

/** The team logo clipped to a circle (the source image has photo corners). */
function circleTexture(img: HTMLImageElement) {
	const size = 256;
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = size;
	const c = canvas.getContext("2d")!;
	c.beginPath();
	c.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
	c.clip();
	c.drawImage(img, 0, 0, size, size);
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	return texture;
}

/** "10951 / SAIGON SOUTH / DRAGONS" with the dragon logo, as on the rear panel. Transparent background. */
async function drawDecal() {
	const [img] = await Promise.all([loadImage(LOGO), document.fonts.load(`900 120px ${FONT}`).catch(() => undefined)]);
	const w = 1100;
	const h = 450;
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const c = canvas.getContext("2d")!;
	if (img) {
		c.save();
		c.beginPath();
		c.arc(190, 225, 170, 0, Math.PI * 2);
		c.clip();
		c.drawImage(img, 20, 55, 340, 340);
		c.restore();
	}
	c.fillStyle = "#15171b";
	c.font = `900 170px ${FONT}`;
	c.fillText("10951", 400, 175);
	c.fillStyle = "#2146c7";
	c.font = `900 78px ${FONT}`;
	c.fillText("SAIGON SOUTH", 400, 268);
	c.fillStyle = "#f2c230";
	c.font = `900 118px ${FONT}`;
	c.fillText("DRAGONS", 400, 390);
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.anisotropy = 8;
	return texture;
}
