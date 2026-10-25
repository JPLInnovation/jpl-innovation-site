// Reduces the F450 3D layout's GLB export (CAD/f450-drone.glb, from the "Download 3D files" button on the 3D layout page)
// to src/lib/three/models/f450-cad.bin, the file the drone page's 3D model and its intro load.
//
//   - the model is moved to metres with its front on +z (the GLB has a 0.001 scale and a half turn on its root node)
//   - triangles are merged by material, so the whole drone is a few dozen meshes instead of one per part
//   - the four props (and their motor adapters and nuts) are split off, each around its own motor, so they can spin:
//     from the four prop_* nodes of Blender's export (public/models/f450-drone-web.glb), or else by height from the
//     layout's single "Motors and props" part
//   - positions are 16-bit, normals 8-bit, identical vertices are welded, and the file is gzipped
//   - the file also says where each part is (a bounding box per part name) and where the camera lens looks from
//
// File layout (before gzip): u32 header length (padded to 4) · header JSON · for each group, in order: 16-bit
// positions x3, 8-bit normals x3, indices (16-bit, or 32-bit when `w` is 1), each padded to 4 bytes.
//
// Run:  node scripts/f450-cad.mjs [CAD/f450-drone.glb] [src/lib/three/models/f450-cad.bin]
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const [srcPath = "CAD/f450-drone.glb", outPath = "src/lib/three/models/f450-cad.bin"] = process.argv.slice(2);

/* ---------- Read the GLB ---------- */
const glb = readFileSync(srcPath);
if (glb.toString("latin1", 0, 4) !== "glTF") throw new Error(`${srcPath} is not a GLB file`);
let json;
let bin;
for (let at = 12; at < glb.length; ) {
	const size = glb.readUInt32LE(at);
	const type = glb.readUInt32LE(at + 4);
	const data = glb.subarray(at + 8, at + 8 + size);
	if (type === 0x4e4f534a) json = JSON.parse(data.toString("utf8"));
	else if (type === 0x004e4942) bin = data;
	at += 8 + size;
}
const read = (index) => {
	const a = json.accessors[index];
	const v = json.bufferViews[a.bufferView];
	const Type = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[a.componentType];
	const width = { VEC3: 3, SCALAR: 1 }[a.type];
	const start = bin.byteOffset + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
	return new Type(bin.buffer.slice(start, start + a.count * width * Type.BYTES_PER_ELEMENT));
};

/* ---------- The root node's transform (scale and a rotation about y), applied to everything ---------- */
const root = json.nodes[json.scenes[json.scene ?? 0].nodes[0]];
const parts = root.children.map((i) => json.nodes[i]);
// A part may have its own translation, rotation and scale (Blender's export gives the props one at their hub), but no matrix.
for (const n of parts) if (n.matrix) throw new Error(`part "${n.name}" has a matrix transform`);
const k = root.scale ? root.scale[0] : 1;
const rotateBy = ([qx, qy, qz, qw], [x, y, z]) => {
	// v' = v + 2w (q × v) + 2 q × (q × v)
	const tx = 2 * (qy * z - qz * y);
	const ty = 2 * (qz * x - qx * z);
	const tz = 2 * (qx * y - qy * x);
	return [x + qw * tx + (qy * tz - qz * ty), y + qw * ty + (qz * tx - qx * tz), z + qw * tz + (qx * ty - qy * tx)];
};
const rotate = (v) => rotateBy(root.rotation ?? [0, 0, 0, 1], v);
/** A point in a part's own space, in the root's (still millimetres): scale, rotate, then move. */
const place = (n, [x, y, z]) => {
	const [sx, sy, sz] = n.scale ?? [1, 1, 1];
	const [px, py, pz] = rotateBy(n.rotation ?? [0, 0, 0, 1], [x * sx, y * sy, z * sz]);
	const [ox, oy, oz] = n.translation ?? [0, 0, 0];
	return [px + ox, py + oy, pz + oz];
};
/** A part's normals turn with its rotation; a uniform scale doesn't change them, and the export's are 1. */
const turn = (n, v) => rotateBy(n.rotation ?? [0, 0, 0, 1], v);

