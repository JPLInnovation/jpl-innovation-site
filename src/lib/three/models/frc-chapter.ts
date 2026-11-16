/**
 * The FRC chapter's 3D (src/components/FrcChapter.astro): the KitBot on the 2026 field, beats 1 to 4, built like the
 * drone chapter (./drone-chapter.ts). The camera is the scroll showcase's (src/lib/three/showcase.ts), on the KitBot and
 * its part-by-part stops (./frc-robot-showcase.ts), with three stops in front of them: the prologue (the robot low in
 * the dark arena, lit from behind), the stakes (over the launcher as it shoots into its HUB) and the reveal (the field's
 * lights come up).
 *
 * The field is drawn from the official 2026 field (public/assets/2026-playing-field-page.webp): its grey carpet in
 * 12 ft rolls and its tape lines as one texture drawn here; the HUBs, BUMPs, TRENCHes, guardrails, alliance walls and
 * FUEL as a few merged meshes; the arena's lights as a ring of lamps above; behind them the team's own photograph of the
 * Pacific Coliseum, blurred (public/chapter/frc/stands.webp, scripts/bake-stands.py). The robot stays where the camera
 * frames it and the field moves under it: it drives a short curve, shoots, then turns for its close-ups
 * (src/lib/look/kitbot-drive.ts), all following the scroll, forward and back.
 *
 * Cheap on purpose: no real-time shadows (the robot's own soft blob), no post-processing, the carpet and the stands
 * unlit, nine draw calls for the field. Whatever comes between the camera and the robot fades out (dithered, no
 * sorting), so a wall or the HUB never hides it, and an alliance wall the camera is behind is not drawn. Every intensity
 * is in LOOK, below, to tune in one place.
 *
 * For the checks (scripts/check-field.py): window.__kitbotField is where the robot is on the field (x, z, heading,
 * metres travelled), where the camera is in stops (at) and how many balls of the shot are in the air.
 */
