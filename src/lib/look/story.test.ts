import { test } from "node:test";
import assert from "node:assert/strict";
import { clock, frameAt, plan, shotAt } from "./story.ts";

const pace = { cps: 10, read: 5, hold: 1000, card: 500, gap: 100 };
// "abcdefghij": 10 characters → typed in 1 s, on screen max(1 + 1, 10 / 5 = 2) = 2 s.
const film = [{ lines: ["abcdefghij"] }, { lines: ["abcde", "abcdefghij"] }];

test("each chapter opens with its card, then its lines one after another", () => {
	const p = plan(film, pace);
	assert.deepEqual(p.cues[0], { chapter: 0, text: "abcdefghij", start: 500, typed: 1500, end: 2500 });
	assert.deepEqual(p.chapters[0], { start: 0, end: 2600 });
	assert.equal(p.cues[1].start, 2600 + 500);
	assert.equal(p.chapters[1].start, 2600);
	assert.equal(p.total, p.chapters[1].end);
});

test("a short line stays long enough to read", () => {
	// "abcde": typed in 0.5 s, + 1 s hold = 1.5 s, but reading it takes 5 / 5 = 1 s: 1.5 s wins.
	const cue = plan(film, pace).cues[1];
	assert.equal(cue.end - cue.start, 1500);
	// reading at 2 characters a second: 2.5 s beats typing + hold
	const slow = plan(film, { ...pace, read: 2 }).cues[1];
	assert.equal(slow.end - slow.start, 2500);
});

test("the card shows no line; a line writes itself, then stays whole", () => {
	const p = plan(film, pace);
	assert.deepEqual(frameAt(p, 200), { chapter: 0, progress: 200 / 2600, cue: -1, chars: 0, done: false });
	assert.equal(frameAt(p, 1000).chars, 5);
	assert.equal(frameAt(p, 1500).chars, 10);
	assert.equal(frameAt(p, 2400).chars, 10);
	assert.equal(frameAt(p, 2550).cue, -1); // the gap between lines
	assert.equal(frameAt(p, 3100).chapter, 1);
	assert.equal(frameAt(p, 3100).cue, 1);
});

test("without typing (reduced motion) a line appears whole", () => {
	const p = plan(film, { ...pace, cps: Infinity });
	assert.equal(frameAt(p, 500).chars, 10);
	assert.equal(p.cues[0].typed, p.cues[0].start);
});

test("at the end it says so, and never before", () => {
	const p = plan(film, pace);
	assert.equal(frameAt(p, p.total - 1).done, false);
	assert.deepEqual(frameAt(p, p.total), { chapter: 1, progress: 1, cue: -1, chars: 0, done: true });
	assert.equal(frameAt(p, -50).chapter, 0); // before the start: the start
});

test("a chapter's pictures share its time", () => {
	assert.deepEqual(shotAt(0, 2), { index: 0, progress: 0 });
	assert.deepEqual(shotAt(0.25, 2), { index: 0, progress: 0.5 });
	assert.deepEqual(shotAt(0.5, 2), { index: 1, progress: 0 });
	assert.deepEqual(shotAt(1, 2), { index: 1, progress: 1 });
	assert.deepEqual(shotAt(0.7, 1), { index: 0, progress: 0.7 });
});

test("the running time reads as minutes and seconds", () => {
	assert.equal(clock(43_000), "0:43");
	assert.equal(clock(61_400), "1:01");
	assert.equal(clock(9_600), "0:10");
});
