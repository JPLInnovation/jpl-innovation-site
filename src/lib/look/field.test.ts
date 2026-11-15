import { test } from "node:test";
import assert from "node:assert/strict";
import { cameraFor, nextScale, shouldAnimate, shouldFallBack } from "./field.ts";

test("slow frames lower the resolution, never below half", () => {
	assert.ok(nextScale(1, 20) < 1);
	assert.equal(nextScale(0.5, 40), 0.5);
});
test("fast frames raise it again, never above full", () => {
	assert.ok(nextScale(0.8, 5) > 0.8);
	assert.equal(nextScale(1, 5), 1);
});
test("in-between frames leave it alone", () => assert.equal(nextScale(0.8, 9), 0.8));
test("three slow windows at the lowest resolution fall back to the still", () => {
	assert.equal(shouldFallBack(2), false);
	assert.equal(shouldFallBack(3), true);
});
test("the field draws only when visible, allowed to move, and not under a page's own 3D", () => {
	assert.equal(shouldAnimate({ hidden: false, reduced: false, ownBackdrop: false }), true);
	assert.equal(shouldAnimate({ hidden: true, reduced: false, ownBackdrop: false }), false);
	assert.equal(shouldAnimate({ hidden: false, reduced: true, ownBackdrop: false }), false);
	assert.equal(shouldAnimate({ hidden: false, reduced: false, ownBackdrop: true }), false);
});
test("scrolling flies the camera: forward, rising, turning, tilting down onto the drawing; the pointer leans it", () => {
	const still = { x: 0, y: 0 };
	const a = cameraFor(0, still);
	const b = cameraFor(1, still);
	assert.equal(a.drift, 0);
	assert.ok(cameraFor(1, still).drift > cameraFor(0.5, still).drift);
	assert.ok(Math.abs(a.height - 1.6) < 1e-9 && Math.abs(b.height - 4.2) < 1e-9, "rises from 1.6 to 4.2");
	assert.ok(Math.abs(a.pitch - 0.18) < 1e-9 && Math.abs(b.pitch - 0.62) < 1e-9, "tilts from 0.18 to 0.62");
	assert.ok(Math.abs(a.yaw + 0.22) < 1e-9 && Math.abs(b.yaw - 0.3) < 1e-9, "turns from -0.22 to 0.3");
	assert.ok(Math.abs(cameraFor(0.5, { x: 1, y: 0 }).lean[0] - 0.04) < 1e-9);
});

import { newMeter, resetMeter, tickMeter } from "./field.ts";

/** Drives a meter through `seconds` of steady frames `ms` apart, active (scrolling) or idle; returns what it said. */
function run(meter: ReturnType<typeof newMeter>, start: number, ms: number, seconds: number, active = true) {
	const said = new Set<string>();
	let t = start;
	for (; t < start + seconds * 1000; t += ms) said.add(tickMeter(meter, t, active));
	return { said, end: t };
}

test("the first frame after waking is not measured (a short first gap must not set the screen's rate)", () => {
	const m = newMeter();
	resetMeter(m);
	tickMeter(m, 1000, true); // wake
	const { said } = run(m, 1000.4, 16.67, 8); // the first gap is 0.4 ms, then a steady 60 Hz
	assert.ok(!said.has("fallback"));
	assert.equal(m.scale, 1);
});
test("a steady 240 Hz screen stays at full resolution", () => {
	const m = newMeter();
	resetMeter(m);
	run(m, 0, 4.17, 6);
	assert.equal(m.scale, 1);
});
test("the refresh rate dropping (240 to 60 Hz) never falls back and recovers full resolution", () => {
	const m = newMeter();
	resetMeter(m);
	const a = run(m, 0, 4.17, 3);
	const b = run(m, a.end, 16.67, 12);
	assert.ok(!b.said.has("fallback"));
	assert.equal(m.scale, 1);
});
test("a device under 25 fps steps down and then falls back to the still", () => {
	const m = newMeter();
	resetMeter(m);
	const { said } = run(m, 0, 80, 12);
	assert.ok(said.has("fallback"));
});
test("a device far under 10 fps falls back too (long frames are counted, not dropped)", () => {
	const m = newMeter();
	resetMeter(m);
	const { said } = run(m, 0, 200, 20);
	assert.ok(said.has("fallback"));
});
test("idle frames (30 fps on purpose) say nothing about cost", () => {
	const m = newMeter();
	resetMeter(m);
	const { said } = run(m, 0, 33.3, 10, false);
	assert.ok(!said.has("rescale") && !said.has("fallback"));
	assert.equal(m.scale, 1);
});