import {
	BackSide,
	BoxGeometry,
	type BufferGeometry,
	CanvasTexture,
	CylinderGeometry,
	DataTexture,
	DoubleSide,
	ExtrudeGeometry,
	Group,
	HemisphereLight,
	InstancedMesh,
	LinearMipmapLinearFilter,
	Matrix4,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	MirroredRepeatWrapping,
	NearestFilter,
	Object3D,
	PlaneGeometry,
	RingGeometry,
	ShaderMaterial,
	Shape,
	SphereGeometry,
	type Texture,
	TextureLoader,
	Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { FIELD, HUB, ballsAt, fieldTransform, poseAt, shotPoint } from "../../look/kitbot-drive";
import { drive } from "../showcase";
import type { Model, StageContext } from "../stage";
import createRobotShowcase from "./frc-robot-showcase";

type Light = { key: number; fill: number; rim: number; sky: number; environment: number; house: number };

/** Every intensity of the chapter's look. */
export const LOOK = {
	/**
	 * The light on each beat; the camera blends between them as it moves. Beat 4's stops all use `anatomy`. `house` is
	 * the arena's own light on the carpet and the stands, 0 to 1.
	 */
	light: {
		prologue: { key: 0.06, fill: 0, rim: 2.6, sky: 0.03, environment: 0.06, house: 0.42 },
		stakes: { key: 0.9, fill: 0.1, rim: 1.8, sky: 0.12, environment: 0.3, house: 0.7 },
		reveal: { key: 1.6, fill: 0.3, rim: 1.0, sky: 0.3, environment: 0.45, house: 1 },
		anatomy: { key: 1.6, fill: 0.3, rim: 1.0, sky: 0.3, environment: 0.45, house: 1 },
	} satisfies Record<string, Light>,
	/** The arena's lights are plain white: no coloured rim. */
	keyColor: "#ffffff",
	rimColor: "#ffffff",
	/** The page's near-black (the edition's --frc-k): the floor and the stands fade into it at their edges. */
	night: [7, 11, 18],
	/** Colours from the field photograph: the carpet (two rolls a hair apart), the arena floor, the tape. */
	carpet: ["#57595b", "#525456"],
	floor: "#121519",
	tape: { white: "#d6d8dc", blue: "#1f6fe6", red: "#d23a40" },
	/** The field's materials (lit): alliance blue and red, the HUB's navy and black, its white hood, aluminium, FUEL. */
	paint: { blue: "#1b63d8", red: "#c62b33", navy: "#18223a", black: "#101216", white: "#e3e6ea", aluminium: "#aab0b8", fuel: "#ffc20e" },
	/** The arena: the stands' radius and height (metres), how many times the photograph goes round, its lamps. */
	arena: { radius: 16, height: 6, repeat: 10, lamps: 96, lampHeight: 3.35, lampColor: "#fff2da" },
	/** The stands' brightness at full house light (the photograph is baked dark). */
	stands: 1.25,
	/** The scrim behind the words on the left, on wide windows (CSS). */
	scrim: 0.72,
	/** On wide windows, the share of the width the robot is framed in (on the right; the words are on the left). */
	frame: 0.6,
	/** Where the robot is, for the fade of whatever comes between it and the camera: its middle, and its radius (m). */
	robot: { y: 0.3, r: 0.62 },
	files: { stands: "/chapter/frc/stands.webp" },
};

/** The chapter's stops, in order: beats 1 to 3, then beat 4's part-by-part stops (src/text/showcase/robot.ts). */
export const STOPS = ["prologue", "stakes", "reveal", "overview", "intake", "hopper", "indexer", "shooter", "hopper-close", "krakens", "vision", "odometry", "drivetrain", "electronics"];

export interface ChapterOptions {
	/** Where the page is, in stops (0 = the prologue). */
	position(): number;
	/** The stop being read changed. */
	onStop(index: number): void;
	/** Every frame: where the camera is, in stops. */
	onFrame(at: number): void;
	/** The small label on each stop (empty: none). */
	titles: string[];
	/** For the stills: the robot alone, lit as on beat 4, nothing else drawn. */
	capture?: boolean;
}

const lightOf = (id: string): Light => (LOOK.light as Record<string, Light>)[id] ?? LOOK.light.anatomy;
const rgb = (c: number[]) => new Vector3(c[0] / 255, c[1] / 255, c[2] / 255);

/* ------------------------------------------------------------------ */
/* The carpet: one texture, drawn here from the field's layout          */
/* ------------------------------------------------------------------ */

const CARPET = { w: 20, h: 10, px: 2048 }; // metres the texture covers (the field and a margin of arena floor)
const L = FIELD.length / 2;
const W = FIELD.width / 2;
/** The HUB row's edges along x (the BUMPs and TRENCHes are in line with the HUB). */
const ROW = { near: Math.abs(HUB.x) + HUB.size / 2, far: Math.abs(HUB.x) - HUB.size / 2 };
/** The DEPOT against each alliance wall (blue at -x; red turned round the middle, as the field is). */
const DEPOT = { depth: 0.69, z: [-3.0, -1.3] };

function drawCarpet() {
	const canvas = document.createElement("canvas");
	canvas.width = CARPET.px;
	canvas.height = CARPET.px / 2;
	const g = canvas.getContext("2d")!;
	const k = CARPET.px / CARPET.w;
	const X = (x: number) => (x + CARPET.w / 2) * k;
	const Z = (z: number) => (z + CARPET.h / 2) * k;
	g.fillStyle = LOOK.floor;
	g.fillRect(0, 0, canvas.width, canvas.height);
	// The carpet, in 12 ft rolls laid across the field, each a hair lighter or darker than the next, as real ones are.
	for (let i = 0, x = -L; x < L; i++, x += 3.66) {
		g.fillStyle = LOOK.carpet[i % 2];
		g.fillRect(X(x), Z(-W), Math.min(3.66, L - x) * k + 1, FIELD.width * k);
	}
	// 2 in tape: the centre line, each alliance's line along its HUB row, the white lines on the neutral side of the rows.
	const tape = 0.05 * k;
	const across = (x: number, color: string) => {
		g.fillStyle = color;
		g.fillRect(X(x) - tape / 2, Z(-W), tape, FIELD.width * k);
	};
	across(0, LOOK.tape.white);
	across(-ROW.near - 0.03, LOOK.tape.blue);
	across(ROW.near + 0.03, LOOK.tape.red);
	across(-ROW.far + 1.3, LOOK.tape.white);
	across(ROW.far - 1.3, LOOK.tape.white);
	// The DEPOTs, outlined in their alliance's tape.
	g.lineWidth = tape;
	g.strokeStyle = LOOK.tape.blue;
	g.strokeRect(X(-L) + tape / 2, Z(DEPOT.z[0]), DEPOT.depth * k, (DEPOT.z[1] - DEPOT.z[0]) * k);
	g.strokeStyle = LOOK.tape.red;
	g.strokeRect(X(L - DEPOT.depth) - tape / 2, Z(-DEPOT.z[1]), DEPOT.depth * k, (DEPOT.z[1] - DEPOT.z[0]) * k);
	const texture = new CanvasTexture(canvas);
	texture.flipY = false; // row 0 is -z
	return texture;
}

/** An AprilTag-like square (white border, black ring, a fixed pattern): the field's landmarks for the Limelight. */
function drawTag() {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 80;
	const g = canvas.getContext("2d")!;
	g.fillStyle = "#f4f4f4";
	g.fillRect(0, 0, 80, 80);
	g.fillStyle = "#0b0b0b";
	g.fillRect(8, 8, 64, 64);
	const bits = [0b110100, 0b011011, 0b101110, 0b010011, 0b111001, 0b100110];
	g.fillStyle = "#f4f4f4";
	bits.forEach((row, y) => {
		for (let x = 0; x < 6; x++) if (row & (1 << x)) g.fillRect(16 + x * 8, 16 + y * 8, 8, 8);
	});
	const texture = new CanvasTexture(canvas);
	texture.magFilter = NearestFilter;
	texture.minFilter = LinearMipmapLinearFilter;
	return texture;
}

/* ------------------------------------------------------------------ */
/* The field's solid pieces, merged per material                        */
/* ------------------------------------------------------------------ */

/**
 * The fade for whatever comes between the camera and the robot: fragments nearer than the robot's front and inside its
 * outline on screen are dropped, in a dither (no sorting, no blending), and so is anything within a few tens of
 * centimetres of the lens. `robot` is the robot's middle in view space.
 */
function clearTheView(material: MeshStandardMaterial, robot: { value: Vector3 }) {
	material.onBeforeCompile = (shader) => {
		shader.uniforms.uRobotView = robot;
		shader.vertexShader = shader.vertexShader
			.replace("void main() {", "varying vec3 vViewPos;\nvoid main() {")
			.replace("#include <project_vertex>", "#include <project_vertex>\n\tvViewPos = mvPosition.xyz;");
		shader.fragmentShader = shader.fragmentShader.replace(
			"void main() {",
			`varying vec3 vViewPos;
uniform vec3 uRobotView;
void main() {
	float robotDepth = -uRobotView.z;
	float depth = -vViewPos.z;
	float spread = length(vViewPos.xy / max(depth, 0.05) - uRobotView.xy / max(robotDepth, 0.05)) * robotDepth;
	float inFront = 1.0 - smoothstep(robotDepth - ${LOOK.robot.r.toFixed(2)} - 0.25, robotDepth - ${LOOK.robot.r.toFixed(2)}, depth);
	float inside = 1.0 - smoothstep(${(LOOK.robot.r + 0.05).toFixed(2)}, ${(LOOK.robot.r + 0.15).toFixed(2)}, spread);
	float keep = (1.0 - inFront * inside) * smoothstep(0.3, 0.75, depth); // and anything right at the lens
	if (keep < fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;`,
		);
	};
	material.customProgramCacheKey = () => "frc-field-clear";
}

function buildField(robotView: { value: Vector3 }) {
	const field = new Group();
	field.name = "frc-field";
	const paint = (color: string, extra: Partial<{ roughness: number; metalness: number; map: Texture; side: typeof DoubleSide }> = {}) => {
		const m = new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra });
		clearTheView(m, robotView);
		return m;
	};
	const tagTexture = drawTag();
	const materials = {
		blue: paint(LOOK.paint.blue, { roughness: 0.5 }),
		red: paint(LOOK.paint.red, { roughness: 0.5 }),
		navy: paint(LOOK.paint.navy),
		black: paint(LOOK.paint.black, { roughness: 0.6 }),
		white: paint(LOOK.paint.white, { roughness: 0.45 }),
		aluminium: paint(LOOK.paint.aluminium, { roughness: 0.35, metalness: 0.7 }),
		tag: paint("#ffffff", { roughness: 0.6, map: tagTexture, side: DoubleSide }),
	};
	type Key = keyof typeof materials;
	const pieces = new Map<Key, BufferGeometry[]>();
	const m4 = new Matrix4();
	const put = (key: Key, geometry: BufferGeometry, x: number, y: number, z: number, turnY = 0, tiltZ = 0) => {
		const g = geometry.index ? geometry.toNonIndexed() : geometry;
		if (tiltZ) g.rotateZ(tiltZ);
		if (turnY) g.rotateY(turnY);
		g.applyMatrix4(m4.makeTranslation(x, y, z));
		pieces.set(key, [...(pieces.get(key) ?? []), g]);
	};
	const box = (key: Key, sx: number, sy: number, sz: number, x: number, y: number, z: number, tiltZ = 0) => put(key, new BoxGeometry(sx, sy, sz), x, y, z, 0, tiltZ);
	const tag = (x: number, y: number, z: number, turnY: number) => put("tag", new PlaneGeometry(0.165, 0.165), x, y, z, turnY);

	// The BUMP's profile: a low ramp up, a flat top, a ramp down (along x), 1.85 m across the field.
	const ramp = new Shape();
	ramp.moveTo(-0.565, 0);
	ramp.lineTo(0.565, 0);
	ramp.lineTo(0.33, 0.165);
	ramp.lineTo(-0.33, 0.165);
	ramp.closePath();

	const walls: Group[] = [];
	for (const side of [-1, 1] as const) {
		const alliance: Key = side < 0 ? "blue" : "red";
		const hx = side * Math.abs(HUB.x);
		const lean = -side * 0.2; // the HUB's frame leans toward the middle of the field (radians, toward +x for blue)
		// The HUB: a navy body, a black band with two AprilTags a face, a white hexagonal hood, its opening ringed in
		// the alliance's colour, and the aluminium frame above it.
		box("navy", HUB.size, 1.05, HUB.size, hx, 0.525, 0);
		box("black", HUB.size + 0.02, 0.36, HUB.size + 0.02, hx, 1.23, 0);
		for (let f = 0; f < 4; f++) {
			const turn = (f * Math.PI) / 2;
			for (const along of [-0.27, 0.27]) {
				const out = HUB.size / 2 + 0.017;
				const [dx, dz] = [Math.sin(turn) * out + Math.cos(turn) * along, Math.cos(turn) * out - Math.sin(turn) * along];
				tag(hx + dx, 1.23, dz, turn);
			}
		}
		put("white", new CylinderGeometry(0.47, 0.8, 0.38, 6, 1, true), hx, 1.6, 0, Math.PI / 6);
		put(alliance, new RingGeometry(0.3, 0.47, 6).rotateX(-Math.PI / 2), hx, 1.79, 0, Math.PI / 6);
		for (const z of [-0.55, 0.55]) box("aluminium", 0.035, 1.5, 0.035, hx + lean * 0.75, 2.5, z, -lean);
		box("aluminium", 0.035, 0.035, 1.14, hx + lean * 1.5, 3.23, 0);
		for (const zs of [-1, 1] as const) {
			// The BUMPs either side of the HUB, then the TRENCH out to the guardrail: a block, an arm, a tag on a post.
			put(alliance, new ExtrudeGeometry(ramp, { depth: 1.85, bevelEnabled: false }).translate(0, 0, -0.925), hx, 0, zs * 1.52);
			box(alliance, 0.32, 0.56, 0.4, hx, 0.28, zs * 2.65);
			box(alliance, 0.24, 0.12, 1.42, hx, 0.62, zs * 3.32);
			box("aluminium", 0.03, 0.2, 0.03, hx, 0.78, zs * 3.55);
			tag(hx, 0.97, zs * 3.55, Math.PI / 2);
		}
		// The alliance wall: its dark lower wall, topped with a stripe of the alliance's colour (the polycarbonate above
		// it is left out). Its own two meshes: it is hidden while the camera is behind it, as in a cutaway.
		const wall = new Group();
		wall.userData.side = side;
		for (const [m, sy, y] of [[materials.black, 1.0, 0.5], [materials[alliance], 0.05, 1.025]] as const) {
			const mesh = new Mesh(new BoxGeometry(0.12, sy, FIELD.width), m);
			mesh.position.set(side * (L + 0.06), y, 0);
			wall.add(mesh);
		}
		walls.push(wall);
		field.add(wall);
		// The guardrail along this long side: posts, a top rail and a kick rail.
		const gz = side * (W + 0.03);
		box("aluminium", FIELD.length, 0.04, 0.04, 0, 0.5, gz);
		box("aluminium", FIELD.length, 0.05, 0.02, 0, 0.05, gz);
		for (let i = 0; i <= 12; i++) box("aluminium", 0.04, 0.5, 0.04, -L + (i * FIELD.length) / 12, 0.25, gz);
	}
	for (const [key, list] of pieces) {
		const mesh = new Mesh(mergeGeometries(list, false), materials[key]);
		mesh.matrixAutoUpdate = false;
		field.add(mesh);
		for (const g of list) g.dispose();
	}

	/* FUEL: the neutral zone's two blocks either side of the centre line, the DEPOTs, a few strays; and the stream. */
	const fuelMaterial = paint(LOOK.paint.fuel, { roughness: 0.85 });
	const ball = new SphereGeometry(0.075, 14, 10);
	const spots: number[][] = [];
	const jitter = (i: number) => (((i * 7919) % 13) / 13 - 0.5) * 0.02;
	for (let i = 0; i < 5; i++) for (let j = 0; j < 21; j++) for (const s of [-1, 1]) spots.push([s * (0.16 + i * 0.152) + jitter(i * 31 + j), (j - 10) * 0.152 + jitter(j * 17 + i)]);
	for (const s of [-1, 1]) for (let i = 0; i < 3; i++) for (let j = 0; j < 9; j++) spots.push([s * (L - 0.14 - i * 0.16), -s * (DEPOT.z[0] + 0.2 + j * 0.16)]);
	// (the strays stay over 2.5 m from where the robot drives and stops: the close-up cameras are about 2 m out)
	spots.push([-4.2, 3.05], [-3.0, 2.3], [-2.4, -2.95], [-1.7, 0.45], [-5.6, -2.7], [-3.4, -1.0], [-2.1, 3.3], [1.3, -2.6], [2.6, 1.9], [-0.9, -3.4]);
	const fuel = new InstancedMesh(ball, fuelMaterial, spots.length);
	const at = new Object3D();
	spots.forEach(([x, z], i) => {
		at.position.set(x, 0.075, z);
		at.rotation.set(i * 1.3, i * 0.7, 0);
		at.updateMatrix();
		fuel.setMatrixAt(i, at.matrix);
	});
	fuel.computeBoundingSphere();
	field.add(fuel);
	const stream = Array.from(ballsAt(0), () => {
		const m = new Mesh(ball, fuelMaterial);
		m.visible = false;
		field.add(m);
		return m;
	});

	/* The arena: lamps on a ring above the stands, and the stands themselves (the team's photograph, blurred). */
	const { radius, height, lamps } = LOOK.arena;
	const lampMesh = new InstancedMesh(new PlaneGeometry(0.4, 0.11), new MeshBasicMaterial({ color: LOOK.arena.lampColor }), lamps);
	for (let i = 0; i < lamps; i++) {
		const a = (i / lamps) * Math.PI * 2;
		at.position.set(Math.cos(a) * (radius - 0.6), LOOK.arena.lampHeight + (i % 2) * 0.26, Math.sin(a) * (radius - 0.6));
		at.rotation.set(0, 0, 0);
		at.lookAt(0, LOOK.arena.lampHeight, 0);
		at.updateMatrix();
		lampMesh.setMatrixAt(i, at.matrix);
	}
	lampMesh.computeBoundingSphere();
	field.add(lampMesh);

	const night = rgb(LOOK.night);
	const blank = new DataTexture(new Uint8Array([...LOOK.night, 255]), 1, 1);
	blank.needsUpdate = true;
	const stands = new Mesh(
		new CylinderGeometry(radius, radius, height, 96, 1, true).translate(0, height / 2, 0),
		new ShaderMaterial({
			side: BackSide,
			uniforms: { uMap: { value: blank as Texture }, uLevel: { value: 0.3 }, uNight: { value: night }, uRepeat: { value: LOOK.arena.repeat } },
			vertexShader: /* glsl */ `
				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}`,
			fragmentShader: /* glsl */ `
				uniform sampler2D uMap;
				uniform float uLevel;
				uniform vec3 uNight;
				uniform float uRepeat;
				varying vec2 vUv;
				void main() {
					vec3 photo = texture2D(uMap, vec2(vUv.x * uRepeat, vUv.y)).rgb;
					gl_FragColor = vec4(mix(uNight, photo, uLevel), 1.0);
				}`,
		}),
	);
	field.add(stands);

	const carpetTexture = drawCarpet();
	const carpet = new Mesh(
		new PlaneGeometry(radius * 2.2, radius * 2.2).rotateX(-Math.PI / 2),
		new ShaderMaterial({
			uniforms: { uMap: { value: carpetTexture }, uLevel: { value: 0.3 }, uNight: { value: night }, uSize: { value: [CARPET.w, CARPET.h] } },
			vertexShader: /* glsl */ `
				varying vec2 vXZ;
				void main() {
					vXZ = position.xz;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}`,
			fragmentShader: /* glsl */ `
				uniform sampler2D uMap;
				uniform float uLevel;
				uniform vec3 uNight;
				uniform vec2 uSize;
				varying vec2 vXZ;
				void main() {
					vec3 c = texture2D(uMap, vXZ / uSize + 0.5).rgb;
					// The carpet's pile up close: a fine grain, gone before it is small enough to shimmer.
					vec2 cell = vXZ * 240.0;
					float near = 1.0 - smoothstep(0.3, 0.9, max(fwidth(cell.x), fwidth(cell.y)));
					c *= 1.0 + (fract(52.9829189 * fract(dot(floor(cell), vec2(0.06711056, 0.00583715)))) - 0.5) * 0.1 * near;
					float edge = smoothstep(0.92, 1.5, length(vXZ / vec2(9.6, 5.2)));
					gl_FragColor = vec4(mix(c * uLevel, uNight, edge), 1.0);
				}`,
		}),
	);
	field.add(carpet);

	const loaded: Texture[] = [];
	const lens = new Vector3();
	return {
		field,
		stream,
		/** Hides an alliance wall while the camera is behind it (call after moving the field and the camera). */
		cutaway(cameraWorld: Vector3) {
			field.updateMatrixWorld();
			field.worldToLocal(lens.copy(cameraWorld));
			for (const w of walls) w.visible = lens.x * w.userData.side < L + 0.12;
		},
		/** The arena's light on the carpet and the stands, 0 to 1. */
		house(level: number) {
			(carpet.material as ShaderMaterial).uniforms.uLevel.value = level;
			(stands.material as ShaderMaterial).uniforms.uLevel.value = Math.min(1, level * LOOK.stands);
		},
		/** The stands' photograph: only once the chapter is coming up. */
		async load(anisotropy: number) {
			carpetTexture.anisotropy = anisotropy;
			const texture = await new TextureLoader().loadAsync(LOOK.files.stands);
			texture.wrapS = MirroredRepeatWrapping;
			loaded.push(texture);
			(stands.material as ShaderMaterial).uniforms.uMap.value = texture;
		},
		dispose() {
			for (const t of [carpetTexture, tagTexture, blank, ...loaded]) t.dispose();
		},
	};
}

