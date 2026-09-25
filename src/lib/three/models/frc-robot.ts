/**
 * Team 10951's 2026 modified KitBot in 3D, rebuilt from the team's photos (website-old-main/image):
 *   front  â€” FRCnew.jpg (details) and FRC.JPG (proportions)
 *   back   â€” modifiedkitbot.jpg
 * Simplified, not CAD. ~1 unit = 1 m. The robot's front (intake) faces +z; its left side is +x.
 *
 * What's modelled: the aluminium KitBot frame with perforated rails and tan tread wheels; the front intake
 * (tan compliant-wheel roller under a shaft of red star wheels); the cage of white/blue/black arc guides over the
 * banded roller and the blue-flap/green-wheel feeder; clear side plates, Kraken X60 motors and the drive pulley on
 * the left; the red robot signal light on the right; the Limelight camera on top; and the clear rear hopper with
 * the "10951 Saigon South Dragons" decal. The roboRIO sits in the hopper for 2026 (SystemCore replaces it after).
 * A game piece is pulled in at the front, carried up and over the rollers along the arcs, and dropped into the
 * hopper, on a loop.
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
	camera: [1.45, 1.0, 1.7],
	target: [0, 0.3, 0],
	fov: 34,
	spin: 0.22,
	minPolar: 0.5,
	maxPolar: 1.45,
	fitWidth: 1.3,
};

const X_AXIS = Math.PI / 2; // rotate a y-axis cylinder onto the x axis
const FONT = '"Archivo Variable", "Arial Black", sans-serif';
const LOGO = "/assets/10951.jpg";

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

	/* ---------- KitBot frame, wheels and belly pan ---------- */
	for (const x of [-0.325, 0.325]) add(new BoxGeometry(0.05, 0.1, 0.74), perforated(0.74), x, 0.1, 0);
	add(new BoxGeometry(0.6, 0.1, 0.05), perforated(0.6), 0, 0.1, -0.345);
	add(new BoxGeometry(0.5, 0.08, 0.04), perforated(0.5), 0, 0.09, 0.335); // front cross member
	for (const x of [-0.3, 0.3]) add(new BoxGeometry(0.1, 0.11, 0.12), perforated(0.12), x, 0.1, 0.36); // front corner blocks
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

	/* ---------- Front intake: tan compliant-wheel roller, red star wheels ---------- */
	const lowRoller = new Group();
	lowRoller.position.set(0, 0.105, 0.445);
	robot.add(lowRoller);
	onX(add(new CylinderGeometry(0.008, 0.008, 0.6, 10), black, 0, 0, 0, lowRoller));
	const compliant = new CylinderGeometry(0.03, 0.03, 0.02, 20);
	for (const x of [-0.22, -0.13, -0.04, 0.05, 0.14, 0.23]) {
		for (const dx of [-0.011, 0.011]) onX(add(compliant, tan, x + dx, 0, 0, lowRoller));
	}

	const starGeometry = starWheel(0.055, 0.022, 8, 0.012);
	const starRoller = new Group();
	starRoller.position.set(0, 0.19, 0.4);
	robot.add(starRoller);
	onX(add(new CylinderGeometry(0.008, 0.008, 0.6, 10), black, 0, 0, 0, starRoller));
	for (const x of [-0.2, -0.05, 0.1]) {
		const star = add(starGeometry, red, x, 0, 0, starRoller);
		star.rotation.y = Math.PI / 2;
	}
	for (const x of [-0.125, 0.025]) onX(add(new CylinderGeometry(0.032, 0.032, 0.03, 20), black, x, 0, 0, starRoller));
	const blueStar = add(starGeometry, blue, 0.2, 0, 0, starRoller);
	blueStar.rotation.y = Math.PI / 2;
	onX(add(new CylinderGeometry(0.014, 0.014, 0.03, 12), red, 0.2, 0, 0, starRoller));

	/* ---------- Mechanism: clear side plates, arc guides, rollers ---------- */
	const plate = new Shape();
	plate.moveTo(0, 0.155);
	plate.lineTo(0.34, 0.155);
	plate.lineTo(0.34, 0.5);
	plate.quadraticCurveTo(0.34, 0.63, 0.21, 0.63);
	plate.lineTo(0, 0.63);
	plate.closePath();
	const plateGeometry = new ExtrudeGeometry(plate, { depth: 0.006, bevelEnabled: false, curveSegments: 12 });
	for (const x of [-0.318, 0.324]) {
		const side = add(plateGeometry, clear, x, 0, 0);
		side.rotation.y = -Math.PI / 2; // shape x â†’ world z, extrusion â†’ world âˆ’x
	}

	// Arc guides wrapping over the roller stack, centred on the banded roller.
	const CENTER = { y: 0.42, z: 0.14 };
	const from = (-50 * Math.PI) / 180;
	const to = (150 * Math.PI) / 180;
	const arcShape = new Shape();
	arcShape.moveTo(Math.cos(from) * 0.245, Math.sin(from) * 0.245);
	arcShape.absarc(0, 0, 0.245, from, to, false);
	arcShape.lineTo(Math.cos(to) * 0.21, Math.sin(to) * 0.21);
	arcShape.absarc(0, 0, 0.21, to, from, true);
	arcShape.closePath();
	const arcGeometry = new ExtrudeGeometry(arcShape, { depth: 0.012, bevelEnabled: false, curveSegments: 28 });
	const arcs = new Group();
	arcs.position.set(0, CENTER.y, CENTER.z);
	robot.add(arcs);
	[white, blue, white, black, black, white, blue, white].forEach((material, i) => {
		const arc = add(arcGeometry, material, -0.27 + i * 0.077 + 0.006, 0, 0, arcs);
		arc.rotation.y = -Math.PI / 2;
	});
	// Tie-rods through the arcs, with white spacer tubes
	for (const degrees of [-20, 45, 110]) {
		const a = (degrees * Math.PI) / 180;
		const y = Math.sin(a) * 0.2275;
		const z = Math.cos(a) * 0.2275;
		onX(add(new CylinderGeometry(0.008, 0.008, 0.62, 10), black, 0, y, z, arcs));
		for (const x of [-0.19, 0.04, 0.2]) onX(add(new CylinderGeometry(0.012, 0.012, 0.05, 12), white, x, y, z, arcs));
	}

	// Banded roller: black with blue / green / red bands
	const bandedRoller = new Group();
	bandedRoller.position.set(0, CENTER.y, CENTER.z);
	robot.add(bandedRoller);
	onX(add(new CylinderGeometry(0.05, 0.05, 0.58, 32), black, 0, 0, 0, bandedRoller));
	const bandGeometry = new CylinderGeometry(0.0505, 0.0505, 0.024, 32);
	const bands: Array<[number, Material]> = [[-0.23, blue], [-0.16, green], [-0.05, red], [0.0, red], [0.1, green], [0.21, blue]];
	for (const [x, material] of bands) onX(add(bandGeometry, material, x, 0, 0, bandedRoller));

	// Feeder: blue flap wheels alternating with green compliant wheels
	const feeder = new Group();
	feeder.position.set(0, 0.3, 0.05);
	robot.add(feeder);
	onX(add(new CylinderGeometry(0.008, 0.008, 0.6, 10), aluminium, 0, 0, 0, feeder));
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

	// Silver guard rods across the back of the mechanism
	for (const [y, z] of [[0.36, -0.01], [0.47, -0.025]]) onX(add(new CylinderGeometry(0.008, 0.008, 0.64, 10), aluminium, 0, y, z));

	/* ---------- Left side (+x): Kraken X60s, drive pulley, controller box. Right side: signal light ---------- */
	const krakenGeometry = new CylinderGeometry(0.03, 0.03, 0.1, 24);
	const capGeometry = new CylinderGeometry(0.031, 0.031, 0.012, 24);
	const krakens = [
		[0.38, 0.54, 0.2],
		[0.38, 0.42, 0.3],
	].map(([x, y, z]) => {
		const motor = onX(add(krakenGeometry, black, x, y, z));
		add(capGeometry, aluminium, 0, 0.05, 0, motor);
		return motor;
	});
	onX(add(new CylinderGeometry(0.06, 0.06, 0.016, 32), black, 0.345, 0.24, 0.2)); // drive pulley
	add(new BoxGeometry(0.075, 0.035, 0.05), white, 0.29, 0.645, 0.23);
	add(new BoxGeometry(0.01, 0.036, 0.05), standard(0xff8a1f, { roughness: 0.5 }), 0.33, 0.645, 0.23);

	const rsl = new Group();
	rsl.position.set(-0.3, 0.63, 0.03);
	robot.add(rsl);
	add(new CylinderGeometry(0.02, 0.022, 0.022, 20), black, 0, 0.011, 0, rsl);
	const dome = add(new SphereGeometry(0.022, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), signal, 0, 0.022, 0, rsl);

	/* ---------- Limelight: top left, lens facing forward ---------- */
	const limelight = new Group();
	limelight.position.set(0.25, 0.665, 0.0);
	robot.add(limelight);
	add(new RoundedBoxGeometry(0.09, 0.055, 0.032, 2, 0.006), black, 0, 0, 0, limelight);
	const lens = add(new CylinderGeometry(0.011, 0.011, 0.006, 20), standard(0x0a0c10, { metalness: 0.3, roughness: 0.08 }), -0.012, 0.004, 0.017, limelight);
	lens.rotation.x = Math.PI / 2;
	for (const [dx, dy] of [[0.018, 0.012], [0.03, 0.012], [0.018, -0.006], [0.03, -0.006]]) {
		add(new BoxGeometry(0.006, 0.006, 0.002), limelightLed, dx, dy, 0.0165, limelight);
	}

	/* ---------- Rear hopper: clear box with the team decal, electronics inside ---------- */
	const hopperSide = new Shape();
	hopperSide.moveTo(-0.4, 0.155);
	hopperSide.lineTo(0.0, 0.155);
	hopperSide.lineTo(0.0, 0.52);
	hopperSide.quadraticCurveTo(-0.08, 0.5, -0.2, 0.46);
	hopperSide.lineTo(-0.4, 0.44);
	hopperSide.closePath();
	const hopperSideGeometry = new ExtrudeGeometry(hopperSide, { depth: 0.005, bevelEnabled: false, curveSegments: 12 });
	for (const x of [-0.352, 0.357]) {
		const side = add(hopperSideGeometry, clear, x, 0, 0);
		side.rotation.y = -Math.PI / 2;
	}
	add(new PlaneGeometry(0.71, 0.285), clear, 0, 0.2975, -0.4);
	const decalMaterial = new MeshStandardMaterial({ transparent: true, opacity: 0, roughness: 0.5, depthWrite: false });
	const decal = add(new PlaneGeometry(0.66, 0.27), decalMaterial, 0, 0.3, -0.402);
	decal.rotation.y = Math.PI; // faces backwards
	drawDecal().then((texture) => {
		decalMaterial.map = texture;
		decalMaterial.opacity = 1;
		decalMaterial.needsUpdate = true;
		ctx.invalidate();
	});

	// Power Distribution Hub (red breakers) and the roboRIO (2026 season)
	add(new BoxGeometry(0.22, 0.035, 0.1), standard(0x2b2f36, { roughness: 0.5 }), 0.04, 0.18, -0.14);
	for (let i = 0; i < 10; i++) add(new BoxGeometry(0.012, 0.012, 0.03), red, -0.045 + i * 0.019, 0.203, -0.14);
	add(new BoxGeometry(0.14, 0.03, 0.1), standard(0xc8ccd2, { metalness: 0.4, roughness: 0.4 }), -0.17, 0.177, -0.26);

	/* ---------- Game pieces ---------- */
	const ballGeometry = new SphereGeometry(0.075, 24, 16);
	for (const [x, z] of [[-0.14, -0.3], [0.13, -0.27]]) add(ballGeometry, ballMaterial, x, 0.237, z);
	const path = new CatmullRomCurve3([
		new Vector3(0, 0.075, 1.0),
		new Vector3(0, 0.08, 0.62),
		new Vector3(0, 0.15, 0.47),
		new Vector3(0, 0.22, 0.3),
		// up and over the banded roller, just inside the arcs
		...[-40, 0, 45, 90, 135].map((d) => {
			const a = (d * Math.PI) / 180;
			return new Vector3(0, CENTER.y + Math.sin(a) * 0.13, CENTER.z + Math.cos(a) * 0.13);
		}),
		new Vector3(0, 0.5, -0.05),
		new Vector3(0, 0.26, -0.2),
	]);
	const PERIOD = 4;
	const balls = [0, 0.5].map((offset) => ({ ball: add(ballGeometry, ballMaterial), offset }));
	const placeBall = (ball: Mesh, t: number) => {
		const phase = t % PERIOD;
		if (phase < 3.1) {
			const u = phase / 3.1;
			ball.position.copy(path.getPointAt(u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2));
			ball.scale.setScalar(Math.min(1, phase / 0.25));
			ball.rotation.x -= 0.1;
			ball.visible = true;
		} else if (phase < 3.6) {
			// Settles into the hopper, then fades out so the pile doesn't grow forever.
			ball.scale.setScalar(1 - (phase - 3.1) / 0.5);
		} else {
			ball.visible = false;
		}
	};

	/* ---------- Floor and labels ---------- */
	const shadow = contactShadow(0.85);
	robot.add(shadow);

	// One part is called out at a time, so labels never pile up.
	const tourClass = "opacity-0 transition-opacity duration-500 data-[on]:opacity-100";
	const tour = [
		ctx.label("Intake rollers", starRoller, tourClass),
		ctx.label("Arc guides", new Vector3(0, CENTER.y + 0.28, CENTER.z), tourClass),
		ctx.label("Clear hopper", new Vector3(0, 0.5, -0.3), tourClass),
		ctx.label("Limelight camera", limelight, tourClass),
		ctx.label("Kraken X60", krakens[0], tourClass),
	];
	let shown = -1;

	// Still pose (reduced motion): one ball on its way over the roller.
	balls[0].ball.position.copy(path.getPointAt(0.55));
	balls[1].ball.visible = false;

	return {
		update(t, dt) {
			const current = dt === 0 ? -2 : Math.floor(t / 2.5) % tour.length;
			if (current !== shown) {
				shown = current;
				tour.forEach((el, i) => el.toggleAttribute("data-on", current === -2 || i === current));
			}
			if (dt === 0) return;
			lowRoller.rotation.x -= dt * 9;
			starRoller.rotation.x -= dt * 9;
			bandedRoller.rotation.x += dt * 14;
			feeder.rotation.x += dt * 8;
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
