/**
 * The opening hook's dissolve (hook-scene.ts): the desk drone's own materials, cloned and patched so a cut sweeps down
 * through it and discards what is above, with a glowing edge; and the particles it turns into, sampled from its surface
 * (the real CAD's triangles, weighted by area, coloured by the material under them).
 *
 * One Points draw call; every motion is in its vertex shader, driven by a few uniforms (no CPU per frame). The cut is in
 * world space, so the drone's props (inside their hub groups) dissolve with the rest. Then the particles collapse into
 * one glowing line (uCollapse), each keeping its place from left to right; a soft sprite behind it is the glow (no
 * post-processing).
 */
import {
	BufferAttribute,
	BufferGeometry,
	Color,
	type Material,
	Matrix4,
	type Mesh,
	MeshStandardMaterial,
	type Object3D,
	Points,
	ShaderMaterial,
	Sprite,
	SpriteMaterial,
	AdditiveBlending,
	CanvasTexture,
	Vector3,
} from "three";

/** The uniforms every patched material shares: where the cut is (world y) and the colour of its edge. */
export interface DissolveUniforms {
	uHookCut: { value: number };
	uHookEdge: { value: Color };
}

const NOISE = /* glsl */ `
	float hookHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
	float hookNoise(vec3 p) {
		vec3 i = floor(p);
		vec3 f = fract(p);
		f = f * f * (3.0 - 2.0 * f);
		return mix(
			mix(mix(hookHash(i), hookHash(i + vec3(1, 0, 0)), f.x), mix(hookHash(i + vec3(0, 1, 0)), hookHash(i + vec3(1, 1, 0)), f.x), f.y),
			mix(mix(hookHash(i + vec3(0, 0, 1)), hookHash(i + vec3(1, 0, 1)), f.x), mix(hookHash(i + vec3(0, 1, 1)), hookHash(i + vec3(1, 1, 1)), f.x), f.y),
			f.z);
	}`;

