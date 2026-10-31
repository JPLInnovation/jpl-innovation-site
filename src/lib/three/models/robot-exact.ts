import { Box3, BufferAttribute, BufferGeometry, Color, DoubleSide, FrontSide, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Sphere, Vector3, type Object3D } from 'three';
import type { RobotPart } from './frc-robot';

interface Batch {
	material: number; file: string; vertices: number; indices: number;
	lo: [number, number, number]; hi: [number, number, number];
	instances: Array<{ part: number; matrix: number[] }>;
}

export async function loadExactRobot(parent: Object3D, tag?: (parts: RobotPart[]) => number[]) {
	const url = new URL('/assets/robot/manifest.json', location.href);
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Robot manifest: ${response.status}`);
	const manifest = await response.json() as {
		parts: RobotPart[]; batches: Batch[];
		materials: Array<{ doubleSided?: boolean; alphaMode?: string; alphaCutoff?: number;
			pbrMetallicRoughness?: { baseColorFactor?: number[]; metallicFactor?: number; roughnessFactor?: number } }>;
	};
	const colors: string[] = [];
	const isolatedFeature = { value: -1 };
	const materials = manifest.materials.map(source => {
		const pbr = source.pbrMetallicRoughness ?? {};
		const [r,g,b,a] = pbr.baseColorFactor ?? [1,1,1,1];
		colors.push('#' + [r,g,b].map(c => Math.round(c * 255).toString(16).padStart(2,'0')).join(''));
		const material = new MeshStandardMaterial({ color: new Color().setRGB(r,g,b), opacity: a,
			metalness: pbr.metallicFactor ?? 1, roughness: pbr.roughnessFactor ?? 1,
			side: source.doubleSided ? DoubleSide : FrontSide, transparent: source.alphaMode === 'BLEND',
			depthWrite: source.alphaMode !== 'BLEND', alphaTest: source.alphaMode === 'MASK' ? source.alphaCutoff ?? .5 : 0 });
		material.onBeforeCompile = shader => {
			shader.uniforms.isolatedFeature = isolatedFeature;
			shader.vertexShader = shader.vertexShader.replace('void main() {', 'attribute float robotPartFeature; varying float robotFeature; void main() { robotFeature = robotPartFeature;');
			shader.fragmentShader = shader.fragmentShader.replace('void main() {', 'uniform float isolatedFeature; varying float robotFeature; void main() { if (isolatedFeature >= 0.0 && abs(robotFeature - isolatedFeature) > 0.5) discard;');
		};
		material.customProgramCacheKey = () => 'exact-robot-isolation';
		return material;
	});
	const features = tag?.(manifest.parts) ?? manifest.parts.map(() => 0);
	const worker = new Worker(new URL('./robot-exact.worker.ts', import.meta.url), { type: 'module' });
	await new Promise<void>((resolve, reject) => {
		const fail = (error: unknown) => { worker.terminate(); reject(error); };
		worker.onerror = fail;
		worker.onmessage = ({ data }) => {
			if (data.error) return fail(new Error(data.error));
			if (data.done) { worker.terminate(); resolve(); return; }
			try {
				const batch = manifest.batches[data.id];
				const geometry = new BufferGeometry();
				geometry.setAttribute('position', new BufferAttribute(new Float32Array(data.buffer, 0, batch.vertices * 3), 3));
				geometry.setAttribute('normal', new BufferAttribute(new Float32Array(data.buffer, batch.vertices * 12, batch.vertices * 3), 3));
				geometry.setIndex(new BufferAttribute(new Uint32Array(data.buffer, batch.vertices * 24, batch.indices), 1));
				geometry.setAttribute('feature', new InstancedBufferAttribute(data.feature, 1));
				geometry.setAttribute('robotPartFeature', geometry.getAttribute('feature'));
				geometry.boundingBox = new Box3(new Vector3(...batch.lo), new Vector3(...batch.hi));
				geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new Sphere());
				const mesh = new InstancedMesh(geometry, materials[batch.material], batch.instances.length);
				const matrix = new Matrix4();
				batch.instances.forEach((instance, i) => mesh.setMatrixAt(i, matrix.fromArray(instance.matrix)));
				mesh.instanceMatrix.needsUpdate = true;
				mesh.computeBoundingBox(); mesh.computeBoundingSphere();
				parent.add(mesh);
			} catch (error) { fail(error); }
		};
		worker.postMessage({ url: url.href, features, batches: manifest.batches });
	});
	return { materials, colors, isolate: (feature: number) => { isolatedFeature.value = feature; } };
}
