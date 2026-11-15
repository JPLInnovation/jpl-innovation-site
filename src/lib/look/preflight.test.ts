import { test } from "node:test";
import assert from "node:assert/strict";
import { altitudeAt, bootLine, BOOT_LINES, CLIMB, drumsAt, PROMPT_AT } from "./preflight.ts";

test("the altitude starts at 0 m and ends at 120 m", () => {
	assert.equal(altitudeAt(0), 0);
	assert.equal(altitudeAt(-1), 0);
	assert.equal(altitudeAt(CLIMB.end), 120);
	assert.equal(altitudeAt(60), 120);
});

test("the altitude is in whole metres, never falls and never overshoots", () => {
	let last = 0;
	for (let t = 0; t <= 4; t += 0.01) {
		const a = altitudeAt(t);
		assert.ok(Number.isInteger(a), `t=${t}: ${a}`);
		assert.ok(a >= last, `t=${t}: ${a} < ${last}`);
		assert.ok(a <= 120, `t=${t}: ${a}`);
		last = a;
	}
});

test("it eases: slow off the ground, fast in the middle, slow into cruise", () => {
	const span = CLIMB.end - CLIMB.start;
	const at = (k: number) => altitudeAt(CLIMB.start + span * k);
	const first = at(0.1) - at(0);
	const middle = at(0.55) - at(0.45);
	const last = at(1) - at(0.9);
	assert.ok(middle > first * 2, `middle ${middle} vs first ${first}`);
	assert.ok(middle > last * 2, `middle ${middle} vs last ${last}`);
});

test("the boot log shows its lines one by one, all of them by the prompt", () => {
	assert.equal(bootLine(0), 0);
	assert.equal(bootLine(PROMPT_AT), BOOT_LINES);
	assert.equal(bootLine(60), BOOT_LINES);
	let last = 0;
	for (let t = 0; t <= PROMPT_AT; t += 0.01) {
		const n = bootLine(t);
		assert.ok(n >= last && n - last <= 1, `t=${t}: ${last} -> ${n}`);
		last = n;
	}
});

test("the counter's drums: 000 at the start, 120 at cruise", () => {
	assert.deepEqual(drumsAt(0), [0, 0, 0]);
	assert.deepEqual(drumsAt(120), [1, 2, 0]);
	assert.deepEqual(drumsAt(45), [0, 4, 5]);
});

test("a higher drum turns only while the one below rolls from 9 to 0", () => {
	const near = (a: number[], b: number[]) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
	assert.ok(near(drumsAt(14.5), [0, 1, 4.5]), `${drumsAt(14.5)}`);
	assert.ok(near(drumsAt(19.5), [0, 1.5, 9.5]), `${drumsAt(19.5)}`);
	assert.ok(near(drumsAt(99.5), [0.5, 9.5, 9.5]), `${drumsAt(99.5)}`);
});

test("the take-off prompt comes in under 4 s, after the climb and the log are done", () => {
	assert.ok(PROMPT_AT < 4);
	assert.ok(CLIMB.end <= PROMPT_AT);
	assert.equal(altitudeAt(PROMPT_AT), 120);
});
