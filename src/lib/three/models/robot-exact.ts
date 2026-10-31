import { Box3, BufferAttribute, BufferGeometry, Color, DoubleSide, FrontSide, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Sphere, SRGBColorSpace, Vector3, type Object3D } from 'three';
import type { RobotPart } from './frc-robot';

interface Batch {
	material: number; file: string; motionFile?: string; vertices: number; indices: number;
	lo: [number, number, number]; hi: [number, number, number];
	instances: Array<{ part: number; matrix: number[] }>;
}

export async function loadExactRobot(parent: Object3D, tag?: (parts: RobotPart[]) => number[]) {
	const url = new URL('/assets/robot/manifest.json', location.href);
	const response = await fetch(url, { cache: 'no-cache' });
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
		const material = new MeshStandardMaterial({ color: new Color().setRGB(r,g,b, SRGBColorSpace), opacity: a,
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
	const meshes: Array<{ mesh: InstancedMesh; full: BufferAttribute; motion: BufferAttribute; features: number[] }> = [];
	const panel = /^(Extended hopper side|Extended Back Hopper|Back Hopper|Right Side hopper|Left Side$|Hopper Floor)/i;
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
				const full = new BufferAttribute(new Uint32Array(data.buffer, batch.vertices * 24, batch.indices), 1);
				const motion = data.motion.byteLength ? new BufferAttribute(new Uint32Array(data.motion), 1) : full;
				geometry.setIndex(motion);
				geometry.setAttribute('feature', new InstancedBufferAttribute(data.feature, 1));
				geometry.setAttribute('robotPartFeature', geometry.getAttribute('feature'));
				geometry.boundingBox = new Box3(new Vector3(...batch.lo), new Vector3(...batch.hi));
				geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new Sphere());
				let material = materials[batch.material];
				if (batch.instances.every(i => panel.test(manifest.parts[i.part].name))) {
					material = material.clone();
					material.onBeforeCompile = materials[batch.material].onBeforeCompile;
					material.customProgramCacheKey = materials[batch.material].customProgramCacheKey;
					material.transparent = true; material.opacity = .22; material.depthWrite = false;
					material.roughness = .16; material.metalness = 0; material.forceSinglePass = true;
				}
				const mesh = new InstancedMesh(geometry, material, batch.instances.length);
				meshes.push({ mesh, full, motion, features: Array.from(data.feature as Float32Array) });
				const matrix = new Matrix4();
				batch.instances.forEach((instance, i) => mesh.setMatrixAt(i, matrix.fromArray(instance.matrix)));
				mesh.instanceMatrix.needsUpdate = true;
				mesh.computeBoundingBox(); mesh.computeBoundingSphere();
				parent.add(mesh);
			} catch (error) { fail(error); }
		};
		worker.postMessage({ url: url.href, features, batches: manifest.batches });
	});
	let moving = true;
	return { materials, colors,
		motion(active: boolean) {
			if (active === moving) return;
			moving = active;
			for (const item of meshes) item.mesh.geometry.setIndex(active ? item.motion : item.full);
		},
		isolate(feature: number) {
			if (isolatedFeature.value === feature) return;
			isolatedFeature.value = feature;
			for (const item of meshes) item.mesh.visible = feature < 0 || item.features.includes(feature);
		},
	};
}
