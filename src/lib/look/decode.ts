/**
 * The decoding headline (src/components/work/DecodeHeading.astro): a line scrambles from random characters into its
 * words, once. Pure, so `npm test` covers it; the component only paints the frames.
 */

/** The noise: capitals, figures and drafting marks, all in Archivo's Latin subset. */
export const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#+/=<>";

const scrambles = (ch: string) => /[\p{L}\p{N}]/u.test(ch);

/**
 * The line at progress `t` (0..1). Letters and figures lock into place left to right (the first at t = 0.35, the
 * last at t = 1), each showing noise until then; spaces and punctuation never scramble, so the line keeps its shape.
 */
export function decodeFrame(text: string, t: number, rand: () => number = Math.random, glyphs = GLYPHS): string {
	const chars = [...text];
	const last = Math.max(1, chars.length - 1);
	return chars
		.map((ch, i) => (!scrambles(ch) || t >= 0.35 + 0.65 * (i / last) ? ch : glyphs[Math.floor(rand() * glyphs.length)]))
		.join("");
}
