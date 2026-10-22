/**
 * A project's panel face: its picture, its title and its status chip, drawn into a canvas texture. Shared by the home
 * studio's project wall (stations.ts) and the Work page's wall (src/lib/three/models/work-wall.ts), so they match.
 */
import { canvasSurface, loadImage } from "./room";

export interface PanelProject {
	title: string;
	/** Path under public/. */
	img: string;
	/** The status chip, e.g. "Build in progress". */
	badge?: string;
}

export const PANEL_FONT = '"Archivo Variable", "Archivo", system-ui, sans-serif';
export const PANEL_MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

/** Draws `img` into the box, cropped to fill it (like CSS object-fit: cover). */
export function cover(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
	const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
	const sw = w / scale;
	const sh = h / scale;
	g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

/** A 1024 x 720 face for `project`; the picture arrives a moment later and the texture updates by itself. */
export function projectFace(project: PanelProject) {
	const face = canvasSurface(1024, 720);
	const draw = (img?: HTMLImageElement) => {
		const { g } = face;
		g.fillStyle = "#0b1226";
		g.fillRect(0, 0, 1024, 720);
		if (img) cover(g, img, 0, 0, 1024, 560);
		else {
			g.fillStyle = "#16224a";
			g.fillRect(0, 0, 1024, 560);
		}
		const fade = g.createLinearGradient(0, 420, 0, 560);
		fade.addColorStop(0, "rgba(11,18,38,0)");
		fade.addColorStop(1, "rgba(11,18,38,0.85)");
		g.fillStyle = fade;
		g.fillRect(0, 420, 1024, 140);
		g.fillStyle = "#f3f6fc";
		g.font = `800 64px ${PANEL_FONT}`;
		g.textBaseline = "alphabetic";
		g.fillText(project.title, 40, 640);
		if (project.badge) {
			g.font = `500 30px ${PANEL_MONO}`;
			const w = g.measureText(project.badge).width;
			g.fillStyle = "rgba(255,255,255,0.1)";
			g.beginPath();
			g.roundRect(40, 668, w + 56, 40, 20);
			g.fill();
			g.fillStyle = "#ffc20e";
			g.beginPath();
			g.arc(62, 688, 7, 0, Math.PI * 2);
			g.fill();
			g.fillStyle = "#cfe0ff";
			g.fillText(project.badge, 80, 699);
		}
		face.redraw();
	};
	draw();
	loadImage(project.img).then(draw, () => undefined);
	return face;
}
