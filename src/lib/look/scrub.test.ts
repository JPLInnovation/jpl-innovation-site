import { test } from "node:test";
import assert from "node:assert/strict";
import { nearestStage, scrubKey, scrubLayers, scrubStage } from "./scrub.ts";

test("the ends are the sketch and the built drone", () => {
	assert.deepEqual(scrubStage(0), { stage: 0, mix: 0 });
	assert.deepEqual(scrubStage(1), { stage: 2, mix: 0 });
});
test("the middle is the CAD render, and halfway between is half mixed", () => {
	assert.deepEqual(scrubStage(0.5), { stage: 1, mix: 0 });
	assert.deepEqual(scrubStage(0.25), { stage: 0, mix: 0.5 });
	assert.deepEqual(scrubStage(0.75), { stage: 1, mix: 0.5 });
});
test("out of range and junk are clamped", () => {
	assert.deepEqual(scrubStage(-3), { stage: 0, mix: 0 });
	assert.deepEqual(scrubStage(7), { stage: 2, mix: 0 });
	assert.deepEqual(scrubStage(Number.NaN), { stage: 0, mix: 0 });
});
test("the stage read aloud is the one mostly showing", () => {
	assert.equal(nearestStage(0), 0);
	assert.equal(nearestStage(0.24), 0);
	assert.equal(nearestStage(0.26), 1);
	assert.equal(nearestStage(0.74), 1);
	assert.equal(nearestStage(0.76), 2);
	assert.equal(nearestStage(5), 2);
});
test("arrow keys step, Page keys jump a stage, Home and End go to the ends", () => {
	assert.equal(scrubKey(0, "ArrowRight"), 0.05);
	assert.equal(scrubKey(0, "ArrowUp"), 0.05);
	assert.equal(scrubKey(0, "ArrowLeft"), 0);
	assert.equal(scrubKey(1, "ArrowRight"), 1);
	assert.equal(scrubKey(0.5, "ArrowDown"), 0.45);
	assert.equal(scrubKey(0.1, "PageUp"), 0.5);
	assert.equal(scrubKey(0.5, "PageUp"), 1);
	assert.equal(scrubKey(0.6, "PageDown"), 0.5);
	assert.equal(scrubKey(0.5, "PageDown"), 0);
	assert.equal(scrubKey(0.3, "Home"), 0);
	assert.equal(scrubKey(0.3, "End"), 1);
	assert.equal(scrubKey(0.3, "a"), null);
});
test("one picture shows at each stop, two only while passing between them", () => {
	const shown = (t: number) => scrubLayers(t).map((l) => l.opacity);
	assert.deepEqual(shown(0), [1, 0, 0]);
	assert.deepEqual(shown(0.5), [0, 1, 0]);
	assert.deepEqual(shown(1), [0, 0, 1]);
	const mid = shown(0.25);
	assert.ok(mid[0] > 0 && mid[1] > 0 && mid[2] === 0);
});
test("the sketch lies back as the CAD rises out of it; nothing is tilted at rest", () => {
	assert.equal(scrubLayers(0)[0].tilt, 0);
	assert.ok(scrubLayers(0.4)[0].tilt > scrubLayers(0.1)[0].tilt);
	assert.ok(scrubLayers(0.1)[1].lift > scrubLayers(0.4)[1].lift);
	assert.equal(scrubLayers(0.5)[1].lift, 0);
	assert.equal(scrubLayers(1)[2].dark, 0);
	assert.ok(scrubLayers(0.6)[2].dark > 0.5);
});
