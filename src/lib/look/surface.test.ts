import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseSurface, lensSupported, rimFromPointer } from "./surface.ts";

test("a stored choice wins", () => {
	assert.equal(chooseSurface({ stored: "solid", reducedMotion: false }), "solid");
	assert.equal(chooseSurface({ stored: "glass", reducedMotion: true }), "glass");
});
test("with no choice, reduced motion, save-data and small memory get solid", () => {
	assert.equal(chooseSurface({ stored: null, reducedMotion: true }), "solid");
	assert.equal(chooseSurface({ stored: null, reducedMotion: false, deviceMemory: 4 }), "solid");
	assert.equal(chooseSurface({ stored: null, reducedMotion: false, saveData: true }), "solid");
});
test("with no choice on a capable device, glass", () => {
	assert.equal(chooseSurface({ stored: null, reducedMotion: false, deviceMemory: 8 }), "glass");
	assert.equal(chooseSurface({ stored: "junk", reducedMotion: false }), "glass");
});
test("the lens only where backdrop-filter takes an SVG filter", () => {
	const chrome = ["Chromium", "Google Chrome"];
	assert.equal(lensSupported(() => true, chrome), true);
	assert.equal(lensSupported(() => false, chrome), false);
	assert.equal(lensSupported((prop, value) => prop === "backdrop-filter" && value.startsWith("url("), chrome), true);
});
test("the rim faces the pointer", () => {
	const box = { left: 0, top: 0, width: 100, height: 100 };
	const right = rimFromPointer(box, 200, 50);
	assert.equal(right.angle, 0);
	assert.ok(right.strength > 0 && right.strength < 1);
	assert.equal(rimFromPointer(box, 50, 150).angle, 90);
	assert.equal(rimFromPointer(box, 50, 50).strength, 1);
	assert.equal(rimFromPointer(box, 1000, 50).strength, 0);
});

test("the lens needs Chromium, not just the syntax (Firefox and Safari accept url() but do not draw it)", () => {
	assert.equal(lensSupported(() => true, ["Chromium", "Google Chrome"]), true);
	assert.equal(lensSupported(() => true, undefined), false);
	assert.equal(lensSupported(() => true, ["Not A Brand"]), false);
	assert.equal(lensSupported(() => false, ["Chromium"]), false);
});
