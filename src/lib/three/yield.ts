/**
 * Hands the main thread back to the browser for a moment, so a long build (the studio's room) is done in slices: a
 * frame can be drawn and a click answered between them, instead of the page freezing for the whole build. That is what
 * keeps a page change smooth when the next page builds a 3D scene while the old one is still fading out.
 */
import type { Camera, Material, Mesh, Object3D, Scene, ShaderMaterial, Texture, WebGLRenderTarget, WebGLRenderer } from "three";
type WithScheduler = { scheduler?: { yield?: () => Promise<void> } };

const channel = typeof MessageChannel === "undefined" ? undefined : new MessageChannel();
const waiting: Array<() => void> = [];
if (channel) channel.port1.onmessage = () => waiting.splice(0).forEach((resolve) => resolve());

export function tick(): Promise<void> {
	const scheduler = (globalThis as WithScheduler).scheduler;
	if (scheduler?.yield) return scheduler.yield();
	return new Promise((resolve) => {
		if (!channel) {
			setTimeout(resolve, 0);
			return;
		}
		waiting.push(resolve);
		channel.port2.postMessage(0);
	});
}

/**
 * Builds a scene's shaders one at a time in the background. Asked for together, the GPU process works through the whole
 * queue and the page's next call to it waits for all of them (seconds, on large standard-material shaders).
 * `target`: where the scene will be drawn, since three.js picks a different shader for a render target than for the screen.
 */
export async function compileInSlices(renderer: WebGLRenderer, scene: Scene, camera: Camera, target: WebGLRenderTarget | null = null) {
	const seen = new Set<string>();
	const meshes: Object3D[] = [];
	scene.traverse((o) => {
		const mesh = o as Mesh;
		if (!mesh.isMesh) return;
		const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		const key = `${materials.map((m) => m.uuid).join()}|${(mesh as { isInstancedMesh?: boolean }).isInstancedMesh ? 1 : 0}`;
		if (!seen.has(key)) {
			seen.add(key);
			meshes.push(mesh);
		}
	});
	for (const mesh of meshes) {
		const before = renderer.getRenderTarget();
		renderer.setRenderTarget(target);
		const compiled = renderer.compileAsync(mesh, camera, scene); // (the programs are chosen synchronously, in this call)
		renderer.setRenderTarget(before);
		await compiled;
	}
}

/**
 * Sends a scene's textures to the GPU ahead of time, one per frame. three.js otherwise uploads a texture in the frame its
 * object first comes into view, and a few large ones together (canvases, photos) froze that frame for 100 ms or more.
 */
export async function uploadInSlices(renderer: WebGLRenderer, scene: Scene) {
	const textures = new Set<Texture>();
	const take = (value: unknown) => {
		const t = value as Texture | null;
		if (t?.isTexture && t.image && !(t as { isRenderTargetTexture?: boolean }).isRenderTargetTexture) textures.add(t);
	};
	scene.traverse((o) => {
		const mesh = o as Mesh;
		if (!mesh.material) return;
		for (const m of ([] as Material[]).concat(mesh.material)) {
			for (const value of Object.values(m)) take(value);
			for (const uniform of Object.values((m as ShaderMaterial).uniforms ?? {})) take(uniform?.value);
		}
	});
	for (const texture of textures) {
		if ((renderer.properties.get(texture) as { __webglInit?: boolean }).__webglInit) continue;
		await new Promise((resolve) => requestAnimationFrame(resolve));
		if (renderer.getContext().isContextLost()) return; // the page moved on and the stage was let go of
		renderer.initTexture(texture);
	}
}