/* ---------- Triangles by part, in metres ---------- */
const srgb = (c) => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
const materials = [];
const materialIndex = new Map();
const useMaterial = (i) => {
	const m = json.materials[i];
	const p = m.pbrMetallicRoughness;
	const [r, g, b, a] = p.baseColorFactor;
	const rec = { c: "#" + [r, g, b].map((x) => srgb(x).toString(16).padStart(2, "0")).join(""), r: +(p.roughnessFactor ?? 1).toFixed(2), m: +(p.metallicFactor ?? 0).toFixed(2) };
	if (a < 1) rec.o = +a.toFixed(2);
	if (m.doubleSided) rec.ds = 1;
	const key = JSON.stringify(rec);
	if (!materialIndex.has(key)) materialIndex.set(key, materials.push(rec) - 1);
	return materialIndex.get(key);
};
/** All triangles as {material, part, v: [3 × [x, y, z]], n: [3 × [x, y, z]]}. */
const tris = [];
for (const part of parts) {
	for (const prim of json.meshes[part.mesh].primitives) {
		const pos = read(prim.attributes.POSITION);
		const nor = read(prim.attributes.NORMAL);
		const idx = read(prim.indices);
		const mat = useMaterial(prim.material);
		const vertex = (i) => rotate(place(part, [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]).map((x) => x * k));
		const normal = (i) => rotate(turn(part, [nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]]));
		for (let t = 0; t < idx.length; t += 3) {
			const ids = [idx[t], idx[t + 1], idx[t + 2]];
			tris.push({ mat, part: part.name, v: ids.map(vertex), n: ids.map(normal), hub: -1 });
		}
	}
}

/* ---------- Props: one per quadrant, each turning about its own motor ---------- */
// Quadrants in the order the file has always listed the hubs: -x -z, +x -z, -x +z, +x +z.
const quadrantOf = (x, z) => (x < 0 ? 0 : 1) + (z < 0 ? 0 : 2);
const centroid = (t) => [0, 1, 2].map((d) => (t.v[0][d] + t.v[1][d] + t.v[2][d]) / 3);
const hubs = [];
const propNodes = parts.filter((n) => /^prop_/.test(n.name));
if (propNodes.length) {
	// Blender's split export (public/models/f450-drone-web.glb): a node per prop, with its origin at the hub.
	if (propNodes.length !== 4) throw new Error(`expected 4 prop_ nodes, found ${propNodes.length}`);
	for (const n of propNodes) {
		const [x, , z] = rotate(place(n, [0, 0, 0]).map((v) => v * k));
		const q = quadrantOf(x, z);
		if (hubs[q]) throw new Error(`"${n.name}" is in the same quadrant as another prop`);
		hubs[q] = [x, 0, z];
		for (const t of tris) if (t.part === n.name) t.hub = q;
	}
} else {
	// The 3D layout page's export (CAD/f450-drone.glb): one "Motors and props" part, so everything high on the motors.
	const PROP_ABOVE = 0.0635; // metres: above the motor bell (top 63 mm), below the prop adapter's middle
	const motorsAndProps = tris.filter((t) => t.part === "Motors and props" && centroid(t)[1] > PROP_ABOVE);
	for (let q = 0; q < 4; q++) {
		const own = motorsAndProps.filter((t) => quadrantOf(centroid(t)[0], centroid(t)[2]) === q);
		if (!own.length) throw new Error(`no prop found in quadrant ${q}`);
		const xs = own.flatMap((t) => t.v.map((v) => v[0]));
		const zs = own.flatMap((t) => t.v.map((v) => v[2]));
		hubs[q] = [(Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2];
		for (const t of own) t.hub = q;
	}
}

/* ---------- Quantise, weld and group ---------- */
const lo = [Infinity, Infinity, Infinity];
const hi = [-Infinity, -Infinity, -Infinity];
for (const t of tris) for (const v of t.v) for (let d = 0; d < 3; d++) (lo[d] = Math.min(lo[d], v[d])), (hi[d] = Math.max(hi[d], v[d]));
const centre = lo.map((v, d) => (v + hi[d]) / 2);
const half = lo.map((v, d) => (hi[d] - v) / 2);
const quant = (v) => v.map((x, d) => Math.round(((x - centre[d]) / half[d]) * 32767));
const quantNormal = (n) => {
	const l = Math.hypot(...n) || 1;
	return n.map((x) => Math.round((x / l) * 127));
};

const order = [...new Set(tris.map((t) => `${t.hub}:${t.mat}`))].sort((a, b) => Number(a.split(":")[0]) - Number(b.split(":")[0]) || Number(a.split(":")[1]) - Number(b.split(":")[1]));
const groups = order.map((key) => {
	const [hub, mat] = key.split(":").map(Number);
	const weld = new Map();
	const P = [];
	const N = [];
	const I = [];
	for (const t of tris) {
		if (t.hub !== hub || t.mat !== mat) continue;
		const ids = t.v.map((v, c) => {
			const p = quant(v);
			const n = quantNormal(t.n[c]);
			const id = `${p}|${n}`;
			if (!weld.has(id)) {
				weld.set(id, weld.size);
				P.push(...p);
				N.push(...n);
			}
			return weld.get(id);
		});
		if (ids[0] !== ids[1] && ids[1] !== ids[2] && ids[0] !== ids[2]) I.push(...ids);
	}
	return { hub, mat, P, N, I };
});

/* ---------- Where things are: a box per part name, and the camera lens ---------- */
const boxes = {};
for (const t of tris) {
	const b = (boxes[t.part] ??= { lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] });
	for (const v of t.v) for (let d = 0; d < 3; d++) (b.lo[d] = Math.min(b.lo[d], v[d])), (b.hi[d] = Math.max(b.hi[d], v[d]));
}
const round = (v) => Math.round(v * 1e4) / 1e4;
const partBoxes = Object.fromEntries(Object.entries(boxes).map(([name, b]) => [name, [...b.lo, ...b.hi].map(round)]));

