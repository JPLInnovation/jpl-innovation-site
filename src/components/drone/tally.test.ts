import { test } from "node:test";
import assert from "node:assert/strict";
import { tally } from "./tally.ts";

const groups = [
	{ id: "a", parts: [{ price: 180_000 }, { price: 142_000 }, {}] },
	{ id: "b", parts: [{ price: 360_000 }, {}] },
	{ id: "c", parts: [{ price: 1 }] },
];

test("each subtotal is the sum of its priced rows, the total the sum of the subtotals", () => {
	const t = tally(groups);
	assert.deepEqual(
		t.groups.map((g) => g.subtotal),
		[322_000, 360_000, 1],
	);
	assert.equal(t.total, 682_001);
	assert.equal(t.total, t.groups.reduce((s, g) => s + g.subtotal, 0));
});

test("counts every row, priced or not, and keeps each group's own fields", () => {
	const t = tally(groups);
	assert.equal(t.count, 6);
	assert.deepEqual(
		t.groups.map((g) => [g.id, g.count, g.unpriced]),
		[
			["a", 3, 1],
			["b", 2, 1],
			["c", 1, 0],
		],
	);
	assert.equal(t.priced, true);
});

test("the shares are whole percents that add up to exactly 100", () => {
	const t = tally([{ parts: [{ price: 1 }] }, { parts: [{ price: 1 }] }, { parts: [{ price: 1 }] }]);
	assert.deepEqual(t.groups.map((g) => g.share), [34, 33, 33]);
	const big = tally(groups);
	assert.equal(big.groups.reduce((s, g) => s + g.share, 0), 100);
});

test("a list with no prices has no total to share out", () => {
	const t = tally([{ parts: [{}, {}] }, { parts: [{}] }]);
	assert.equal(t.total, 0);
	assert.equal(t.priced, false);
	assert.deepEqual(t.groups.map((g) => g.share), [0, 0]);
	assert.equal(t.count, 3);
});
