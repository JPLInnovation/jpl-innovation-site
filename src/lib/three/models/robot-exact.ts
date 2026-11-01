import { Box3, BufferAttribute, BufferGeometry, Color, DoubleSide, FrontSide, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Sphere, SRGBColorSpace, Vector3, type Object3D } from 'three';
import type { RobotPart } from './frc-robot';

interface Batch {
	material: number; file: string; motionFile?: string; vertices: number; indices: number;
	lo: [number, number, number]; hi: [number, number, number];
	instances: Array<{ part: number; matrix: number[] }>;
}

/** rad/s, shafts low to high: intake, upper intake, indexer, flywheel. Slowed for illustration; the signs follow the FUEL's path (./frc-robot.ts). */
const SHAFT_SPEEDS = [5, 5, -6, -14];
const ON_AXLE = 0.02; // metres: a part centred this close to a wheel's axis rolls with it
const WHEEL_SPEED = 4; // rad/s, forward (the intake's way): illustrative, like the roller speeds
const ON_SHAFT = 0.02; // metres: a part's centre this close to a shaft's axis is mounted on it (wheels, spacers, collars and their screws)
const KEEP_FULL_UNDER = 12000; // triangles: smaller meshes skip the motion geometry (simplifying them tore the bumper numbers, and saves little)

