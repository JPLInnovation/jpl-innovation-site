/**
 * The opening hook's blueprint and reassembly (hook-scene.ts), all from the real CAD's own data: the part boxes the
 * .bin stores for every named part (f450-cad.bin, `parts`), and the drone's own triangles.
 *
 *   - blueprintLines: the 12 edges of every part box, one LineSegments draw call. Each part's lines draw in from the
 *     bottom up, and fade as that part seats.
 *   - blueprintTargets: a point on those edges for every particle, so the glowing line can spread into the blueprint.
 *   - explodePieces: the exploded view, to play in reverse: every connected piece of the drone's meshes gets an offset
 *     (outward from the middle, a little up) and an order (bottom to top), as vertex attributes the patched materials read.
 *   - wallBlueprint: the part boxes drawn front-on in faint cyan lines on a panel for the wall; it lights with the lamp.
 */
import {
	AdditiveBlending,
	BufferAttribute,
	BufferGeometry,
	CanvasTexture,
	Color,
	LineSegments,
	Matrix4,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	type Object3D,
	PlaneGeometry,
	ShaderMaterial,
	Vector3,
} from "three";

/** A part's box: min x y z, max x y z (the drone's own space). */
export type PartBox = number[];

/** The part boxes worth drawing: real parts (not the empty or the whole-drone ones). */
export function partBoxes(parts: Record<string, number[]>): PartBox[] {
	return Object.values(parts).filter((b) => b.length === 6 && b[3] > b[0] && b[4] > b[1] && b[5] > b[2]);
}

const EDGES = [
	[0, 1], [1, 3], [3, 2], [2, 0], // bottom
	[4, 5], [5, 7], [7, 6], [6, 4], // top
	[0, 4], [1, 5], [2, 6], [3, 7], // uprights
];
const corner = (b: PartBox, i: number) => new Vector3(i & 1 ? b[3] : b[0], i & 4 ? b[4] : b[1], i & 2 ? b[5] : b[2]);

/** Each box's 12 edges, as segments, with the box's order (0 at the bottom of the drone, 1 at the top). */
function edges(boxes: PartBox[], bottom: number, top: number) {
	const out: { a: Vector3; b: Vector3; order: number }[] = [];
	for (const box of boxes) {
		const order = Math.max(0, Math.min(1, (box[1] - bottom) / Math.max(1e-6, top - bottom)));
		for (const [i, j] of EDGES) out.push({ a: corner(box, i), b: corner(box, j), order });
	}
	return out;
}

export function blueprintLines(boxes: PartBox[], bottom: number, top: number, colour: number) {
	const list = edges(boxes, bottom, top);
	const positions = new Float32Array(list.length * 6);
	const orders = new Float32Array(list.length * 2);
	list.forEach(({ a, b, order }, k) => {
		positions.set([a.x, a.y, a.z, b.x, b.y, b.z], k * 6);
		orders.set([order, order], k * 2);
	});
	const geometry = new BufferGeometry();
	geometry.setAttribute("position", new BufferAttribute(positions, 3));
	geometry.setAttribute("order", new BufferAttribute(orders, 1));
	const material = new ShaderMaterial({
		transparent: true,
		depthWrite: false,
		blending: AdditiveBlending,
		fog: false,
		uniforms: { uReveal: { value: 0 }, uSolid: { value: 0 }, uOpacity: { value: 0 }, uColour: { value: new Color(colour) } },
		vertexShader: /* glsl */ `
			attribute float order;
			uniform float uReveal;
			uniform float uSolid;
			varying float vAlpha;
			void main() {
				// Drawn in from the bottom up; gone as its part seats.
				float drawn = smoothstep(order, order + 0.12, uReveal * 1.12); // (nothing at 0, all at 1)
				float seated = smoothstep(order * 0.7, order * 0.7 + 0.3, uSolid);
				vAlpha = drawn * (1.0 - seated);
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}`,
		fragmentShader: /* glsl */ `
			uniform float uOpacity;
			uniform vec3 uColour;
			varying float vAlpha;
			void main() {
				gl_FragColor = vec4(uColour, uOpacity * vAlpha);
				#include <colorspace_fragment>
			}`,
	});
	const lines = new LineSegments(geometry, material);
	lines.frustumCulled = false;
	return { lines, material };
}

/** A point on the blueprint's edges for each particle (by edge length), and that point's order. */
export function blueprintTargets(geometry: BufferGeometry, boxes: PartBox[], bottom: number, top: number) {
	const list = edges(boxes, bottom, top);
	const lengths = list.map(({ a, b }) => a.distanceTo(b));
	const cumulative = new Float32Array(lengths.length);
	let sum = 0;
	lengths.forEach((l, i) => (cumulative[i] = sum += l));
	const count = geometry.getAttribute("position").count;
	const blue = new Float32Array(count * 3);
	const blueOrder = new Float32Array(count);
	let seed = 17;
	const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	const p = new Vector3();
	for (let i = 0; i < count; i++) {
		const pick = rand() * sum;
		let lo = 0;
		let hi = cumulative.length - 1;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (cumulative[mid] < pick) lo = mid + 1;
			else hi = mid;
		}
		const { a, b, order } = list[lo];
		p.lerpVectors(a, b, rand());
		blue.set([p.x, p.y, p.z], i * 3);
		blueOrder[i] = order;
	}
	geometry.setAttribute("blue", new BufferAttribute(blue, 3));
	geometry.setAttribute("blueOrder", new BufferAttribute(blueOrder, 1));
}

