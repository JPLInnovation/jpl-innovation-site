/**
 * The living blueprint's decisions (src/scripts/blueprint.ts draws them): how much of the floor drawing the pen has drawn
 * at this scroll, whether the world is in day or night here, and where the glass tiles with the real parts float.
 * Pure, so `npm test` covers it.
 */

const smooth = (t: number) => t * t * (3 - 2 * t);

/** The share of the floor drawing drawn (0..1): nothing before the page's `start`, all of it by its `end`, eased. */
export function revealAt(scroll: number, page: { start: number; end: number } = { start: 0.05, end: 0.8 }): number {
	if (scroll <= page.start) return 0;
	if (scroll >= page.end) return 1;
	return smooth((scroll - page.start) / (page.end - page.start));
}

/** Day where the section under the middle of the screen asks for it (`data-field="day"`); night otherwise. */
export function dayAt(sections: ReadonlyArray<{ top: number; bottom: number; day: boolean }>, mid: number): boolean {
	return sections.find((s) => mid >= s.top && mid < s.bottom)?.day ?? false;
}

export type Parts = "all" | "drone" | "robot" | "none";

/** Which drawing a page lays on the floor (public/look/drawings/{drawing}.png) and which parts float over it. */
export function fieldFor(pathname: string): { drawing: "f450" | "mini" | "network" | "badge"; parts: Parts } {
	const path = pathname.replace(/\/+$/, "") || "/";
	if (path === "/") return { drawing: "f450", parts: "all" };
	if (path === "/work/drone") return { drawing: "f450", parts: "drone" };
	if (path === "/work/mini-drone") return { drawing: "mini", parts: "drone" };
	if (path === "/work/cybersecurity") return { drawing: "network", parts: "none" };
	if (path === "/work/frc") return { drawing: "badge", parts: "robot" };
	return { drawing: "badge", parts: "all" };
}

export type Tile ={ x: number; y: number; z: number; size: number; spin: number };

/**
 * Where the glass tiles float, in the field's screen space (x and y from -1 to 1 times the aspect, z its depth for
 * parallax): never in the middle third (where text is), never overlapping. The same seed gives the same layout.
 */
export function tileLayout(n: number, seed: number): Tile[] {
	let s = seed;
	const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
	const tiles: Tile[] = [];
	for (let tries = 0; tiles.length < n && tries < n * 400; tries++) {
		const side = rand() < 0.5 ? -1 : 1;
		const t: Tile = { x: side * (0.5 + rand() * 1.15), y: -0.85 + rand() * 1.7, z: 1 + rand() * 2, size: 0.1 + rand() * 0.12, spin: (rand() - 0.5) * 0.6 };
		if (tiles.every((o) => Math.hypot(o.x - t.x, o.y - t.y) >= (o.size + t.size) * 0.9)) tiles.push(t);
	}
	return tiles;
}
