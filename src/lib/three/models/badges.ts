/**
 * Member ID badges on lanyards, drawn from each member's content (photo, name, roles, skills).
 *   mode "row":    every member's badge hangs in a row and sways; hover turns one to face you, click opens it.
 *   mode "single": one member's badge turns slowly to show its back (skills).
 */
import {
	CanvasTexture,
	ExtrudeGeometry,
	Group,
	Mesh,
	type MeshBasicMaterial,
	MeshStandardMaterial,
	PlaneGeometry,
	Raycaster,
	RepeatWrapping,
	Shape,
	ShapeGeometry,
	SRGBColorSpace,
	TorusGeometry,
	Vector2,
	BoxGeometry,
} from "three";
import { contactShadow, type Model, type StageContext, type StageView, standard } from "../stage";

export interface BadgeMember {
	id: string;
	name: string;
	/** Leadership line, e.g. "CEO · Mechanical Lead (FRC)". Shown on the front instead of roles when set. */
	title?: string;
	roles: string[];
	img: string;
	skills: Array<{ title: string; level: string }>;
}
interface Options {
	members?: BadgeMember[];
	mode?: "row" | "single";
}

const CARD_W = 0.6;
const CARD_H = 0.9;
const SPACING = 0.86;
const TEX_W = 600;
const TEX_H = 900;
const NAVY = "#0a1a33";
const BLUE = "#1d4ed8"; // --primary
const CYAN = "#22d3ee"; // --accent
const SLOT = "#1b2c4d";
const FONT = '"Archivo Variable", "Arial Black", sans-serif';

export const view = (options: Options): StageView => {
	const count = options.members?.length ?? 1;
	return options.mode === "single"
		? { camera: [0, 0.05, 1.65], target: [0, 0.05, 0], fov: 34, spin: 0.45, minPolar: 1.1, maxPolar: 2.0, fitWidth: 0.9 }
		: { camera: [0, 0.12, 2.2], target: [0, 0.08, 0], fov: 34, minPolar: 1.15, maxPolar: 1.95, fitWidth: count * SPACING + 0.4 };
};

export default function createBadges(ctx: StageContext, options: Options): Model {
	const members = options.members ?? [];
	const single = options.mode === "single";

	const shape = roundedRect(CARD_W, CARD_H, 0.045);
	const bodyGeometry = new ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false, curveSegments: 8 });
	bodyGeometry.translate(0, 0, -0.006);
	const faceGeometry = mapUv(new ShapeGeometry(shape, 8), CARD_W, CARD_H);
	const edgeMaterial = standard(0xf4f6f8, { roughness: 0.5 });
	const clipMaterial = standard(0xc5ccd6, { metalness: 0.9, roughness: 0.25 });
	const strapTexture = strap();
	const strapMaterial = new MeshStandardMaterial({ map: strapTexture, roughness: 0.8 });

	const badges = members.map((member, i) => {
		const pivot = new Group(); // swings from the top of the strap
		pivot.position.set(single ? 0 : (i - (members.length - 1) / 2) * SPACING, 1.35, 0);
		ctx.root.add(pivot);
		const card = new Group();
		card.position.y = -1.35 + 0.05;
		pivot.add(card);

		const front = makeCanvas();
		const back = makeCanvas();
		const frontMaterial = new MeshStandardMaterial({ map: front.texture, roughness: 0.7, envMapIntensity: 0.45 });
		const backMaterial = new MeshStandardMaterial({ map: back.texture, roughness: 0.7, envMapIntensity: 0.45 });
		card.add(new Mesh(bodyGeometry, edgeMaterial));
		const frontFace = new Mesh(faceGeometry, frontMaterial);
		frontFace.position.z = 0.0065;
		card.add(frontFace);
		const backFace = new Mesh(faceGeometry, backMaterial);
		backFace.rotation.y = Math.PI;
		backFace.position.z = -0.0065;
		card.add(backFace);

		// Clip and lanyard
		const clip = new Mesh(new BoxGeometry(0.07, 0.035, 0.018), clipMaterial);
		clip.position.set(0, CARD_H / 2 + 0.01, 0);
		card.add(clip);
		const ring = new Mesh(new TorusGeometry(0.022, 0.005, 8, 24), clipMaterial);
		ring.position.set(0, CARD_H / 2 + 0.045, 0);
		card.add(ring);
		for (const side of [-1, 1]) {
			const band = new Mesh(new PlaneGeometry(0.05, 1.3), strapMaterial);
			band.position.set(side * 0.06, CARD_H / 2 + 0.7, -0.004);
			band.rotation.z = side * -0.09;
			card.add(band);
		}

		// Draw once the photo, logo and font are ready.
		drawFront(front, member).then(() => ctx.invalidate());
		drawBack(back, member).then(() => ctx.invalidate());

		return { member, pivot, card, phase: i * 1.7, hover: 0, faces: [frontFace, backFace] };
	});

	const shadow = contactShadow(single ? 0.45 : members.length * 0.5, 0.25);
	shadow.position.y = -0.55;
	ctx.root.add(shadow);

	/* ---------- Hover and click (row mode) ---------- */
	const raycaster = new Raycaster();
	const pointer = new Vector2();
	let hovered: (typeof badges)[number] | null = null;
	let downAt: { x: number; y: number } | null = null;
	const pick = (event: PointerEvent) => {
		const rect = ctx.canvas.getBoundingClientRect();
		pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
		raycaster.setFromCamera(pointer, ctx.camera);
		const hit = raycaster.intersectObjects(badges.flatMap((b) => b.faces))[0];
		return hit ? badges.find((b) => b.faces.some((face) => face === hit.object)) ?? null : null;
	};
	const onMove = (event: PointerEvent) => {
		if (event.pointerType !== "mouse") return;
		hovered = pick(event);
		ctx.canvas.style.cursor = hovered ? "pointer" : "grab";
		ctx.invalidate();
	};
	const onLeave = () => {
		hovered = null;
		ctx.invalidate();
	};
	const onDown = (event: PointerEvent) => (downAt = { x: event.clientX, y: event.clientY });
	const onUp = (event: PointerEvent) => {
		if (!downAt || Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 6) return;
		const target = pick(event);
		if (target) window.location.href = `/members/${target.member.id}/`;
	};
	if (!single) {
		ctx.canvas.addEventListener("pointermove", onMove);
		ctx.canvas.addEventListener("pointerleave", onLeave);
		ctx.canvas.addEventListener("pointerdown", onDown);
		ctx.canvas.addEventListener("pointerup", onUp);
	}

	return {
		update(t, dt) {
			for (const b of badges) {
				const target = hovered === b ? 1 : 0;
				b.hover += (target - b.hover) * Math.min(1, dt * 8 || 1);
				const calm = 1 - b.hover;
				b.pivot.rotation.z = Math.sin(t * 1.1 + b.phase) * 0.05 * calm;
				b.card.rotation.y = single ? 0 : Math.sin(t * 0.45 + b.phase) * 0.55 * calm;
				b.card.scale.setScalar(1 + b.hover * 0.05);
			}
		},
		applyPalette(p) {
			(shadow.material as MeshBasicMaterial).opacity = p.dark ? 0.5 : 0.22;
		},
		dispose() {
			ctx.canvas.removeEventListener("pointermove", onMove);
			ctx.canvas.removeEventListener("pointerleave", onLeave);
			ctx.canvas.removeEventListener("pointerdown", onDown);
			ctx.canvas.removeEventListener("pointerup", onUp);
		},
	};
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

