/**
 * The Work page's project wall (src/components/WorkWall.astro), on the shared 3D stage: one panel per project on an
 * arc in front of the camera. The page's own scroll position moves the wall sideways (the page calls `setTarget`), the
 * panel in front lifts and lights its edge, and the others sit back, dimmer. A click opens the project: the camera
 * pushes into the front panel first (`leave`). The same panel faces as the home studio's wall (src/lib/studio/panels.ts).
 *
 * Nothing here is lit, so the lights cost nothing, and there is no ambient occlusion to draw.
 */
import { CanvasTexture, Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Raycaster, SRGBColorSpace, Vector2, AdditiveBlending, NormalBlending } from "three";
import { projectFace, type PanelProject } from "../../studio/panels";
import type { Model, Palette, StageContext, StageView } from "../stage";

const R = 5.0; // metres from the camera to the front panel
const STEP = 0.37; // radians between neighbouring panels
const W = 1.5;
const H = (W * 720) / 1024;
const FOLLOW = 5; // per second: the spring the wall follows the page's scroll through
const LEAVE = 0.5; // seconds for the push-in

export const view: StageView = { camera: [0, 0, 0], target: [0, 0, -R], fov: 30, orbit: false };

const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const smooth = (x: number) => x * x * (3 - 2 * x);

export interface WallModel extends Model {
	/** Where the page is, in panels: 0 = the first panel in front; fractions in between. */
	setTarget(position: number): void;
	/** The pointer, from -1 to 1 across the canvas (a little parallax); null when it leaves. */
	setPointer(x: number | null, y?: number): void;
	/** The panel under a point of the canvas (client pixels), or -1. */
	pick(clientX: number, clientY: number): number;
	/** The panel in front. */
	front(): number;
	/** Push the camera into the front panel, then resolve. */
	leave(): Promise<void>;
}

export default function createWall(ctx: StageContext, projects: PanelProject[], onFront?: (index: number) => void): WallModel {
	const group = new Group();
	ctx.root.add(group);
	const n = projects.length;

	// A soft glow behind the front panel.
	const glowCanvas = document.createElement("canvas");
	glowCanvas.width = glowCanvas.height = 256;
	{
		const g = glowCanvas.getContext("2d")!;
		const gradient = g.createRadialGradient(128, 128, 0, 128, 128, 128);
		gradient.addColorStop(0, "rgba(255,255,255,0.9)");
		gradient.addColorStop(1, "rgba(255,255,255,0)");
		g.fillStyle = gradient;
		g.fillRect(0, 0, 256, 256);
	}
	const glowTexture = new CanvasTexture(glowCanvas);
	glowTexture.colorSpace = SRGBColorSpace;
	const glowMaterial = new MeshBasicMaterial({ map: glowTexture, color: 0x22d3ee, transparent: true, opacity: 0.35, depthWrite: false, blending: AdditiveBlending });
	const glow = new Mesh(new PlaneGeometry(5.2, 3.6), glowMaterial);
	glow.position.set(0, 0, -R - 0.4);
	group.add(glow);

	const frameGeometry = new PlaneGeometry(W + 0.03, H + 0.03);
	const screenGeometry = new PlaneGeometry(W, H);
	const edgeGeometry = new PlaneGeometry(W + 0.05, H + 0.05);
	const panels = projects.map((project) => {
		const holder = new Group();
		group.add(holder);
		const edge = new Mesh(edgeGeometry, new MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0, depthWrite: false }));
		edge.position.z = -0.004;
		holder.add(edge);
		const frame = new Mesh(frameGeometry, new MeshBasicMaterial({ color: 0x0b1226 }));
		frame.position.z = -0.002;
		holder.add(frame);
		const face = projectFace(project);
		const screenMaterial = new MeshBasicMaterial({ map: face.texture, toneMapped: false });
		const screen = new Mesh(screenGeometry, screenMaterial);
		holder.add(screen);
		return { holder, edge, screen, screenMaterial };
	});

	let dark = true;
	let target = 0;
	let pos = 0;
	let speed = 0;
	let px = 0;
	let py = 0;
	let tpx = 0;
	let tpy = 0;
	let leaveT = -1;
	let leaveDone: (() => void) | undefined;
	let shown = -1;
	const dim = new Color();

	const layout = () => {
		panels.forEach((panel, i) => {
			const d = i - pos;
			const a = d * STEP;
			const lift = smooth(clamp(1 - Math.abs(d) * 1.3));
			panel.holder.position.set(Math.sin(a) * R, 0, -Math.cos(a) * R + lift * 0.4);
			panel.holder.rotation.y = -a;
			panel.holder.scale.setScalar(1 + 0.1 * lift);
			panel.screenMaterial.color.copy(dim.setScalar((dark ? 0.42 : 0.62) + (dark ? 0.58 : 0.38) * lift));
			(panel.edge.material as MeshBasicMaterial).opacity = lift * 0.55;
		});
		glowMaterial.opacity = (dark ? 0.32 : 0.2) * (1 - Math.min(1, Math.abs(pos - Math.round(pos)) * 1.6));
		const front = clamp(Math.round(pos), 0, n - 1);
		if (front !== shown) {
			shown = front;
			onFront?.(front);
		}
	};

	const raycaster = new Raycaster();
	const ndc = new Vector2();
	layout();

	return {
		setTarget(position) {
			target = clamp(position, 0, n - 1);
			ctx.wake();
		},
		setPointer(x, y = 0) {
			tpx = x ?? 0;
			tpy = y;
			ctx.wake();
		},
		pick(clientX, clientY) {
			const rect = ctx.canvas.getBoundingClientRect();
			ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
			raycaster.setFromCamera(ndc, ctx.camera);
			const hits = raycaster.intersectObjects(panels.map((p) => p.screen), false);
			return hits.length ? panels.findIndex((p) => p.screen === hits[0].object) : -1;
		},
		front: () => shown,
		leave() {
			if (ctx.reducedMotion) return Promise.resolve();
			leaveT = 0;
			ctx.wake();
			return new Promise((resolve) => (leaveDone = resolve));
		},
		update(_t, dt) {
			// The wall follows the page through a critically damped spring: about 0.7 s to settle, never overshooting.
			const e = Math.exp(-FOLLOW * dt);
			const x = pos - target;
			const k = speed + FOLLOW * x;
			pos = target + (x + k * dt) * e;
			speed = (speed - FOLLOW * k * dt) * e;
			const f = 1 - Math.exp(-6 * dt);
			px += (tpx - px) * f;
			py += (tpy - py) * f;
			layout();

			let push = 0;
			if (leaveT >= 0) {
				leaveT += dt / LEAVE;
				push = smooth(clamp(leaveT));
				if (leaveT >= 1) {
					leaveT = -1;
					leaveDone?.();
					leaveDone = undefined;
				}
			}
			ctx.camera.position.set(px * 0.4, -py * 0.14, -push * (R - 2.4));
			ctx.camera.lookAt(px * 0.05, 0.12 - py * 0.02, -R + 0.4); // a little high, so the wall sits low in the frame, under the heading
			ctx.occlusion = 0;

			const moving = Math.abs(pos - target) > 0.0005 || Math.abs(speed) > 0.0005 || Math.abs(tpx - px) > 0.0005 || Math.abs(tpy - py) > 0.0005 || leaveT >= 0;
			return moving;
		},
		applyPalette(p: Palette) {
			dark = p.dark;
			glowMaterial.color.set(dark ? 0x22d3ee : 0x1d4ed8);
			glowMaterial.blending = dark ? AdditiveBlending : NormalBlending;
			glowMaterial.needsUpdate = true;
			layout();
		},
	};
}
