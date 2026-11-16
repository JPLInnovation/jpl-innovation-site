/**
 * The decoding headline's text at a moment (pure, tested in decode.test.ts): at `progress` 0 every letter is a random
 * glyph, at 1 the words themselves; letters settle from left to right. Spaces and punctuation never change, so the
 * words keep their shape while they decode.
 */
const GLYPHS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789#%&*+=?";
const KEEP = /[\s.,:;!?'’“”"()·—–-]/;

export function scramble(text: string, progress: number, random: () => number = Math.random): string {
	const chars = [...text];
	const settled = Math.floor(Math.max(0, Math.min(1, progress)) * chars.length);
	return chars
		.map((c, i) => {
			if (i < settled || KEEP.test(c)) return c;
			let g = GLYPHS[Math.floor(random() * GLYPHS.length) % GLYPHS.length];
			if (g === c.toUpperCase()) g = GLYPHS[(GLYPHS.indexOf(g) + 1) % GLYPHS.length];
			return g;
		})
		.join("");
}