// The lens glass is a thin disc of the lens's blue: its middle, and the way it faces (the direction it is thinnest in).
const glass = tris.filter((t) => t.part === "Camera Module 3 lens" && materials[t.mat].c === "#2a4a7a");
if (!glass.length) throw new Error('no blue glass in "Camera Module 3 lens"');
const verts = glass.flatMap((t) => t.v);
const middle = [0, 1, 2].map((d) => verts.reduce((s, v) => s + v[d], 0) / verts.length);
let facing = [0, 0, 1];
let thinnest = Infinity;
for (let a = 0; a < 180; a += 0.5) {
	const d = [0, Math.sin((a * Math.PI) / 180), Math.cos((a * Math.PI) / 180)];
	const along = verts.map((v) => v[0] * d[0] + v[1] * d[1] + v[2] * d[2]);
	const thickness = Math.max(...along) - Math.min(...along);
	if (thickness < thinnest) (thinnest = thickness), (facing = d);
}
if (facing[2] < 0) facing = facing.map((x) => -x); // the front of the drone is +z

/* ---------- Write ---------- */
const pad4 = (n) => (n + 3) & ~3;
const header = {
	centre: centre.map(round),
	half: half.map(round),
	materials,
	hubs: hubs.map((h) => h.map(round)),
	groups: groups.map((g) => ({ m: g.mat, h: g.hub, n: g.P.length / 3, i: g.I.length, w: g.P.length / 3 > 65535 ? 1 : 0 })),
	parts: partBoxes,
	lens: { p: middle.map(round), d: facing.map((x) => Math.round(x * 1e4) / 1e4) },
};
const headerBytes = Buffer.from(JSON.stringify(header));
// The header pads with spaces, not zeros: drone.ts parses the whole padded length as JSON, and spaces are JSON whitespace.
const sections = [Buffer.alloc(4), headerBytes, Buffer.alloc(pad4(headerBytes.length) - headerBytes.length, 0x20)];
sections[0].writeUInt32LE(pad4(headerBytes.length));
const section = (typed) => {
	const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
	sections.push(bytes, Buffer.alloc(pad4(bytes.length) - bytes.length));
};
for (const g of groups) {
	section(Int16Array.from(g.P));
	section(Int8Array.from(g.N));
	section(g.P.length / 3 > 65535 ? Uint32Array.from(g.I) : Uint16Array.from(g.I));
}
const raw = Buffer.concat(sections);
const gz = gzipSync(raw, { level: 9 });
writeFileSync(outPath, gz);

const vertexCount = groups.reduce((s, g) => s + g.P.length / 3, 0);
console.log(`${srcPath} → ${outPath}`);
console.log(`  ${tris.length} triangles in, ${groups.reduce((s, g) => s + g.I.length / 3, 0)} out; ${vertexCount} vertices; ${materials.length} materials, ${groups.length} meshes (${hubs.length} spinning props)`);
console.log(`  ${(glb.length / 1024).toFixed(0)} KB GLB → ${(raw.length / 1024).toFixed(0)} KB → ${(gz.length / 1024).toFixed(0)} KB gzipped`);
console.log(`  lens at ${header.lens.p.join(", ")} facing ${header.lens.d.join(", ")}; hubs ${hubs.map((h) => `(${h[0].toFixed(3)}, ${h[2].toFixed(3)})`).join(" ")}`);