/** Gives every lit mesh under `root` its own copy of its material, patched with the cut. Returns the copies. */
export function dissolveMaterials(root: Object3D, uniforms: DissolveUniforms) {
	const copies = new Map<Material, Material>();
	root.traverse((object) => {
		const mesh = object as Mesh;
		if (!mesh.isMesh || !(mesh.material instanceof MeshStandardMaterial)) return;
		const original = mesh.material;
		let copy = copies.get(original);
		if (!copy) {
			const m = original.clone();
			// Keep the finish's own patch (finish.ts), then add the cut.
			const previous = original.onBeforeCompile;
			const previousKey = original.customProgramCacheKey.bind(original);
			m.onBeforeCompile = (shader, renderer) => {
				previous.call(m, shader, renderer);
				Object.assign(shader.uniforms, uniforms);
				shader.vertexShader = shader.vertexShader
					.replace("void main() {", "varying vec3 vHookWorld;\nvoid main() {")
					.replace("#include <project_vertex>", "#include <project_vertex>\n\tvHookWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
				shader.fragmentShader = shader.fragmentShader
					.replace("void main() {", `uniform float uHookCut;\nuniform vec3 uHookEdge;\nvarying vec3 vHookWorld;\n${NOISE}\nvoid main() {`)
					.replace(
						"#include <clipping_planes_fragment>",
						"#include <clipping_planes_fragment>\n\tfloat hookD = vHookWorld.y + (hookNoise(vHookWorld * 70.0) - 0.5) * 0.03 - uHookCut;\n\tif (hookD > 0.0) discard;",
					)
					.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += uHookEdge * (1.0 - smoothstep(0.0, 0.012, -hookD));");
			};
			m.customProgramCacheKey = () => `${previousKey()}|hook-cut`;
			copy = m;
			copies.set(original, copy);
		}
		mesh.material = copy;
	});
	return [...copies.values()];
}

export interface Particles {
	points: Points;
	material: ShaderMaterial;
	/** The line they collapse into, in the drone's own space: its ends. */
	line: [Vector3, Vector3];
}

/**
 * `count` points on the surface of the meshes under `root`, in `root`'s own space, weighted by area and coloured by the
 * material under each. They show once the cut has passed them and drift off, upward and outward.
 */
export function surfaceParticles(root: Object3D, count: number, uniforms: DissolveUniforms): Particles {
	root.updateMatrixWorld(true);
	const toRoot = new Matrix4().copy(root.matrixWorld).invert();
	type Source = { mesh: Mesh; matrix: Matrix4; colour: Color; areas: Float32Array; total: number };
	const sources: Source[] = [];
	const a = new Vector3();
	const b = new Vector3();
	const c = new Vector3();
	let total = 0;
	root.traverse((object) => {
		const mesh = object as Mesh;
		if (!mesh.isMesh || !(mesh.material instanceof MeshStandardMaterial) || !mesh.geometry.index) return;
		if (mesh.geometry.type === "BoxGeometry") return; // (the FC's little LED)
		const matrix = new Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld);
		const position = mesh.geometry.getAttribute("position");
		const index = mesh.geometry.index;
		const areas = new Float32Array(index.count / 3);
		let sum = 0;
		for (let t = 0; t < areas.length; t++) {
			a.fromBufferAttribute(position, index.getX(t * 3)).applyMatrix4(matrix);
			b.fromBufferAttribute(position, index.getX(t * 3 + 1)).applyMatrix4(matrix);
			c.fromBufferAttribute(position, index.getX(t * 3 + 2)).applyMatrix4(matrix);
			sum += b.sub(a).cross(c.sub(a)).length() / 2;
			areas[t] = sum; // cumulative
		}
		sources.push({ mesh, matrix, colour: (mesh.material as MeshStandardMaterial).color, areas, total: sum });
		total += sum;
	});

	const positions = new Float32Array(count * 3);
	const colours = new Float32Array(count * 3);
	const seeds = new Float32Array(count);
	let seed = 9;
	const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	for (let i = 0; i < count; i++) {
		// A source by area, a triangle in it by area, a point in the triangle.
		let pick = rand() * total;
		let s = sources[0];
		for (const source of sources) {
			if (pick <= source.total) {
				s = source;
				break;
			}
			pick -= source.total;
		}
		let lo = 0;
		let hi = s.areas.length - 1;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (s.areas[mid] < pick) lo = mid + 1;
			else hi = mid;
		}
		const position = s.mesh.geometry.getAttribute("position");
		const index = s.mesh.geometry.index!;
		a.fromBufferAttribute(position, index.getX(lo * 3)).applyMatrix4(s.matrix);
		b.fromBufferAttribute(position, index.getX(lo * 3 + 1)).applyMatrix4(s.matrix);
		c.fromBufferAttribute(position, index.getX(lo * 3 + 2)).applyMatrix4(s.matrix);
		let u = rand();
		let v = rand();
		if (u + v > 1) (u = 1 - u), (v = 1 - v);
		const p = a.clone().add(b.sub(a).multiplyScalar(u)).add(c.sub(a).multiplyScalar(v));
		positions.set([p.x, p.y, p.z], i * 3);
		colours.set([s.colour.r, s.colour.g, s.colour.b], i * 3);
		seeds[i] = rand();
	}
	// The line: level, through the middle of the drone, as wide as most of it; each particle keeps its place along it.
	let x0 = Infinity;
	let x1 = -Infinity;
	let ySum = 0;
	let zSum = 0;
	for (let i = 0; i < count; i++) {
		x0 = Math.min(x0, positions[i * 3]);
		x1 = Math.max(x1, positions[i * 3]);
		ySum += positions[i * 3 + 1];
		zSum += positions[i * 3 + 2];
	}
	const along = new Float32Array(count);
	for (let i = 0; i < count; i++) along[i] = (positions[i * 3] - x0) / Math.max(1e-6, x1 - x0);
	const inset = (x1 - x0) * 0.08;
	const line: [Vector3, Vector3] = [new Vector3(x0 + inset, ySum / count, zSum / count), new Vector3(x1 - inset, ySum / count, zSum / count)];
	const geometry = new BufferGeometry();
	geometry.setAttribute("position", new BufferAttribute(positions, 3));
	geometry.setAttribute("along", new BufferAttribute(along, 1));
	geometry.setAttribute("colour", new BufferAttribute(colours, 3));
	geometry.setAttribute("seed", new BufferAttribute(seeds, 1));

	const material = new ShaderMaterial({
		transparent: true,
		depthWrite: false,
		fog: false,
		uniforms: {
			uHookCut: uniforms.uHookCut,
			uAfter: { value: 0 },
			uTime: { value: 0 },
			uSize: { value: 2.3 * Math.min(window.devicePixelRatio, 1.5) },
			uOpacity: { value: 0 },
			uCollapse: { value: 0 },
			uLineA: { value: line[0] },
			uLineB: { value: line[1] },
			uLineColour: { value: new Color(0x9fe8ff) },
		},
		vertexShader: /* glsl */ `
			attribute vec3 colour;
			attribute float seed;
			attribute float along;
			uniform float uCollapse;
			uniform vec3 uLineA;
			uniform vec3 uLineB;
			uniform vec3 uLineColour;
			uniform float uHookCut;
			uniform float uAfter;
			uniform float uTime;
			uniform float uSize;
			uniform float uOpacity;
			varying vec3 vColour;
			varying float vAlpha;
			void main() {
				float worldY = (modelMatrix * vec4(position, 1.0)).y;
				// Out once the cut has passed it; how far it has gone grows with how long ago (the cut moves steadily).
				float since = max(worldY - uHookCut, 0.0) * 1.4 + uAfter * 0.05;
				float released = smoothstep(0.0, 0.015, worldY - uHookCut);
				vec3 away = normalize(vec3(sin(seed * 91.7), 0.7 + 0.5 * fract(seed * 13.3), cos(seed * 53.1)));
				vec3 drift = away * since * 0.35;
				drift += vec3(sin(uTime * 0.8 + seed * 40.0), sin(uTime * 0.6 + seed * 23.0), cos(uTime * 0.7 + seed * 31.0)) * 0.012 * released;
				vec3 free = position + drift * released;
				// The collapse: each particle onto its place along the line, a little after its neighbours (by its seed),
				// and the line breathes a hair.
				float c = clamp(uCollapse * 1.5 - seed * 0.5, 0.0, 1.0);
				c = c * c * (3.0 - 2.0 * c);
				vec3 onLine = mix(uLineA, uLineB, along) + vec3(0.0, sin(uTime * 2.2 + along * 18.0) * 0.0025, sin(seed * 70.0) * 0.003);
				vec4 view = modelViewMatrix * vec4(mix(free, onLine, c), 1.0);
				gl_Position = projectionMatrix * view;
				gl_PointSize = uSize * (0.7 + 0.6 * fract(seed * 7.0)) * (1.0 - 0.3 * c);
				vColour = mix(mix(colour, vec3(0.56, 0.89, 1.0), 0.35), uLineColour, c);
				vAlpha = uOpacity * max(released, c);
			}`,
		fragmentShader: /* glsl */ `
			varying vec3 vColour;
			varying float vAlpha;
			void main() {
				float d = length(gl_PointCoord - 0.5);
				gl_FragColor = vec4(vColour, vAlpha * smoothstep(0.5, 0.2, d));
				#include <colorspace_fragment>
			}`,
	});
	const points = new Points(geometry, material);
	points.frustumCulled = false;
	return { points, material, line };
}

