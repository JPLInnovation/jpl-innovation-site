import { test } from "node:test";
import assert from "node:assert/strict";
import { dayAt, fieldFor, revealAt, tileLayout } from "./drawing.ts";

test("the floor drawing is drawn between its scroll window's start and end, never backwards", () => {
	assert.equal(revealAt(0, { start: 0.05, end: 0.8 }), 0);
	assert.equal(revealAt(0.05, { start: 0.05, end: 0.8 }), 0);
	assert.equal(revealAt(0.8, { start: 0.05, end: 0.8 }), 1);
	assert.equal(revealAt(1, { start: 0.05, end: 0.8 }), 1);
	let last = -1;
	for (let s = 0; s <= 1; s += 0.01) {
		const r = revealAt(s, { start: 0.05, end: 0.8 });
		assert.ok(r >= last, `monotonic at ${s}`);
		last = r;
	}
	assert.ok(revealAt(0.1, { start: 0.05, end: 0.8 }) < 0.1, "eased in: slow at the start");
});
test("the section under the middle of the screen decides day or night", () => {
	const sections = [
		{ top: 0, bottom: 800, day: false },
		{ top: 800, bottom: 1600, day: true },
	];
	assert.equal(dayAt(sections, 400), false);
	assert.equal(dayAt(sections, 1200), true);
	assert.equal(dayAt(sections, 2000), false, "outside every section: night (the theme decides)");
	assert.equal(dayAt([], 100), false);
});
test("tiles float clear of the middle third (where text is) and never overlap", () => {
	const tiles = tileLayout(18, 7);
	assert.equal(tiles.length, 18);
	for (const t of tiles) assert.ok(Math.abs(t.x) >= 0.45, `x ${t.x} in the middle third`);
	for (let i = 0; i < tiles.length; i++)
		for (let j = i + 1; j < tiles.length; j++) {
			const a = tiles[i];
			const b = tiles[j];
			assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= (a.size + b.size) * 0.9, `tiles ${i} and ${j} overlap`);
		}
	assert.deepEqual(tileLayout(18, 7), tiles, "the same seed gives the same layout");
});
test("each page draws its own subject on the floor; pages with none get the badge", () => {
	assert.deepEqual(fieldFor("/"), { drawing: "f450", parts: "all" });
	assert.deepEqual(fieldFor("/work/drone/"), { drawing: "f450", parts: "drone" });
	assert.deepEqual(fieldFor("/work/mini-drone"), { drawing: "mini", parts: "drone" });
	assert.deepEqual(fieldFor("/work/cybersecurity/"), { drawing: "network", parts: "none" });
	assert.deepEqual(fieldFor("/work/frc/"), { drawing: "badge", parts: "robot" });
	assert.deepEqual(fieldFor("/about/"), { drawing: "badge", parts: "all" });
	assert.deepEqual(fieldFor("/members/khoa/"), { drawing: "badge", parts: "all" });
});
