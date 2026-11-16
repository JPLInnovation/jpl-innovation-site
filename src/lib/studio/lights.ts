/**
 * The room's moving lights, pooled. A light costs every lit pixel on the screen, whether it is bright or not, so the
 * room has two besides the desk lamp, and both slide from one scene's setting to the next as the camera does (the
 * shader never changes, nothing can hitch):
 *   - an accent light: the glow of whatever the camera is looking at (the monitor, the rack, the whiteboard, the door);
 *   - a bench lamp: a warm spot hung over the scene's subject, so each view is a pool of light on its bench and the rest
 *     of the room falls away into the dark (the reference's one desk under one lamp, for every station).
 */
import { Color, type Group, PointLight, SpotLight, Vector3 } from "three";
import type { V3 } from "./scenes";

export interface LightSpec {
	at: V3;
	/** Where a spot points (the bench lamp); ignored by the accent light. */
	aim?: V3;
	/** A spot's cone (radians from its axis); 0.6 if not given. */
	angle?: number;
	color: number;
	/** Intensity in the dark theme, and in the light one. */
	dark: number;
	light: number;
	/** How far it reaches (m). */
	distance: number;
	decay: number;
}

type Spec = Pick<LightSpec, "at" | "aim" | "angle" | "distance" | "decay"> & { color: Color; intensity: number };

export interface LightPool {
	/**
	 * @param focus  How much the camera is on each scene, by scene id, summing to 1 (the camera's own easing, so the
	 *               lights stay put while it holds still).
	 * @param level  0 to 1, the room coming up with the lamp.
	 */
	update(focus: Record<string, number>, level: number, dark: boolean): void;
}

export function createLightPool(parent: Group, accents: Record<string, LightSpec>, lamps: Record<string, LightSpec>): LightPool {
	const accent = new PointLight(0xffffff, 0, 3, 2);
	// A wide cone with a soft edge: a pool, not a disc.
	const lamp = new SpotLight(0xffd6a0, 0, 5, 0.62, 0.9, 2);
	parent.add(accent, lamp, lamp.target);
	const mix = new Color();
	const aim = new Vector3();

	/** Blends the scenes' specs for one light, each weighted by how much the camera is on it and how bright it is. */
	const blend = (light: PointLight | SpotLight, pick: (scene: string) => Spec | undefined, focus: Record<string, number>) => {
		let weight = 0;
		let x = 0;
		let y = 0;
		let z = 0;
		let distance = 0;
		let decay = 0;
		let intensity = 0;
		let angle = 0;
		mix.setRGB(0, 0, 0);
		aim.set(0, 0, 0);
		for (const scene in focus) {
			const f = focus[scene];
			if (f <= 0.001) continue;
			const spec = pick(scene);
			if (!spec) continue;
			const w = f * spec.intensity;
			weight += w;
			x += spec.at[0] * w;
			y += spec.at[1] * w;
			z += spec.at[2] * w;
			if (spec.aim) aim.set(aim.x + spec.aim[0] * w, aim.y + spec.aim[1] * w, aim.z + spec.aim[2] * w);
			distance += spec.distance * w;
			angle += (spec.angle ?? 0.6) * w;
			decay += spec.decay * w;
			mix.r += spec.color.r * w;
			mix.g += spec.color.g * w;
			mix.b += spec.color.b * w;
			intensity += w;
		}
		if (weight <= 0) {
			light.intensity = 0;
			return;
		}
		light.position.set(x / weight, y / weight, z / weight);
		if (light instanceof SpotLight) {
			light.target.position.copy(aim).divideScalar(weight);
			light.angle = angle / weight;
		}
		light.distance = distance / weight;
		light.decay = decay / weight;
		light.color.setRGB(mix.r / weight, mix.g / weight, mix.b / weight);
		light.intensity = intensity;
	};

	const colors = new WeakMap<LightSpec, Color>();
	const resolve = (spec: LightSpec | undefined, dark: boolean, level: number): Spec | undefined => {
		if (!spec) return undefined;
		let color = colors.get(spec);
		if (!color) colors.set(spec, (color = new Color(spec.color)));
		return { at: spec.at, aim: spec.aim, angle: spec.angle, distance: spec.distance, decay: spec.decay, color, intensity: (dark ? spec.dark : spec.light) * level };
	};

	return {
		update(focus, level, dark) {
			blend(accent, (scene) => resolve(accents[scene], dark, level), focus);
			blend(lamp, (scene) => resolve(lamps[scene], dark, level), focus);
			lamp.target.updateMatrixWorld();
		},
	};
}
