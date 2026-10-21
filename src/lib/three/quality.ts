/**
 * The medium and high quality tiers of the shared stage (./stage.ts), loaded only when a device gets one of them, so
 * phones and the intros never download it.
 *
 * - Soft contact shadows: the model seen from straight below into a small depth texture, blurred twice, on the floor
 *   plane each model already has (contactShadow() in stage.ts). Drawn once, and again only when the model asks
 *   (the drone's exploded view), never every frame.
 * - High tier only: a post-processing chain with 4x MSAA, ground-truth ambient occlusion (GTAO)
 *   and the tone mapping done at the end, on straight (not premultiplied) colour, so the faded parts and the soft
 *   shadow edges come out the same as on the plain renderer.
 */
import {
	type Camera,
	HalfFloatType,
	type Material,
	type Mesh,
	MeshBasicMaterial,
	MeshDepthMaterial,
	type Object3D,
	OrthographicCamera,
	type Scene,
	ShaderMaterial,
	Vector2,
	WebGLRenderTarget,
	type WebGLRenderer,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { HorizontalBlurShader } from "three/addons/shaders/HorizontalBlurShader.js";
import { VerticalBlurShader } from "three/addons/shaders/VerticalBlurShader.js";

/* ------------------------------------------------------------------ */
/* Contact shadows                                                     */
/* ------------------------------------------------------------------ */

/** What contactShadow() in stage.ts stores on its plane. */
export interface ShadowSpec {
	/** Half the plane's side, metres. */
	radius: number;
	/** How far above the floor something still casts, metres. */
	height: number;
}

const SHADOW_SIZE = 512;

/** Meshes left out of the shadow: effects (basic materials), see-through parts and anything marked `shadow: false`. */
const casts = (mesh: Mesh) => {
	if (mesh.userData.shadow === false || mesh.userData.contactShadow) return false;
	const materials = ([] as Material[]).concat(mesh.material);
	return materials.every((m) => !(m instanceof MeshBasicMaterial) && !(m.transparent && m.opacity < 0.5));
};

export function createContactShadows(renderer: WebGLRenderer, scene: Scene) {
	const targets = new Map<Mesh, { a: WebGLRenderTarget; b: WebGLRenderTarget; camera: OrthographicCamera }>();
	const depth = new MeshDepthMaterial();
	depth.onBeforeCompile = (shader) => {
		shader.fragmentShader = shader.fragmentShader.replace(
			"gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );",
			// Everything over the floor shades it a little (the sky it hides); darker still where a part nearly touches it.
			"float d = 1.0 - fragCoordZ; gl_FragColor = vec4( vec3( 0.0 ), 0.45 + 0.55 * d * d );",
		);
	};
	// Depth-tested from below, so the lowest (darkest) surface over each point wins.
	const blurH = new ShaderMaterial({ ...HorizontalBlurShader, uniforms: { tDiffuse: { value: null }, h: { value: 0 } }, depthTest: false });
	const blurV = new ShaderMaterial({ ...VerticalBlurShader, uniforms: { tDiffuse: { value: null }, v: { value: 0 } }, depthTest: false });
	const quad = new FullScreenQuad();

	const planes = () => {
		const found: Mesh[] = [];
		scene.traverse((o) => (o as Mesh).isMesh && o.userData.contactShadow && found.push(o as Mesh));
		return found;
	};

	/** Draws every contact shadow in the scene again (after the model has changed shape). */
	function update() {
		const list = planes();
		if (!list.length) return;
		const hidden: Object3D[] = [];
		scene.traverse((o) => {
			const mesh = o as Mesh;
			if (mesh.isMesh && mesh.visible && !casts(mesh)) {
				mesh.visible = false;
				hidden.push(mesh);
			}
		});
		const previous = { target: renderer.getRenderTarget(), override: scene.overrideMaterial, background: scene.background, alpha: renderer.getClearAlpha() };
		scene.overrideMaterial = depth;
		scene.background = null;
		renderer.setClearAlpha(0);
		for (const plane of list) {
			const spec = plane.userData.contactShadow as ShadowSpec;
			let entry = targets.get(plane);
			if (!entry) {
				const a = new WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE);
				a.texture.generateMipmaps = false;
				const b = a.clone();
				const camera = new OrthographicCamera(-spec.radius, spec.radius, spec.radius, -spec.radius, 0, spec.height);
				camera.rotation.x = Math.PI / 2; // looking straight up from the floor
				plane.parent!.add(camera);
				entry = { a, b, camera };
				targets.set(plane, entry);
				const material = plane.material as MeshBasicMaterial;
				material.map = a.texture;
				material.color.set(0xffffff);
				material.needsUpdate = true;
				// The camera looks up; the plane is seen from above, so its texture runs the other way along z.
				const uv = plane.geometry.getAttribute("uv");
				for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
				uv.needsUpdate = true;
			}
			entry.camera.position.copy(plane.position);
			entry.camera.updateMatrixWorld();
			plane.visible = false;
			renderer.setRenderTarget(entry.a);
			renderer.clear();
			renderer.render(scene, entry.camera);
			plane.visible = true;
			// Two blur passes each way: soft under the middle, softer at the edges.
			for (const amount of [3, 1.2]) {
				blurH.uniforms.tDiffuse.value = entry.a.texture;
				blurH.uniforms.h.value = amount / 256;
				quad.material = blurH;
				renderer.setRenderTarget(entry.b);
				quad.render(renderer);
				blurV.uniforms.tDiffuse.value = entry.b.texture;
				blurV.uniforms.v.value = amount / 256;
				quad.material = blurV;
				renderer.setRenderTarget(entry.a);
				quad.render(renderer);
			}
		}
		for (const o of hidden) o.visible = true;
		scene.overrideMaterial = previous.override;
		scene.background = previous.background;
		renderer.setRenderTarget(previous.target);
		renderer.setClearAlpha(previous.alpha);
	}

	return {
		update,
		dispose() {
			for (const { a, b, camera } of targets.values()) {
				a.dispose();
				b.dispose();
				camera.removeFromParent();
			}
			depth.dispose();
			blurH.dispose();
			blurV.dispose();
			quad.dispose();
		},
	};
}

