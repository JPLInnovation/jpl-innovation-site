/**
 * The visitor's own settings (the Settings panel in the header, src/components/SettingsPanel.astro), next to what the
 * system says. Stored only in this browser (localStorage), like the theme.
 *
 *   motion   "full" | "reduced" | "read"   Reduced acts like the system's reduce-motion setting; Read also turns
 *                                          the studio into one ordinary page. BaseLayout puts html.reduce-motion and
 *                                          html.read-mode on before the first paint.
 *   quality  "high" | "low" (else auto)    The 3D stage's starting tier (src/lib/three/stage.ts).
 */
export const MOTION_KEY = "motion";
export const QUALITY_KEY = "quality";

const read = (key: string) => {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
};

/** Animation should stay still: the system asks for it, or the visitor chose Reduced or Read mode. */
export const reducedMotion = () =>
	matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("reduce-motion");

export const qualityPref = (): "high" | "low" | null => {
	const q = read(QUALITY_KEY);
	return q === "high" || q === "low" ? q : null;
};
