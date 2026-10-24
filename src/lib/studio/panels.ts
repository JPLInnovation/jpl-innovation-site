/**
 * A project's panel face: an exhibition poster with the project's picture, its title, its status and its address on
 * the site, drawn into a canvas texture at 2048 x 1440. Shared by the home studio's project wall (stations.ts, where
 * the panel itself has cut corners: `cutCorners`) and the Work page's wall (src/lib/three/models/work-wall.ts).
 *
 * The look: the picture sits inset in a navy frame, its top-right and bottom-left corners cut like the panel's; a
 * cyan line of light runs under it; the title in the site's wide display type; the status as a chip; the page's
 * address in mono, as on a gallery label.
 */
import { BufferAttribute, Shape, ShapeGeometry } from "three";
import { canvasSurface, loadImage } from "./room";

export interface PanelProject {
	title: string;
	/** Path under public/. */
	img: string;
	/** The status chip, e.g. "Build in progress". */
	badge?: string;
	/** The project's page, e.g. "/work/drone/" (shown small, like a gallery label). */
	href?: string;
}

export const PANEL_FONT = '"Archivo Variable", "Archivo", system-ui, sans-serif';
export const PANEL_MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

/** The panel's cut corners, as a share of its width (the poster's picture follows the same cut). */
export const CUT = 0.075;

/** Draws `img` into the box, cropped to fill it (like CSS object-fit: cover). */
export function cover(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
	const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
	const sw = w / scale;
	const sh = h / scale;
	g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

/** A rectangle with its top-right and bottom-left corners cut by `c`, as a canvas path. */
function cutPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: number) {
	g.beginPath();
	g.moveTo(x, y);
	g.lineTo(x + w - c, y);
	g.lineTo(x + w, y + c);
	g.lineTo(x + w, y + h);
	g.lineTo(x + c, y + h);
	g.lineTo(x, y + h - c);
	g.closePath();
}

/** The panel's outline in metres (centred), with the same cut corners, for the 3D wall's frames and screens. */
export function cutCorners(w: number, h: number, c = CUT * w) {
	const shape = new Shape();
	shape.moveTo(-w / 2, h / 2);
	shape.lineTo(w / 2 - c, h / 2);
	shape.lineTo(w / 2, h / 2 - c);
	shape.lineTo(w / 2, -h / 2);
	shape.lineTo(-w / 2 + c, -h / 2);
	shape.lineTo(-w / 2, -h / 2 + c);
	shape.closePath();
	return shape;
}

/** A flat surface in that outline, with texture coordinates spanning its full width and height. */
export function cutCornerSurface(w: number, h: number) {
	const geometry = new ShapeGeometry(cutCorners(w, h));
	const position = geometry.getAttribute("position");
	const uv = new Float32Array(position.count * 2);
	for (let i = 0; i < position.count; i++) {
		uv[i * 2] = position.getX(i) / w + 0.5;
		uv[i * 2 + 1] = position.getY(i) / h + 0.5;
	}
	geometry.setAttribute("uv", new BufferAttribute(uv, 2));
	return geometry;
}

const W = 2048;
const H = 1440;

/** The poster for `project`; the picture arrives a moment later and the texture updates by itself. */
export function projectFace(project: PanelProject) {
	const face = canvasSurface(W, H);
	let img: HTMLImageElement | undefined;
	const draw = () => {
		const { g } = face;
		// The frame: deep navy, a faint sheen from the top left.
		g.fillStyle = "#0a1124";
		g.fillRect(0, 0, W, H);
		const sheen = g.createLinearGradient(0, 0, W, H);
		sheen.addColorStop(0, "rgba(103,232,249,0.08)");
		sheen.addColorStop(0.45, "rgba(103,232,249,0)");
		g.fillStyle = sheen;
		g.fillRect(0, 0, W, H);

		// The picture, inset, its corners cut like the panel's (the panel's own cut is CUT of its width).
		const m = 56;
		const pw = W - m * 2;
		const ph = 900;
		const c = CUT * W - m * 0.4;
		g.save();
		cutPath(g, m, m, pw, ph, c);
		g.clip();
		if (img) cover(g, img, m, m, pw, ph);
		else {
			g.fillStyle = "#16224a";
			g.fillRect(m, m, pw, ph);
		}
		const fade = g.createLinearGradient(0, m + ph * 0.62, 0, m + ph);
		fade.addColorStop(0, "rgba(10,17,36,0)");
		fade.addColorStop(1, "rgba(10,17,36,0.55)");
		g.fillStyle = fade;
		g.fillRect(m, m, pw, ph);
		g.restore();
		// A hairline round the picture.
		g.strokeStyle = "rgba(255,255,255,0.14)";
		g.lineWidth = 3;
		cutPath(g, m, m, pw, ph, c);
		g.stroke();
		// The line of light under it.
		const line = g.createLinearGradient(m, 0, m + pw, 0);
		line.addColorStop(0, "rgba(34,211,238,0)");
		line.addColorStop(0.18, "rgba(34,211,238,0.95)");
		line.addColorStop(0.82, "rgba(34,211,238,0.95)");
		line.addColorStop(1, "rgba(34,211,238,0)");
		g.fillStyle = line;
		g.fillRect(m, m + ph + 26, pw, 5);

		// The title, in the site's wide display type.
		g.textBaseline = "alphabetic";
		g.fillStyle = "#f3f6fc";
		let size = 132;
		g.font = `900 expanded ${size}px ${PANEL_FONT}`;
		while (g.measureText(project.title).width > pw - 40 && size > 80) {
			size -= 6;
			g.font = `900 expanded ${size}px ${PANEL_FONT}`;
		}
		g.fillText(project.title, m + 8, m + ph + 196);

		// The status chip, and the page's address on the right, like a gallery label.
		const row = m + ph + 318;
		if (project.badge) {
			g.font = `600 60px ${PANEL_MONO}`;
			const tw = g.measureText(project.badge).width;
			g.fillStyle = "rgba(34,211,238,0.16)";
			g.beginPath();
			g.roundRect(m + 8, row - 68, tw + 116, 96, 48);
			g.fill();
			g.strokeStyle = "rgba(34,211,238,0.55)";
			g.lineWidth = 3;
			g.stroke();
			g.fillStyle = "#22d3ee";
			g.beginPath();
			g.arc(m + 56, row - 20, 13, 0, Math.PI * 2);
			g.fill();
			g.fillStyle = "#e6f6ff";
			g.fillText(project.badge, m + 88, row);
		}
		if (project.href) {
			g.font = `500 50px ${PANEL_MONO}`;
			g.fillStyle = "rgba(197,206,224,0.7)";
			g.textAlign = "right";
			g.fillText(project.href, W - m - 8, row);
			g.textAlign = "start";
		}
		face.redraw();
	};
	draw();
	loadImage(project.img, 2048).then((loaded) => {
		img = loaded;
		draw();
	}, () => undefined);
	document.fonts?.ready.then(draw); // again in Archivo once it is in
	return face;
}
