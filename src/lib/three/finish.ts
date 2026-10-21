/**
 * Surface finishes for the CAD models: what a part is made of, on top of the colour, roughness and metalness its
 * model file gives it. The colour always stays the model's own; a finish only changes how light sits on it (a clear
 * coat on a circuit board, sheen on bumper fabric, a brushed highlight on a motor bell).
 *
 * On the low quality tier (phones, weak GPUs, saveData; see stage.ts) every part stays a plain MeshStandardMaterial,
 * which is cheaper to shade. The stage sets the tier before a model is built, through setDetail().
 */
import { BufferAttribute, Color, type Material, type Mesh, MeshPhysicalMaterial, MeshStandardMaterial, type MeshStandardMaterialParameters } from "three";

export type Finish =
	| "pcb" // a populated circuit board: glossy solder mask
	| "plate" // the F450's fibreglass (PCB) plates
	| "printed" // matte printed PETG
	| "plastic" // moulded plastic: arms, props, cases
	| "wrap" // shrink wrap and glossy sleeves (the LiPo)
	| "metal" // machined or brushed metal: screws, shafts
	| "brushed" // brushed metal with a circular grain (motor bells); the mesh needs tangents
	| "anodised" // anodised aluminium (robot plates and tube)
	| "rubber" // tyres, grommets
	| "fabric" // bumper cloth
	| "foam" // FUEL
	| "glass" // a lens
	| "clear"; // polycarbonate: see-through, brighter where you look across it

let detail = true;
/** false: plain standard materials (the low tier). */
export function setDetail(on: boolean) {
	detail = on;
}

type Params = MeshStandardMaterialParameters & { color: Color | number | string };

const PRESETS: Record<Finish, (p: MeshPhysicalMaterial, base: Params) => void> = {
	pcb: (m) => {
		m.roughness = Math.min(m.roughness, 0.45);
		m.clearcoat = 0.8;
		m.clearcoatRoughness = 0.18;
	},
	plate: (m) => {
		m.roughness = 0.5;
		m.clearcoat = 0.5;
		m.clearcoatRoughness = 0.3;
	},
	printed: (m) => {
		m.roughness = Math.max(m.roughness, 0.7);
		m.metalness = 0;
		m.sheen = 0.25;
		m.sheenRoughness = 0.7;
		m.sheenColor = m.color.clone().lerp(new Color(1, 1, 1), 0.35);
	},
	plastic: (m) => {
		m.roughness = Math.min(Math.max(m.roughness, 0.38), 0.55);
		m.clearcoat = 0.15;
		m.clearcoatRoughness = 0.35;
	},
	wrap: (m) => {
		m.roughness = 0.35;
		m.clearcoat = 0.6;
		m.clearcoatRoughness = 0.12;
	},
	metal: (m) => {
		m.metalness = 1;
		m.roughness = Math.min(Math.max(m.roughness, 0.22), 0.38);
	},
	brushed: (m) => {
		m.metalness = 1;
		m.roughness = 0.34;
		m.anisotropy = 0.75;
	},
	anodised: (m) => {
		m.metalness = 0.85;
		m.roughness = 0.42;
		m.clearcoat = 0.2;
		m.clearcoatRoughness = 0.4;
	},
	rubber: (m) => {
		m.metalness = 0;
		m.roughness = 0.88;
		m.sheen = 0.15;
		m.sheenRoughness = 0.9;
	},
	fabric: (m) => {
		m.metalness = 0;
		m.roughness = 0.95;
		m.sheen = 0.6;
		m.sheenRoughness = 0.5;
		m.sheenColor = m.color.clone().lerp(new Color(1, 1, 1), 0.2);
	},
	foam: (m) => {
		m.metalness = 0;
		m.roughness = 0.95;
		m.sheen = 0.6;
		m.sheenRoughness = 0.8;
		m.sheenColor = m.color.clone().lerp(new Color(1, 1, 1), 0.4);
	},
	glass: (m) => {
		m.metalness = 0;
		m.roughness = 0.05;
		m.clearcoat = 1;
		m.clearcoatRoughness = 0.02;
	},
	clear: (m, base) => {
		m.metalness = 0;
		m.roughness = 0.06;
		m.ior = 1.58;
		m.specularIntensity = 1;
		m.clearcoat = 1;
		m.clearcoatRoughness = 0.05;
		m.transparent = true;
		m.depthWrite = false;
		m.opacity = Math.min(base.opacity ?? 0.3, 0.3);
		fresnelEdges(m);
	},
};

/**
 * See-through plastic without a transmission pass (which would need a second render of the scene, and shows the
 * cleared background, not the page, through a transparent canvas): faint face on, more solid where the surface turns
 * away, which is what makes a clear panel read as a panel. Chains any onBeforeCompile set later (the showcase's fading).
 */
function fresnelEdges(m: MeshPhysicalMaterial) {
	m.userData.fresnel = true;
	m.onBeforeCompile = (shader) => {
		shader.fragmentShader = shader.fragmentShader.replace(
			"#include <opaque_fragment>",
			`#include <opaque_fragment>
			float facing = abs(dot(normalize(vViewPosition), normal));
			gl_FragColor.a = mix(gl_FragColor.a, min(1.0, gl_FragColor.a * 3.2 + 0.08), pow(1.0 - facing, 2.5));`,
		);
	};
	m.customProgramCacheKey = () => "fresnel";
}

/** A material for a part with this finish. The low tier gets the plain standard material with the same values. */
export function hardware(params: Params, finish?: Finish): MeshStandardMaterial {
	if (!detail || !finish) return new MeshStandardMaterial({ roughness: 0.55, metalness: 0.1, ...params });
	const m = new MeshPhysicalMaterial({ roughness: 0.55, metalness: 0.1, ...params });
	PRESETS[finish](m, params);
	m.userData.finish = finish;
	return m;
}

/** The low tier, after the fact: drop the clear coats, sheen and grain so the shaders get cheaper. */
export function simplify(materials: Iterable<Material>) {
	for (const material of materials) {
		const m = material as MeshPhysicalMaterial;
		if (!m.isMeshPhysicalMaterial) continue;
		m.clearcoat = 0;
		m.sheen = 0;
		m.anisotropy = 0;
	}
}

/** Gives a motor bell's mesh tangents that run around each motor's axis (x, z centres), for the brushed grain. */
export function circularGrain(mesh: Mesh, hubs: number[][]) {
	const position = mesh.geometry.getAttribute("position");
	const tangent = new Float32Array(position.count * 4);
	for (let i = 0; i < position.count; i++) {
		const x = position.getX(i);
		const z = position.getZ(i);
		let best = hubs[0];
		let d = Infinity;
		for (const h of hubs) {
			const e = (x - h[0]) ** 2 + (z - h[2]) ** 2;
			if (e < d) (d = e), (best = h);
		}
		const dx = x - best[0];
		const dz = z - best[2];
		const l = Math.hypot(dx, dz) || 1;
		tangent.set([-dz / l, 0, dx / l, 1], i * 4);
	}
	mesh.geometry.setAttribute("tangent", new BufferAttribute(tangent, 4));
}
