/**
 * Glass or Solid (the spec's section 2), and the light on a glass sheet's rim. Pure: no DOM, so `npm test` runs it.
 * BaseLayout's head script applies the same rule before the first paint (it can't import this; keep the two in step).
 */

export type Surface = "glass" | "solid";

/** The visitor's stored choice wins; otherwise weak or motion-sensitive setups get Solid, everything else Glass. */
export function chooseSurface(o: { stored: string | null; reducedMotion: boolean; deviceMemory?: number; saveData?: boolean }): Surface {
	if (o.stored === "glass" || o.stored === "solid") return o.stored;
	if (o.reducedMotion || o.saveData || (o.deviceMemory !== undefined && o.deviceMemory <= 4)) return "solid";
	return "glass";
}

/**
 * The refracting lens needs `backdrop-filter: url(#…)` drawn, which only Chromium does: Firefox and Safari accept the
 * syntax (CSS.supports says yes) but draw nothing, so the browser's brands must name Chromium too. Elsewhere: plain
 * frosted glass. `brands`: navigator.userAgentData?.brands (only Chromium browsers have it).
 */
export function lensSupported(supports: (prop: string, value: string) => boolean, brands: ReadonlyArray<string> | undefined): boolean {
	return !!brands?.includes("Chromium") && supports("backdrop-filter", "url(#jpl-lens)");
}

/**
 * Where a sheet's rim catches the light: the angle from the sheet's middle towards the pointer (degrees, 0 = right,
 * clockwise, as the screen's y points down), and how strongly (1 on or inside the sheet, 0 at 1.5 sheet-widths away).
 */
export function rimFromPointer(rect: { left: number; top: number; width: number; height: number }, x: number, y: number): { angle: number; strength: number } {
	const cx = rect.left + rect.width / 2;
	const cy = rect.top + rect.height / 2;
	const angle = Math.round((Math.atan2(y - cy, x - cx) * 180) / Math.PI);
	const dx = Math.max(rect.left - x, 0, x - (rect.left + rect.width));
	const dy = Math.max(rect.top - y, 0, y - (rect.top + rect.height));
	const strength = Math.max(0, 1 - Math.hypot(dx, dy) / (1.5 * rect.width));
	return { angle, strength };
}