/**
 * The exploded view, for playing in reverse: every connected piece of every lit mesh under `root` gets `hookOffset`
 * (where it starts, relative to where it belongs: outward from the drone's middle and a little up) and `hookOrder`
 * (when it seats: bottom to top). The geometry is shared with the bench drone; its materials don't read these.
 */
export function explodePieces(root: Object3D, spread: number) {
	root.updateMatrixWorld(true);
	const toRoot = new Matrix4().copy(root.matrixWorld).invert();
	const meshes: Mesh[] = [];
	let bottom = Infinity;
	let top = -Infinity;
	const centre = new Vector3();
	let n = 0;
	const v = new Vector3();
	root.traverse((object) => {
		const mesh = object as Mesh;
		if (!mesh.isMesh || !(mesh.material instanceof MeshStandardMaterial) || !mesh.geometry.index) return;
		meshes.push(mesh);
		const m = new Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld);
		const position = mesh.geometry.getAttribute("position");
		for (let i = 0; i < position.count; i += 7) {
			v.fromBufferAttribute(position, i).applyMatrix4(m);
			bottom = Math.min(bottom, v.y);
			top = Math.max(top, v.y);
			centre.add(v);
			n++;
		}
	});
	centre.divideScalar(Math.max(1, n));
	for (const mesh of meshes) {
		const geometry = mesh.geometry;
		if (geometry.getAttribute("hookOffset")) continue;
		const m = new Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld);
		const position = geometry.getAttribute("position");
		const index = geometry.index!;
		// Connected pieces: union-find over the triangles' vertices.
		const parent = Int32Array.from({ length: position.count }, (_, i) => i);
		const find = (x: number) => {
			while (parent[x] !== x) x = parent[x] = parent[parent[x]];
			return x;
		};
		for (let t = 0; t < index.count; t += 3) {
			const r = find(index.getX(t));
			parent[find(index.getX(t + 1))] = r;
			parent[find(index.getX(t + 2))] = r;
		}
		const sums = new Map<number, { x: number; y: number; z: number; n: number }>();
		for (let i = 0; i < position.count; i++) {
			v.fromBufferAttribute(position, i).applyMatrix4(m);
			const r = find(i);
			const s = sums.get(r) ?? { x: 0, y: 0, z: 0, n: 0 };
			s.x += v.x;
			s.y += v.y;
			s.z += v.z;
			s.n++;
			sums.set(r, s);
		}
		const offset = new Float32Array(position.count * 3);
		const order = new Float32Array(position.count);
		const away = new Vector3();
		const pieces = new Map<number, { o: Vector3; k: number }>();
		for (const [r, s] of sums) {
			const c = new Vector3(s.x / s.n, s.y / s.n, s.z / s.n);
			away.copy(c).sub(centre).setY(0);
			const reach = away.length();
			if (reach < 1e-4) away.set(0, 0, 1);
			away.normalize().multiplyScalar(spread * (0.5 + Math.min(1, reach / 0.3) * 0.5));
			away.y += spread * 0.4;
			pieces.set(r, { o: away.clone(), k: Math.max(0, Math.min(1, (c.y - bottom) / Math.max(1e-6, top - bottom))) });
		}
		for (let i = 0; i < position.count; i++) {
			const piece = pieces.get(find(i))!;
			offset.set([piece.o.x, piece.o.y, piece.o.z], i * 3);
			order[i] = piece.k;
		}
		geometry.setAttribute("hookOffset", new BufferAttribute(offset, 3));
		geometry.setAttribute("hookOrder", new BufferAttribute(order, 1));
	}
}

/** The part boxes front-on, in faint cyan lines, on a panel for the wall (width x height, m). It lights with the lamp. */
export function wallBlueprint(boxes: PartBox[], width: number, height: number) {
	const canvas = document.createElement("canvas");
	canvas.width = 1024;
	canvas.height = Math.round((1024 * height) / width);
	const g = canvas.getContext("2d")!;
	let x0 = Infinity;
	let x1 = -Infinity;
	let y0 = Infinity;
	let y1 = -Infinity;
	for (const b of boxes) (x0 = Math.min(x0, b[0])), (x1 = Math.max(x1, b[3])), (y0 = Math.min(y0, b[1])), (y1 = Math.max(y1, b[4]));
	const margin = 0.08;
	const scale = Math.min((canvas.width * (1 - 2 * margin)) / (x1 - x0), (canvas.height * (1 - 2 * margin)) / (y1 - y0));
	const ox = (canvas.width - (x1 - x0) * scale) / 2;
	const oy = (canvas.height - (y1 - y0) * scale) / 2;
	g.strokeStyle = "rgba(150,225,255,0.85)";
	g.lineWidth = 1.6;
	for (const b of boxes) g.strokeRect(ox + (b[0] - x0) * scale, canvas.height - oy - (b[4] - y0) * scale, (b[3] - b[0]) * scale, (b[4] - b[1]) * scale);
	// A centre line, dashed, as on a drawing.
	g.setLineDash([14, 10]);
	g.strokeStyle = "rgba(150,225,255,0.45)";
	g.beginPath();
	g.moveTo(canvas.width / 2, oy * 0.5);
	g.lineTo(canvas.width / 2, canvas.height - oy * 0.5);
	g.stroke();
	const material = new MeshBasicMaterial({ map: new CanvasTexture(canvas), transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, toneMapped: false, fog: false });
	const panel = new Mesh(new PlaneGeometry(width, height), material);
	return { panel, material };
}
