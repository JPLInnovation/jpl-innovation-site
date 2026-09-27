/**
 * Geometry of the FRC intro's colour burn, shared by its markup (FrcSplash.astro builds the masks) and its
 * timeline (src/scripts/frc-splash.ts moves the burn front). Lengths are in FIRST-logo widths.
 *
 * The burn front is a ragged, slightly soft vertical edge. Left of it (already burnt) the logo is white, with
 * a glowing ember line on the edge and a charcoal zone just behind it that cools back to white; right of it
 * the logo still has its colours. Each of those is a "window" that slides with the front while its content
 * slides back the same distance, so only transforms move.
 */
export const BURN = {
	/** How far the ragged edge wanders either side of the front. */
	amp: 0.055,
	/** Softness (blur) of the edge. */
	soft: 0.012,
	/** Width : height of the FIRST logo. */
	aspect: 438 / 115,
	/** Windows reach this far above and below the logo (in logo heights), so the edge can bob up and down. */
	pad: 0.3,
};

/** A front this far outside the logo leaves no part of the ragged edge on it. */
export const BURN_CLEAR = BURN.amp / 2 + 4 * BURN.soft;

/** The ragged edge's offset from the front at height y (0 = window top, 1 = bottom), in logo widths. */
export const burnEdge = (y: number) =>
	(0.3 * Math.sin(2 * Math.PI * 2.3 * y + 0.7) + 0.15 * Math.sin(2 * Math.PI * 5.1 * y + 2.1) + 0.05 * Math.sin(2 * Math.PI * 11.3 * y + 0.3)) * BURN.amp;