function roundedRect(w: number, h: number, r: number) {
	const s = new Shape();
	const x = -w / 2;
	const y = -h / 2;
	s.moveTo(x + r, y);
	s.lineTo(x + w - r, y);
	s.quadraticCurveTo(x + w, y, x + w, y + r);
	s.lineTo(x + w, y + h - r);
	s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	s.lineTo(x + r, y + h);
	s.quadraticCurveTo(x, y + h, x, y + h - r);
	s.lineTo(x, y + r);
	s.quadraticCurveTo(x, y, x + r, y);
	return s;
}

/** ShapeGeometry UVs are in shape units; remap them to 0..1 across the card. */
function mapUv(geometry: ShapeGeometry, w: number, h: number) {
	const position = geometry.attributes.position;
	const uv = geometry.attributes.uv;
	for (let i = 0; i < position.count; i++) uv.setXY(i, position.getX(i) / w + 0.5, position.getY(i) / h + 0.5);
	uv.needsUpdate = true;
	return geometry;
}

/* ------------------------------------------------------------------ */
/* Card faces (2D canvas)                                              */
/* ------------------------------------------------------------------ */

function makeCanvas() {
	const canvas = document.createElement("canvas");
	canvas.width = TEX_W;
	canvas.height = TEX_H;
	const c = canvas.getContext("2d")!;
	c.fillStyle = "#ffffff";
	c.fillRect(0, 0, TEX_W, TEX_H);
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.anisotropy = 8;
	return { canvas, c, texture };
}

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
function loadImage(src: string) {
	if (!imageCache.has(src)) {
		imageCache.set(
			src,
			new Promise((resolve) => {
				const img = new Image();
				img.decoding = "async";
				img.onload = () => resolve(img);
				img.onerror = () => resolve(null);
				img.src = src;
			}),
		);
	}
	return imageCache.get(src)!;
}
const fontsReady = () =>
	Promise.all([document.fonts.load(`800 56px ${FONT}`), document.fonts.load(`600 28px ${FONT}`)]).catch(() => undefined);

function roundedPath(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	c.beginPath();
	c.roundRect(x, y, w, h, r);
}

/** Largest font size (down to `min`) at which `text` fits in `width`. */
function fit(c: CanvasRenderingContext2D, text: string, weight: number, size: number, width: number, min = 28) {
	let s = size;
	c.font = `${weight} ${s}px ${FONT}`;
	while (c.measureText(text).width > width && s > min) {
		s -= 2;
		c.font = `${weight} ${s}px ${FONT}`;
	}
}

type Face = ReturnType<typeof makeCanvas>;

