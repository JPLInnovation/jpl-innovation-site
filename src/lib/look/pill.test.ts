import { test } from "node:test";
import assert from "node:assert/strict";
import { pillAt } from "./pill.ts";

const work = { x: 0, w: 80 };
const about = { x: 200, w: 60 };
const edges = (p: { x: number; w: number }) => [p.x, p.x + p.w];

test("at the start it is where it was, at the end where it goes", () => {
	assert.deepEqual(pillAt(work, about, 0), work);
	assert.deepEqual(pillAt(work, about, 1), about);
});
test("halfway, it stretches like a drop over both links (moving right)", () => {
	assert.deepEqual(edges(pillAt(work, about, 0.5)), [0, 260]);
});
test("halfway, it stretches over both links (moving left)", () => {
	assert.deepEqual(edges(pillAt(about, work, 0.5)), [0, 260]);
});
test("it never gets thinner than the smaller link", () => {
	for (let i = 0; i <= 10; i++) {
		assert.ok(pillAt(work, about, i / 10).w >= 60, `t=${i / 10}`);
		assert.ok(pillAt(about, work, i / 10).w >= 60, `back t=${i / 10}`);
	}
});