/** The line's glow: a soft, wide light behind it (a sprite, additive), as wide as the line. */
export function lineGlow(line: [Vector3, Vector3]) {
	const canvas = document.createElement("canvas");
	canvas.width = 256;
	canvas.height = 64;
	const g = canvas.getContext("2d")!;
	const across = g.createLinearGradient(0, 0, 256, 0);
	across.addColorStop(0, "rgba(255,255,255,0)");
	across.addColorStop(0.15, "rgba(255,255,255,1)");
	across.addColorStop(0.85, "rgba(255,255,255,1)");
	across.addColorStop(1, "rgba(255,255,255,0)");
	g.fillStyle = across;
	g.fillRect(0, 0, 256, 64);
	g.globalCompositeOperation = "destination-in";
	const down = g.createLinearGradient(0, 0, 0, 64);
	down.addColorStop(0, "rgba(0,0,0,0)");
	down.addColorStop(0.5, "rgba(0,0,0,1)");
	down.addColorStop(1, "rgba(0,0,0,0)");
	g.fillStyle = down;
	g.fillRect(0, 0, 256, 64);
	const material = new SpriteMaterial({ map: new CanvasTexture(canvas), color: 0x6fdcff, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, fog: false });
	const sprite = new Sprite(material);
	sprite.position.copy(line[0]).lerp(line[1], 0.5);
	sprite.scale.set(line[0].distanceTo(line[1]) * 1.25, 0.05, 1);
	return { sprite, material };
}