async function drawFront({ c, texture }: Face, member: BadgeMember) {
	const [photo, logo] = await Promise.all([loadImage(member.img), loadImage("/assets/jpl-logo-dark.png"), fontsReady()]);
	c.fillStyle = "#ffffff";
	c.fillRect(0, 0, TEX_W, TEX_H);

	// Navy header with logo and the lanyard slot
	c.fillStyle = NAVY;
	c.fillRect(0, 0, TEX_W, 150);
	c.fillStyle = SLOT;
	roundedPath(c, TEX_W / 2 - 50, 18, 100, 16, 8);
	c.fill();
	if (logo) {
		const h = 64;
		c.drawImage(logo, 36, 58, (logo.width / logo.height) * h, h);
	}
	c.fillStyle = CYAN;
	c.font = `700 22px ${FONT}`;
	c.textAlign = "right";
	c.fillText("TEAM MEMBER", TEX_W - 36, 98);

	// Photo, cover-fit from the top
	const box = { x: 40, y: 180, w: TEX_W - 80, h: 450 };
	c.save();
	roundedPath(c, box.x, box.y, box.w, box.h, 22);
	c.clip();
	c.fillStyle = "#e3e8ed";
	c.fillRect(box.x, box.y, box.w, box.h);
	if (photo) {
		const scale = Math.max(box.w / photo.width, box.h / photo.height);
		const w = photo.width * scale;
		c.drawImage(photo, box.x + (box.w - w) / 2, box.y, w, photo.height * scale);
	}
	c.restore();

	// Name and roles
	c.textAlign = "left";
	c.fillStyle = NAVY;
	fit(c, member.name, 800, 56, TEX_W - 80);
	c.fillText(member.name, 40, 710);
	const roleLine = member.title ?? member.roles.slice(0, 2).join(" · ");
	fit(c, roleLine, 600, 26, TEX_W - 80, 18);
	c.fillStyle = "#4f5b6c";
	c.fillText(roleLine, 40, 758);

	// Footer band
	c.fillStyle = BLUE;
	c.fillRect(0, 820, TEX_W, 80);
	c.fillStyle = "#ffffff";
	c.font = `800 26px ${FONT}`;
	c.fillText("JPL INNOVATION", 40, 870);
	c.textAlign = "right";
	c.fillText("HO CHI MINH CITY", TEX_W - 40, 870);
	texture.needsUpdate = true;
}

async function drawBack({ c, texture }: Face, member: BadgeMember) {
	const [logo] = await Promise.all([loadImage("/assets/jpl-logo-dark.png"), fontsReady()]);
	c.fillStyle = NAVY;
	c.fillRect(0, 0, TEX_W, TEX_H);
	c.fillStyle = SLOT;
	roundedPath(c, TEX_W / 2 - 50, 18, 100, 16, 8);
	c.fill();
	if (logo) {
		const w = 300;
		c.drawImage(logo, (TEX_W - w) / 2, 70, w, (logo.height / logo.width) * w);
	}

	c.textAlign = "left";
	c.fillStyle = "#ffffff";
	c.font = `800 34px ${FONT}`;
	c.fillText("Technical skills", 40, 250);
	const levels: Record<string, number> = { Developing: 1, Proficient: 2, Advanced: 3 };
	member.skills.slice(0, 6).forEach((skill, i) => {
		const y = 310 + i * 64;
		c.fillStyle = "#e6edf8";
		c.font = `700 28px ${FONT}`;
		c.fillText(skill.title, 40, y);
		const level = levels[skill.level] ?? 0;
		for (let n = 0; n < 3; n++) {
			c.fillStyle = n < level ? CYAN : SLOT;
			roundedPath(c, TEX_W - 40 - (3 - n) * 44, y - 18, 36, 12, 6);
			c.fill();
		}
	});

	c.fillStyle = "#93a4bd";
	c.font = `600 24px ${FONT}`;
	c.fillText(member.roles.join(" · "), 40, 740, TEX_W - 80);
	c.fillStyle = BLUE;
	c.fillRect(0, 820, TEX_W, 80);
	c.fillStyle = "#ffffff";
	c.font = `700 24px ${FONT}`;
	c.textAlign = "center";
	c.fillText("jpl-innovation.github.io", TEX_W / 2, 870);
	texture.needsUpdate = true;
}

/** Repeating "JPL INNOVATION" lanyard print. */
function strap() {
	const canvas = document.createElement("canvas");
	canvas.width = 64;
	canvas.height = 512;
	const c = canvas.getContext("2d")!;
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.wrapS = texture.wrapT = RepeatWrapping;
	texture.repeat.set(1, 2.6);
	const draw = () => {
		c.fillStyle = BLUE;
		c.fillRect(0, 0, 64, 512);
		c.save();
		c.translate(32, 256);
		c.rotate(-Math.PI / 2);
		c.fillStyle = "#ffffff";
		c.font = `800 30px ${FONT}`;
		c.textAlign = "center";
		c.textBaseline = "middle";
		c.fillText("JPL INNOVATION", 0, 2);
		c.restore();
		texture.needsUpdate = true;
	};
	draw();
	fontsReady().then(draw); // redraw in Archivo once it has loaded
	return texture;
}
