/**
 * The header's liquid pill (the spec's section 2): moving from one link to another it stretches like a drop. For the
 * first half its leading edge travels to the far side of the target while the trailing edge stays put; for the second
 * half the trailing edge catches up. Pure; the header (SiteHeader.astro) eases `t` and draws the result.
 */
export type Span = { x: number; w: number };

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function pillAt(from: Span, to: Span, t: number): Span {
	const k = Math.min(1, Math.max(0, t));
	const fromRight = from.x + from.w;
	const toRight = to.x + to.w;
	let left: number;
	let right: number;
	if (to.x >= from.x) {
		// moving right: the right edge leads
		left = k <= 0.5 ? from.x : lerp(from.x, to.x, (k - 0.5) * 2);
		right = k <= 0.5 ? lerp(fromRight, toRight, k * 2) : toRight;
	} else {
		// moving left: the left edge leads
		left = k <= 0.5 ? lerp(from.x, to.x, k * 2) : to.x;
		right = k <= 0.5 ? fromRight : lerp(fromRight, toRight, (k - 0.5) * 2);
	}
	return { x: left, w: right - left };
}
