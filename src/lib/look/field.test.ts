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
test("scrolling moves forward over the floor; the pointer leans the view", () => {
	const still = { x: 0, y: 0 };
	assert.equal(cameraFor(0, still).drift, 0);
	assert.ok(cameraFor(1, still).drift > cameraFor(0.5, still).drift);
	assert.ok(Math.abs(cameraFor(0.5, { x: 1, y: 0 }).lean[0] - 0.04) < 1e-9);
	assert.ok(Math.abs(cameraFor(0, still).pitch - 0.18) < 1e-9);
	assert.ok(Math.abs(cameraFor(1, still).pitch - 0.32) < 1e-9);
});