export default async function createFrcChapter(ctx: StageContext, options: ChapterOptions): Promise<Model> {
	const { camera, scene } = ctx;
	const base = await createRobotShowcase(ctx, STOPS);
	const atmosphere = !options.capture;

	/* ---------- Lights: the arena's, plain white, levelled per beat ---------- */
	const { key, fill, rim } = ctx.lights;
	key.color.set(LOOK.keyColor);
	rim.color.set(LOOK.rimColor);
	let sky: HemisphereLight | undefined;
	scene.traverse((o) => {
		if ((o as HemisphereLight).isHemisphereLight) sky = o as HemisphereLight;
	});
	const lights = STOPS.map((id) => (options.capture ? LOOK.light.anatomy : lightOf(id)));
	const weights = new Float32Array(STOPS.length);
	weights[0] = 1;
	const robotView = { value: new Vector3(0, 0, -2) };
	const field = atmosphere ? buildField(robotView) : undefined;
	const applyLights = () => {
		const l = { key: 0, fill: 0, rim: 0, sky: 0, environment: 0, house: 0 };
		STOPS.forEach((_, i) => {
			for (const k of Object.keys(l) as (keyof Light)[]) l[k] += lights[i][k] * weights[i];
		});
		key.intensity = l.key;
		fill.intensity = l.fill;
		rim.intensity = l.rim;
		if (sky) sky.intensity = l.sky;
		scene.environmentIntensity = l.environment;
		field?.house(l.house);
	};

	if (field) {
		scene.add(field.field);
		field.load(Math.min(8, ctx.renderer.capabilities.getMaxAnisotropy())).then(
			() => ctx.invalidate(),
			() => undefined, // the stands stay the page's own near-black
		);
	}

	/* ---------- The drive: the field moves under the robot, following the scroll ---------- */
	const robotMiddle = new Vector3();
	const state = { at: 0, x: 0, z: 0, heading: 0, travelled: 0, balls: 0 };
	if (atmosphere) (window as unknown as { __kitbotField?: typeof state }).__kitbotField = state;
	const place = (at: number) => {
		if (!field) return;
		const pose = poseAt(at);
		const t = fieldTransform(pose);
		field.field.rotation.y = t.rotationY;
		field.field.position.set(t.x, 0, t.z);
		const rolled = pose.travelled - state.travelled;
		if (rolled) base.wheels(rolled);
		let flying = 0;
		ballsAt(at).forEach((b, i) => {
			const m = field.stream[i];
			m.visible = b.visible;
			if (b.visible) {
				m.position.set(...shotPoint(b.u));
				flying++;
			}
		});
		Object.assign(state, { at, x: pose.x, z: pose.z, heading: pose.heading, travelled: pose.travelled, balls: flying });
		// Where the robot is on screen, for the fade of anything in front of it; no alliance wall in front of the camera.
		camera.updateMatrixWorld();
		field.cutaway(camera.position);
		robotView.value.copy(robotMiddle.set(0, LOOK.robot.y, 0)).applyMatrix4(camera.matrixWorldInverse);
	};

	/* ---------- Framing: on a wide window the robot sits in the right part, clear of the words ---------- */
	const frameShift = (w = ctx.canvas.clientWidth, h = ctx.canvas.clientHeight) => {
		if (!w || !h) return;
		const k = options.capture || w / h < 1.2 ? 1 : LOOK.frame;
		const aspect = (w * k) / h;
		const offset = w - w * k;
		const view = camera.view;
		const right = k === 1 ? !view?.enabled : !!view?.enabled && view.fullWidth === w * k && view.offsetX === -offset && view.width === w;
		if (Math.abs(camera.aspect - aspect) < 1e-6 && right) return;
		camera.aspect = aspect;
		if (k === 1) camera.clearViewOffset();
		else camera.setViewOffset(w * k, h, -offset, 0, w, h);
		camera.updateProjectionMatrix();
	};

	const chapter = {
		...base,
		// The opening beats and the overview keep the whole robot in colour; each part stop fades the rest back.
		whole: [0, 1, 2, 3],
		keepsMoving: options.capture ? undefined : base.keepsMoving, // stills need the full geometry
		focus(w: ArrayLike<number>, explode: number) {
			base.focus?.(w, explode);
			for (let i = 0; i < weights.length; i++) weights[i] = w[i] ?? 0;
			applyLights();
		},
		// The chapter is dark in both themes, as the drone's.
		applyPalette(p: StageContext["palette"]) {
			base.applyPalette?.({ ...p, dark: true });
			applyLights();
		},
	};

	const driven = drive(ctx, chapter, {
		titles: options.titles,
		directScroll: false,
		position: options.position,
		opening: () => 1,
		onStop: options.onStop,
		onFrame: (at) => {
			place(at);
			options.onFrame(at);
		},
	});
	frameShift();
	applyLights();
	return {
		...driven,
		get idle() {
			return driven.idle;
		},
		resize(w, h) {
			frameShift(w, h);
			driven.update?.(0, 0);
		},
		update(t, dt) {
			return driven.update?.(t, dt);
		},
		applyPalette(p) {
			driven.applyPalette?.(p);
			frameShift();
		},
		dispose() {
			field?.dispose();
			const w = window as unknown as { __kitbotField?: unknown };
			if (w.__kitbotField === state) delete w.__kitbotField;
			driven.dispose?.();
		},
	};
}
