import { test } from "node:test";
import assert from "node:assert/strict";
import { CEILING, FUEL, GRAVITY, SOFT, THRUST, landed, start, step } from "./landing.ts";

const fly = (s: ReturnType<typeof start>, throttle: boolean, seconds: number, dt = 1 / 120) => {
	for (let t = 0; t < seconds - 1e-9; t += dt) s = step(s, throttle, dt);
	return s;
};

test("it starts at the ceiling, still, with a full tank", () => {
	assert.deepEqual(start(), { y: CEILING, vy: 0, fuel: FUEL });
});

test("gravity pulls it down", () => {
	const s = fly(start(), false, 1);
	assert.ok(s.vy < 0 && s.y < CEILING, JSON.stringify(s));
	assert.ok(Math.abs(s.vy + GRAVITY) < 1e-6, `vy after 1 s is -g (${s.vy})`);
});

test("throttle lifts: thrust beats gravity", () => {
	assert.ok(THRUST > GRAVITY);
	const s = fly({ y: 10, vy: -3, fuel: FUEL }, true, 1);
	assert.ok(Math.abs(s.vy - (-3 + THRUST - GRAVITY)) < 1e-6, `vy ${s.vy}`);
});

test("no fuel, no lift", () => {
	const empty = { y: 10, vy: -1, fuel: 0 };
	assert.deepEqual(step(empty, true, 0.1), step(empty, false, 0.1));
});

test("throttle burns fuel, coasting does not, and the tank lasts 6 s of throttle", () => {
	assert.equal(fly(start(), false, 1).fuel, FUEL);
	assert.ok(Math.abs(fly({ y: 10, vy: 0, fuel: FUEL }, true, 1).fuel - (FUEL - 1)) < 1e-6);
	assert.equal(FUEL, 6);
	const dry = fly({ y: 10, vy: 0, fuel: FUEL }, true, 7);
	assert.equal(dry.fuel, 0);
});

test("it never climbs above the ceiling", () => {
	const s = fly(start(), true, 2);
	assert.equal(s.y, CEILING);
	assert.ok(s.vy <= 0);
});

test("landed: nothing while above the pad, soft under 1.5 m/s, hard otherwise", () => {
	const pad = { y: 0 };
	assert.equal(landed({ y: 0.2, vy: -9, fuel: 1 }, pad), null);
	assert.equal(landed({ y: 0, vy: -1.2, fuel: 1 }, pad), "soft");
	assert.equal(landed({ y: -0.01, vy: -SOFT, fuel: 1 }, pad), "hard");
	assert.equal(landed({ y: -0.3, vy: -6, fuel: 0 }, pad), "hard");
	assert.equal(landed({ y: 2, vy: 0, fuel: 1 }, { y: 2 }), "soft");
});

test("a dropped drone lands hard; a well-flown one can land soft", () => {
	const pad = { y: 0 };
	let s = start();
	while (!landed(s, pad)) s = step(s, false, 1 / 120);
	assert.equal(landed(s, pad), "hard");
	// fall, then brake once the stopping distance reaches the height: the tank is enough for a soft landing, with spare
	s = start();
	let t = 0;
	while (!landed(s, pad)) {
		const stopping = (s.vy * s.vy) / (2 * (THRUST - GRAVITY));
		s = step(s, s.vy < -0.5 && stopping >= s.y - 0.3, 1 / 120);
		t += 1 / 120;
		assert.ok(t < 60, "lands within a minute");
	}
	assert.equal(landed(s, pad), "soft", JSON.stringify(s));
});
