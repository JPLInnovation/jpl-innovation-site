/**
 * "Play the story" (About; the spec's section 9): the film's clock. Pure, so `npm test` covers it; the page script
 * (src/components/about/StoryFilm.astro) asks it what to show at each frame.
 *
 * Each chapter opens with its card (its name alone), then its lines, one after another: a line writes itself at `cps`
 * characters a second, then stays until it has been on screen long enough to read (`read` characters a second, and at
 * least `hold` ms after the last character). Times in ms from the start of the film.
 */

export interface Pace {
	cps: number; // characters written a second (Infinity: the line appears whole, for reduced motion)
	read: number; // characters a second a viewer reads
	hold: number; // ms a line stays after its last character
	card: number; // ms a chapter's name shows alone
	gap: number; // ms of nothing between two lines
}

export const PACE: Pace = { cps: 34, read: 15, hold: 1200, card: 1500, gap: 350 };

export interface Cue {
	chapter: number;
	text: string;
	start: number;
	typed: number;
	end: number;
}

export interface Plan {
	cues: Cue[];
	chapters: { start: number; end: number }[];
	total: number;
}

export function plan(chapters: ReadonlyArray<{ lines: ReadonlyArray<string> }>, pace: Pace = PACE): Plan {
	const cues: Cue[] = [];
	const spans: Plan["chapters"] = [];
	let t = 0;
	chapters.forEach((chapter, index) => {
		const start = t;
		t += pace.card;
		for (const text of chapter.lines) {
			const typing = Number.isFinite(pace.cps) ? (text.length / pace.cps) * 1000 : 0;
			const shown = Math.max(typing + pace.hold, (text.length / pace.read) * 1000);
			cues.push({ chapter: index, text, start: t, typed: t + typing, end: t + shown });
			t += shown + pace.gap;
		}
		spans.push({ start, end: t });
	});
	return { cues, chapters: spans, total: t };
}

export interface Frame {
	chapter: number;
	progress: number; // 0..1 through the chapter
	cue: number; // the line on screen, -1 for none (a card, a gap, the end)
	chars: number; // how many of its characters are written
	done: boolean;
}

/** What the film shows at `t`. */
export function frameAt(p: Plan, t: number): Frame {
	if (t >= p.total) return { chapter: p.chapters.length - 1, progress: 1, cue: -1, chars: 0, done: true };
	const now = Math.max(0, t);
	const chapter = p.chapters.findIndex((c) => now < c.end);
	const span = p.chapters[chapter];
	const cue = p.cues.findIndex((c) => now >= c.start && now < c.end);
	let chars = 0;
	if (cue >= 0) {
		const c = p.cues[cue];
		chars = c.typed <= c.start ? c.text.length : Math.min(c.text.length, Math.floor(((now - c.start) / (c.typed - c.start)) * c.text.length));
	}
	return { chapter, progress: (now - span.start) / (span.end - span.start), cue, chars, done: false };
}

/** Which of a chapter's `count` pictures shows at `progress` (0..1), and how far through its own share it is. */
export function shotAt(progress: number, count: number): { index: number; progress: number } {
	const at = Math.min(Math.max(progress, 0), 1) * count;
	const index = Math.min(count - 1, Math.floor(at));
	return { index, progress: at - index };
}

/** The running time as the button shows it: 43000 → "0:43". */
export function clock(ms: number): string {
	const s = Math.round(ms / 1000);
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