/* ------------------------------------------------------------------ */
/* High tier: MSAA + GTAO + tone mapping                               */
/* ------------------------------------------------------------------ */

export interface Pipeline {
	/** `occlusion`: 0..1, how strongly the ambient occlusion is blended in. */
	render(occlusion?: number): void;
	setSize(width: number, height: number, pixelRatio: number): void;
	dispose(): void;
}

/** `aoRadius`: how far ambient occlusion reaches, metres (about 5% of the model's size). */
export function createPipeline(renderer: WebGLRenderer, scene: Scene, camera: Camera, aoRadius: number): Pipeline {
	const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
	const composer = new EffectComposer(renderer, target);
	const renderPass = new RenderPass(scene, camera);
	renderPass.clearAlpha = 0;
	composer.addPass(renderPass);

	const gtao = new GTAOPass(scene, camera, 1, 1);
	gtao.updateGtaoMaterial({ radius: aoRadius, distanceExponent: 1.6, thickness: aoRadius * 1.5, scale: 1.1, samples: 12, distanceFallOff: 1 });
	gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
	gtao.blendIntensity = 0.85;
	// Full resolution: at half, the occlusion bleeds past the parts' outlines as a grainy halo.
	// See-through parts and effects don't occlude: hide them from the depth and normal pass too.
	const internal = gtao as unknown as { _overrideVisibility(): void; _visibilityCache: Object3D[] };
	const hideLines = internal._overrideVisibility.bind(gtao);
	internal._overrideVisibility = () => {
		hideLines();
		scene.traverse((o) => {
			const mesh = o as Mesh;
			if (!mesh.isMesh || !mesh.visible) return;
			const material = mesh.material as Material;
			if (mesh.userData.contactShadow || material instanceof MeshBasicMaterial || (material.transparent && !material.depthWrite)) {
				mesh.visible = false;
				internal._visibilityCache.push(mesh);
			}
		});
	};
	composer.addPass(gtao);

	const output = new OutputPass();
	// The buffer holds premultiplied colour (the canvas is see-through): tone map the straight colour, then multiply back.
	output.material.fragmentShader = output.material.fragmentShader
		.replace("gl_FragColor = texture2D( tDiffuse, vUv );", "gl_FragColor = texture2D( tDiffuse, vUv );\n\tfloat a = gl_FragColor.a;\n\tif ( a > 0.0 ) gl_FragColor.rgb /= a;")
		.replace(/}\s*$/, "\tgl_FragColor.rgb *= a;\n}");
	output.material.needsUpdate = true;
	composer.addPass(output);

	const size = new Vector2();
	return {
		render(occlusion = 1) {
			gtao.blendIntensity = 0.85 * occlusion;
			composer.render();
		},
		setSize(width, height, pixelRatio) {
			renderer.getSize(size);
			composer.setPixelRatio(pixelRatio);
			composer.setSize(width, height);
		},
		dispose() {
			composer.dispose();
			gtao.dispose();
			output.dispose();
			target.dispose();
		},
	};
}
