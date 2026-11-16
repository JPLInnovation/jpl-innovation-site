import { test } from "node:test";
import assert from "node:assert/strict";
import { scramble } from "./decode.ts";

const zero = () => 0; // always the first glyph of the set
const text = "F450 4G Drone";

test("at the end it is the words themselves", () => {
	assert.equal(scramble(text, 1, zero), text);
	assert.equal(scramble(text, 1.4, zero), text);
});

test("at the start nothing is decoded, but the spaces and the length stay", () => {
	const s = scramble(text, 0, zero);
	assert.equal(s.length, text.length);
	assert.deepEqual([...s].map((c, i) => (c === " ") === (text[i] === " ")), [...text].map(() => true));
	assert.ok([...s].every((c, i) => c === " " || c !== text[i]));
});

test("it decodes from left to right", () => {
	const half = scramble(text, 0.5, zero);
	assert.equal(half.slice(0, 6), text.slice(0, 6));
	assert.notEqual(half.slice(-4), text.slice(-4));
});

test("punctuation and spaces are never scrambled", () => {
	assert.equal(scramble("a, b.", 0, zero)[1], ",");
	assert.equal(scramble("a, b.", 0, zero)[2], " ");
	assert.equal(scramble("a, b.", 0, zero)[4], ".");
});
