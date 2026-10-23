/**
 * Warms the browser's cache while the logo intro plays, so the room is complete the moment it appears: the pictures it
 * hangs on its walls and screens, the sketchbook's handwriting and the drone's CAD file (the robot's is in its script). Nothing here runs the 3D or
 * costs the intro a frame: they are low-priority hints and two small scripts.
 */
import type { RoomContent } from "./room";
import droneCad from "../three/models/f450-cad.bin?url";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function warmRoom(content: RoomContent) {
	const seen = new Set<string>();
	const hint = (href: string, as: "image" | "fetch") => {
		if (seen.has(href)) return;
		seen.add(href);
		const link = document.createElement("link");
		link.rel = "prefetch";
		link.as = as;
		link.href = href;
		document.head.append(link);
	};
	for (const p of content.projects) hint(p.img.startsWith("/") ? BASE + p.img : p.img, "image");
	for (const p of content.portraits) hint(p.img.startsWith("/") ? BASE + p.img : p.img, "image");
	for (const path of ["/studio/research.webp", "/studio/site.webp", "/assets/jpl-logo-dark-480.webp", "/assets/jpl-logo-light-480.webp"]) hint(BASE + path, "image");
	hint(droneCad, "fetch");
	// The sketchbook's handwriting (declared in global.css; a canvas only uses a font that is already loaded).
	document.fonts?.load('600 40px "Caveat"').catch(() => undefined);
	// The robot's and the drone's scripts (the room loads them when it is built).
	import("../three/models/frc-robot").catch(() => undefined);
	import("../three/models/drone").catch(() => undefined);
}
