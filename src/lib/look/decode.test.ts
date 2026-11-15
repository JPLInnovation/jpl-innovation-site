import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeFrame, GLYPHS } from "./decode.ts";

const text = "Every robot, drone and web app.";

test("at the end the line is its words", () => {
	assert.equal(decodeFrame(text, 1), text);
});

test("at the start every letter is noise; spaces and punctuation keep the shape", () => {
	const frame = [...decodeFrame(text, 0, () => 0.5)];
	assert.equal(frame.length, [...text].length);
	[...text].forEach((ch, i) => {
		if (/[\p{L}\p{N}]/u.test(ch)) assert.ok(GLYPHS.includes(frame[i]), `${i}: ${frame[i]}`);
		else assert.equal(frame[i], ch);
	});
});

test("letters lock left to right and never unlock", () => {
	let locked = 0;
	for (let t = 0; t <= 1.0001; t += 0.05) {
		const frame = decodeFrame("ABCDEFGH", t, () => 0.999); // noise is always ">", never a real letter
		const now = [...frame].findIndex((ch, i) => ch !== "ABCDEFGH"[i]);
		const count = now === -1 ? 8 : now;
		assert.ok(count >= locked, `t=${t.toFixed(2)}: ${frame}`);
		assert.ok(frame.slice(count).split("").every((ch) => ch === ">"), `only a prefix is locked at t=${t.toFixed(2)}: ${frame}`);
		locked = count;
	}
	assert.equal(locked, 8);
});

test("Vietnamese letters stay whole", () => {
	assert.equal(decodeFrame("Xin chào", 1), "Xin chào");
	assert.equal([...decodeFrame("Xin chào", 0)].length, 8);
});
