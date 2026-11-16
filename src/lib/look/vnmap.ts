/**
 * The members' map of Vietnam (src/components/members/VietnamMap.astro): where a place sits on the drawing, how the
 * outline was thinned (scripts/build-vietnam-map.mjs), and where the stops of a person's path fall along their route.
 * Pure, so `npm test` covers it.
 */

type Pt = [number, number];

/** The map's frame in degrees (the mainland, Hoàng Sa and Trường Sa), and drawing units per degree of latitude. */
export const FRAME = { west: 101.8, north: 23.6, east: 116, south: 7.4, k: 60 } as const;
/** A degree of longitude is cos(latitude) of a degree of latitude: taken at 16°N, the middle of the country. */
const KX = FRAME.k * Math.cos((16 * Math.PI) / 180);
export const SIZE = { w: (FRAME.east - FRAME.west) * KX, h: (FRAME.north - FRAME.south) * FRAME.k };

/** A place (degrees) on the drawing (units; y down). */
export function project(lat: number, lon: number): Pt {
	return [(lon - FRAME.west) * KX, (FRAME.north - lat) * FRAME.k];
}

/** Douglas–Peucker: drop the points that sit within `epsilon` of the line between the ones kept. Ends always kept. */
export function simplify(line: Pt[], epsilon: number): Pt[] {
	if (line.length < 3) return line;
	const [a, b] = [line[0], line[line.length - 1]];
	const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
	const off = (p: Pt) =>
		len === 0 ? Math.hypot(p[0] - a[0], p[1] - a[1]) : Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len;
	let far = 0;
	let at = 0;
	for (let i = 1; i < line.length - 1; i++) {
		const d = off(line[i]);
		if (d > far) [far, at] = [d, i];
	}
	if (far <= epsilon) return [a, b];
	return [...simplify(line.slice(0, at + 1), epsilon).slice(0, -1), ...simplify(line.slice(at), epsilon)];
}

/**
 * A person's route (degrees, [lat, lon]): from their first place out to the coast, down the coast and in to their
 * last place, so it reads as a voyage down the country instead of a line across the mountains. Places between are
 * marked on the map but not visited. Needs two places; otherwise there is no route.
 */
export function routeVia(places: Pt[], coast: Pt[]): Pt[] {
	if (places.length < 2) return [];
	const [a, b] = [places[0], places[places.length - 1]];
	const [hi, lo] = a[0] > b[0] ? [a[0] - 0.3, b[0] - 0.7] : [b[0] - 0.3, a[0] - 0.7];
	const between = coast.filter(([lat]) => lat < hi && lat > lo);
	return [a, ...(a[0] > b[0] ? between : between.reverse()), b];
}

/** A smooth curve through the points (Catmull–Rom), as a polyline with `steps` pieces per span. */
export function smooth(points: Pt[], steps: number): Pt[] {
	if (!points.length) return [];
	const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
	const out: Pt[] = [points[0]];
	for (let i = 0; i < points.length - 1; i++) {
		const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
		for (let s = 1; s <= steps; s++) {
			const t = s / steps;
			const t2 = t * t;
			const t3 = t2 * t;
			const c = (k: 0 | 1) =>
				0.5 * (2 * p1[k] + (p2[k] - p0[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t3);
			out.push(s === steps ? p2 : [c(0), c(1)]);
		}
	}
	return out;
}

/** `n` stops spaced evenly by distance along a polyline, the first at its start and (n > 1) the last at its end. */
export function pointsAlong(line: Pt[], n: number): Pt[] {
	const seg = line.slice(1).map((p, i) => Math.hypot(p[0] - line[i][0], p[1] - line[i][1]));
	const total = seg.reduce((s, d) => s + d, 0);
	return Array.from({ length: n }, (_, k) => {
		let left = n > 1 ? (total * k) / (n - 1) : 0;
		for (let i = 0; i < seg.length; i++) {
			if (left <= seg[i] || i === seg.length - 1) {
				const t = seg[i] ? Math.min(1, left / seg[i]) : 0;
				return [line[i][0] + (line[i + 1][0] - line[i][0]) * t, line[i][1] + (line[i + 1][1] - line[i][1]) * t] as Pt;
			}
			left -= seg[i];
		}
		return line[0];
	});
}
