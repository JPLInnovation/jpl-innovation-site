/**
 * The room's point lights, pooled. A point light costs every lit pixel on the screen, whether it is bright or not,
 * and the room used to carry nine of them (a ceiling light per bay, a glow per screen, one for the whiteboard and one
 * for the door). Only the lights near the camera matter, so the room has two: an accent light (the glow of whatever
 * the camera is looking at: the monitor, the rack, the whiteboard, the door) and a ceiling light above the camera. Both
 * slide from one scene's setting to the next as the camera does, so the shader never changes and nothing can hitch.
 */
import { Color, type Group, PointLight } from "three";
import type { V3 } from "./scenes";

export interface LightSpec {
	at: V3;
	color: number;
	/** Intensity in the dark theme, and in the light one (a lit room needs more to show). */
	dark: number;
	light: number;
	/** How far it reaches (m). */
	distance: number;
	decay: number;
}

type Spec = Pick<LightSpec, "at" | "distance" | "decay"> & { color: Color; intensity: number };

export interface LightPool {
	/**
	 * @param focus  How much the camera is on each scene, by scene id, summing to 1 (the camera's own easing, so the
	 *               lights stay put while it holds still).
	 * @param level  0 to 1, the room coming up with the lamp.
	 */
	update(focus: Record<string, number>, level: number, dark: boolean): void;
}

export function createLightPool(parent: Group, accents: Record<string, LightSpec>, ceiling: Record<string, LightSpec>): LightPool {
	const slots = [new PointLight(0xffffff, 0, 3, 2), new PointLight(0xcfe3ff, 0, 9, 1.6)];
	for (const light of slots) parent.add(light);
	const mix = new Color();

	/** Blends the scenes' specs for one slot, each weighted by how much the camera is on it and how bright it is. */
	const blend = (light: PointLight, pick: (scene: string) => Spec | undefined, focus: Record<string, number>) => {
		let weight = 0;
		let x = 0;
		let y = 0;
		let z = 0;
		let distance = 0;
		let decay = 0;
		let intensity = 0;
		mix.setRGB(0, 0, 0);
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
			distance += spec.distance * w;
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
		return { at: spec.at, distance: spec.distance, decay: spec.decay, color, intensity: (dark ? spec.dark : spec.light) * level };
	};

	return {
		update(focus, level, dark) {
			blend(slots[0], (scene) => resolve(accents[scene], dark, level), focus);
			blend(slots[1], (scene) => resolve(ceiling[scene], dark, level), focus);
		},
	};
}