/** Everything on the hopper extension: it moves as one piece, with the clamps and their bolts. */
export const EXTENSION = /^(Extended |Back Hopper|Sticker - |Pivot block |#6 screw - (left|right) pivot|Bolt 1\/4-20 SHCS|Spacer 1\/2 OD|Washer 1\/4|Nyloc nut 1\/4-20|Zip tie (1[7-9]|2[0-8]) )/;

/** Writes a turn of `angle` radians about the x axis through (y, z) into `m`. */
export function turnAbout(m: Matrix4, angle: number, y: number, z: number) {
	const c = Math.cos(angle), n = Math.sin(angle);
	return m.makeRotationX(angle).setPosition(0, y - y * c + z * n, z - y * n - z * c);
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
	const highlight = { feature: { value: -1 }, level: { value: 0 } };
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
			shader.uniforms.robotHighlightFeature = highlight.feature;
			shader.uniforms.robotHighlightLevel = highlight.level;
			shader.vertexShader = shader.vertexShader.replace('void main() {', 'attribute float robotPartFeature; varying float robotFeature; void main() { robotFeature = robotPartFeature;');
			shader.fragmentShader = shader.fragmentShader.replace('void main() {', 'uniform float isolatedFeature; varying float robotFeature; void main() { if (isolatedFeature >= 0.0 && abs(robotFeature - isolatedFeature) > 0.5) discard;')
				.replace('uniform float isolatedFeature;', 'uniform float isolatedFeature; uniform float robotHighlightFeature; uniform float robotHighlightLevel;')
				// The highlighted parts lift a little (full colour, on any background); the rest fall much further back.
				.replace('#include <dithering_fragment>', `#include <dithering_fragment>
				if (robotHighlightLevel > 0.0) {
					if (abs(robotFeature - robotHighlightFeature) < 0.5) gl_FragColor.rgb += robotHighlightLevel * (gl_FragColor.rgb * 0.12 + 0.015) * gl_FragColor.a;
					else gl_FragColor *= 1.0 - 0.6 * robotHighlightLevel;
				}`);
		};
		material.customProgramCacheKey = () => 'exact-robot-isolation';
		return material;
	});
	const meshes: Array<{ mesh: InstancedMesh; full: BufferAttribute; motion: BufferAttribute; features: number[] }> = [];
	const panel = /^(Extended hopper side|Extended Back Hopper|Back Hopper|Right Side hopper|Left Side$|Hopper Floor|Hopper bottom plate|Left side bracket|Right hopper bracket)/i;
	// The export has no joints, so the roller shafts give the axes (along x). Everything centred on a shaft turns with it.
	const middle = (p: RobotPart, d: number) => (p.lo[d] + p.hi[d]) / 2;
	const shafts = manifest.parts.filter(p => /Roller Shaft/.test(p.name)).sort((a, b) => middle(a, 1) - middle(b, 1))
		.map((p, i) => ({ y: middle(p, 1), z: middle(p, 2), speed: SHAFT_SPEEDS[i] ?? 0, angle: 0, turn: new Matrix4() }));
	const shaftOf = (p: RobotPart) => shafts.find(s => Math.hypot(middle(p, 1) - s.y, middle(p, 2) - s.z) < ON_SHAFT);
	// RobotPart.rotor's order: intake, second intake, launcher, feeder.
	const rotorOrder = [shafts[0], shafts[1], shafts[3], shafts[2]];
	// The six drive wheels sit on three axles across the robot; everything small centred on one rolls with it.
	const axles = [...new Map(manifest.parts.filter(p => /^6 wheel Rev/.test(p.name))
		.map(p => [Math.round(middle(p, 2) * 1000), { y: middle(p, 1), z: middle(p, 2), angle: 0, turn: new Matrix4() }])).values()];
	const axleOf = (p: RobotPart) => Math.max(p.hi[1] - p.lo[1], p.hi[2] - p.lo[2]) > 0.17 ? undefined
		: axles.find(a => Math.hypot(middle(p, 1) - a.y, middle(p, 2) - a.z) < ON_AXLE);
	for (const p of manifest.parts) { const shaft = shaftOf(p); p.rotor = shaft ? rotorOrder.indexOf(shaft) : -1; }
	const placed: Array<{ mesh: InstancedMesh; index: number; base: Matrix4; part: RobotPart }> = [];
	const rolling: Array<{ mesh: InstancedMesh; index: number; base: Matrix4; axle: (typeof axles)[number] }> = [];
	const turning: Array<{ mesh: InstancedMesh; index: number; base: Matrix4; shaft: typeof shafts[number] }> = [];
	const turned = new Matrix4();
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
				const motion = data.motion.byteLength && batch.indices / 3 >= KEEP_FULL_UNDER ? new BufferAttribute(new Uint32Array(data.motion), 1) : full;
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
					material.transparent = true; material.opacity = .25; material.depthWrite = false;
					// The decals sit 0.2 mm off these panels: pushed back in the depth buffer, they stay sharp up close.
					material.polygonOffset = true; material.polygonOffsetFactor = 1; material.polygonOffsetUnits = 4;
					material.roughness = .16; material.metalness = 0; material.forceSinglePass = true;
				}
				const mesh = new InstancedMesh(geometry, material, batch.instances.length);
				meshes.push({ mesh, full, motion, features: Array.from(data.feature as Float32Array) });
				const matrix = new Matrix4();
				batch.instances.forEach((instance, i) => {
					mesh.setMatrixAt(i, matrix.fromArray(instance.matrix));
					const shaft = shaftOf(manifest.parts[instance.part]);
					const base = matrix.clone();
					placed.push({ mesh, index: i, base, part: manifest.parts[instance.part] });
					if (shaft) { turning.push({ mesh, index: i, base, shaft }); mesh.frustumCulled = false; }
					const axle = axleOf(manifest.parts[instance.part]);
					if (axle) { rolling.push({ mesh, index: i, base, axle }); mesh.frustumCulled = false; }
				});
				mesh.instanceMatrix.needsUpdate = true;
				mesh.computeBoundingBox(); mesh.computeBoundingSphere();
				parent.add(mesh);
			} catch (error) { fail(error); }
		};
		worker.postMessage({ url: url.href, features, batches: manifest.batches });
	});
	let moving = true;
	return { materials, colors,
		/** Parts that move together: returns the function that places them, as a matrix on top of their CAD pose. */
		group(test: (part: RobotPart) => boolean) {
			const items = placed.filter(p => test(p.part));
			for (const item of items) item.mesh.frustumCulled = false;
			return (m: Matrix4) => {
				for (const item of items) {
					item.mesh.setMatrixAt(item.index, turned.multiplyMatrices(m, item.base));
					item.mesh.instanceMatrix.needsUpdate = true;
				}
			};
		},
		/** A material of their own for these parts, to fade or tint without touching anything else (all set for see-through). */
		own(test: (part: RobotPart) => boolean) {
			const owned: MeshStandardMaterial[] = [];
			for (const { mesh } of placed.filter(p => test(p.part))) {
				const shared = mesh.material as MeshStandardMaterial;
				if (owned.includes(shared) || !placed.filter(p => p.mesh === mesh).every(p => test(p.part))) continue;
				const material = shared.clone();
				material.onBeforeCompile = shared.onBeforeCompile;
				material.customProgramCacheKey = shared.customProgramCacheKey;
				material.transparent = true;
				material.forceSinglePass = true;
				mesh.material = material;
				owned.push(material);
			}
			return owned;
		},
		/** One feature's parts lifted and everything else pushed further back, 0 (off) to 1. */
		highlight(feature: number, level: number) {
			highlight.feature.value = feature;
			highlight.level.value = level;
		},
		/** Turns the rollers on their shafts by dt seconds' worth. */
		spin(dt: number) {
			for (const s of shafts) {
				s.angle = (s.angle + s.speed * dt) % (Math.PI * 2);
				turnAbout(s.turn, s.angle, s.y, s.z);
			}
			for (const t of turning) {
				t.mesh.setMatrixAt(t.index, turned.multiplyMatrices(t.shaft.turn, t.base));
				t.mesh.instanceMatrix.needsUpdate = true;
			}
		},
		/** Rolls the six drive wheels forward by dt seconds' worth. */
		roll(dt: number) {
			for (const a of axles) {
				a.angle = (a.angle + WHEEL_SPEED * dt) % (Math.PI * 2);
				turnAbout(a.turn, a.angle, a.y, a.z);
			}
			for (const r of rolling) {
				r.mesh.setMatrixAt(r.index, turned.multiplyMatrices(r.axle.turn, r.base));
				r.mesh.instanceMatrix.needsUpdate = true;
			}
		},
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
