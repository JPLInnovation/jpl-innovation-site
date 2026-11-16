// Draws Vietnam's outline for the members' map from Natural Earth (public domain, naturalearthdata.com), thinned to a
// hand-drawn line, into src/components/members/vietnam-map.ts. Run once, with the 1:10m countries file downloaded from
// https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson
//   node scripts/build-vietnam-map.mjs path/to/ne_10m_admin_0_countries.geojson
// Hoàng Sa and Trường Sa are marked as Vietnamese maps mark them: Trường Sa from the same file, Hoàng Sa (not a
// separate feature there) from its islands' published positions.
import { readFileSync, writeFileSync } from "node:fs";
import { SIZE, project, simplify } from "../src/lib/look/vnmap.ts";

const file = process.argv[2];
if (!file) throw new Error("usage: node scripts/build-vietnam-map.mjs ne_10m_admin_0_countries.geojson");
const features = JSON.parse(readFileSync(file, "utf8")).features;
const find = (name) => features.find((f) => f.properties.NAME === name);
const rings = (f) => (f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates]).map((p) => p[0]);

const area = (pts) => Math.abs(pts.reduce((s, p, i) => s + p[0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * p[1], 0)) / 2;
const centroid = (pts) => pts.reduce((c, p) => [c[0] + p[0] / pts.length, c[1] + p[1] / pts.length], [0, 0]);
const r1 = (n) => Math.round(n * 10) / 10;

// The mainland and the islands big enough to read at this size (Phú Quốc, Côn Đảo, Cát Bà…); the rest are too small.
const land = rings(find("Vietnam"))
	.map((ring) => ring.map(([lon, lat]) => project(lat, lon)))
	.filter((pts) => area(pts) > 6)
	.map((pts) => simplify(pts, 1.1))
	.filter((pts) => pts.length > 3)
	.map((pts) => `M${pts.map((p) => `${r1(p[0])} ${r1(p[1])}`).join("L")}Z`)
	.join("");

const truongSa = rings(find("Spratly Is.")).map((ring) => centroid(ring.map(([lon, lat]) => project(lat, lon))).map(r1));
// Hoàng Sa: Phú Lâm, Hoàng Sa, Linh Côn, Tri Tôn, Quang Hòa, Hữu Nhật, Cây, Bắc (degrees N, E)
const hoangSa = [
	[16.834, 112.338], [16.53, 111.61], [16.67, 112.73], [15.78, 111.2], [16.45, 111.71], [16.52, 111.58], [16.98, 112.26], [17.08, 111.5],
].map(([lat, lon]) => project(lat, lon).map(r1));

writeFileSync(
	"src/components/members/vietnam-map.ts",
	`// Made by scripts/build-vietnam-map.mjs from Natural Earth (public domain). Don't edit by hand: re-run the script.
export const VIETNAM = {
	w: ${r1(SIZE.w)},
	h: ${r1(SIZE.h)},
	land: "${land}",
	hoangSa: ${JSON.stringify(hoangSa)} as [number, number][],
	truongSa: ${JSON.stringify(truongSa)} as [number, number][],
};
`,
);
console.log(`land path ${land.length} chars, ${hoangSa.length} + ${truongSa.length} island marks`);
